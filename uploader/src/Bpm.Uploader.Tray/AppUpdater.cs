using Velopack;

namespace Bpm.Uploader.Tray;

/// <summary>
/// Automatic updates through Velopack. Looks at the release folder URL a few times a day, downloads a newer version in the
/// background and then waits: it is applied when the user picks "update and restart" or, at the latest, when the program exits.
/// Does nothing when no update URL is configured or when the program is not an installed copy (a developer build).
/// </summary>
internal sealed class AppUpdater : IDisposable
{
    private static readonly TimeSpan Every = TimeSpan.FromHours(6);

    private readonly UpdateManager? _mgr;
    private readonly System.Threading.Timer? _timer;
    private UpdateInfo? _ready;
    private int _busy;

    public event Action? Changed;

    private readonly Action<string> _log;

    public AppUpdater(string url, Action<string> log)
    {
        _log = log;
        if (url.Length == 0) return;
        try
        {
            var mgr = new UpdateManager(url);         // an http(s) folder, or a local folder for tests;
            if (!mgr.IsInstalled) { _log("updates: not an installed copy, automatic updates are off"); return; }
            _mgr = mgr;
            _log($"updates: checking {url} every {Every.TotalHours:0} h (running {mgr.CurrentVersion})");
            _timer = new System.Threading.Timer(_ => _ = CheckAsync(), null, TimeSpan.FromSeconds(30), Every);
        }
        catch (Exception e) { _log($"updates: setup failed ({e.Message})"); }     // never stops the uploader from running
    }

    public bool Enabled => _mgr is not null;

    /// <summary>The version that is downloaded and ready to install, or null.</summary>
    public string? ReadyVersion => _ready?.TargetFullRelease.Version.ToString();

    public async Task CheckAsync()
    {
        if (_mgr is null || _ready is not null || Interlocked.Exchange(ref _busy, 1) == 1) return;
        try
        {
            var info = await _mgr.CheckForUpdatesAsync();
            if (info is null) return;
            _log($"updates: downloading {info.TargetFullRelease.Version}");
            await _mgr.DownloadUpdatesAsync(info);
            _ready = info;
            _log($"updates: {info.TargetFullRelease.Version} is ready; it installs on restart or exit");
            Changed?.Invoke();
        }
        catch (Exception e) { _log($"updates: check failed ({e.GetType().Name}: {e.Message})"); }
        finally { Interlocked.Exchange(ref _busy, 0); }
    }

    public void ApplyAndRestart()
    {
        if (_mgr is not null && _ready is not null) _mgr.ApplyUpdatesAndRestart(_ready.TargetFullRelease);
    }

    /// <summary>Install silently once this process has exited, without restarting.</summary>
    public void ApplyWhenExited()
    {
        if (_mgr is not null && _ready is not null) _mgr.WaitExitThenApplyUpdates(_ready.TargetFullRelease, silent: true, restart: false);
    }

    public void Dispose() => _timer?.Dispose();
}
