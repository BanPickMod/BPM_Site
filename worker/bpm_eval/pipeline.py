"""Replay -> "form" curve (the omniscient evaluator M1 at every 10 s), for the site's AI evaluation.

The method is the engine's, step for step (docs/reports/bpm_value_validation.md in bpm-ai-engine): extraction v3 (10 s samples
for both players), `featurize.row_features`, `MemoryTracker`, the economy arrays and `EconTracker`, then the bundle. The heavy parts
(state.py, replay_data.py, featurize.py, infer_np.py, the role table and the bundle) are copies of the engine's files
(scripts/sync-eval-from-engine.py); this file is the glue and lives here. The engine-side test tests/test_vendored_eval.py compares
the result with the engine's own code on real replays, so a drift shows up there.

The replay is read straight from the file (no StarCraft II). It runs on numpy only, on CPU.
"""
from __future__ import annotations

import json
import pkgutil
from pathlib import Path

import numpy as np

from bpm_replay.compat import install_imp_compat as _install_imp_compat

from . import featurize as F
from .infer_np import load as _load_bundle
from .replay_data import (
    LOOPS_PER_SECOND,
    add_upgrade_starts,
    base_start_events,
    build_samples,
    normalize_game_events,
    normalize_tracker_events,
)

HERE = Path(__file__).resolve().parent
BUNDLE = "M1_v_priv_v0_r16"
EVAL_VERSION = "eval-2"
STEP_SEC = 10
CAUSE_WINDOW_SEC = 60            # the change of the form is explained over this window, like the site's "biggest swings"
CAUSES = ("army", "econ", "tech")
_ARMY_ROLES = {"anti_air", "detector", "firepower", "frontline", "mobile", "siege", "splash", "support", "transport"}
_TECH_ROLES = {"production", "tech", "structure"}
_ARMY_METRICS = {"supply_used", "army_value", "army_dispersion", "army_dist_opp_start", "army_dist_own_start", "log_army_ratio"}
_ECON_METRICS = {"workers", "mineral_rate", "gas_rate", "bases", "supply_cap", "farthest_base_from_start", "nearest_base_to_enemy_start"}
_TECH_METRICS = {"n_production", "n_production_types", "n_tech", "upgrades_done", "research_running"}
_SIDES = ("self.", "obs_enemy.", "priv_enemy.", "priv_diff.", "mem_max.", "delta60.")


def feature_cause(name: str) -> str | None:
    """Which of army / econ / tech a model input belongs to, or None when it is about something else (time, race, what was seen)."""
    if name.startswith("econ."):
        rest = name.split(".", 1)[1]
        return "army" if rest == "free_supply" else "econ" if rest in {"minerals", "gas", "workers_created", "worker_seconds", "income_per_base"} else None
    for side in _SIDES:
        if not name.startswith(side):
            continue
        rest = name[len(side):]
        if rest.startswith("role."):
            role = rest.split(".")[1]
            return "army" if role in _ARMY_ROLES else "tech" if role in _TECH_ROLES else "econ" if role == "worker" else None
        if rest in _ARMY_METRICS:
            return "army"
        if rest in _ECON_METRICS:
            return "econ"
        if rest in _TECH_METRICS:
            return "tech"
    return None

RACE_NAMES = {
    "Terran": "Terran", "Protoss": "Protoss", "Zerg": "Zerg",
    "테란": "Terran", "프로토스": "Protoss", "저그": "Zerg",
    "人类": "Terran", "人類": "Terran", "星灵": "Protoss", "神族": "Protoss", "异虫": "Zerg", "蟲族": "Zerg",
    "Terraner": "Terran", "Terrano": "Terran", "Terrien": "Terran", "Zergs": "Zerg",
    "Терран": "Terran", "Протосс": "Protoss", "Зерг": "Zerg",
}
WORKERS = {"SCV", "Probe", "Drone", "MULE"}
ECON_COLS = ["time", "minerals", "gas", "food_used", "food_made", "workers", "mineral_rate", "gas_rate", "minerals_in_progress", "workers_created", "worker_seconds"]


class Skip(Exception):
    """The replay cannot be evaluated by design (not a 1v1 of the three races); not an error worth retrying."""


