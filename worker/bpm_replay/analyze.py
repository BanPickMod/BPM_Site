"""Turn one replay file into a job result the site accepts (docs/BPM_Backend_Plan.md section 5.1).

The replay is untrusted input from the internet, so it is parsed in a separate Python process with a time limit
(and a memory limit where the OS supports it). A crashing or hanging parser costs one job, never the worker.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from .pseudonym import handle_key
from .timeline import gzip_timeline

ANALYZER_VERSION = "timeline-2"
SCHEMA = 1
DECODER = Path(__file__).with_name("draft_decode.py")
DEFAULT_TIMEOUT_SEC = 120
MEMORY_LIMIT_BYTES = 1 << 30


def _limit_memory() -> None:  # runs in the child between fork and exec (POSIX only)
    import resource

    resource.setrlimit(resource.RLIMIT_AS, (MEMORY_LIMIT_BYTES, MEMORY_LIMIT_BYTES))


def decode_isolated(path: str | Path, timeout: float = DEFAULT_TIMEOUT_SEC, decoder: Path = DECODER) -> dict:
    """Run the decoder in a child process. Returns its JSON, or {"replayError": {"kind", "message"}}."""
    kwargs = {"preexec_fn": _limit_memory} if sys.platform != "win32" else {}
    try:
        # -I: ignore PYTHON* variables and the current directory, so a planted module in the replay's folder cannot load.
        proc = subprocess.run(
            [sys.executable, "-X", "utf8", "-I", str(decoder), str(path)],
            capture_output=True, timeout=timeout, check=False, **kwargs,
        )
    except subprocess.TimeoutExpired:
        return {"replayError": {"kind": "corrupt", "message": f"decoder exceeded {timeout:.0f}s"}}
    out = proc.stdout.decode("utf8", "replace").strip()
    if proc.returncode in (0, 3) and out:
        try:
            return json.loads(out)
        except json.JSONDecodeError:
            pass
    # A crash (including out-of-memory) on a hostile or broken file: treat as an unreadable replay.
    return {"replayError": {"kind": "corrupt", "message": f"decoder exited {proc.returncode}: {proc.stderr.decode('utf8', 'replace')[-200:]}"}}


def to_job_result(decoded: dict) -> dict:
    """Map decoder output to the site's job result. Only facts the owner needs are kept; nicknames are dropped.

    Neither the nickname nor the Battle.net handle is kept. Each player gets `handleKey`, a keyed hash of the handle
    (bpm_replay/pseudonym.py): enough to recognise one game uploaded by both players, useless as a name.
    """
    err = decoded.get("replayError")
    if err:
        code = "UNSUPPORTED" if err.get("kind") == "unsupported" else "CORRUPT"
        return {"status": "REJECTED", "rejectCode": code, "analyzerVersion": ANALYZER_VERSION}
    if not decoded.get("isBpm"):
        return {"status": "REJECTED", "rejectCode": "NOT_BPM", "analyzerVersion": ANALYZER_VERSION}

    players = []
    for p in decoded["players"]:
        players.append({
            "playerId": p["playerId"],
            "handleKey": handle_key(p.get("handle")),
            "race": p["race"],
            "result": p["result"],
            "isAi": p["isAi"],
            "bans": p["bans"],
            "picks": p["picks"],
            "displaced": p["displaced"],
        })
    result = {
        "status": "READY",
        "analyzerVersion": ANALYZER_VERSION,
        "analysis": {
            "schema": SCHEMA,
            "map": decoded["map"],
            "baseBuild": decoded["baseBuild"],
            "durationSec": decoded["durationSec"],
            "gameLoops": decoded.get("gameLoops"),
            "startedAt": decoded.get("startedAt"),
            "convenienceMode": decoded["convenienceMode"],
            "players": players,
            "warnings": decoded["warnings"],
        },
    }
    timeline = decoded.get("timeline")
    if isinstance(timeline, dict):
        result["_timeline_gzip"] = gzip_timeline(timeline)
    return result


def analyze_file(path: str | Path, timeout: float = DEFAULT_TIMEOUT_SEC) -> dict:
    return to_job_result(decode_isolated(path, timeout))
