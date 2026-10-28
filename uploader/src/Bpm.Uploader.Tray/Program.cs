using Velopack;

namespace Bpm.Uploader.Tray;

internal static class Program
{
    /// <summary>True for the one start that the installer makes (Velopack's first-run hook).</summary>
    internal static bool FirstRun { get; private set; }

    private const string ShowSignal = @"Local\BPMUploader.Show";

    [STAThread]
    private static void Main()
    {
        // Must run first: the installer and updater start this exe with special arguments and expect it to handle them and exit.
        VelopackApp.Build()
            .OnAfterInstallFastCallback(_ => TrayContext.SetAutostart(true))     // a launcher that is not running uploads nothing
            .OnFirstRun(_ => FirstRun = true)
            .OnBeforeUninstallFastCallback(_ => TrayContext.SetAutostart(false)) // leave no Run entry pointing at a deleted exe
            .Run();

        if (Environment.GetEnvironmentVariable("BPM_UI_SNAPSHOT") is { Length: > 0 } snapshotDir)
        {
            ApplicationConfiguration.Initialize();
            UiSnapshot.Run(snapshotDir);
            return;
        }

        // One tray icon per user session. A second launch (Start menu, shortcut) asks the running one to show its window and exits.
        using var mutex = new Mutex(initiallyOwned: true, @"Local\BPMUploader.SingleInstance", out var first);
        if (!first)
        {
            try { EventWaitHandle.OpenExisting(ShowSignal).Set(); }
            catch (Exception e) when (e is WaitHandleCannotBeOpenedException or UnauthorizedAccessException) { /* the first instance is still starting */ }
            return;
        }

        ApplicationConfiguration.Initialize();
        Application.ThreadException += (_, e) => MessageBox.Show(e.Exception.Message, "BPM Uploader", MessageBoxButtons.OK, MessageBoxIcon.Error);
        using var signal = new EventWaitHandle(false, EventResetMode.AutoReset, ShowSignal);
        var context = new TrayContext(FirstRun);
        var listener = new Thread(() => { while (signal.WaitOne()) context.ShowFromAnotherLaunch(); }) { IsBackground = true, Name = "show-signal" };
        listener.Start();
        Application.Run(context);
    }
}
