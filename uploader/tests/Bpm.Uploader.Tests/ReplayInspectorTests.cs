using Bpm.Uploader.Core.Replay;

namespace Bpm.Uploader.Tests;

public class ReplayInspectorTests
{
    private static string Fixture(string name) => Path.Combine(AppContext.BaseDirectory, "Fixtures", name);

    [Fact]
    public void Real_bot_replay_is_detected_with_the_same_picks_as_the_server_decoder()
    {
        // worker/tests asserts the same file: distinct bans {Raven, Thor, VikingFighter}, picks {ScienceVessel, Goliath, Wraith}.
        var r = ReplayInspector.Inspect(Fixture("bot_tvt_3picks.SC2Replay"));
        Assert.Equal(ReplayKind.Bpm, r.Kind);
        Assert.Equal(3, r.Bans);
        Assert.Equal(3, r.Picks);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Tracker_stream_with_draft_upgrades_is_bpm(bool compressed)
    {
        var r = ReplayInspector.Inspect(TestMpq.Replay("xxSprayTerran\0BPM_Ban_Thor\0BPM_Pick_Goliath\0BPM_Ban_Thor", compressed));
        Assert.Equal(new InspectResult(ReplayKind.Bpm, 1, 1), r);
    }

    [Fact]
    public void Convenience_marker_alone_counts_as_bpm()
    {
        Assert.Equal(ReplayKind.Bpm, ReplayInspector.Inspect(TestMpq.Replay("BPM_Upgrade_ConvenienceMode")).Kind);
    }

    [Fact]
    public void Ordinary_game_is_not_bpm_and_would_never_be_uploaded()
    {
        var r = ReplayInspector.Inspect(TestMpq.Replay("SprayTerran\0Stimpack\0TerranInfantryWeaponsLevel1\0BPMish_Ban"));
        Assert.Equal(ReplayKind.NotBpm, r.Kind);
    }

    [Fact]
    public void Other_bpm_upgrades_without_draft_or_marker_are_not_enough()
    {
        // A research upgrade name alone must not make a ladder game look like BPM.
        Assert.Equal(ReplayKind.NotBpm, ReplayInspector.Inspect(TestMpq.Replay("BPM_GoliathRange")).Kind);
    }

    [Fact]
    public void Archive_without_tracker_events_is_unreadable()
    {
        var r = ReplayInspector.Inspect(TestMpq.Build("replay.details", [1, 2, 3, 4, 5, 6, 7, 8]));
        Assert.Equal(ReplayKind.Unreadable, r.Kind);
    }

    [Fact]
    public void Garbage_truncated_and_empty_files_are_unreadable_not_crashes()
    {
        var good = File.ReadAllBytes(Fixture("bot_tvt_3picks.SC2Replay"));
        foreach (var bytes in new[] { Array.Empty<byte>(), "this is not a replay at all......................"u8.ToArray(), good[..(good.Length / 2)], good[..40] })
            Assert.Equal(ReplayKind.Unreadable, ReplayInspector.Inspect(bytes).Kind);
    }

    [Fact]
    public void Corrupted_bytes_in_a_real_replay_do_not_throw()
    {
        var bytes = File.ReadAllBytes(Fixture("bot_tvt_3picks.SC2Replay"));
        var rnd = new Random(7);
        for (var i = 0; i < 200; i++)
        {
            var copy = (byte[])bytes.Clone();
            for (var k = 0; k < 8; k++) copy[rnd.Next(copy.Length)] = (byte)rnd.Next(256);
            var kind = ReplayInspector.Inspect(copy).Kind;   // any verdict is fine; an exception is not
            Assert.True(Enum.IsDefined(kind));
        }
    }

    [Fact]
    public void Missing_file_is_unreadable()
    {
        Assert.Equal(ReplayKind.Unreadable, ReplayInspector.Inspect(Path.Combine(Path.GetTempPath(), "nope-" + Guid.NewGuid() + ".SC2Replay")).Kind);
    }
}
