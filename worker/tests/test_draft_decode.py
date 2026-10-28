"""Run: python -X utf8 -m unittest discover -s worker/tests   (from BPM_Site, with s2protocol and mpyq installed)"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bpm_replay.draft_decode import ReplayError, decode_draft  # noqa: E402

FIX = Path(__file__).parent / "fixtures"


class BotReplay(unittest.TestCase):
    """Ground truth: the AI harness's own draft record for this game (bpm-ai-engine run_selfplay).
    A picked [Marauder, SiegeTank, Thor, VikingFighter, ScienceVessel]; B picked [Marauder, SiegeTank, Goliath, Wraith, ScienceVessel]."""

    def setUp(self):
        self.r = decode_draft(FIX / "bot_tvt_3picks.SC2Replay")

    def test_detected_as_bpm(self):
        self.assertTrue(self.r["isBpm"])
        self.assertEqual(self.r["warnings"], [])

    def test_player_a_only_science_vessel_is_visible(self):
        a = self.r["players"][0]
        self.assertEqual([p["unit"] for p in a["picks"]], ["ScienceVessel"])  # base picks leave no trace
        self.assertEqual(a["picks"][0]["replaces"], "Raven")
        self.assertEqual(a["bans"], [])  # Ban_Raven is the displaced default, not a real ban
        self.assertEqual(a["displaced"], ["Raven"])

    def test_player_b_picks_match_harness_record(self):
        b = self.r["players"][1]
        self.assertEqual(sorted(p["unit"] for p in b["picks"]), ["Goliath", "ScienceVessel", "Wraith"])
        self.assertEqual(b["displaced"], ["Raven", "Thor", "VikingFighter"])
        self.assertEqual(b["bans"], [])

    def test_race(self):
        self.assertEqual({p["race"] for p in self.r["players"]}, {"terran"})

    def test_result_unknown_when_a_player_left(self):
        # This game ended by a bot leaving, so the replay header has no result. Callers must not assume one;
        # the winner then comes from the match harness record, not the replay.
        self.assertEqual([p["result"] for p in self.r["players"]], [None, None])


class BadInput(unittest.TestCase):
    def test_garbage_file_raises_replay_error(self):
        bad = FIX / "garbage.tmp"
        bad.write_bytes(b"not a replay" * 20)
        try:
            with self.assertRaises(ReplayError):
                decode_draft(bad)
        finally:
            bad.unlink()


if __name__ == "__main__":
    unittest.main()
