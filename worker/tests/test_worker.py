"""Run from BPM_Site:  python -X utf8 -m unittest discover -s worker/tests"""
import os
import sys
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("BPM_HANDLE_KEY", "test-handle-key-0123456789abcdef0123456789")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bpm_replay import analyze  # noqa: E402
from bpm_replay.client import ServerError  # noqa: E402
from run_worker import process_job, run  # noqa: E402

FIX = Path(__file__).parent / "fixtures"
BOT = FIX / "bot_tvt_3picks.SC2Replay"


class AnalyzeRealReplay(unittest.TestCase):
    def test_bpm_replay_becomes_ready_with_the_draft(self):
        r = analyze.analyze_file(BOT)
        self.assertEqual(r["status"], "READY")
        self.assertEqual(r["analyzerVersion"], analyze.ANALYZER_VERSION)
        a = r["analysis"]
        self.assertEqual(a["schema"], 1)
        self.assertEqual(a["map"], "BPM_Rorschach")
        p1, p2 = a["players"]
        self.assertEqual([x["unit"] for x in p1["picks"]], ["ScienceVessel"])
        self.assertEqual(sorted(x["unit"] for x in p2["picks"]), ["Goliath", "ScienceVessel", "Wraith"])
        self.assertEqual(p2["displaced"], ["Raven", "Thor", "VikingFighter"])

    def test_analysis_carries_what_identifies_the_game(self):
        # Start time and length let the server recognise two players' replays of one game (lib/replay/matchKey.ts).
        a = analyze.analyze_file(BOT)["analysis"]
        self.assertEqual(a["gameLoops"], 1344)
        self.assertEqual(a["startedAt"], "2026-10-27T09:46:57Z")

    def test_start_time_conversion(self):
        from bpm_replay.draft_decode import _started_at
        self.assertEqual(_started_at({"m_timeUTC": 134375680174019399}), "2026-10-27T09:46:57Z")
        self.assertIsNone(_started_at({}))
        self.assertIsNone(_started_at({"m_timeUTC": 0}))
        self.assertIsNone(_started_at({"m_timeUTC": 2**62}))                 # out of calendar range

    def test_analysis_never_contains_nicknames(self):
        # The bot replay's players are called foo54309 / foo54313; no display name may reach the stored analysis.
        text = str(analyze.analyze_file(BOT)["analysis"])
        self.assertNotIn("foo54309", text)
        self.assertNotIn("foo54313", text)
        self.assertNotIn("name", {k for p in analyze.analyze_file(BOT)["analysis"]["players"] for k in p})

    def test_no_battle_net_handle_leaves_the_worker_only_a_keyed_hash(self):
        import re
        # The fixture's players are bots, so build a human game by hand: the decoder output still carries raw handles.
        human = lambda pid, handle: {"playerId": pid, "handle": handle, "race": "terran", "result": "win" if pid == 1 else "loss",   # noqa: E731
                                     "isAi": False, "bans": [], "picks": [], "displaced": []}
        decoded = {"isBpm": True, "map": "M", "baseBuild": 1, "durationSec": 60, "convenienceMode": False, "warnings": [],
                   "players": [human(1, "2-S2-1-1234567"), human(2, "2-S2-1-7654321")]}
        a = analyze.to_job_result(decoded)["analysis"]
        self.assertIsNone(re.search(r"\d-S2-\d-\d{3,}", str(a)))
        for p in a["players"]:
            self.assertNotIn("handle", p)
            self.assertRegex(p["handleKey"], r"^[0-9a-f]{32}$")
        self.assertEqual(len({p["handleKey"] for p in a["players"]}), 2)
        # the same player in another game gets the same value: that is what recognises one game uploaded twice
        again = analyze.to_job_result({**decoded, "players": [human(1, "2-S2-1-7654321"), human(2, "2-S2-1-1234567")]})["analysis"]
        self.assertEqual({p["handleKey"] for p in again["players"]}, {p["handleKey"] for p in a["players"]})

    def test_the_bot_fixture_carries_no_handle_at_all(self):
        import gzip
        import re
        r = analyze.analyze_file(BOT)
        self.assertIsNone(re.search(r"\d-S2-\d-\d{3,}", str(r["analysis"]) + gzip.decompress(r["_timeline_gzip"]).decode("utf8")))
        self.assertTrue(all("handle" not in p for p in r["analysis"]["players"]))

    def test_result_is_small_enough_for_the_site(self):
        import json
        self.assertLess(len(json.dumps(analyze.analyze_file(BOT)["analysis"])), 8 * 1024)

    def test_timeline_is_gzip_and_contains_no_nicknames(self):
        import gzip
        import json
        r = analyze.analyze_file(BOT)
        blob = r["_timeline_gzip"]
        timeline = json.loads(gzip.decompress(blob))
        self.assertEqual(timeline["schema"], 1)
        self.assertEqual(timeline["meta"]["map"], "BPM_Rorschach")
        self.assertTrue(timeline["units"])
        self.assertTrue(timeline["series"])
        self.assertNotIn("foo54309", gzip.decompress(blob).decode("utf8"))
        self.assertEqual(blob, analyze.analyze_file(BOT)["_timeline_gzip"])


