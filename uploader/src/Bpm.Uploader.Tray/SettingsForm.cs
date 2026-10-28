using System.Diagnostics;
using System.Globalization;
using Bpm.Uploader.Core.Net;
using Bpm.Uploader.Core.Service;
using Bpm.Uploader.Core.Storage;
using static Bpm.Uploader.Tray.Loc;

namespace Bpm.Uploader.Tray;

/// <summary>The uploader settings, presented as a compact operations console rather than a stock tab dialog.</summary>
internal sealed class SettingsForm : Form
{
    private const int TextWidth = 500;
    private readonly UploadService _svc;
    private readonly string _updateStatus;
    private readonly Panel _pageHost = new() { Dock = DockStyle.Fill, BackColor = UiTheme.Back, Padding = new Padding(24) };
    private readonly Panel[] _pages = new Panel[3];
    private readonly Button[] _nav = new Button[3];

    private readonly BpmSwitch _c1 = new();
    private readonly BpmSwitch _c2 = new();
    private readonly BpmSwitch _c3 = new();
    private readonly BpmSwitch _private = new();
    private readonly Label _status = UiTheme.Label("", 9, UiTheme.Muted);
    private bool _loading = true;
    private int _seq;

    private readonly ListBox _auto = new() { Height = 64, Width = TextWidth, Enabled = false, HorizontalScrollbar = true };
    private readonly ListBox _extra = new() { Height = 88, Width = TextWidth, HorizontalScrollbar = true };
    private readonly Button _remove = UiTheme.Button("");
    private readonly Label _folderMsg = UiTheme.Label("", 9, UiTheme.Muted);

    private readonly BpmSwitch _autostart = new();
    private readonly BpmSwitch _paused = new();

    public SettingsForm(UploadService svc, string updateStatus)
    {
        _svc = svc;
        _updateStatus = updateStatus;
        Text = T("BPM 업로더 설정", "BPM Uploader settings");
        Font = new Font("Segoe UI", 9);
        BackColor = UiTheme.Back;
        ForeColor = UiTheme.Text;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(840, 600);

        var header = Header();
        var rail = Navigation();
        var body = new Panel { Dock = DockStyle.Fill, BackColor = UiTheme.Back };
        body.Controls.Add(_pageHost);
        body.Controls.Add(rail);
        Controls.Add(body);
        Controls.Add(header);

        _pages[0] = SharingPage();
        _pages[1] = FoldersPage();
        _pages[2] = ProgramPage();
        foreach (var page in _pages) { page.Dock = DockStyle.Fill; _pageHost.Controls.Add(page); }
        SelectPage(0);
        Shown += async (_, _) => await LoadAsync();
    }

    private Control Header()
    {
        var header = new Panel { Dock = DockStyle.Top, Height = 78, BackColor = UiTheme.Surface, Padding = new Padding(20, 12, 18, 12) };
        header.Paint += (_, e) => ControlPaint.DrawBorder(e.Graphics, header.ClientRectangle, UiTheme.Line, ButtonBorderStyle.Solid);
        var logo = UiTheme.Logo(220, 44); logo.Location = new Point(16, 16);
        var title = UiTheme.Label(T("업로더 설정", "UPLOADER SETTINGS"), 9, UiTheme.Muted, true); title.Location = new Point(250, 19); title.Font = UiTheme.Mono(9);
        var detail = UiTheme.Label(T("리플레이 자동 업로드와 공유 범위", "REPLAY WATCHING & SHARING"), 10, UiTheme.Text); detail.Location = new Point(250, 39);
        header.Controls.AddRange([logo, title, detail]);
        return header;
    }

