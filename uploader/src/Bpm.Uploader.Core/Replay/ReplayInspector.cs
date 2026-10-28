using System.Text;
using System.Text.RegularExpressions;

namespace Bpm.Uploader.Core.Replay;

public enum ReplayKind
{
    /// <summary>The mod's draft upgrades are in the replay: upload it.</summary>
    Bpm,
    /// <summary>A readable replay with no BPM draft: never leaves the machine.</summary>
    NotBpm,
    /// <summary>Could not be read as an SC2 replay (still being written, corrupt).</summary>
    Unreadable,
}

public sealed record InspectResult(ReplayKind Kind, int Bans, int Picks, string? Error = null);

/// <summary>
/// Decides locally whether a replay is a BPM game, so ordinary ladder games are never uploaded.
/// The mod grants hidden upgrades BPM_Ban_* / BPM_Pick_* when the draft is applied; the replay's tracker stream
/// stores them as plain byte strings, so a byte search is enough and does not depend on the game build's protocol.
/// Mirrors worker/bpm_replay/draft_decode.py (server side repeats the check; the client is not trusted).
/// </summary>
public static partial class ReplayInspector
{
    private const string TrackerFile = "replay.tracker.events";

    [GeneratedRegex(@"BPM_(Ban|Pick)_[A-Za-z0-9]+", RegexOptions.CultureInvariant)]
    private static partial Regex UpgradeName();

    public static InspectResult Inspect(string path)
    {
        try
        {
            return Inspect(File.ReadAllBytes(path));
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            return new InspectResult(ReplayKind.Unreadable, 0, 0, e.Message);
        }
    }

    public static InspectResult Inspect(byte[] replay)
    {
        try
        {
            var tracker = MpqArchive.Open(replay).ReadFile(TrackerFile);
            if (tracker is null) return new InspectResult(ReplayKind.Unreadable, 0, 0, "no tracker events");

            // Latin1 maps every byte to one char, so the regex runs over raw bytes without decoding the stream.
            var text = Encoding.Latin1.GetString(tracker);
            HashSet<string> bans = [], picks = [];
            foreach (Match m in UpgradeName().Matches(text))
                (m.Groups[1].Value == "Ban" ? bans : picks).Add(m.Value);

            // Both players get the upgrades twice (draft, then game start); distinct names are a per-replay lower bound.
            // A BPM game where nobody banned or picked anything still carries the convenience-mode marker.
            var marker = text.Contains("BPM_Upgrade_ConvenienceMode", StringComparison.Ordinal);
            return bans.Count + picks.Count > 0 || marker
                ? new InspectResult(ReplayKind.Bpm, bans.Count, picks.Count)
                : new InspectResult(ReplayKind.NotBpm, 0, 0);
        }
        catch (Exception e) when (e is InvalidDataException or NotSupportedException or OverflowException or ArgumentException or IOException)
        {
            return new InspectResult(ReplayKind.Unreadable, 0, 0, e.Message);
        }
    }
}
