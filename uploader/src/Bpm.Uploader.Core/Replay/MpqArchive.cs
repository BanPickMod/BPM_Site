using System.Buffers.Binary;
using System.IO.Compression;
using ICSharpCode.SharpZipLib.BZip2;

namespace Bpm.Uploader.Core.Replay;

/// <summary>
/// Minimal read-only MPQ reader, enough for StarCraft II replays: finds a named file and returns its bytes.
/// Supports sector-compressed (zlib, bzip2) and single-unit files. Encrypted or imploded files are not supported
/// (replays do not use them). Format reference: the public MPQ file format description (StormLib / mpyq).
/// </summary>
public sealed class MpqArchive
{
    private const uint FlagCompressed = 0x00000200;
    private const uint FlagEncrypted = 0x00010000;
    private const uint FlagSingleUnit = 0x01000000;
    private const uint FlagSectorCrc = 0x04000000;
    private const uint FlagImplode = 0x00000100;
    private const uint FlagExists = 0x80000000;

    internal static readonly uint[] Crypt = BuildCryptTable();

    private readonly byte[] _data;
    private readonly int _base;          // offset of the archive header inside the file
    private readonly int _sectorSize;
    private readonly HashEntry[] _hash;
    private readonly BlockEntry[] _block;

    private readonly record struct HashEntry(uint A, uint B, uint BlockIndex);
    private readonly record struct BlockEntry(uint Offset, uint Packed, uint Size, uint Flags);

    private MpqArchive(byte[] data, int @base, int sectorSize, HashEntry[] hash, BlockEntry[] block)
    {
        _data = data;
        _base = @base;
        _sectorSize = sectorSize;
        _hash = hash;
        _block = block;
    }

    public static MpqArchive Open(byte[] data)
    {
        if (data.Length < 32) throw new InvalidDataException("file too small for MPQ");
        var pos = 0;
        var sig = BinaryPrimitives.ReadUInt32LittleEndian(data);
        // 'MPQ\x1B' = user data header (replays); the real header follows at the offset it names.
        if (sig == 0x1B51504D) pos = checked((int)BinaryPrimitives.ReadUInt32LittleEndian(data.AsSpan(8)));
        else if (sig != 0x1A51504D) throw new InvalidDataException("not an MPQ archive");
        if (pos < 0 || pos + 32 > data.Length || BinaryPrimitives.ReadUInt32LittleEndian(data.AsSpan(pos)) != 0x1A51504D)
            throw new InvalidDataException("MPQ header not found");

        var h = data.AsSpan(pos);
        var shift = BinaryPrimitives.ReadUInt16LittleEndian(h[14..]);
        var hashPos = BinaryPrimitives.ReadUInt32LittleEndian(h[16..]);
        var blockPos = BinaryPrimitives.ReadUInt32LittleEndian(h[20..]);
        var hashCount = BinaryPrimitives.ReadUInt32LittleEndian(h[24..]);
        var blockCount = BinaryPrimitives.ReadUInt32LittleEndian(h[28..]);
        if (hashCount == 0 || (hashCount & (hashCount - 1)) != 0) throw new InvalidDataException("bad MPQ hash table size");
        if (shift > 20) throw new InvalidDataException("bad MPQ sector size");

        var hashBytes = Decrypt(Slice(data, pos + (long)hashPos, hashCount * 16L), HashString("(hash table)", 3));
        var blockBytes = Decrypt(Slice(data, pos + (long)blockPos, blockCount * 16L), HashString("(block table)", 3));

        var hash = new HashEntry[hashCount];
        for (var i = 0; i < hashCount; i++)
        {
            var e = hashBytes.AsSpan(i * 16);
            hash[i] = new HashEntry(BinaryPrimitives.ReadUInt32LittleEndian(e), BinaryPrimitives.ReadUInt32LittleEndian(e[4..]),
                BinaryPrimitives.ReadUInt32LittleEndian(e[12..]));
        }
        var block = new BlockEntry[blockCount];
        for (var i = 0; i < blockCount; i++)
        {
            var e = blockBytes.AsSpan(i * 16);
            block[i] = new BlockEntry(BinaryPrimitives.ReadUInt32LittleEndian(e), BinaryPrimitives.ReadUInt32LittleEndian(e[4..]),
                BinaryPrimitives.ReadUInt32LittleEndian(e[8..]), BinaryPrimitives.ReadUInt32LittleEndian(e[12..]));
        }
        return new MpqArchive(data, pos, 512 << shift, hash, block);
    }

    /// <summary>Returns the file's bytes, or null if the archive does not contain it.</summary>
    public byte[]? ReadFile(string name)
    {
        var a = HashString(name, 1);
        var b = HashString(name, 2);
        var mask = (uint)_hash.Length - 1;
        var start = HashString(name, 0) & mask;
        for (var n = 0; n < _hash.Length; n++)
        {
            var e = _hash[(start + n) & mask];
            if (e.BlockIndex == 0xFFFFFFFF) return null;           // empty slot ends the probe chain
            if (e.A == a && e.B == b && e.BlockIndex < _block.Length) return Extract(_block[e.BlockIndex]);
        }
        return null;
    }

