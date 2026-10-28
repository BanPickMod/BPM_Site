using System.Buffers.Binary;
using System.IO.Compression;
using System.Text;
using Bpm.Uploader.Core.Replay;

namespace Bpm.Uploader.Tests;

/// <summary>Builds tiny but valid MPQ archives for tests, so "not a BPM game" and edge cases need no real replays.</summary>
internal static class TestMpq
{
    public static byte[] Build(string fileName, byte[] content, bool zlib = false, bool userDataHeader = false)
    {
        byte[] stored = content;
        uint flags = 0x80000000 | 0x01000000; // exists | single unit
        if (zlib)
        {
            using var ms = new MemoryStream();
            ms.WriteByte(0x02);
            using (var z = new ZLibStream(ms, CompressionLevel.Optimal, leaveOpen: true)) z.Write(content);
            // Like a real MPQ writer: keep the compressed form only when it is smaller, otherwise store the data as is.
            if (ms.Length < content.Length)
            {
                stored = ms.ToArray();
                flags |= 0x200;
            }
        }

        const int HashCount = 16;
        var hash = new byte[HashCount * 16];
        Array.Fill(hash, (byte)0xFF);
        var slot = (int)(MpqArchive.HashString(fileName, 0) & (HashCount - 1));
        BinaryPrimitives.WriteUInt32LittleEndian(hash.AsSpan(slot * 16), MpqArchive.HashString(fileName, 1));
        BinaryPrimitives.WriteUInt32LittleEndian(hash.AsSpan(slot * 16 + 4), MpqArchive.HashString(fileName, 2));
        BinaryPrimitives.WriteUInt32LittleEndian(hash.AsSpan(slot * 16 + 8), 0);   // locale + platform
        BinaryPrimitives.WriteUInt32LittleEndian(hash.AsSpan(slot * 16 + 12), 0);  // block index 0

        var block = new byte[16];
        BinaryPrimitives.WriteUInt32LittleEndian(block, 32);                       // file offset (right after the header)
        BinaryPrimitives.WriteUInt32LittleEndian(block.AsSpan(4), (uint)stored.Length);
        BinaryPrimitives.WriteUInt32LittleEndian(block.AsSpan(8), (uint)content.Length);
        BinaryPrimitives.WriteUInt32LittleEndian(block.AsSpan(12), flags);

        var hashPos = 32 + stored.Length;
        var blockPos = hashPos + hash.Length;
        var header = new byte[32];
        BinaryPrimitives.WriteUInt32LittleEndian(header, 0x1A51504D);
        BinaryPrimitives.WriteUInt32LittleEndian(header.AsSpan(4), 32);
        BinaryPrimitives.WriteUInt32LittleEndian(header.AsSpan(8), (uint)(blockPos + 16));
        BinaryPrimitives.WriteUInt16LittleEndian(header.AsSpan(12), 0);
        BinaryPrimitives.WriteUInt16LittleEndian(header.AsSpan(14), 3);
        BinaryPrimitives.WriteUInt32LittleEndian(header.AsSpan(16), (uint)hashPos);
        BinaryPrimitives.WriteUInt32LittleEndian(header.AsSpan(20), (uint)blockPos);
        BinaryPrimitives.WriteUInt32LittleEndian(header.AsSpan(24), HashCount);
        BinaryPrimitives.WriteUInt32LittleEndian(header.AsSpan(28), 1);

        var archive = header.Concat(stored).Concat(Encrypt(hash, MpqArchive.HashString("(hash table)", 3)))
            .Concat(Encrypt(block, MpqArchive.HashString("(block table)", 3))).ToArray();
        if (!userDataHeader) return archive;

        // Replays start with a 'MPQ\x1B' user-data header that points at the real archive header.
        var prefix = new byte[16];
        BinaryPrimitives.WriteUInt32LittleEndian(prefix, 0x1B51504D);
        BinaryPrimitives.WriteUInt32LittleEndian(prefix.AsSpan(4), 0);
        BinaryPrimitives.WriteUInt32LittleEndian(prefix.AsSpan(8), 16);
        return prefix.Concat(archive).ToArray();
    }

    /// <summary>A replay-shaped archive whose tracker stream contains the given text, as the bit-packed stream would.</summary>
    public static byte[] Replay(string trackerText, bool zlib = true) =>
        Build("replay.tracker.events", [0x05, 0x01, .. Encoding.Latin1.GetBytes(trackerText), 0x00, 0x7F], zlib, userDataHeader: true);

    private static byte[] Encrypt(byte[] data, uint key)
    {
        var o = (byte[])data.Clone();
        uint seed = 0xEEEEEEEE;
        for (var i = 0; i < o.Length / 4; i++)
        {
            seed += MpqArchive.Crypt[0x400 + (key & 0xFF)];
            var plain = BinaryPrimitives.ReadUInt32LittleEndian(o.AsSpan(i * 4));
            BinaryPrimitives.WriteUInt32LittleEndian(o.AsSpan(i * 4), plain ^ (key + seed));
            key = ((~key << 21) + 0x11111111) | (key >> 11);
            seed = plain + seed + (seed << 5) + 3;
        }
        return o;
    }
}
