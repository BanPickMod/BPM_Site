using Bpm.Uploader.Core.Service;
using Bpm.Uploader.Core.Storage;

namespace Bpm.Uploader.Tray;

/// <summary>
/// Development aid: with BPM_UI_SNAPSHOT=&lt;folder&gt; the program draws its settings window, saves one PNG per tab and exits
/// instead of starting the tray. Uses a throw-away state folder, so it never touches the real settings or token.
/// </summary>
internal static class UiSnapshot
{
    public static void Run(string outDir)
    {
        Directory.CreateDirectory(outDir);
        var home = new UploaderHome(Path.Combine(outDir, "home"));
        new TokenStore(home).Save("snapshot-token");                      // so the sharing tab shows its "server unreachable" state
        using var svc = new UploadService(home);
        using var form = new SettingsForm(svc, "Automatic updates: off (development build or no update address)");
        form.Show();
        for (var i = 0; i < 3; i++)
        {
            form.SelectSnapshotPage(i);
            var until = DateTime.UtcNow.AddSeconds(2);
            while (DateTime.UtcNow < until) { Application.DoEvents(); Thread.Sleep(30); }
            using var bmp = new Bitmap(form.Width, form.Height);
            form.DrawToBitmap(bmp, new Rectangle(0, 0, form.Width, form.Height));
            bmp.Save(Path.Combine(outDir, $"settings-tab{i}.png"));
        }
        using var welcome = new WelcomeForm(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BanPickModUploader"), linked: false, () => { });
        welcome.Show();
        var wait = DateTime.UtcNow.AddSeconds(1);
        while (DateTime.UtcNow < wait) { Application.DoEvents(); Thread.Sleep(30); }
        using var shot = new Bitmap(welcome.Width, welcome.Height);
        welcome.DrawToBitmap(shot, new Rectangle(0, 0, welcome.Width, welcome.Height));
        shot.Save(Path.Combine(outDir, "welcome.png"));
    }
}
