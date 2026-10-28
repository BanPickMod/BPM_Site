using System.Diagnostics;
using System.Drawing.Drawing2D;
using Bpm.Uploader.Core.Service;
using Bpm.Uploader.Core.Storage;
using Microsoft.Win32;
using static Bpm.Uploader.Tray.Loc;

namespace Bpm.Uploader.Tray;

/// <summary>The tray icon and its menu. All real work happens in <see cref="UploadService"/>.</summary>
internal sealed class TrayContext : ApplicationContext
{
    private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string RunValue = "BPMUploader";

    private readonly UploaderHome _home = new();
    private readonly UploadService _svc;
    private readonly NotifyIcon _tray;
    private readonly SynchronizationContext _ui = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
    private readonly ToolStripMenuItem _statusItem = new() { Enabled = false };
    private readonly ToolStripMenuItem _link = new();
    private readonly ToolStripMenuItem _pause = new();
    private readonly ToolStripMenuItem _private = new() { CheckOnClick = true };
    private readonly ToolStripMenuItem _retry = new();
    private readonly ToolStripMenuItem _autostart = new() { CheckOnClick = true };
    private readonly ToolStripMenuItem _settings = new();
    private readonly ToolStripMenuItem _update = new() { Visible = false };
    private readonly AppUpdater _updater;
    private LinkForm? _linkForm;
    private SettingsForm? _settingsForm;

    public TrayContext()
    {
        _svc = new UploadService(_home);
        _updater = new AppUpdater(_svc.Settings.EffectiveUpdateUrl, _svc.Note);
        _updater.Changed += () => _ui.Post(_ => Refresh(), null);
        _svc.StateChanged += () => _ui.Post(_ => Refresh(), null);
        _svc.Activity += e => _ui.Post(_ => Notify(e), null);

        _link.Click += (_, _) => { if (_svc.IsLinked) Unlink(); else ShowLink(); };
        _update.Click += (_, _) => _updater.ApplyAndRestart();
        _settings.Click += (_, _) => ShowSettings();
        _pause.Click += (_, _) => _svc.SetPaused(!_svc.Settings.Paused);
        _private.Click += (_, _) => _svc.SetUploadPrivately(_private.Checked);
        _retry.Click += (_, _) => _svc.OnLinked();                      // wakes pending uploads and rescans
        _autostart.CheckedChanged += (_, _) => SetAutostart(_autostart.Checked);
        _autostart.Checked = IsAutostart();

        var menu = new ContextMenuStrip();
        menu.Items.AddRange([
            _statusItem, new ToolStripSeparator(), _link, _settings, _pause, _private, _retry, new ToolStripSeparator(),
            Item(T("로그 열기", "Open log"), () => OpenPath(_svc.LogFile)),
            Item(T("사이트 열기", "Open website"), OpenSite),
            _autostart, _update, new ToolStripSeparator(),
            Item(T("종료", "Exit"), ExitApp),
        ]);

        _tray = new NotifyIcon { ContextMenuStrip = menu, Visible = true };
        _tray.DoubleClick += (_, _) => { if (!_svc.IsLinked) ShowLink(); };
        _svc.Start();
        Refresh();
        if (!_svc.IsLinked) ShowLink();                                 // first run: go straight to linking
    }

    private static ToolStripMenuItem Item(string text, Action onClick)
    {
        var i = new ToolStripMenuItem(text);
        i.Click += (_, _) => onClick();
        return i;
    }

    private void Refresh()
    {
        var (text, color) = _svc.State switch
        {
            ServiceState.NotLinked => (T("연결되지 않음", "Not linked"), Color.Gray),
            ServiceState.Watching => (T("리플레이 감시 중", "Watching for replays"), Color.FromArgb(60, 120, 255)),
            ServiceState.Paused => (T("일시 중지됨", "Paused"), Color.Gray),
            ServiceState.NeedsConsent => (T("업로드 동의가 꺼져 있음 (설정에서 켜기)", "Upload consent is off (turn it on in settings)"), Color.Orange),
            ServiceState.NeedsRelink => (T("다시 연결해야 합니다", "Please link again"), Color.Orange),
            ServiceState.NoFolders => (T("SC2 리플레이 폴더를 찾지 못함", "No StarCraft II replay folder found"), Color.Orange),
            _ => ("", Color.Gray),
        };
        var pending = _svc.PendingCount;
        _statusItem.Text = pending > 0 ? $"{text} · {T("대기", "waiting")} {pending}" : text;
        _link.Text = _svc.IsLinked ? T("연결 해제", "Unlink account") : T("계정 연결…", "Link account…");
        if (_updater.ReadyVersion is { } v)
        {
            _update.Text = T($"{v} 업데이트 설치 후 다시 시작", $"Update to {v} and restart");
            _update.Visible = true;
        }
        _autostart.Checked = IsAutostart();
        _settings.Text = T("설정…", "Settings…");
        _settings.Enabled = _svc.IsLinked;
        _pause.Text = _svc.Settings.Paused ? T("재개", "Resume") : T("일시 중지", "Pause");
        _pause.Enabled = _svc.IsLinked;
        _private.Text = T("비공개로만 올리기", "Upload as private");
        _private.Checked = _svc.Settings.UploadPrivately;
        _private.Enabled = _svc.IsLinked;
        _retry.Text = T("지금 다시 시도", "Retry now");
        _retry.Enabled = _svc.IsLinked && pending > 0;
        _tray.Text = Truncate($"BPM Uploader — {text}", 63);                // NotifyIcon.Text is limited to 63 chars
        var old = _tray.Icon;
        _tray.Icon = MakeIcon(color);
        old?.Dispose();

        if (_svc.State is ServiceState.NeedsRelink or ServiceState.NeedsConsent)
            _tray.ShowBalloonTip(5000, "BPM Uploader", _statusItem.Text, ToolTipIcon.Warning);
    }

