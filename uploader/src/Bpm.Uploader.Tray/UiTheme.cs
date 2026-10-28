using System.Drawing.Drawing2D;
using System.Reflection;

namespace Bpm.Uploader.Tray;

/// <summary>Small, dependency-free visual system shared by the uploader's WinForms surfaces.</summary>
internal static class UiTheme
{
    public static readonly Color Back = Color.FromArgb(10, 14, 21);
    public static readonly Color Surface = Color.FromArgb(17, 25, 38);
    public static readonly Color SurfaceHover = Color.FromArgb(22, 33, 50);
    public static readonly Color Line = Color.FromArgb(39, 56, 79);
    public static readonly Color Text = Color.FromArgb(230, 237, 247);
    public static readonly Color Muted = Color.FromArgb(151, 169, 193);
    public static readonly Color Accent = Color.FromArgb(76, 201, 224);
    public static readonly Color Good = Color.FromArgb(94, 224, 140);

    public static Font Title(float size = 18) => new("Segoe UI", size, FontStyle.Bold, GraphicsUnit.Point);
    public static Font Mono(float size = 9) => new("Cascadia Mono", size, FontStyle.Regular, GraphicsUnit.Point);

    public static PictureBox Logo(int width = 220, int height = 48)
    {
        var picture = new PictureBox { Size = new Size(width, height), SizeMode = PictureBoxSizeMode.Zoom, BackColor = Color.Transparent };
        var resource = Assembly.GetExecutingAssembly().GetManifestResourceNames()
            .SingleOrDefault(n => n.EndsWith("banpickmod-logo-v2-horizontal.png", StringComparison.Ordinal));
        if (resource is null) return picture;
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resource);
        if (stream is not null) picture.Image = Image.FromStream(stream);
        return picture;
    }

    public static Panel Card()
    {
        var panel = new Panel { BackColor = Surface, Padding = new Padding(20), Margin = new Padding(0, 0, 0, 12) };
        panel.Paint += (_, e) => ControlPaint.DrawBorder(e.Graphics, panel.ClientRectangle, Line, ButtonBorderStyle.Solid);
        return panel;
    }

    public static Button Button(string text, bool primary = false) => new()
    {
        Text = text,
        AutoSize = true,
        Height = 34,
        Padding = new Padding(14, 0, 14, 0),
        FlatStyle = FlatStyle.Flat,
        FlatAppearance = { BorderColor = primary ? Accent : Line, BorderSize = 1, MouseOverBackColor = primary ? Color.FromArgb(51, 128, 145) : SurfaceHover },
        BackColor = primary ? Accent : Surface,
        ForeColor = primary ? Back : Text,
        Font = new Font("Segoe UI", 9, FontStyle.Bold),
        Cursor = Cursors.Hand,
    };

    public static Label Label(string text, float size = 9, Color? color = null, bool bold = false) => new()
    {
        Text = text,
        AutoSize = true,
        ForeColor = color ?? Text,
        Font = new Font("Segoe UI", size, bold ? FontStyle.Bold : FontStyle.Regular),
        BackColor = Color.Transparent,
    };
}

/// <summary>A keyboard-accessible switch with a compact, native-drawn surface.</summary>
internal sealed class BpmSwitch : CheckBox
{
    public BpmSwitch()
    {
        AutoSize = false;
        Size = new Size(48, 26);
        Text = string.Empty;
        Cursor = Cursors.Hand;
        FlatStyle = FlatStyle.Flat;
        FlatAppearance.BorderSize = 0;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        var track = new Rectangle(1, 3, Width - 2, Height - 6);
        using var fill = new SolidBrush(Checked ? UiTheme.Accent : Color.FromArgb(74, 91, 117));
        e.Graphics.FillRoundedRectangle(fill, track, track.Height / 2);
        var diameter = track.Height - 6;
        var x = Checked ? track.Right - diameter - 3 : track.Left + 3;
        using var knob = new SolidBrush(Checked ? UiTheme.Back : Color.FromArgb(232, 238, 247));
        e.Graphics.FillEllipse(knob, x, track.Top + 3, diameter, diameter);
        if (Focused) ControlPaint.DrawFocusRectangle(e.Graphics, ClientRectangle, UiTheme.Accent, BackColor);
    }
}

internal static class GraphicsExtensions
{
    public static void FillRoundedRectangle(this Graphics graphics, Brush brush, Rectangle rectangle, int radius)
    {
        using var path = new GraphicsPath();
        path.AddArc(rectangle.Left, rectangle.Top, radius * 2, radius * 2, 180, 90);
        path.AddArc(rectangle.Right - radius * 2, rectangle.Top, radius * 2, radius * 2, 270, 90);
        path.AddArc(rectangle.Right - radius * 2, rectangle.Bottom - radius * 2, radius * 2, radius * 2, 0, 90);
        path.AddArc(rectangle.Left, rectangle.Bottom - radius * 2, radius * 2, radius * 2, 90, 90);
        path.CloseFigure();
        graphics.FillPath(brush, path);
    }
}
