namespace Bpm.Uploader.Core.Watching;

public static class ReplayFolders
{
    /// <summary>
    /// StarCraft II keeps replays under Documents\StarCraft II\Accounts\&lt;id&gt;\&lt;region-profile&gt;\Replays\Multiplayer.
    /// MyDocuments follows OneDrive folder redirection, which is where many players' Documents actually live.
    /// </summary>
    public static IReadOnlyList<string> Discover(IEnumerable<string> extra, string? documentsOverride = null)
    {
        // BPM_DOCUMENTS lets dev/test runs point away from the real Documents folder.
        var docs = documentsOverride ?? Environment.GetEnvironmentVariable("BPM_DOCUMENTS") ?? Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        var found = new List<string>();
        var accounts = Path.Combine(docs, "StarCraft II", "Accounts");
        if (Directory.Exists(accounts))
        {
            foreach (var acc in Directory.EnumerateDirectories(accounts))
            foreach (var profile in Directory.EnumerateDirectories(acc))
            {
                var mp = Path.Combine(profile, "Replays", "Multiplayer");
                if (Directory.Exists(mp)) found.Add(mp);
            }
        }
        found.AddRange(extra.Where(Directory.Exists));
        return found.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    /// <summary>
    /// Turns a folder the user picked into the replay folders to watch. Accepts the replay folder itself (it holds .SC2Replay
    /// files, or is called Multiplayer) or any folder above it, such as "StarCraft II" or "Accounts", by looking for
    /// Replays\Multiplayer below it. Returns an empty list when nothing that looks like a replay folder is found.
    /// </summary>
    public static IReadOnlyList<string> Resolve(string path)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path)) return [];
            var full = Path.GetFullPath(path).TrimEnd('\\', '/');
            if (Path.GetFileName(full).Equals("Multiplayer", StringComparison.OrdinalIgnoreCase) || Directory.EnumerateFiles(full, "*.SC2Replay").Any())
                return [full];

            var found = new List<string>();
            var visited = 0;
            void Walk(string dir, int depth)
            {
                if (depth > 5 || visited > 4000) return;                 // a drive root must not turn into a long crawl
                IEnumerable<string> subs;
                try { subs = Directory.EnumerateDirectories(dir); }
                catch (Exception e) when (e is IOException or UnauthorizedAccessException) { return; }
                foreach (var d in subs)
                {
                    visited++;
                    if (Path.GetFileName(d).Equals("Multiplayer", StringComparison.OrdinalIgnoreCase)
                        && Path.GetFileName(Path.GetDirectoryName(d) ?? "").Equals("Replays", StringComparison.OrdinalIgnoreCase)) found.Add(d);
                    else Walk(d, depth + 1);
                }
            }
            Walk(full, 0);
            return found;
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            return [];
        }
    }
}

/// <summary>
/// Reports new/changed .SC2Replay files. FileSystemWatcher can miss events (network or OneDrive folders, buffer overflow),
/// so a periodic rescan backs it up; duplicates are fine because the ledger deduplicates.
/// </summary>
public sealed class ReplayWatcher : IDisposable
{
    private readonly List<FileSystemWatcher> _watchers = [];
    private readonly Timer _rescan;
    private readonly Func<IReadOnlyList<string>> _folders;
    private readonly Action<string> _onFile;

    public ReplayWatcher(Func<IReadOnlyList<string>> folders, Action<string> onFile, TimeSpan rescanEvery)
    {
        _folders = folders;
        _onFile = onFile;
        _rescan = new Timer(_ => Rescan(), null, TimeSpan.FromSeconds(2), rescanEvery);
        Refresh();
    }

    /// <summary>Re-reads the folder list (new SC2 account folders appear over time) and re-attaches watchers.</summary>
    public void Refresh()
    {
        foreach (var w in _watchers) w.Dispose();
        _watchers.Clear();
        foreach (var dir in _folders())
        {
            try
            {
                var w = new FileSystemWatcher(dir, "*.SC2Replay")
                {
                    IncludeSubdirectories = false,
                    NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size,
                    InternalBufferSize = 64 * 1024,
                };
                w.Created += (_, e) => _onFile(e.FullPath);
                w.Changed += (_, e) => _onFile(e.FullPath);
                w.Renamed += (_, e) => _onFile(e.FullPath);
                w.EnableRaisingEvents = true;
                _watchers.Add(w);
            }
            catch (Exception e) when (e is ArgumentException or IOException or UnauthorizedAccessException)
            {
                // Folder vanished or is unreadable; the rescan retries on the next Refresh.
            }
        }
    }

    public void Rescan()
    {
        foreach (var dir in _folders())
        {
            try
            {
                foreach (var f in Directory.EnumerateFiles(dir, "*.SC2Replay")) _onFile(f);
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException)
            {
                // Skip this folder this round.
            }
        }
    }

    public void Dispose()
    {
        _rescan.Dispose();
        foreach (var w in _watchers) w.Dispose();
    }
}