    private void Notify(UploadEvent e) =>
        _tray.ShowBalloonTip(4000, "BPM Uploader", e.Success ? T("리플레이를 업로드했습니다.", "Replay uploaded.") : $"{e.File}: {e.Message}",
            e.Success ? ToolTipIcon.Info : ToolTipIcon.Warning);

    private void ShowLink()
    {
        if (_linkForm is { IsDisposed: false }) { _linkForm.Activate(); return; }
        _linkForm = new LinkForm(_svc.Settings, _home);
        _linkForm.FormClosed += (_, _) =>
        {
            if (_linkForm?.Result is { Success: true }) _svc.OnLinked();
            Refresh();
        };
        _linkForm.Show();
    }

    private void ShowSettings()
    {
        if (_settingsForm is { IsDisposed: false }) { _settingsForm.Activate(); return; }
        _settingsForm = new SettingsForm(_svc, UpdateStatus());
        _settingsForm.FormClosed += (_, _) => Refresh();
        _settingsForm.Show();
    }

    private string UpdateStatus() =>
        !_updater.Enabled ? T("자동 업데이트: 꺼짐 (개발 빌드이거나 업데이트 주소가 없음)", "Automatic updates: off (development build or no update address)")
        : _updater.ReadyVersion is { } v ? T($"자동 업데이트: {v} 준비됨 (종료할 때 설치)", $"Automatic updates: {v} is ready (installs on exit)")
        : T("자동 업데이트: 켜짐", "Automatic updates: on");

    private void Unlink()
    {
        _svc.Unlink();
        Refresh();
    }

    private void OpenSite()
    {
        var url = _svc.Settings.EffectiveServerUrl;
        if (url.Length > 0) OpenPath(url);
    }

    private static void OpenPath(string target)
    {
        try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); }
        catch (Exception e) when (e is System.ComponentModel.Win32Exception or FileNotFoundException) { /* nothing registered to open it */ }
    }

    internal static bool IsAutostart()
    {
        using var k = Registry.CurrentUser.OpenSubKey(RunKey);
        return k?.GetValue(RunValue) is string;
    }

    internal static void SetAutostart(bool on)
    {
        using var k = Registry.CurrentUser.OpenSubKey(RunKey, writable: true);
        if (k is null) return;
        if (on) k.SetValue(RunValue, $"\"{Environment.ProcessPath}\"");
        else k.DeleteValue(RunValue, throwOnMissingValue: false);
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..(max - 1)] + "…";

    private static Icon MakeIcon(Color color)
    {
        using var bmp = new Bitmap(32, 32);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            using var fill = new SolidBrush(color);
            g.FillEllipse(fill, 2, 2, 28, 28);
            using var font = new Font("Segoe UI", 15, FontStyle.Bold, GraphicsUnit.Pixel);
            using var white = new SolidBrush(Color.White);
            g.DrawString("B", font, white, new RectangleF(0, 4, 32, 26), new StringFormat { Alignment = StringAlignment.Center });
        }
        var h = bmp.GetHicon();
        try { return (Icon)Icon.FromHandle(h).Clone(); }
        finally { NativeMethods.DestroyIcon(h); }
    }

    private void ExitApp()
    {
        _tray.Visible = false;
        _updater.ApplyWhenExited();                                     // a downloaded update installs once we are gone
        _updater.Dispose();
        _svc.Dispose();
        _tray.Dispose();
        ExitThread();
    }

    private static class NativeMethods
    {
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool DestroyIcon(IntPtr handle);
    }
}
