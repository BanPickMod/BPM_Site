using System.Security.Cryptography;
using System.Threading.Channels;
using Bpm.Uploader.Core.Net;
using Bpm.Uploader.Core.Replay;
using Bpm.Uploader.Core.Storage;
using Bpm.Uploader.Core.Watching;

namespace Bpm.Uploader.Core.Service;

public enum ServiceState
{
    NotLinked,
    Watching,
    Paused,
    /// <summary>Linked, but the server says upload consent is off.</summary>
    NeedsConsent,
    /// <summary>The token stopped working; link again.</summary>
    NeedsRelink,
    NoFolders,
}

public enum AddFolderResult { Added, AlreadyWatched, NoReplaysFound }

public sealed record UploadEvent(string File, string Message, bool Success);

/// <summary>
/// The uploader's engine: watches replay folders, waits for each file to be fully written, keeps only BPM games,
/// and uploads them with retries that survive restarts. One consumer processes files in order.
/// </summary>
public sealed class UploadService : IDisposable
{
    public static readonly TimeSpan RescanEvery = TimeSpan.FromSeconds(45);
    internal const int MaxAttempts = 8;

    private readonly UploaderHome _home;
    private readonly Ledger _ledger;
    private readonly TokenStore _tokens;
    private readonly Func<string, ApiClient> _apiFactory;
    private readonly Func<TimeSpan, CancellationToken, Task> _delay;
    private readonly Channel<string> _queue = Channel.CreateUnbounded<string>(new UnboundedChannelOptions { SingleReader = true });
    private readonly HashSet<string> _enqueued = [];
    private readonly Lock _gate = new();
    private readonly CancellationTokenSource _cts = new();
    private readonly Logger _log;
    private ReplayWatcher? _watcher;
    private Task? _loop;
    private Timer? _retryTimer;

    public Settings Settings { get; private set; }
    public ServiceState State { get; private set; }
    public event Action? StateChanged;
    public event Action<UploadEvent>? Activity;

    public UploadService(UploaderHome home, Func<string, ApiClient>? apiFactory = null, Func<TimeSpan, CancellationToken, Task>? delay = null)
    {
        _home = home;
        _ledger = new Ledger(home);
        _tokens = new TokenStore(home);
        _log = new Logger(home.LogFile);
        Settings = Settings.Load(home);
        _apiFactory = apiFactory ?? (token => new ApiClient(Settings.EffectiveServerUrl, token));
        _delay = delay ?? Task.Delay;
        State = ComputeState(hasFolders: true);
    }

    public int PendingCount => _ledger.CountPending();
    public bool IsLinked => _tokens.Load() is not null;
    public string LogFile => _home.LogFile;

    /// <summary>Lets other parts of the program write to the same log file.</summary>
    public void Note(string message) => _log.Info(message);

    public void Start()
    {
        _loop = Task.Run(ProcessLoopAsync);
        _watcher = new ReplayWatcher(() => ReplayFolders.Discover(Settings.ExtraReplayFolders), Enqueue, RescanEvery);
        _retryTimer = new Timer(_ => EnqueueDuePending(), null, TimeSpan.FromSeconds(10), TimeSpan.FromSeconds(30));
        SetState(ComputeState(ReplayFolders.Discover(Settings.ExtraReplayFolders).Count > 0));
        _log.Info($"started; folders: {string.Join(" | ", ReplayFolders.Discover(Settings.ExtraReplayFolders))}");
    }

    /// <summary>The StarCraft II replay folders found under Documents (read-only for the user).</summary>
    public IReadOnlyList<string> AutoFolders => ReplayFolders.Discover([]);

    /// <summary>Folders the user added by hand.</summary>
    public IReadOnlyList<string> ExtraFolders => Settings.ExtraReplayFolders;

    public AddFolderResult AddFolder(string path)
    {
        var found = ReplayFolders.Resolve(path);
        if (found.Count == 0) return AddFolderResult.NoReplaysFound;
        var watched = ReplayFolders.Discover(Settings.ExtraReplayFolders);
        var fresh = found.Where(f => !watched.Contains(f, StringComparer.OrdinalIgnoreCase)).ToList();
        if (fresh.Count == 0) return AddFolderResult.AlreadyWatched;
        Settings.ExtraReplayFolders = [.. Settings.ExtraReplayFolders, .. fresh];     // replaced, never edited: the watcher thread reads it
        Settings.Save(_home);
        _log.Info($"folder added: {string.Join(" | ", fresh)}");
        FoldersChanged();
        return AddFolderResult.Added;
    }