class AnalyzeBadInput(unittest.TestCase):
    def _file(self, data: bytes) -> Path:
        d = Path(tempfile.mkdtemp(prefix="bpm-test-"))
        self.addCleanup(lambda: [f.unlink() for f in d.iterdir()] and d.rmdir() or None)
        p = d / "x.SC2Replay"
        p.write_bytes(data)
        return p

    def test_garbage_is_rejected_as_corrupt(self):
        r = analyze.analyze_file(self._file(b"definitely not a replay " * 40))
        self.assertEqual((r["status"], r["rejectCode"]), ("REJECTED", "CORRUPT"))

    def test_truncated_replay_is_rejected_as_corrupt(self):
        r = analyze.analyze_file(self._file(BOT.read_bytes()[:300]))
        self.assertEqual((r["status"], r["rejectCode"]), ("REJECTED", "CORRUPT"))

    def test_hanging_decoder_is_killed(self):
        # A decoder that never finishes must cost one job, not the worker.
        sleeper = Path(tempfile.mkdtemp(prefix="bpm-test-")) / "sleeper.py"
        sleeper.write_text("import time\ntime.sleep(60)\n")
        self.addCleanup(lambda: (sleeper.unlink(), sleeper.parent.rmdir()))
        out = analyze.decode_isolated(BOT, timeout=1.5, decoder=sleeper)
        self.assertEqual(out["replayError"]["kind"], "corrupt")
        self.assertIn("exceeded", out["replayError"]["message"])

    def test_crashing_decoder_is_contained(self):
        crasher = Path(tempfile.mkdtemp(prefix="bpm-test-")) / "crash.py"
        crasher.write_text("import sys\nsys.exit(139)\n")
        self.addCleanup(lambda: (crasher.unlink(), crasher.parent.rmdir()))
        self.assertIn("replayError", analyze.decode_isolated(BOT, timeout=10, decoder=crasher))

    def test_mapping_of_decoder_verdicts(self):
        self.assertEqual(analyze.to_job_result({"isBpm": False})["rejectCode"], "NOT_BPM")
        self.assertEqual(analyze.to_job_result({"replayError": {"kind": "unsupported"}})["rejectCode"], "UNSUPPORTED")
        self.assertEqual(analyze.to_job_result({"replayError": {"kind": "corrupt"}})["rejectCode"], "CORRUPT")


class FakeClient:
    def __init__(self, jobs=(), data=b"x" * 100, download_error=None, report_error=None):
        self.jobs = list(jobs)
        self.data = data
        self.download_error = download_error
        self.report_error = report_error
        self.reports = []
        self.timelines = []

    def claim(self):
        return self.jobs.pop(0) if self.jobs else None

    def download(self, job_id):
        if self.download_error:
            raise self.download_error
        return self.data

    def report(self, job_id, result):
        if self.report_error:
            raise self.report_error
        self.reports.append((job_id, result))
        return {"status": result["status"]}

    def upload_timeline(self, job_id, data, attempt=None):
        self.timelines.append((job_id, data))
        return {"size": len(data), "schema": 1}


