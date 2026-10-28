using Velopack;

namespace Bpm.Uploader.Tray;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        // Must run first: the installer and updater start this exe with special arguments and expect it to handle them and exit.
        VelopackApp.Build()
            .OnAfterInstallFastCallback(_ => TrayContext.SetAutostart(true))     // a launcher that is not running uploads nothing
            .OnBeforeUninstallFastCallback(_ => TrayContext.SetAutostart(false)) // leave no Run entry pointing at a deleted exe
            .Run();

        if (Environment.GetEnvironmentVariable("BPM_UI_SNAPSHOT") is { Length: > 0 } snapshotDir)
        {
            ApplicationConfiguration.Initialize();
            UiSnapshot.Run(snapshotDir);
            return;
        }

        // One tray icon per user session: a second launch just exits.
        using var mutex = new Mutex(initiallyOwned: true, @"Local\BPMUploader.SingleInstance", out var first);
        if (!first) return;

        ApplicationConfiguration.Initialize();
        Application.ThreadException += (_, e) => MessageBox.Show(e.Exception.Message, "BPM Uploader", MessageBoxButtons.OK, MessageBoxIcon.Error);
        Application.Run(new TrayContext());
    }
}
