using System.Diagnostics;
using Bpm.Uploader.Core.Net;
using Bpm.Uploader.Core.Storage;
using static Bpm.Uploader.Tray.Loc;

namespace Bpm.Uploader.Tray;

/// <summary>Shows a device code in the same compact console language as the settings surface.</summary>
internal sealed class LinkForm : Form
{
    private readonly Label _status = UiTheme.Label("", 10, UiTheme.Muted);
    private readonly Label _code = UiTheme.Label("…", 28, UiTheme.Accent, true);
    private readonly Button _open = UiTheme.Button("", true);
    private readonly CancellationTokenSource _cts = new();
    private string? _url;

    public LinkResult? Result { get; private set; }

    public LinkForm(Settings settings, UploaderHome home)
    {
        Text = T("BPM 계정 연결", "Link BPM account");
        BackColor = UiTheme.Back;
        ForeColor = UiTheme.Text;
        Font = new Font("Segoe UI", 9);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(500, 365);

        var header = new Panel { Dock = DockStyle.Top, Height = 80, BackColor = UiTheme.Surface };
        header.Paint += (_, e) => ControlPaint.DrawBorder(e.Graphics, header.ClientRectangle, UiTheme.Line, ButtonBorderStyle.Solid);
        var logo = UiTheme.Logo(200, 42); logo.Location = new Point(18, 17);
        header.Controls.Add(logo);

        var content = new Panel { Dock = DockStyle.Fill, Padding = new Padding(26, 22, 26, 22), BackColor = UiTheme.Back };
        var title = UiTheme.Label(T("계정 연결", "Link your account"), 20, UiTheme.Text, true); title.Location = new Point(26, 20);
        _status.Location = new Point(26, 58); _status.MaximumSize = new Size(440, 0);
        var codeCard = UiTheme.Card(); codeCard.Location = new Point(26, 130); codeCard.Size = new Size(448, 76); codeCard.Padding = new Padding(18, 10, 18, 10);
        var codeCaption = UiTheme.Label(T("연결 코드", "LINK CODE"), 9, UiTheme.Muted, true); codeCaption.Font = UiTheme.Mono(9); codeCaption.Location = new Point(18, 13);
        _code.Location = new Point(17, 29);
        codeCard.Controls.AddRange([codeCaption, _code]);
        _open.Text = T("브라우저에서 열기", "Open in browser"); _open.Location = new Point(26, 230); _open.Enabled = false;
        var cancel = UiTheme.Button(T("취소", "Cancel")); cancel.Location = new Point(_open.Right + 8, 230);
        content.Controls.AddRange([title, _status, codeCard, _open, cancel]);
        Controls.Add(content); Controls.Add(header);

        _status.Text = T("연결 코드를 받는 중…", "Getting a link code…");
        _open.Click += (_, _) => { if (_url is not null) Process.Start(new ProcessStartInfo(_url) { UseShellExecute = true }); };
        cancel.Click += (_, _) => Close();
        FormClosed += (_, _) => _cts.Cancel();

        Shown += async (_, _) =>
        {
            var result = await DeviceLinker.LinkAsync(settings, home, c => BeginInvoke(() =>
            {
                _url = c.VerificationUriComplete;
                _code.Text = c.UserCode;
                _status.Text = T("브라우저에서 코드를 확인하고 동의 항목을 선택하세요. 승인되면 이 창이 자동으로 닫힙니다.", "Confirm this code in your browser and choose what to agree to. This window closes when approved.");
                _open.Enabled = true;
                Process.Start(new ProcessStartInfo(_url) { UseShellExecute = true });
            }), _cts.Token);
            if (_cts.IsCancellationRequested) return;
            Result = result;
            if (result.Success) { DialogResult = DialogResult.OK; Close(); }
            else { _status.Text = result.Message ?? T("연결하지 못했습니다.", "Could not link."); _code.Text = "—"; _open.Enabled = false; }
        };
    }
}