    private Control Navigation()
    {
        var rail = new Panel { Dock = DockStyle.Left, Width = 175, BackColor = UiTheme.Surface, Padding = new Padding(12, 22, 12, 12) };
        rail.Paint += (_, e) => ControlPaint.DrawBorder(e.Graphics, rail.ClientRectangle, UiTheme.Line, ButtonBorderStyle.Solid);
        var labels = new[] { T("공유", "Sharing"), T("리플레이 폴더", "Replay folders"), T("프로그램", "Program") };
        for (var i = labels.Length - 1; i >= 0; i--)
        {
            var index = i;
            var button = new Button
            {
                Text = labels[i], Dock = DockStyle.Top, Height = 48, TextAlign = ContentAlignment.MiddleLeft,
                Padding = new Padding(13, 0, 0, 0), FlatStyle = FlatStyle.Flat,
                FlatAppearance = { BorderSize = 0, MouseOverBackColor = UiTheme.SurfaceHover }, BackColor = UiTheme.Surface, ForeColor = UiTheme.Muted,
                Font = new Font("Segoe UI", 10, FontStyle.Bold), Cursor = Cursors.Hand,
            };
            button.Click += (_, _) => SelectPage(index);
            rail.Controls.Add(button);
            _nav[i] = button;
        }
        return rail;
    }

    private void SelectPage(int index)
    {
        for (var i = 0; i < _pages.Length; i++)
        {
            _pages[i].Visible = i == index;
            _nav[i].BackColor = i == index ? Color.FromArgb(25, 61, 73) : UiTheme.Surface;
            _nav[i].ForeColor = i == index ? UiTheme.Accent : UiTheme.Muted;
        }
    }

    // Used by UiSnapshot without exposing interactive navigation as a test seam.
    internal void SelectSnapshotPage(int index) => SelectPage(index);

    private static Panel Page() => new() { BackColor = UiTheme.Back, AutoScroll = true };
    private static FlowLayoutPanel Stack() => new() { Dock = DockStyle.Top, AutoSize = true, FlowDirection = FlowDirection.TopDown, WrapContents = false };
    private static Label Note(string text)
    {
        var label = UiTheme.Label(text, 9, UiTheme.Muted);
        label.MaximumSize = new Size(TextWidth, 0);
        return label;
    }