    private byte[] Extract(BlockEntry blk)
    {
        if ((blk.Flags & FlagExists) == 0) throw new InvalidDataException("file entry is deleted");
        if ((blk.Flags & (FlagEncrypted | FlagImplode)) != 0) throw new NotSupportedException("encrypted/imploded MPQ files are not supported");
        if (blk.Size > 64 * 1024 * 1024) throw new InvalidDataException("file too large");
        var fileStart = _base + (long)blk.Offset;
        var compressed = (blk.Flags & FlagCompressed) != 0;

        if ((blk.Flags & FlagSingleUnit) != 0)
        {
            var raw = Slice(_data, fileStart, blk.Packed);
            return compressed && blk.Packed < blk.Size ? Decompress(raw, (int)blk.Size) : raw;
        }

        var sectors = (int)((blk.Size + _sectorSize - 1) / _sectorSize);
        var tableLen = (sectors + 1 + ((blk.Flags & FlagSectorCrc) != 0 ? 1 : 0)) * 4L;
        var offsets = new uint[sectors + 1];
        var table = Slice(_data, fileStart, tableLen);
        if (!compressed)
        {
            // Stored sector by sector without an offset table.
            var plain = Slice(_data, fileStart, blk.Size);
            return plain;
        }
        for (var i = 0; i <= sectors; i++) offsets[i] = BinaryPrimitives.ReadUInt32LittleEndian(table.AsSpan(i * 4));

        var result = new byte[blk.Size];
        var written = 0;
        for (var i = 0; i < sectors; i++)
        {
            var expected = (int)Math.Min(_sectorSize, blk.Size - (long)i * _sectorSize);
            if (offsets[i + 1] < offsets[i]) throw new InvalidDataException("bad sector offsets");
            var chunk = Slice(_data, fileStart + offsets[i], offsets[i + 1] - offsets[i]);
            var plain = chunk.Length < expected ? Decompress(chunk, expected) : chunk;
            if (plain.Length != expected) throw new InvalidDataException("sector size mismatch");
            Buffer.BlockCopy(plain, 0, result, written, expected);
            written += expected;
        }
        return result;
    }

    private static byte[] Decompress(byte[] input, int expected)
    {
        if (input.Length == 0) throw new InvalidDataException("empty compressed block");
        var mask = input[0];
        var body = input.AsMemory(1);
        using var src = new MemoryStream(body.ToArray());
        using var dst = new MemoryStream(expected);
        try
        {
            switch (mask)
            {
                case 0x02:
                    using (var z = new ZLibStream(src, CompressionMode.Decompress)) z.CopyTo(dst);
                    break;
                case 0x10:
                    BZip2.Decompress(src, dst, isStreamOwner: false);
                    break;
                default:
                    throw new NotSupportedException($"MPQ compression 0x{mask:X2} is not supported");
            }
        }
        catch (Exception e) when (e is not (NotSupportedException or InvalidDataException))
        {
            // Codecs report corrupt input in many ways (SharpZipLib even leaks IndexOutOfRangeException).
            // Bad data is a data error, whatever the codec calls it.
            throw new InvalidDataException("corrupt compressed block: " + e.Message, e);
        }
        return dst.ToArray();
    }

    private static byte[] Slice(byte[] data, long offset, long length)
    {
        if (offset < 0 || length < 0 || offset + length > data.Length) throw new InvalidDataException("MPQ range outside file");
        var r = new byte[length];
        Buffer.BlockCopy(data, (int)offset, r, 0, (int)length);
        return r;
    }

    // ---- MPQ hashing / table encryption ------------------------------------------------------------

    private static uint[] BuildCryptTable()
    {
        var t = new uint[0x500];
        uint seed = 0x00100001;
        for (var i1 = 0; i1 < 0x100; i1++)
        {
            var i2 = i1;
            for (var k = 0; k < 5; k++, i2 += 0x100)
            {
                seed = (seed * 125 + 3) % 0x2AAAAB;
                var t1 = (seed & 0xFFFF) << 16;
                seed = (seed * 125 + 3) % 0x2AAAAB;
                t[i2] = t1 | (seed & 0xFFFF);
            }
        }
        return t;
    }

    internal static uint HashString(string s, int type)
    {
        uint s1 = 0x7FED7FED, s2 = 0xEEEEEEEE;
        foreach (var c in s)
        {
            var ch = (uint)char.ToUpperInvariant(c);
            s1 = Crypt[(type << 8) + ch] ^ (s1 + s2);
            s2 = ch + s1 + s2 + (s2 << 5) + 3;
        }
        return s1;
    }

    private static byte[] Decrypt(byte[] data, uint key)
    {
        uint seed = 0xEEEEEEEE;
        var words = data.Length / 4;
        for (var i = 0; i < words; i++)
        {
            seed += Crypt[0x400 + (key & 0xFF)];
            var v = BinaryPrimitives.ReadUInt32LittleEndian(data.AsSpan(i * 4)) ^ (key + seed);
            key = ((~key << 21) + 0x11111111) | (key >> 11);
            seed = v + seed + (seed << 5) + 3;
            BinaryPrimitives.WriteUInt32LittleEndian(data.AsSpan(i * 4), v);
        }
        return data;
    }
}