    public void RemoveFolder(string path)
    {
        var rest = Settings.ExtraReplayFolders.Where(f => !f.Equals(path, StringComparison.OrdinalIgnoreCase)).ToList();
        if (rest.Count == Settings.ExtraReplayFolders.Count) return;
        Settings.ExtraReplayFolders = rest;
        Settings.Save(_home);
        _log.Info($"folder removed: {path}");
        FoldersChanged();
    }

    private void FoldersChanged()
    {
        _watcher?.Refresh();
        _watcher?.Rescan();
        if (State is ServiceState.Watching or ServiceState.NoFolders)
            SetState(ReplayFolders.Discover(Settings.ExtraReplayFolders).Count > 0 ? ServiceState.Watching : ServiceState.NoFolders);
    }

    /// <summary>Applies to games uploaded from now on; replays already on the site keep their setting (change those on the website).</summary>
    public void SetUploadPrivately(bool on)
    {
        Settings.UploadPrivately = on;
        Settings.Save(_home);
        _log.Info($"upload privately: {on}");
    }

    public void SetPaused(bool paused)
    {
        Settings.Paused = paused;
        Settings.Save(_home);
        SetState(ComputeState(true));
        if (!paused) _watcher?.Rescan();
    }

    /// <summary>Call after a successful link: reload token/settings and send anything that was waiting for an account.</summary>
    public void OnLinked()
    {
        Settings = Settings.Load(_home);
        _ledger.WakePending();
        SetState(ComputeState(true));
        _watcher?.Refresh();
        _watcher?.Rescan();
        EnqueueDuePending();
    }

    /// <summary>The account's consent as the server has it, or null when not linked, offline or the token was revoked (then relink is flagged).</summary>
    public async Task<ConsentCheck?> GetConsentAsync(CancellationToken ct = default) => await ConsentAsync(api => api.GetConsentAsync(ct));

    /// <summary>Change the consent from the launcher. Applies to every stored replay of the account, same as on the website.</summary>
    public async Task<ConsentCheck?> SetConsentAsync(bool c1, bool c2, bool c3, CancellationToken ct = default)
    {
        var r = await ConsentAsync(api => api.SetConsentAsync(c1, c2, c3, ct));
        if (r is { Kind: ConsentKind.Ok }) OnConsentChanged(r.C1);
        return r;
    }

    private async Task<ConsentCheck?> ConsentAsync(Func<ApiClient, Task<ConsentCheck>> call)
    {
        var token = _tokens.Load();
        if (token is null) return null;
        ConsentCheck r;
        try
        {
            using var api = _apiFactory(token);
            r = await call(api);
        }
        // A development build may have a token in its throw-away state but no ServerUrl baked in yet.
        // Treat that exactly like an unreachable server; a settings window must never crash because of it.
        catch (Exception e) when (e is UriFormatException or HttpRequestException or TaskCanceledException)
        {
            return new ConsentCheck(ConsentKind.Unavailable);
        }
        if (r.Kind == ConsentKind.AuthLost)
        {
            _tokens.Clear();
            SetState(ServiceState.NeedsRelink);
        }
        else if (r.Kind == ConsentKind.Ok) OnConsentChanged(r.C1);
        return r;
    }

    /// <summary>C1 on: wake everything that waited for consent and leave the "consent is off" state. C1 off: say so right away.</summary>
    private void OnConsentChanged(bool c1)
    {
        if (c1)
        {
            if (State == ServiceState.NeedsConsent) SetState(ComputeState(true));
            _ledger.WakePending();
            EnqueueDuePending();
        }
        else if (State == ServiceState.Watching) SetState(ServiceState.NeedsConsent);
    }

    public void Unlink()
    {
        _tokens.Clear();
        SetState(ComputeState(true));
    }

    /// <summary>Called by the watcher and rescans for every candidate file. Cheap: the ledger rejects repeats before any I/O on content.</summary>
    public void Enqueue(string path)
    {
        if (Settings.Paused || _cts.IsCancellationRequested) return;
        FileInfo fi;
        try { fi = new FileInfo(path); } catch (Exception e) when (e is ArgumentException or NotSupportedException) { return; }
        if (!fi.Exists) return;
        if (Settings.WatchSinceUtc is { } since && fi.LastWriteTimeUtc < since) return;   // older than the link: never touched
        var key = Ledger.KeyOf(fi);
        if (_ledger.Get(key) is { State: not EntryState.Pending }) return;
        lock (_gate)
        {
            if (!_enqueued.Add(path)) return;       // already waiting in the queue
        }
        _queue.Writer.TryWrite(path);
    }

