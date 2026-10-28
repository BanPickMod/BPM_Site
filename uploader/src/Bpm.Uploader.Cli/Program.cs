using Bpm.Uploader.Core.Net;
using Bpm.Uploader.Core.Replay;
using Bpm.Uploader.Core.Service;
using Bpm.Uploader.Core.Storage;

// Developer/test CLI around the same engine the tray app uses.
//   inspect <file|folder> [--list]   classify replays (BPM / not BPM) without uploading anything
//   link                             link this PC to an account (prints a code to enter on the site)
//   run                              watch replay folders and upload BPM games until Ctrl+C
//   status                           show link state and pending uploads
//   unlink                           forget the account on this PC
// Set BPM_SERVER_URL to the site (e.g. http://localhost:3000) and BPM_UPLOADER_HOME to use a throwaway state folder.
var cmd = args.FirstOrDefault();
var home = new UploaderHome();
var settings = Settings.Load(home);

switch (cmd)
{
    case "inspect" when args.Length >= 2:
    {
        var files = Directory.Exists(args[1])
            ? Directory.EnumerateFiles(args[1], "*.SC2Replay", SearchOption.AllDirectories).ToArray()
            : [args[1]];
        var counts = new Dictionary<ReplayKind, int>();
        foreach (var f in files)
        {
            var r = ReplayInspector.Inspect(f);
            counts[r.Kind] = counts.GetValueOrDefault(r.Kind) + 1;
            if (args.Contains("--list")) Console.WriteLine($"{r.Kind}\t{r.Bans}\t{r.Picks}\t{f}");
        }
        Console.WriteLine($"{files.Length} replays: " + string.Join(", ", counts.OrderBy(k => k.Key).Select(k => $"{k.Key}={k.Value}")));
        return 0;
    }

    case "link":
    {
        using var cts = new CancellationTokenSource();
        Console.CancelKeyPress += (_, e) => { e.Cancel = true; cts.Cancel(); };
        var result = await DeviceLinker.LinkAsync(settings, home, c =>
        {
            Console.WriteLine($"Open {c.VerificationUriComplete}");
            Console.WriteLine($"and confirm the code: {c.UserCode}   (expires in {c.ExpiresIn / 60} min)");
        }, cts.Token);
        Console.WriteLine(result.Success ? "Linked." : $"Not linked: {result.Message}");
        return result.Success ? 0 : 1;
    }

    case "run":
    {
        using var svc = new UploadService(home);
        svc.StateChanged += () => Console.WriteLine($"[state] {svc.State}");
        svc.Activity += e => Console.WriteLine($"[{(e.Success ? "ok" : "!!")}] {e.File}: {e.Message}");
        svc.Start();
        Console.WriteLine($"Watching ({svc.State}). Ctrl+C to stop.");
        var done = new TaskCompletionSource();
        Console.CancelKeyPress += (_, e) => { e.Cancel = true; done.TrySetResult(); };
        await done.Task;
        return 0;
    }

    case "status":
    {
        using var svc = new UploadService(home);
        Console.WriteLine($"server: {(settings.EffectiveServerUrl.Length == 0 ? "(not set)" : settings.EffectiveServerUrl)}");
        Console.WriteLine($"linked: {svc.IsLinked}   paused: {settings.Paused}   pending uploads: {svc.PendingCount}");
        Console.WriteLine($"watching since: {settings.WatchSinceUtc?.ToLocalTime():yyyy-MM-dd HH:mm}");
        return 0;
    }

    case "unlink":
        new TokenStore(home).Clear();
        Console.WriteLine("Unlinked.");
        return 0;

    default:
        Console.Error.WriteLine("usage: bpm-uploader inspect <file|folder> [--list] | link | run | status | unlink");
        return 2;
}