def _protocol(versions, base_build: int):
    """The exact protocol for the game build, else the installed one with the closest number."""
    try:
        return versions.build(base_build)
    except ImportError:
        available = sorted(int(i.name[8:]) for i in pkgutil.iter_modules(versions.__path__) if i.name.startswith("protocol") and i.name[8:].isdigit())
        for candidate in sorted(available, key=lambda v: (abs(v - base_build), v)):
            try:
                return versions.build(candidate)
            except ImportError:
                continue
        raise RuntimeError("no s2protocol build available")


def _text(value) -> str:
    return value.decode("utf8", "ignore") if isinstance(value, bytes) else str(value)


def _race(value) -> str:
    text = _text(value)
    return RACE_NAMES.get(text, text)


def _unit_name(e) -> str:
    v = e.get("m_unitTypeName", "")
    return v.decode() if isinstance(v, (bytes, bytearray)) else str(v)


def _econ_arrays(raw_tracker: list[dict]) -> tuple[dict[int, np.ndarray], dict[int, float | None]]:
    """Resources, supply, workers per PlayerStats tick, plus worker-seconds and workers created (the engine's build_econ)."""
    rows = {1: [], 2: []}
    born = {1: [], 2: []}
    worker_changes = {1: [], 2: []}
    worker_tags: dict = {}
    first_overlord = {1: None, 2: None}
    for e in raw_tracker:
        n = e["_event"].split(".")[-1]
        if n == "SPlayerStatsEvent" and e["m_playerId"] in rows:
            s = e["m_stats"]
            rows[e["m_playerId"]].append([
                e["_gameloop"] / LOOPS_PER_SECOND, s["m_scoreValueMineralsCurrent"], s["m_scoreValueVespeneCurrent"], s["m_scoreValueFoodUsed"] / 4096.0,
                s["m_scoreValueFoodMade"] / 4096.0, s["m_scoreValueWorkersActiveCount"], s["m_scoreValueMineralsCollectionRate"],
                s["m_scoreValueVespeneCollectionRate"], s.get("m_scoreValueMineralsUsedInProgressEconomy", 0) + s.get("m_scoreValueMineralsUsedInProgressArmy", 0)])
        elif n in ("SUnitBornEvent", "SUnitInitEvent") and e.get("m_controlPlayerId") in born:
            name, pid, t = _unit_name(e), e["m_controlPlayerId"], e["_gameloop"] / LOOPS_PER_SECOND
            if name in WORKERS and name != "MULE":
                tag = (e.get("m_unitTagIndex"), e.get("m_unitTagRecycle"))
                if tag not in worker_tags:
                    worker_tags[tag] = pid
                    worker_changes[pid].append((t, 1))
                if e["_gameloop"] > 5:
                    born[pid].append(t)
            elif name == "Overlord" and e["_gameloop"] > 5 and first_overlord[pid] is None:
                first_overlord[pid] = t
        elif n == "SUnitDiedEvent":
            pid = worker_tags.pop((e.get("m_unitTagIndex"), e.get("m_unitTagRecycle")), None)
            if pid in worker_changes:
                worker_changes[pid].append((e["_gameloop"] / LOOPS_PER_SECOND, -1))
        elif n == "SUnitTypeChangeEvent":
            tag = (e.get("m_unitTagIndex"), e.get("m_unitTagRecycle"))
            pid = worker_tags.get(tag)
            if pid in worker_changes and _unit_name(e) not in WORKERS:
                worker_tags.pop(tag, None)
                worker_changes[pid].append((e["_gameloop"] / LOOPS_PER_SECOND, -1))
    out = {}
    for pid in (1, 2):
        a = np.array(rows[pid], dtype=np.float32)
        if len(a) == 0:
            continue
        created = np.searchsorted(np.sort(np.array(born[pid], dtype=np.float32)), a[:, 0], side="right").astype(np.float32)
        wsec = F.integrate_count_events(a[:, 0], worker_changes[pid]).astype(np.float32)
        out[pid] = np.concatenate([a, created[:, None], wsec[:, None]], axis=1)
    return out, first_overlord


def feature_rows(path: str | Path) -> dict:
    """Both players' feature rows every 10 s, as the evaluator expects them. Raises Skip for a game that is not 1v1 of the three races."""
    _install_imp_compat()
    import mpyq

    archive = mpyq.MPQArchive(str(path))
    try:
        return _feature_rows(archive)
    finally:
        archive.file.close()                 # Windows will not delete the replay while it is open