    private void EnqueueDuePending()
    {
        if (Settings.Paused) return;
        foreach (var (key, _) in _ledger.Pending(DateTime.UtcNow))
        {
            var path = key.Split('|')[0];            // lower-cased path; fine on case-insensitive NTFS
            Enqueue(path);
        }
    }

    private async Task ProcessLoopAsync()
    {
        try
        {
            await foreach (var path in _queue.Reader.ReadAllAsync(_cts.Token))
            {
                try { await ProcessAsync(path, _cts.Token); }
                catch (OperationCanceledException) when (_cts.IsCancellationRequested) { return; }
                catch (Exception e) { _log.Error($"unexpected error for {path}: {e}"); }
                finally { lock (_gate) _enqueued.Remove(path); }
            }
        }
        catch (OperationCanceledException) { }
    }

    internal async Task ProcessAsync(string path, CancellationToken ct)
    {
        if (!await WaitUntilStableAsync(path, ct)) return;
        var fi = new FileInfo(path);
        var key = Ledger.KeyOf(fi);
        var entry = _ledger.Get(key);
        if (entry is { State: not EntryState.Pending }) return;
        if (entry is { NextTryUtc: { } next } && next > DateTime.UtcNow) return;

        var inspected = ReplayInspector.Inspect(path);
        if (inspected.Kind == ReplayKind.Unreadable)
        {
            var attempts = (entry?.Attempts ?? 0) + 1;
            if (attempts >= 4) _ledger.Set(key, new LedgerEntry { State = EntryState.Rejected, Reason = $"unreadable: {inspected.Error}", Attempts = attempts });
            else _ledger.Set(key, new LedgerEntry { State = EntryState.Pending, Reason = "unreadable", Attempts = attempts, NextTryUtc = DateTime.UtcNow.AddSeconds(20 * attempts) });
            return;
        }
        if (inspected.Kind == ReplayKind.NotBpm)
        {
            _ledger.Set(key, new LedgerEntry { State = EntryState.NotBpm });
            _log.Info($"skip (not a BPM game): {Path.GetFileName(path)}");
            return;
        }

        var token = _tokens.Load();
        if (token is null)
        {
            _ledger.Set(key, new LedgerEntry { State = EntryState.Pending, Reason = "not linked", Attempts = entry?.Attempts ?? 0, NextTryUtc = DateTime.UtcNow.AddMinutes(5) });
            SetState(ServiceState.NotLinked);
            return;
        }

        // Ask first: if the account withdrew upload consent on the website, the file must not leave this PC at all.
        ConsentCheck consent;
        using (var api = _apiFactory(token)) consent = await api.GetConsentAsync(ct);
        if (consent.Kind == ConsentKind.AuthLost)
        {
            _tokens.Clear();
            _ledger.Set(key, new LedgerEntry { State = EntryState.Pending, Reason = "auth lost", NextTryUtc = DateTime.UtcNow.AddMinutes(5) });
            SetState(ServiceState.NeedsRelink);
            return;
        }
        if (consent.Kind == ConsentKind.Ok && !consent.C1)
        {
            _ledger.Set(key, new LedgerEntry { State = EntryState.Pending, Reason = "no consent", NextTryUtc = DateTime.UtcNow.AddMinutes(10) });
            SetState(ServiceState.NeedsConsent);
            return;
        }
        // Unavailable: fall through. The upload itself is then refused by the server if consent is off (it checks before reading the body).

        var sha = await Sha256Async(path, ct);
        UploadOutcome outcome;
        using (var api = _apiFactory(token)) outcome = await api.UploadAsync(path, sha, ct, Settings.UploadPrivately);
        var name = Path.GetFileName(path);

        switch (outcome.Verdict)
        {
            case UploadVerdict.Accepted:
                _ledger.Set(key, new LedgerEntry { State = EntryState.Uploaded, Sha256 = sha, UploadId = outcome.UploadId });
                _log.Info($"uploaded {name} -> #{outcome.UploadId}");
                Activity?.Invoke(new UploadEvent(name, $"업로드 완료 (#{outcome.UploadId})", true));
                if (State is ServiceState.NeedsConsent or ServiceState.NeedsRelink or ServiceState.NotLinked) SetState(ComputeState(true));
                break;
            case UploadVerdict.Rejected:
                _ledger.Set(key, new LedgerEntry { State = EntryState.Rejected, Sha256 = sha, Reason = outcome.Detail });
                _log.Warn($"rejected {name}: {outcome.Detail}");
                Activity?.Invoke(new UploadEvent(name, $"서버가 거부함: {outcome.Detail}", false));
                break;
            case UploadVerdict.AuthLost:
                _tokens.Clear();                     // a revoked token is useless; ask the user to link again
                _ledger.Set(key, new LedgerEntry { State = EntryState.Pending, Sha256 = sha, Reason = "auth lost", NextTryUtc = DateTime.UtcNow.AddMinutes(5) });
                SetState(ServiceState.NeedsRelink);
                break;
            case UploadVerdict.NoConsent:
                _ledger.Set(key, new LedgerEntry { State = EntryState.Pending, Sha256 = sha, Reason = "no consent", NextTryUtc = DateTime.UtcNow.AddMinutes(10) });
                SetState(ServiceState.NeedsConsent);
                break;
            default:
                var tries = (entry?.Attempts ?? 0) + 1;
                if (tries >= MaxAttempts && outcome.RetryAfter is null)
                {
                    _ledger.Set(key, new LedgerEntry { State = EntryState.Rejected, Sha256 = sha, Reason = $"gave up after {tries} tries: {outcome.Detail}", Attempts = tries });
                    _log.Warn($"giving up on {name}: {outcome.Detail}");
                    Activity?.Invoke(new UploadEvent(name, $"업로드 실패(재시도 한도): {outcome.Detail}", false));
                    break;
                }
                var wait = outcome.RetryAfter ?? TimeSpan.FromSeconds(Math.Min(3600, 30 * Math.Pow(2, Math.Min(tries, 7))));
                _ledger.Set(key, new LedgerEntry { State = EntryState.Pending, Sha256 = sha, Reason = outcome.Detail, Attempts = tries, NextTryUtc = DateTime.UtcNow + wait });
                _log.Warn($"upload of {name} failed ({outcome.Detail}); retry in {wait.TotalSeconds:0}s");
                break;
        }
    }

