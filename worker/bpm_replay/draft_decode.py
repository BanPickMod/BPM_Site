"""Recover the BPM draft result from a .SC2Replay.

The mod grants every player hidden upgrades when the draft is applied:
  BPM_Ban_<Unit>   the unit is unavailable to this player
  BPM_Pick_<Unit>  this player picked the extended unit
Upgrades are recorded in the replay's tracker stream (SUpgradeEvent), so no mod change is needed.

What this can and cannot tell:
  * Ban_<base> next to Pick_<ext> of the same group is the pick displacing the default unit, not a real ban.
    Every other Ban_<X> is a real ban made by the opponent.
  * Picking the base unit leaves no trace (nothing changes), so "kept the default" is inferred, not observed.
  * Ban order, pass rounds and timing are not in the replay; only the final state is.
  * A replay with none of these upgrades is not a BPM game (or the mod did not run the draft).
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# analyze.py는 이 파일을 `python -I <path>`로 실행한다. 격리 모드에서도 워커의
# 신뢰된 패키지만 가져올 수 있도록, 리플레이 폴더가 아닌 worker/를 명시한다.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from bpm_replay.compat import install_imp_compat  # noqa: E402

install_imp_compat()                      # Python 3.12+: s2protocol still imports `imp`; must run before it is imported

import mpyq  # noqa: E402
from s2protocol import versions  # noqa: E402
from bpm_replay.timeline import build_timeline  # noqa: E402

_GROUPS = json.loads((Path(__file__).with_name("groups.json")).read_text(encoding="utf8"))["groups"]
# group id -> (base, ext), plus case-insensitive lookups (upgrade names and registry ids differ in case, e.g. WarHound/Warhound)
_BASE_OF_EXT = {g["ext"].lower(): (gid, g["base"]) for gid, g in _GROUPS.items()}
_CANON = {u.lower(): u for g in _GROUPS.values() for u in (g["base"], g["ext"])}

def _handle(p: dict | None) -> str | None:
    """Battle.net profile id as SC2 prints it ("2-S2-1-1234567"): region-S2-realm-id. Stable, unlike the nickname."""
    toon = (p or {}).get("m_toon")
    if not toon:
        return None
    return f"{toon['m_region']}-S2-{toon['m_realm']}-{toon['m_id']}"


START_UNIT_RACE = {"SCV": "terran", "Probe": "protoss", "Drone": "zerg"}


class ReplayError(Exception):
    """kind: "corrupt" (not a readable replay) or "unsupported" (a game build newer than the installed s2protocol)."""

    def __init__(self, message: str, kind: str = "corrupt"):
        super().__init__(message)
        self.kind = kind


def _canon(name: str) -> str:
    return _CANON.get(name.lower(), name)


def _latest_protocol_build(proto) -> int:
    return int(proto.__name__.removeprefix("protocol"))


def _started_at(details: dict) -> str | None:
    """Game start as UTC seconds ("2026-10-27T09:46:57Z"). SC2 stores it as a Windows FILETIME (100 ns ticks since 1601).

    Together with the map, the players' handles and the length it identifies one game, so two players' replays of the
    same game can be recognised as one (see lib/replay/matchKey.ts). Each client records its own start, so the two
    values can differ by a few seconds: the server compares them with a tolerance.
    """
    ticks = details.get("m_timeUTC")
    if not isinstance(ticks, int) or ticks <= 0:
        return None
    try:
        when = datetime(1601, 1, 1, tzinfo=timezone.utc) + timedelta(microseconds=ticks // 10)
    except OverflowError:
        return None
    return when.strftime("%Y-%m-%dT%H:%M:%SZ")


def _target_commands(proto, archive) -> list[tuple[int, int, int | None, float, float]]:
    """Commands that name a point on the map: `(loop, userId, abilityLink, x, y)`. They are where a lifted building was told to land.

    Streamed, and only these commands are kept, so a long game costs little memory. A replay whose game events cannot be read still
    gets its timeline, without landing positions: nothing here may fail the analysis.
    """
    out: list[tuple[int, int, int | None, float, float]] = []
    try:
        for ev in proto.decode_replay_game_events(archive.read_file("replay.game.events")):
            if not ev["_event"].endswith("SCmdEvent"):
                continue
            point = (ev.get("m_data") or {}).get("TargetPoint")
            if not point:
                continue
            abil = (ev.get("m_abil") or {}).get("m_abilLink")
            out.append((int(ev["_gameloop"]), int((ev.get("_userid") or {}).get("m_userId", -1)), abil,
                        round(point["x"] / 4096, 2), round(point["y"] / 4096, 2)))
    except Exception:  # noqa: BLE001 - see the docstring
        return []
    return out


def decode_draft(path: str | Path) -> dict:
    """Return the draft result and basic game facts. Raises ReplayError for unreadable replays."""
    # Newer game builds than the installed s2protocol: the latest protocol still decodes details and tracker events.
    proto = versions.latest()
    try:
        archive = mpyq.MPQArchive(str(path))
        header = proto.decode_replay_header(archive.header["user_data_header"]["content"])
    except Exception as exc:  # parser errors are data errors, never crash the worker
        raise ReplayError(f"{type(exc).__name__}: {exc}", "corrupt") from exc
    try:
        details = proto.decode_replay_details(archive.read_file("replay.details"))
        tracker = list(proto.decode_replay_tracker_events(archive.read_file("replay.tracker.events")))
    except Exception as exc:
        # A readable header but undecodable body is most likely a build newer than the installed protocols.
        newer = header["m_version"]["m_baseBuild"] > _latest_protocol_build(proto)
        raise ReplayError(f"{type(exc).__name__}: {exc}", "unsupported" if newer else "corrupt") from exc

    # Tracker player ids <-> details entries: both are ordered by lobby slot, so match by position.
    # (m_workingSetSlotId is unreliable: absent in bot games, 1-based in some lobbies. m_race is localized text.)
    setup = sorted(
        (ev for ev in tracker if ev["_event"].endswith("SPlayerSetupEvent") and ev.get("m_slotId") is not None),
        key=lambda ev: ev["m_slotId"],
    )
    listed = details["m_playerList"]
    warnings: list[str] = []
    if len(setup) != len(listed):
        warnings.append(f"{len(setup)} tracker players but {len(listed)} listed in details")

    race_of: dict[int, str] = {}
    for ev in tracker:
        if ev["_gameloop"] > 0:
            break
        if ev["_event"].endswith("SUnitBornEvent"):
            race = START_UNIT_RACE.get(ev["m_unitTypeName"].decode("utf8", "replace"))
            if race:
                race_of.setdefault(ev["m_controlPlayerId"], race)

    players = {}
    for i, st in enumerate(setup):
        pid = st["m_playerId"]
        p = listed[i] if i < len(listed) else None
        players[pid] = {
            "playerId": pid,
            "name": p["m_name"].decode("utf8", "replace") if p else None,
            "handle": _handle(p),
            "race": race_of.get(pid),
            "result": {1: "win", 2: "loss"}.get(p["m_result"]) if p else None,
            "isAi": (p.get("m_control") == 3) if p else st.get("m_type") == 2,
            "bans": [],
            "picks": [],
            "displaced": [],
        }

    seen: dict[tuple[int, str], int] = {}
    convenience = False
    for ev in tracker:
        if not ev["_event"].endswith("SUpgradeEvent"):
            continue
        name = ev["m_upgradeTypeName"].decode("utf8", "replace")
        if name == "BPM_Upgrade_ConvenienceMode":
            convenience = True
        if not name.startswith(("BPM_Ban_", "BPM_Pick_")):
            continue
        # The mod applies the draft at the start of the match and again at game start; the first sighting is the draft.
        seen.setdefault((ev["m_playerId"], name), ev["_gameloop"])

    for (pid, name), loop in sorted(seen.items(), key=lambda kv: kv[1]):
        p = players.get(pid)
        if p is None:
            warnings.append(f"upgrade {name} for unknown player {pid}")
            continue
        kind, unit = name.split("_", 2)[1], _canon(name.split("_", 2)[2])
        if kind == "Pick":
            grp = _BASE_OF_EXT.get(unit.lower())
            if grp is None:
                warnings.append(f"player {pid}: pick {unit} is not an extended unit of any group")
            p["picks"].append({"unit": unit, "replaces": grp[1] if grp else None, "group": grp[0] if grp else None})
        else:
            p["bans"].append(unit)

    for p in players.values():
        displaced = {x["replaces"] for x in p["picks"] if x["replaces"]}
        p["displaced"] = sorted(b for b in p["bans"] if b in displaced)
        p["bans"] = sorted(b for b in p["bans"] if b not in displaced)  # real bans only
        p["picks"].sort(key=lambda x: x["unit"])

    elapsed = header.get("m_elapsedGameLoops") or 0
    first_loop = min(seen.values(), default=None)
    decoded = {
        "isBpm": bool(seen) or convenience,
        "map": details["m_title"].decode("utf8", "replace"),
        "baseBuild": header["m_version"]["m_baseBuild"],
        "gameLoops": elapsed,
        "startedAt": _started_at(details),
        "durationSec": round(elapsed / 22.4),  # Blizzard "faster" game time, as shown in game
        "draftAppliedLoop": first_loop,
        "convenienceMode": convenience,
        "players": [players[k] for k in sorted(players)],
        "warnings": warnings,
    }
    if decoded["isBpm"]:
        decoded["timeline"] = build_timeline(tracker, decoded, "timeline-3", _target_commands(proto, archive))
    return decoded


if __name__ == "__main__":
    import sys

    # Also the entry point the worker runs in a separate process (see analyze.py): exit 3 = unreadable replay.
    try:
        print(json.dumps(decode_draft(sys.argv[1]), ensure_ascii=False, indent=1))
    except ReplayError as err:
        print(json.dumps({"replayError": {"kind": err.kind, "message": str(err)[:300]}}))
        sys.exit(3)
