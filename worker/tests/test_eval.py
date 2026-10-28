"""Run from BPM_Site:  python -X utf8 -m unittest discover -s worker/tests"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bpm_replay.client import ServerError  # noqa: E402
from run_worker import process_eval_job, run  # noqa: E402

FIX = Path(__file__).parent / "fixtures" / "bot_tvt_3picks.SC2Replay"
CURVE = {"schema": 1, "model": "M1", "evalVersion": "eval-1", "validated": False, "t": [10.0, 20.0], "a": [0.1, -0.1], "lengthSec": 20}


class Skipped(Exception):
    pass


class Fake:
    def __init__(self, analysis_jobs=(), eval_jobs=(), report_error=None, download_error=None):
        self.analysis_jobs, self.eval_jobs = list(analysis_jobs), list(eval_jobs)
        self.eval_reports, self.reports = [], []
        self.report_error, self.download_error = report_error, download_error
        self.order = []

    def claim(self):
        self.order.append("claim")
        return self.analysis_jobs.pop(0) if self.analysis_jobs else None

    def eval_claim(self):
        self.order.append("eval_claim")
        return self.eval_jobs.pop(0) if self.eval_jobs else None

    def download(self, job_id):
        if self.download_error:
            raise self.download_error
        return b"x" * 50

    def report(self, job_id, result):
        self.reports.append((job_id, result))
        return {"status": result["status"]}

    def upload_timeline(self, job_id, data):
        return {}

    def eval_report(self, job_id, result):
        if self.report_error:
            raise self.report_error
        self.eval_reports.append((job_id, result))
        return {"status": result["status"]}


class ProcessEvalJob(unittest.TestCase):
    def go(self, client, evaluate):
        return process_eval_job(client, {"id": 7, "attempt": 1}, evaluate, Skipped, log=lambda m: None)

    def test_done_reports_the_curve(self):
        c = Fake()
        self.assertEqual(self.go(c, lambda p: CURVE), "DONE")
        (jid, r), = c.eval_reports
        self.assertEqual((jid, r["status"], r["evalVersion"], r["evaluation"]), (7, "DONE", "eval-1", CURVE))

    def test_the_replay_is_removed_from_disk_after_the_job(self):
        seen = []
        def evaluate(path):
            seen.append(path)
            self.assertTrue(path.exists())
            return CURVE
        self.go(Fake(), evaluate)
        self.assertFalse(seen[0].exists() or seen[0].parent.exists())

    def test_a_game_that_cannot_be_evaluated_is_skipped_not_retried(self):
        def evaluate(path):
            raise Skipped("not a 1v1 game")
        c = Fake()
        self.assertEqual(self.go(c, evaluate), "SKIPPED")
        self.assertEqual(c.eval_reports[0][1], {"status": "SKIPPED", "reason": "not a 1v1 game"})

    def test_a_crash_is_reported_as_failed_so_the_site_retries(self):
        def evaluate(path):
            raise ValueError("boom")
        c = Fake()
        self.assertEqual(self.go(c, evaluate), "FAILED")
        self.assertIn("ValueError: boom", c.eval_reports[0][1]["error"])

    def test_a_lost_lease_is_dropped_quietly(self):
        self.assertEqual(self.go(Fake(download_error=ServerError(409, "gone")), lambda p: CURVE), "LOST")
        c = Fake(report_error=ServerError(409, "lease"))
        self.assertEqual(self.go(c, lambda p: CURVE), "LOST")

    def test_other_server_errors_propagate(self):
        with self.assertRaises(ServerError):
            self.go(Fake(download_error=ServerError(500, "down")), lambda p: CURVE)


class RunLoop(unittest.TestCase):
    def test_analysis_comes_first_and_evaluation_fills_the_gaps(self):
        c = Fake(analysis_jobs=[{"id": 1, "attempt": 1}], eval_jobs=[{"id": 2, "attempt": 1}])
        n = run(c, once=True, stop=lambda: False, analyze=lambda p: {"status": "READY", "_timeline_gzip": b"gz"}, log=lambda m: None,
                sleep=lambda s: None, evaluator=(lambda p: CURVE, Skipped))
        self.assertEqual(n, 2)
        self.assertEqual(c.order[:3], ["claim", "claim", "eval_claim"])     # analysis job, then an empty analysis queue, then evaluation
        self.assertEqual([r[0] for r in c.eval_reports], [2])

    def test_without_an_evaluator_the_eval_queue_is_never_touched(self):
        c = Fake(eval_jobs=[{"id": 2, "attempt": 1}])
        run(c, once=True, stop=lambda: False, log=lambda m: None, sleep=lambda s: None)
        self.assertNotIn("eval_claim", c.order)

    def test_an_unreportable_eval_result_does_not_stop_the_worker(self):
        c = Fake(eval_jobs=[{"id": 2, "attempt": 1}, {"id": 3, "attempt": 1}], report_error=ServerError(500, "x"))
        log = []
        run(c, once=True, stop=lambda: False, log=log.append, sleep=lambda s: None, evaluator=(lambda p: CURVE, Skipped))
        self.assertTrue(any("could not report" in m for m in log))


@unittest.skipUnless(FIX.exists(), "fixture missing")
class RealReplay(unittest.TestCase):
    def test_form_curve_of_a_real_bpm_replay(self):
        from bpm_eval import pipeline
        c = pipeline.form_curve(FIX)
        self.assertEqual((c["schema"], c["model"], c["evalVersion"], c["validated"]), (1, "M1_v_priv_v0_r16", pipeline.EVAL_VERSION, False))
        self.assertEqual(len(c["t"]), len(c["a"]))
        self.assertTrue(len(c["t"]) >= 5)                                    # the fixture is a 60-second game
        self.assertTrue(all(-1 <= v <= 1 for v in c["a"]))
        self.assertTrue(all(b > a for a, b in zip(c["t"], c["t"][1:])))

    def test_both_players_get_rows_and_the_file_is_released(self):
        from bpm_eval import pipeline
        r = pipeline.feature_rows(FIX)["rows"]
        self.assertEqual({x["pid"] for x in r}, {1, 2})
        import shutil, tempfile
        with tempfile.TemporaryDirectory() as d:                              # Windows refuses to delete a replay that is still open
            copy = Path(d) / "r.SC2Replay"
            shutil.copyfile(FIX, copy)
            pipeline.form_curve(copy)
            copy.unlink()

    def test_a_file_that_is_not_a_replay_raises(self):
        from bpm_eval import pipeline
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".SC2Replay", delete=False) as f:
            f.write(b"not a replay" * 20)
        try:
            with self.assertRaises(Exception):
                pipeline.form_curve(f.name)
        finally:
            Path(f.name).unlink()


if __name__ == "__main__":
    unittest.main()