def _feature_rows(archive) -> dict:
    from s2protocol import versions

    header = versions.latest().decode_replay_header(archive.header["user_data_header"]["content"])
    base_build = int(header["m_version"]["m_baseBuild"])
    protocol = _protocol(versions, base_build)
    details = protocol.decode_replay_details(archive.read_file("replay.details"))
    listed = [p for p in details["m_playerList"] if _race(p["m_race"]) in {"Terran", "Protoss", "Zerg"}]
    if len(listed) != 2:
        raise Skip("not a 1v1 game of the three races")

    raw_tracker = list(protocol.decode_replay_tracker_events(archive.read_file("replay.tracker.events")))
    tracker, user_to_player = normalize_tracker_events(raw_tracker)
    tracker = add_upgrade_starts(tracker)
    game_raw = archive.read_file("replay.game.events")
    game_events = normalize_game_events(list(protocol.decode_replay_game_events(game_raw)) if game_raw else [], user_to_player)
    length = max((float(e.get("_gameloop", 0)) for e in raw_tracker), default=0.0) / LOOPS_PER_SECOND

    starts = {1: None, 2: None}
    for ev in tracker:
        if ev["time"] > 1.0:
            break
        if ev["kind"] == "unit_born" and ev.get("unit_type") in {"CommandCenter", "Nexus", "Hatchery"} and int(ev.get("owner", 0)) in starts:
            starts[int(ev["owner"])] = [float(ev["x"]), float(ev["y"])]
    players = [{"player_id": i, "race": _race(d["m_race"]), "result": int(d["m_result"]), "start_position": starts[i]} for i, d in zip((1, 2), listed)]
    role_map = json.loads((HERE / "role_map.json").read_text(encoding="utf8"))
    samples = build_samples(tracker, game_events, players, length, role_map)
    if not samples:
        raise Skip("game too short for a single 10 s sample")

    econ, first_overlord = _econ_arrays(raw_tracker)
    base_starts = base_start_events(tracker)
    structure_starts = {
        pid: sorted(([e["unit_type"], round(float(e["time"]), 3)] for e in tracker
                     if e["kind"] == "unit_init" and int(e.get("owner", 0)) == pid and "structure" in role_map["unit_roles"].get(e.get("unit_type"), [])), key=lambda s: s[1])
        for pid in (1, 2)
    }
    meta_of = {pid: {"start_workers": float(a[0][5]), "start_supply_used": float(a[0][3]), "start_supply_cap": float(a[0][4]),
                     "start_minerals": float(a[0][1]), "start_gas": float(a[0][2])} for pid, a in econ.items()}
    by_pid = {p["player_id"]: p for p in players}
    ecols = {n: i for i, n in enumerate(ECON_COLS)}

    out_rows = []
    for pid in (1, 2):
        mine = sorted((s for s in samples if s["player_id"] == pid), key=lambda s: s["time_seconds"])
        opp = 3 - pid
        if not mine or pid not in econ:
            continue
        mem, tr = F.MemoryTracker(), F.EconTracker()
        a, meta = econ[pid], meta_of[pid]
        enemy_sw = meta_of[opp]["start_workers"] if opp in meta_of else float("nan")
        sts = structure_starts[pid]
        second = F.second_base_start(base_starts.get(str(pid), []), sts)
        fo = first_overlord.get(pid)
        first_supply_t = float(fo) if fo is not None else float("nan")
        si, second_seen, supply_seen, last_k = 0, False, False, -1
        for s in mine:
            t = float(s["time_seconds"])
            row = F.row_features(t, s["race"], by_pid[opp]["race"], s["visibility_mask"], base_build, s["observed"]["self"], s["observed"]["enemy"],
                                 s["priv"]["enemy"], by_pid[pid]["start_position"], by_pid[opp]["start_position"], with_priv=True)
            row.update(mem.update(row))
            while si < len(sts) and sts[si][1] <= t:
                if F.struct_kind(sts[si][0]) != "base":
                    tr.observe_struct(sts[si][0], sts[si][1], initial=False)
                si += 1
            if not second_seen and second is not None and second <= t:
                tr.observe_second_base(second)
                second_seen = True
            if not supply_seen and first_supply_t == first_supply_t and first_supply_t <= t:
                tr.observe_struct("OVERLORD", first_supply_t)
                supply_seen = True
            k = max(int(np.searchsorted(a[:, 0], t + 0.5, side="right")) - 1, 0)
            ext = {
                "start_workers": meta["start_workers"], "start_workers_enemy": enemy_sw, "start_workers_enemy_estimated": 0.0,
                "start_workers_enemy_confidence": 1.0 if enemy_sw == enemy_sw else 0.0,
                "start_supply_used": meta["start_supply_used"], "start_supply_cap": meta["start_supply_cap"],
                "start_minerals": meta["start_minerals"], "start_gas": meta["start_gas"], "start_estimated": 0.0, "start_confidence": 1.0,
                "ruleset_bpm": 0.0,
                "minerals": a[k, ecols["minerals"]], "gas": a[k, ecols["gas"]], "workers_created": a[k, ecols["workers_created"]],
            }
            if k != last_k:
                ext["worker_seconds"] = a[k, ecols["worker_seconds"]]
                ext["worker_seconds_time"] = a[k, ecols["time"]]
                last_k = k
            row.update(tr.update({"time": t, **{n: row.get(n, float("nan")) for n in ("self.workers", "self.supply_cap", "self.supply_used", "self.bases", "self.mineral_rate")}}, ext))
            out_rows.append({"f": row, "pid": pid, "t": t})
    return {"rows": out_rows, "length": length, "build": base_build}


