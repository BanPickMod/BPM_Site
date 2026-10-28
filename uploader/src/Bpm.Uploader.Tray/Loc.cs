using System.Globalization;

namespace Bpm.Uploader.Tray;

/// <summary>UI strings in Korean and English (the site is bilingual; the OS UI language decides).</summary>
internal static class Loc
{
    private static readonly bool Ko = CultureInfo.CurrentUICulture.Name.StartsWith("ko", StringComparison.OrdinalIgnoreCase);

    public static string T(string ko, string en) => Ko ? ko : en;
}