class ProcessJob(unittest.TestCase):
    def setUp(self):
        self.log = []

    def test_success_is_reported_and_temp_file_is_removed(self):
        seen = []

        def fake_analyze(path):
            seen.append(Path(path))
            self.assertTrue(Path(path).exists())
            return {"status": "READY", "analyzerVersion": "t", "analysis": {}, "_timeline_gzip": b"gzip"}

        c = FakeClient()
        self.assertEqual(process_job(c, {"id": 5, "attempt": 1}, fake_analyze, self.log.append), "READY")
        self.assertEqual(c.reports[0][0], 5)
        self.assertEqual(c.timelines, [(5, b"gzip")])
        self.assertFalse(seen[0].exists())                       # the replay copy never outlives the job
        self.assertFalse(seen[0].parent.exists())

    def test_an_analyzer_crash_is_reported_as_failed_so_the_site_can_retry(self):
        def boom(path):
            raise RuntimeError("kaboom")

        c = FakeClient()
        self.assertEqual(process_job(c, {"id": 1}, boom, self.log.append), "FAILED")
        self.assertEqual(c.reports[0][1]["status"], "FAILED")
        self.assertIn("kaboom", c.reports[0][1]["error"])

    def test_a_lost_lease_on_download_is_skipped_quietly(self):
        c = FakeClient(download_error=ServerError(409, "lease expired"))
        self.assertEqual(process_job(c, {"id": 1}, lambda p: {}, self.log.append), "LOST")
        self.assertEqual(c.reports, [])

    def test_a_lost_lease_on_report_is_not_an_error(self):
        c = FakeClient(report_error=ServerError(409, "lease expired"))
        self.assertEqual(process_job(c, {"id": 1}, lambda p: {"status": "READY", "_timeline_gzip": b"gzip"}, self.log.append), "LOST")

    def test_server_trouble_while_downloading_propagates_for_the_loop_to_handle(self):
        c = FakeClient(download_error=ServerError(500, "boom"))
        with self.assertRaises(ServerError):
            process_job(c, {"id": 1}, lambda p: {}, self.log.append)


class Loop(unittest.TestCase):
    def test_once_drains_the_queue_and_exits(self):
        c = FakeClient(jobs=[{"id": 1}, {"id": 2}, {"id": 3}])
        n = run(c, once=True, stop=lambda: False, analyze=lambda p: {"status": "READY", "_timeline_gzip": b"gzip"}, log=lambda m: None, sleep=lambda s: None)
        self.assertEqual((n, [r[0] for r in c.reports]), (3, [1, 2, 3]))

    def test_one_failing_report_does_not_stop_the_worker(self):
        class Flaky(FakeClient):
            def report(self, job_id, result):
                if job_id == 1:
                    raise ServerError(500, "db down")
                return super().report(job_id, result)

        c = Flaky(jobs=[{"id": 1}, {"id": 2}])
        run(c, once=True, stop=lambda: False, analyze=lambda p: {"status": "READY", "_timeline_gzip": b"gzip"}, log=lambda m: None, sleep=lambda s: None)
        self.assertEqual([r[0] for r in c.reports], [2])

    def test_unreachable_site_ends_a_once_run_instead_of_spinning(self):
        class Down(FakeClient):
            def claim(self):
                raise OSError("connection refused")

        self.assertEqual(run(Down(), once=True, stop=lambda: False, log=lambda m: None, sleep=lambda s: None), 0)

    def test_idle_polling_backs_off(self):
        sleeps = []
        calls = {"n": 0}

        def stop():
            calls["n"] += 1
            return calls["n"] > 6

        run(FakeClient(), once=False, stop=stop, log=lambda m: None, sleep=sleeps.append)
        self.assertEqual(sleeps[0], 3.0)
        self.assertGreater(sleeps[-1], sleeps[0])
        self.assertLessEqual(max(sleeps), 30.0)


if __name__ == "__main__":
    unittest.main()