_bundle = None


def bundle():
    global _bundle
    if _bundle is None:
        _bundle = _load_bundle(HERE / "models" / BUNDLE)
    return _bundle


def form_curve(path: str | Path) -> dict:
    """The evaluation stored for a replay.

    `a[i]` is player 1's form minus player 2's at `t[i]` seconds, in -1..1 (positive = player 1 ahead). Each player's win
    probability comes from that player's own point of view; their difference is antisymmetric, so it does not depend on who is "1".
    These are model scores for a rough read of the game, not probabilities (the model is not calibrated on BPM games).
    """
    r = feature_rows(path)
    b = bundle()
    rows = r["rows"]
    X = np.stack([F.row_vector(x["f"], b.feature_names) for x in rows])
    p = np.asarray(b.predict(X))[:, 0]
    by = {1: {}, 2: {}}
    for x, v in zip(rows, p):
        by[x["pid"]][round(x["t"])] = float(v)
    times = sorted(set(by[1]) & set(by[2]))
    if not times:
        raise Skip("no sample for both players")
    adv = [max(-1.0, min(1.0, by[1][t] - by[2][t])) for t in times]
    causes = _causes(b, rows, X, p, times)
    out = {
        "schema": 1, "model": BUNDLE, "evalVersion": EVAL_VERSION, "stepSec": STEP_SEC, "validated": False,
        "t": times, "a": [round(v, 3) for v in adv], "lengthSec": round(r["length"], 1),
    }
    if causes:
        out["causes"] = causes
    return out


def _causes(b, rows, X, p, times) -> dict | None:
    """For every sample, how much of the change of the form over the next CAUSE_WINDOW_SEC came from the army, the economy, the tech.

    Each player's model reading at the later sample is recomputed with one kind of inputs (all the army inputs, say) put back to
    their earlier values; what that changes is that kind's share of the change. The shares of the two players are subtracted the same
    way as the form itself (player 1 minus player 2), so a positive share favours player 1. Shares do not add up to the full change:
    the model is not additive and some of it is other inputs; the site shows the rest as "other". Nothing here changes the curve.
    """
    idx = {(x["pid"], round(x["t"])): k for k, x in enumerate(rows)}
    names = list(b.feature_names)
    cols = {c: [i for i, n in enumerate(names) if feature_cause(n) == c] for c in CAUSES}
    pairs = []
    for i, t in enumerate(times):
        j = i
        while j + 1 < len(times) and times[j + 1] - t <= CAUSE_WINDOW_SEC:
            j += 1
        pairs.append((i, j))
    out = {c: [0.0] * len(times) for c in CAUSES}
    for pid, sign in ((1, 1.0), (2, -1.0)):
        a_rows = [idx[(pid, times[i])] for i, _ in pairs]
        b_rows = [idx[(pid, times[j])] for _, j in pairs]
        base = p[b_rows]
        for c, cs in cols.items():
            if not cs:
                continue
            mod = X[b_rows].copy()
            mod[:, cs] = X[a_rows][:, cs]
            shift = base - np.asarray(b.predict(mod))[:, 0]
            for n, (i, j) in enumerate(pairs):
                if j > i:
                    out[c][i] += sign * float(shift[n])
    return {c: [round(v, 3) for v in vals] for c, vals in out.items()}
