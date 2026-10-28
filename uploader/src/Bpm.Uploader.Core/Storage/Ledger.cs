namespace Bpm.Uploader.Core.Storage;

public enum EntryState
{
    /// <summary>Uploaded; the server has it.</summary>
    Uploaded,
    /// <summary>Readable but not a BPM game. Never sent.</summary>
    NotBpm,
    /// <summary>The server refused it for good (too large, not a replay, ...).</summary>
    Rejected,
    /// <summary>BPM game waiting to be sent (network trouble, no account yet, no consent yet).</summary>
    Pending,
}

public sealed class LedgerEntry
{
    public EntryState State { get; set; }
    public string? Sha256 { get; set; }
    public int? UploadId { get; set; }
    public string? Reason { get; set; }
    public int Attempts { get; set; }
    public DateTime? NextTryUtc { get; set; }
    public DateTime UpdatedUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Remembers what happened to each replay file so nothing is uploaded twice and a restart does not re-read old games.
/// Keyed by path + size + last write time, so a rewritten file is treated as new.
/// </summary>
public sealed class Ledger
{
    private readonly UploaderHome _home;
    private readonly Lock _gate = new();
    private Dictionary<string, LedgerEntry> _entries;

    public Ledger(UploaderHome home)
    {
        _home = home;
        _entries = JsonFile.Read<Dictionary<string, LedgerEntry>>(home.LedgerFile) ?? [];
    }

    public static string KeyOf(FileInfo f) => $"{f.FullName.ToLowerInvariant()}|{f.Length}|{f.LastWriteTimeUtc.Ticks}";

    public LedgerEntry? Get(string key)
    {
        lock (_gate) return _entries.GetValueOrDefault(key);
    }

    public void Set(string key, LedgerEntry entry)
    {
        lock (_gate)
        {
            entry.UpdatedUtc = DateTime.UtcNow;
            _entries[key] = entry;
            Prune();
            JsonFile.Write(_home.LedgerFile, _entries);
        }
    }

    public IReadOnlyList<(string Key, LedgerEntry Entry)> Pending(DateTime nowUtc)
    {
        lock (_gate)
            return _entries.Where(e => e.Value.State == EntryState.Pending && (e.Value.NextTryUtc ?? DateTime.MinValue) <= nowUtc)
                .Select(e => (e.Key, e.Value)).ToList();
    }

    public int CountPending()
    {
        lock (_gate) return _entries.Count(e => e.Value.State == EntryState.Pending);
    }

    /// <summary>Make everything waiting eligible right now (after linking or granting consent).</summary>
    public void WakePending()
    {
        lock (_gate)
        {
            foreach (var e in _entries.Values.Where(v => v.State == EntryState.Pending)) e.NextTryUtc = null;
            JsonFile.Write(_home.LedgerFile, _entries);
        }
    }

    private void Prune()
    {
        // Keep the file small: drop the oldest finished entries beyond 5000 (pending ones are never dropped).
        if (_entries.Count <= 5000) return;
        foreach (var k in _entries.Where(e => e.Value.State != EntryState.Pending).OrderBy(e => e.Value.UpdatedUtc).Take(_entries.Count - 4000).Select(e => e.Key).ToList())
            _entries.Remove(k);
    }
}