    private Panel SharingPage()
    {
        var page = Page();
        var scroll = new Panel { Dock = DockStyle.Fill, AutoScroll = true, BackColor = UiTheme.Back, Padding = new Padding(0, 66, 0, 0) };
        var stack = Stack();
        var status = StatusBand();
        status.Dock = DockStyle.Top;
        var title = UiTheme.Label(T("공유 설정", "Sharing"), 23, UiTheme.Text, true); title.Margin = new Padding(0, 18, 0, 4);
        var lead = Note(T("C1~C3는 서로 독립적인 선택 동의이며 기본값은 꺼짐입니다. 변경 사항은 즉시 저장되고 언제든 철회할 수 있습니다.", "C1–C3 are independent optional consents and are off by default. Changes are saved immediately and can be withdrawn at any time.")); lead.Margin = new Padding(0, 0, 0, 16);
        _c1.CheckedChanged += async (_, _) => await SaveAsync();
        _c2.CheckedChanged += async (_, _) => await SaveAsync();
        _c3.CheckedChanged += async (_, _) => await SaveAsync();
        _c1.Enabled = _c2.Enabled = _c3.Enabled = false;
        _private.Checked = _svc.Settings.UploadPrivately;
        _private.CheckedChanged += (_, _) => _svc.SetUploadPrivately(_private.Checked);
        var site = UiTheme.Button(T("웹 계정 설정 열기", "Open account settings"));
        site.Click += (_, _) => OpenSite("/account");
        stack.Controls.AddRange([
            status, title, lead,
            SettingRow(T("[선택] 분석용 업로드 (C1)", "[Optional] Analysis upload (C1)"), T("원본 리플레이와 경기 기록을 저장해 나만 볼 수 있는 분석을 만듭니다. 직접 삭제·회원 탈퇴·최대 보관기간까지 보관합니다. 끄면 새 업로드가 중단됩니다.", "Stores the original replay and game records to create analysis visible only to you. Retained until deletion, account closure or the maximum retention period. Turning it off stops new uploads."), _c1),
            SettingRow(T("[선택] 공개·익명 통계 (C2)", "[Optional] Public view & anonymous stats (C2)"), T("이름·프로필 핸들·채팅을 뺀 분석과 재생을 공개하고 익명 통계에 반영합니다. 원본 파일은 공개하지 않습니다.", "Publishes analysis and playback without names, profile handles or chat and includes it in anonymous statistics. The original file is never shared."), _c2),
            SettingRow(T("[선택] AI 학습 활용 (C3)", "[Optional] AI training use (C3)"), T("향후 식별정보를 제거한 게임 기록을 학습 후보로 사용할 수 있습니다. 현재 학습 파이프라인은 운영하지 않습니다.", "Allows future use of gameplay with identifiers removed as a training candidate. No training pipeline is currently operating."), _c3),
            SettingRow(T("지금부터 올리는 경기는 비공개로", "Upload new games as private"), T("켜 두면 이후 업로드되는 경기는 공개 목록·통계·AI 학습에서 제외됩니다. 프로게이머 연습처럼 노출되면 안 되는 경기에 쓰세요. 이미 올린 경기는 웹의 내 리플레이에서 바꿉니다.", "While on, games uploaded from now on stay off the public pages, statistics and AI training. Use it for games that must not be exposed, such as practice matches. Change games you already uploaded in My replays on the website."), _private),
            _status, Note(T("Battle.net 계정 식별자·표시 이름과 동의 이력은 기본 서비스 제공을 위해 회원 탈퇴 시까지 처리합니다. 자세한 보유기간과 철회·삭제 방법은 웹의 개인정보 처리방침에서 확인하세요.", "Your Battle.net account identifier, display name and consent history are processed until account deletion to provide the basic service. See the Privacy Policy on the website for retention, withdrawal and deletion details.")), Note(T("연결된 기기 관리, 자료 내려받기와 계정 삭제는 웹 계정 설정에서 할 수 있습니다.", "Manage linked devices, download data and delete your account in web account settings.")), site]);
        scroll.Controls.Add(stack);
        page.Controls.Add(scroll);
        page.Controls.Add(status);
        return page;
    }

    private Panel StatusBand()
    {
        var band = new Panel { BackColor = UiTheme.Surface, Height = 58, Padding = new Padding(16, 12, 16, 12) };
        band.Paint += (_, e) => ControlPaint.DrawBorder(e.Graphics, band.ClientRectangle, UiTheme.Line, ButtonBorderStyle.Solid);
        var dot = new Panel { Size = new Size(10, 10), Location = new Point(17, 20), BackColor = UiTheme.Good };
        dot.Paint += (_, e) => e.Graphics.FillEllipse(new SolidBrush(UiTheme.Good), 0, 0, 10, 10);
        var label = UiTheme.Label(T("리플레이 감시 상태와 공유 범위를 관리합니다", "Manage replay watching and sharing"), 10, UiTheme.Text, true); label.Location = new Point(38, 15);
        band.Controls.AddRange([dot, label]);
        return band;
    }

    private static Panel SettingRow(string title, string description, BpmSwitch toggle)
    {
        var card = UiTheme.Card();
        card.Size = new Size(TextWidth + 80, 92);
        var heading = UiTheme.Label(title, 11, UiTheme.Text, true); heading.Location = new Point(20, 17);
        var detail = Note(description); detail.Location = new Point(20, 41); detail.MaximumSize = new Size(TextWidth - 80, 0);
        toggle.Anchor = AnchorStyles.Top | AnchorStyles.Right;
        toggle.Location = new Point(card.Width - 70, 30);
        card.Resize += (_, _) => toggle.Left = card.Width - 70;
        card.Controls.AddRange([heading, detail, toggle]);
        return card;
    }