    /// <summary>A replay is complete when its size and timestamp stop changing and it can be opened for reading.</summary>
    internal async Task<bool> WaitUntilStableAsync(string path, CancellationToken ct, int stableChecks = 3, int maxChecks = 120)
    {
        long lastSize = -1;
        DateTime lastWrite = default;
        var stable = 0;
        for (var i = 0; i < maxChecks; i++)
        {
            try
            {
                var fi = new FileInfo(path);
                if (!fi.Exists) return false;
                if (fi.Length == lastSize && fi.LastWriteTimeUtc == lastWrite && fi.Length > 0)
                {
                    using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
                    if (++stable >= stableChecks) return true;
                }
                else stable = 0;
                lastSize = fi.Length;
                lastWrite = fi.LastWriteTimeUtc;
            }
            catch (IOException) { stable = 0; }          // still locked by the game
            await _delay(TimeSpan.FromSeconds(1), ct);
        }
        return false;
    }

    private static async Task<string> Sha256Async(string path, CancellationToken ct)
    {
        await using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        return Convert.ToHexStringLower(await SHA256.HashDataAsync(fs, ct));
    }

    private ServiceState ComputeState(bool hasFolders)
    {
        if (!_tokens.Load().IsSome()) return ServiceState.NotLinked;
        if (Settings.Paused) return ServiceState.Paused;
        return hasFolders ? ServiceState.Watching : ServiceState.NoFolders;
    }

    private void SetState(ServiceState s)
    {
        if (State == s) return;
        State = s;
        StateChanged?.Invoke();
    }

    public void Dispose()
    {
        _cts.Cancel();
        _retryTimer?.Dispose();
        _watcher?.Dispose();
        _queue.Writer.TryComplete();
        try { _loop?.Wait(TimeSpan.FromSeconds(3)); } catch (AggregateException) { }
        _cts.Dispose();
        _log.Dispose();
    }
}

internal static class OptionExtensions
{
    public static bool IsSome(this string? s) => s is not null;
}

/// <summary>Tiny append-only log that rolls over at 1 MB. Logs file names and outcomes only, never replay content or tokens.</summary>
internal sealed class Logger(string path) : IDisposable
{
    private readonly Lock _gate = new();

    public void Info(string m) => Write("INFO", m);
    public void Warn(string m) => Write("WARN", m);
    public void Error(string m) => Write("ERROR", m);

    private void Write(string level, string message)
    {
        lock (_gate)
        {
            try
            {
                if (File.Exists(path) && new FileInfo(path).Length > 1_000_000) File.Move(path, path + ".1", overwrite: true);
                File.AppendAllText(path, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss} {level} {message}{Environment.NewLine}");
            }
            catch (IOException) { /* logging must never break uploads */ }
        }
    }

    public void Dispose() { }
}
