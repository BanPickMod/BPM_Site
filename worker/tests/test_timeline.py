"""timeline 스키마 v1과 G2 위치 누락 정책의 단위 시험."""
import gzip
import json
import os
import sys
import unittest
from pathlib import Path

os.environ.setdefault("BPM_HANDLE_KEY", "test-handle-key-0123456789abcdef0123456789")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bpm_replay.timeline import build_timeline, gzip_timeline  # noqa: E402


def event(name, loop, **values):
    return {"_event": "NNet.Replay.Tracker." + name, "_gameloop": loop, **values}


class Timeline(unittest.TestCase):
    def setUp(self):
        self.decoded = {"map": "Test", "baseBuild": 1, "durationSec": 30, "players": [
            {"playerId": 1, "race": "terran", "result": "win", "isAi": False, "handle": "1-S2-1-1", "picks": [], "bans": [], "displaced": []},
            {"playerId": 2, "race": "zerg", "result": "loss", "isAi": True, "handle": None, "picks": [], "bans": [], "displaced": []},
        ]}

    def test_tracked_static_and_missing_units_have_explicit_modes(self):
        tracker = [
            event("SUnitBornEvent", 0, m_unitTagIndex=1, m_unitTagRecycle=1, m_unitTypeName=b"Marine", m_controlPlayerId=1, m_x=10, m_y=20),
            event("SUnitInitEvent", 0, m_unitTagIndex=2, m_unitTagRecycle=1, m_unitTypeName=b"Barracks", m_controlPlayerId=1, m_x=12, m_y=22),
            event("SUnitBornEvent", 0, m_unitTagIndex=3, m_unitTagRecycle=1, m_unitTypeName=b"Zergling", m_controlPlayerId=2, m_x=90, m_y=80),
            event("SUnitPositionsEvent", 224, m_firstUnitIndex=1, m_items=[0, 20, 30]),
            event("SUnitDiedEvent", 448, m_unitTagIndex=3, m_unitTagRecycle=1, m_x=30, m_y=40, m_killerPlayerId=1),
        ]
        timeline = build_timeline(tracker, self.decoded, "test")
        modes = {u["type"]: u["positionMode"] for u in timeline["units"]}
        self.assertEqual(modes, {"Marine": "tracked", "Barracks": "static", "Zergling": "event-endpoints"})
        missing = next(u for u in timeline["units"] if u["type"] == "Zergling")
        self.assertEqual(missing["track"], [])  # 출생→사망 직선 경로를 꾸며내지 않는다
        self.assertEqual(timeline["meta"]["positionPolicy"]["event-endpoints"], "fade-at-birth-and-death")
        self.assertIsNone(timeline["meta"]["mapTransform"])

    def test_delta_track_and_gzip_are_deterministic(self):
        tracker = [
            event("SUnitBornEvent", 0, m_unitTagIndex=7, m_unitTagRecycle=2, m_unitTypeName=b"Marine", m_controlPlayerId=1, m_x=1, m_y=2),
            event("SUnitPositionsEvent", 224, m_firstUnitIndex=7, m_items=[0, 10, 20]),
            event("SUnitPositionsEvent", 448, m_firstUnitIndex=7, m_items=[0, 13, 25]),
        ]
        timeline = build_timeline(tracker, self.decoded, "test")
        self.assertEqual(timeline["units"][0]["track"], [[100, 100, 200], [100, 30, 50]])
        a, b = gzip_timeline(timeline), gzip_timeline(timeline)
        self.assertEqual(a, b)
        self.assertEqual(json.loads(gzip.decompress(a))["schema"], 1)


if __name__ == "__main__":
    unittest.main()