    private async Task LoadAsync()
    {
        ConsentCheck? c;
        try { c = await _svc.GetConsentAsync(); }
        catch (Exception) { c = new ConsentCheck(ConsentKind.Unavailable); }
        if (IsDisposed) return;
        if (c is null) { _status.Text = T("계정을 먼저 연결하세요.", "Link your account first."); return; }
        switch (c.Kind)
        {
            case ConsentKind.Ok: Set(c); EnableConsent(true); _status.Text = ""; break;
            case ConsentKind.AuthLost: _status.Text = T("연결이 해제되었습니다. 트레이 메뉴에서 다시 연결하세요.", "The link was removed. Link again from the tray menu."); break;
            default: _status.Text = T("서버에 연결하지 못했습니다. 나중에 다시 열어 주세요.", "Could not reach the server. Open this again later."); break;
        }
    }

    private void Set(ConsentCheck c)
    {
        _loading = true;
        (_c1.Checked, _c2.Checked, _c3.Checked) = (c.C1, c.C2, c.C3);
        _loading = false;
    }

    private void EnableConsent(bool on) => _c1.Enabled = _c2.Enabled = _c3.Enabled = on;

    private async Task SaveAsync()
    {
        if (_loading) return;
        var mine = ++_seq;
        var want = (_c1.Checked, _c2.Checked, _c3.Checked);
        EnableConsent(false);
        _status.Text = T("저장 중…", "Saving…");
        var r = await _svc.SetConsentAsync(want.Item1, want.Item2, want.Item3);
        if (IsDisposed || mine != _seq) return;
        if (r is { Kind: ConsentKind.Ok })
        {
            Set(r);
            _status.Text = T("저장되었습니다.", "Saved.") + (r.C1 ? "" : " " + T("업로드가 중단되었습니다.", "Uploading is stopped."));
        }
        else
        {
            await LoadAsync();
            _status.Text = T("저장하지 못했습니다. ", "Could not save. ") + _status.Text;
        }
        EnableConsent(r?.Kind != ConsentKind.AuthLost);
    }

    private Panel FoldersPage()
    {
        var page = Page(); var stack = Stack();
        var title = UiTheme.Label(T("리플레이 폴더", "Replay folders"), 23, UiTheme.Text, true); title.Margin = new Padding(0, 18, 0, 4);
        var lead = Note(T("자동으로 찾은 폴더와 직접 추가한 폴더를 관리합니다.", "Manage automatically found and manually added folders.")); lead.Margin = new Padding(0, 0, 0, 16);
        _remove.Text = T("선택한 폴더 제거", "Remove selected"); _remove.Enabled = false;
        var add = UiTheme.Button(T("폴더 추가", "Add folder"), true);
        var buttons = new FlowLayoutPanel { AutoSize = true, Margin = new Padding(0, 0, 0, 12) };
        buttons.Controls.AddRange([add, _remove]);
        add.Click += (_, _) => AddFolder(); _remove.Click += (_, _) => RemoveSelected();
        _extra.SelectedIndexChanged += (_, _) => _remove.Enabled = _extra.SelectedIndex >= 0;
        RefreshFolders();
        stack.Controls.AddRange([title, lead, SectionLabel(T("자동으로 찾음", "Found automatically")), _auto, SectionLabel(T("직접 추가한 폴더", "Folders you added")), _extra, buttons, _folderMsg, Note(T("기본 위치가 아니라면 StarCraft II 폴더 또는 Replays\\Multiplayer 폴더를 선택하세요.", "If your files are elsewhere, select the StarCraft II folder or Replays\\Multiplayer."))]);
        page.Controls.Add(stack); return page;
    }

    private static Label SectionLabel(string text)
    {
        var label = UiTheme.Label(text, 9, UiTheme.Accent, true);
        label.Font = UiTheme.Mono(9);
        label.Margin = new Padding(0, 8, 0, 5);
        return label;
    }

