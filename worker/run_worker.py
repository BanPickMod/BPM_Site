"""Analysis worker: pulls uploaded replays from the site, analyzes them, reports the result.

  python worker/run_worker.py --url https://<site> --token <WORKER_TOKEN>      # runs until Ctrl+C
  python worker/run_worker.py --once                                           # drain the queue, then exit

URL and token may come from BPM_SERVER_URL and WORKER_TOKEN. Any number of workers can run at once: the site hands each
job to exactly one of them and takes it back if a worker stops reporting for 10 minutes.

When the analysis queue is empty the worker also takes AI evaluation jobs (the "form" curve; needs numpy and the bundle under
worker/bpm_eval). BPM_EVAL=0 turns that off; without numpy it turns itself off with a message.
"""
from __future__ import annotations

import argparse
import os
import signal
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bpm_replay import pseudonym  # noqa: E402
from bpm_replay.analyze import analyze_file  # noqa: E402
from bpm_replay.client import ServerError, WorkerClient  # noqa: E402

IDLE_SLEEP_MIN = 3.0
IDLE_SLEEP_MAX = 30.0


def process_job(client: WorkerClient, job: dict, analyze=analyze_file, log=print) -> str:
    """Handle one claimed job end to end. Returns the status that was reported (or "LOST" if the lease was gone)."""
    job_id = job["id"]
    result: dict
    try:
        data = client.download(job_id)
        # The decoder needs a real file; keep it in a private temp dir and always remove it (a replay holds personal data).
        with tempfile.TemporaryDirectory(prefix="bpm-replay-") as tmp:
            path = Path(tmp) / "replay.SC2Replay"
            path.write_bytes(data)
            result = analyze(path)
            timeline = result.pop("_timeline_gzip", None)
            if result.get("status") == "READY":
                if not isinstance(timeline, bytes):
                    raise RuntimeError("analyzer did not produce timeline.json.gz")
                client.upload_timeline(job_id, timeline, job.get("attempt"))
    except ServerError as e:
        if e.status in (404, 409):               # lease expired or file gone: another attempt owns it now
            log(f"job {job_id}: {e}; skipping")
            return "LOST"
        raise
    except Exception as e:                        # a bug or an environment problem: let the site retry with backoff
        log(f"job {job_id}: analysis crashed: {type(e).__name__}: {e}")
        result = {"status": "FAILED", "error": f"{type(e).__name__}: {e}"[:300]}
    if job.get("attempt") is not None:
        result["attempt"] = job["attempt"]        # the site refuses a result from an attempt that has been replaced
    try:
        client.report(job_id, result)
    except ServerError as e:
        if e.status == 409:
            log(f"job {job_id}: result not accepted ({e}); lease was lost")
            return "LOST"
        raise
    log(f"job {job_id} (attempt {job.get('attempt')}): {result['status']}" + (f" {result.get('rejectCode', '')}" if result["status"] == "REJECTED" else ""))
    return result["status"]


def process_eval_job(client: WorkerClient, job: dict, evaluate, skip_error=(), log=print) -> str:
    """Evaluate one claimed replay and report DONE / SKIPPED / FAILED. Returns the reported status (or "LOST" if the lease was gone).

    `skip_error` is the exception type that means "cannot be evaluated by design" (a game that is not a 1v1 of the three races).
    """
    job_id = job["id"]
    try:
        data = client.download(job_id)
        with tempfile.TemporaryDirectory(prefix="bpm-eval-") as tmp:         # a replay holds personal data: private folder, always removed
            path = Path(tmp) / "replay.SC2Replay"
            path.write_bytes(data)
            curve = evaluate(path)
        result = {"status": "DONE", "evalVersion": curve["evalVersion"], "evaluation": curve}
    except ServerError as e:
        if e.status in (404, 409):
            log(f"eval {job_id}: {e}; skipping")
            return "LOST"
        raise
    except skip_error as e:
        result = {"status": "SKIPPED", "reason": str(e)[:200]}
    except Exception as e:                      # a bug or an environment problem: let the site retry with backoff
        log(f"eval {job_id}: crashed: {type(e).__name__}: {e}")
        result = {"status": "FAILED", "error": f"{type(e).__name__}: {e}"[:300]}
    try:
        client.eval_report(job_id, result)
    except ServerError as e:
        if e.status == 409:
            log(f"eval {job_id}: result not accepted ({e}); lease was lost")
            return "LOST"
        raise
    log(f"eval {job_id} (attempt {job.get('attempt')}): {result['status']}" + (f" {result.get('reason', '')}" if result["status"] == "SKIPPED" else ""))
    return result["status"]


def load_evaluator(log=print):
    """(evaluate, skip_error) from worker/bpm_eval, or None when evaluation is off or its requirements are missing."""
    if os.environ.get("BPM_EVAL", "1") == "0":
        return None
    try:
        from bpm_eval import pipeline
    except ImportError as e:                      # numpy missing: the analysis queue still works
        log(f"AI evaluation is off ({e}); pip install -r worker/requirements.txt to turn it on")
        return None
    return pipeline.form_curve, pipeline.Skip


def run(client: WorkerClient, once: bool, stop, analyze=analyze_file, log=print, sleep=time.sleep, evaluator=None) -> int:
    handled = 0
    idle = IDLE_SLEEP_MIN
    while not stop():
        try:
            job = client.claim()
            if job is None and evaluator is not None:         # nothing to analyze: evaluate an analysed replay instead
                ejob = client.eval_claim()
                if ejob is not None:
                    idle = IDLE_SLEEP_MIN
                    try:
                        process_eval_job(client, ejob, evaluator[0], evaluator[1], log)
                        handled += 1
                    except (ServerError, OSError) as e:
                        log(f"eval {ejob['id']}: could not report result: {e}")
                    continue
        except (ServerError, OSError) as e:       # site down or restarting: wait and try again
            log(f"claim failed: {e}")
            if once:
                return handled
            sleep(min(idle * 2, IDLE_SLEEP_MAX))
            idle = min(idle * 2, IDLE_SLEEP_MAX)
            continue
        if job is None:
            if once:
                return handled
            sleep(idle)
            idle = min(idle * 1.5, IDLE_SLEEP_MAX)
            continue
        idle = IDLE_SLEEP_MIN
        try:
            process_job(client, job, analyze, log)
            handled += 1
        except (ServerError, OSError) as e:       # could not report; the lease will expire and the job is retried
            log(f"job {job['id']}: could not report result: {e}")
    return handled


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default=os.environ.get("BPM_SERVER_URL"))
    ap.add_argument("--token", default=os.environ.get("WORKER_TOKEN"))
    ap.add_argument("--once", action="store_true", help="process everything that is queued, then exit")
    a = ap.parse_args()
    pseudonym.require_key()                    # player handles are hashed with it; refuse to run without
    if not a.url or not a.token:
        ap.error("--url/--token (or BPM_SERVER_URL/WORKER_TOKEN) are required")

    stopping = False

    def request_stop(*_):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)
    log = lambda m: print(time.strftime("%H:%M:%S"), m, flush=True)       # noqa: E731
    n = run(WorkerClient(a.url, a.token), a.once, lambda: stopping, log=log, evaluator=load_evaluator(log))
    print(f"processed {n} job(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
