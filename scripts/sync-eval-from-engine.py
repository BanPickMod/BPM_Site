"""Copies the parts of bpm-ai-engine that the evaluation worker needs into worker/bpm_eval/, so the worker can run on Railway
without access to the private engine repository.

  python scripts/sync-eval-from-engine.py            copy files and write worker/bpm_eval/VENDORED.json
  python scripts/sync-eval-from-engine.py --check    exit 1 when a copy no longer matches the engine's file (drift)

Files are copied byte for byte (no edits), so a change in the engine shows up as a hash difference and the engine-side test
(bpm-ai-engine/tests/test_vendored_eval.py) can compare the results of both. The glue code in worker/bpm_eval/pipeline.py is
ours and is not copied.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]
ENGINE = Path(__file__).resolve().parents[2] / "bpm-ai-engine"
OUT = SITE / "worker" / "bpm_eval"
BUNDLE = "M1_v_priv_v0_r16"

# engine path -> path inside worker/bpm_eval
FILES = {
    "src/bpm_ai/data/state.py": "state.py",
    "src/bpm_ai/data/replay_data.py": "replay_data.py",
    "src/bpm_ai/data/featurize.py": "featurize.py",
    "src/bpm_ai/cognition/infer_np.py": "infer_np.py",
    "src/bpm_ai/data/role_map.json": "role_map.json",
    "src/bpm_ai/data/research_times.json": "research_times.json",
    **{f"runs/models/bundles_staging/{BUNDLE}/{n}": f"models/{BUNDLE}/{n}" for n in ("manifest.json", "meta.json", "trees.json", "weights.npz")},
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    if not ENGINE.exists():
        print(f"engine not found at {ENGINE}")
        return 2
    drift = []
    record = {"engine_commit": None, "files": {}}
    for src, dst in FILES.items():
        s, d = ENGINE / src, OUT / dst
        if not s.exists():
            print("missing in engine:", src)
            return 2
        want = sha256(s)
        record["files"][dst] = {"from": src, "sha256": want}
        if args.check:
            if not d.exists() or sha256(d) != want:
                drift.append(dst)
        else:
            d.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(s, d)
    if args.check:
        print("in sync" if not drift else "DRIFT: " + ", ".join(drift))
        return 1 if drift else 0
    (OUT / "VENDORED.json").write_text(json.dumps(record, indent=1, ensure_ascii=False), encoding="utf8")
    print(f"copied {len(FILES)} files to {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