    private void RefreshFolders()
    {
        _auto.Items.Clear(); foreach (var f in _svc.AutoFolders) _auto.Items.Add(f);
        if (_auto.Items.Count == 0) _auto.Items.Add(T("(찾지 못함)", "(none found)"));
        _extra.Items.Clear(); foreach (var f in _svc.ExtraFolders) _extra.Items.Add(f); _remove.Enabled = false;
    }

    private void AddFolder()
    {
        using var dlg = new FolderBrowserDialog { Description = T("리플레이가 저장되는 폴더를 고르세요.", "Pick the folder where replays are saved."), UseDescriptionForTitle = true, ShowNewFolderButton = false };
        if (dlg.ShowDialog(this) != DialogResult.OK) return;
        _folderMsg.Text = _svc.AddFolder(dlg.SelectedPath) switch
        {
            AddFolderResult.Added => T("추가되었습니다. 지금부터 이 폴더를 감시합니다.", "Added. This folder is watched from now on."),
            AddFolderResult.AlreadyWatched => T("이미 감시 중인 폴더입니다.", "Already watched."),
            _ => T("리플레이 폴더를 찾지 못했습니다. 다른 폴더를 골라 보세요.", "No replay folder found there. Try another folder."),
        };
        RefreshFolders();
    }

    private void RemoveSelected()
    {
        if (_extra.SelectedItem is not string path) return;
        _svc.RemoveFolder(path); _folderMsg.Text = T("제거되었습니다.", "Removed."); RefreshFolders();
    }

    private Panel ProgramPage()
    {
        var page = Page(); var stack = Stack();
        var title = UiTheme.Label(T("프로그램", "Program"), 23, UiTheme.Text, true); title.Margin = new Padding(0, 18, 0, 4);
        var lead = Note(T("시작 및 업로드 동작을 관리합니다.", "Control startup and uploading behavior.")); lead.Margin = new Padding(0, 0, 0, 16);
        _autostart.Checked = TrayContext.IsAutostart(); _paused.Checked = _svc.Settings.Paused;
        _autostart.CheckedChanged += (_, _) => TrayContext.SetAutostart(_autostart.Checked);
        _paused.CheckedChanged += (_, _) => _svc.SetPaused(_paused.Checked);
        var version = Note($"BPM Uploader {BuildInfo.Version}\n{_updateStatus}"); version.Margin = new Padding(0, 8, 0, 12);
        var log = UiTheme.Button(T("로그 열기", "Open log")); var data = UiTheme.Button(T("설정 폴더", "Open settings folder")); var site = UiTheme.Button(T("웹사이트", "Open website"));
        log.Click += (_, _) => Open(_svc.LogFile); data.Click += (_, _) => Open(Path.GetDirectoryName(_svc.LogFile)!); site.Click += (_, _) => OpenSite("");
        var buttons = new FlowLayoutPanel { AutoSize = true }; buttons.Controls.AddRange([log, data, site]);
        stack.Controls.AddRange([title, lead, SettingRow(T("Windows와 함께 시작", "Start with Windows"), T("로그인할 때 업로더를 자동으로 시작합니다.", "Start the uploader automatically when you sign in."), _autostart), SettingRow(T("업로드 일시 중지", "Pause uploading"), T("감시와 업로드를 멈춥니다. 다시 끄면 재개합니다.", "Stops watching and uploading. Turn it off to resume."), _paused), version, buttons]);
        page.Controls.Add(stack); return page;
    }

    private void OpenSite(string path)
    {
        var url = _svc.Settings.EffectiveServerUrl; if (url.Length == 0) return;
        var lang = CultureInfo.CurrentUICulture.Name.StartsWith("ko", StringComparison.OrdinalIgnoreCase) ? "ko" : "en";
        Open(path.Length == 0 ? url : $"{url}/{lang}{path}");
    }

    private static void Open(string target)
    {
        try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); }
        catch (Exception e) when (e is System.ComponentModel.Win32Exception or FileNotFoundException) { }
    }
}
