using static Bpm.Uploader.Tray.Loc;

namespace Bpm.Uploader.Tray;

/// <summary>
/// Shown once, right after the installer finishes. The installer has no wizard of its own (it installs in one step, without
/// administrator rights, into the user's folder), so this window is the "done" screen: where it went, where to find it, what next.
/// </summary>
internal sealed class WelcomeForm : Form
{
    public WelcomeForm(string installFolder, bool linked, Action primary)
    {
        Text = T("BPM Uploader 설치 완료", "BPM Uploader installed");
        BackColor = UiTheme.Back;
        ForeColor = UiTheme.Text;
        Font = new Font("Segoe UI", 9);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;

        var header = new Panel { Dock = DockStyle.Top, Height = 80, BackColor = UiTheme.Surface };
        header.Paint += (_, e) => ControlPaint.DrawBorder(e.Graphics, header.ClientRectangle, UiTheme.Line, ButtonBorderStyle.Solid);
        var logo = UiTheme.Logo(200, 42); logo.Location = new Point(18, 17);
        header.Controls.Add(logo);

        var content = new Panel { Dock = DockStyle.Fill, BackColor = UiTheme.Back };
        var title = UiTheme.Label(T("설치가 완료되었습니다", "Installation complete"), 20, UiTheme.Good, true); title.Location = new Point(26, 18);
        var intro = UiTheme.Label(T(
            "BPM Uploader가 실행 중입니다. 창 없이 작업 표시줄 오른쪽 아래(시계 옆)의 트레이에서 동작하며, 아이콘이 보이지 않으면 ^ 표시를 눌러 숨겨진 아이콘을 확인하세요.",
            "BPM Uploader is running. It works from the tray at the bottom right of the taskbar (next to the clock); if you do not see the icon, open the ^ arrow for hidden icons."),
            10, UiTheme.Muted);
        intro.MaximumSize = new Size(448, 0); intro.Location = new Point(26, 60);
        var introBottom = intro.Top + intro.PreferredSize.Height;

        var card = UiTheme.Card(); card.Location = new Point(26, introBottom + 16);
        var caption = UiTheme.Label(T("설치 위치", "INSTALLED IN"), 9, UiTheme.Muted, true); caption.Font = UiTheme.Mono(9); caption.Location = new Point(16, 12);
        var path = UiTheme.Label(installFolder, 9, UiTheme.Text); path.Font = UiTheme.Mono(9); path.MaximumSize = new Size(416, 0); path.Location = new Point(16, 34);
        var note = UiTheme.Label(T("Windows를 시작할 때 자동으로 실행됩니다. 제거는 Windows 설정의 앱 목록에서 합니다.", "It starts with Windows. Remove it from the apps list in Windows Settings."), 9, UiTheme.Muted);
        note.MaximumSize = new Size(416, 0); note.Location = new Point(16, path.Top + path.PreferredSize.Height + 10);
        card.Size = new Size(448, note.Top + note.PreferredSize.Height + 14);
        card.Controls.AddRange([caption, path, note]);

        var next = UiTheme.Label(linked
            ? T("계정이 이미 연결되어 있습니다. 이후 BPM 게임이 끝나면 리플레이가 자동으로 올라갑니다.", "Your account is already linked. From now on, BPM game replays are uploaded when a game ends.")
            : T("다음 단계: 계정을 연결하면 이후 BPM 게임의 리플레이가 자동으로 올라갑니다.", "Next: link your account, and BPM game replays are then uploaded automatically."),
            10, UiTheme.Text);
        next.MaximumSize = new Size(448, 0); next.Location = new Point(26, card.Bottom + 18);
        var buttonsTop = next.Top + next.PreferredSize.Height + 18;

        var action = UiTheme.Button(linked ? T("설정 열기", "Open settings") : T("계정 연결", "Link account"), true); action.Location = new Point(26, buttonsTop);
        var close = UiTheme.Button(T("닫기", "Close")); close.Location = new Point(action.Right + 8, buttonsTop);
        action.Click += (_, _) => { Close(); primary(); };
        close.Click += (_, _) => Close();
        ClientSize = new Size(500, header.Height + buttonsTop + 34 + 24);
        content.Controls.AddRange([title, intro, card, next, action, close]);
        Controls.Add(content); Controls.Add(header);
        AcceptButton = action;
    }
}
