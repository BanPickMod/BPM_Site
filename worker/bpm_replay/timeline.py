"""리플레이 트래커 이벤트를 뷰어용 timeline 스키마 v1로 바꾼다.

엔진의 P1 L0(`p1_l0.py`)와 같은 원천(유닛 생애, UnitPositions, PlayerStats,
Upgrade)을 사용하되 워커에 numpy 의존성을 추가하지 않도록 JSON 친화적인 순수
Python 자료구조를 만든다. 닉네임과 채팅은 입력으로 받지도, 출력하지도 않는다.
"""
from __future__ import annotations

import gzip
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Iterable, Mapping
from .pseudonym import handle_key

LOOPS_PER_SECOND = 22.4
TIMELINE_SCHEMA = 1
TRACK_SCALE = 10  # 시간과 좌표를 0.1 단위 정수로 양자화
SITE_ROOT = Path(__file__).resolve().parents[2]

WORKERS = {"SCV", "Probe", "Drone"}
TOWNHALLS = {"CommandCenter", "OrbitalCommand", "PlanetaryFortress", "Nexus", "Hatchery", "Lair", "Hive"}
GAS = {"Refinery", "RefineryRich", "Assimilator", "AssimilatorRich", "Extractor", "ExtractorRich"}
ARMY = {
    "Marine", "Marauder", "Reaper", "Ghost", "Hellion", "Hellbat", "WidowMine", "SiegeTank", "Cyclone", "Thor",
    "VikingFighter", "Medivac", "Liberator", "Banshee", "Raven", "Battlecruiser", "Zealot", "Stalker", "Sentry",
    "Adept", "HighTemplar", "DarkTemplar", "Archon", "Immortal", "Colossus", "Disruptor", "Observer", "WarpPrism",
    "Phoenix", "VoidRay", "Oracle", "Carrier", "Tempest", "Mothership", "Zergling", "Baneling", "Roach", "Ravager",
    "Hydralisk", "LurkerMP", "Lurker", "Mutalisk", "Corruptor", "BroodLord", "Infestor", "SwarmHostMP", "Ultralisk",
    "Viper", "Queen", "Overseer", "Dragoon", "Energizer", "Wraith", "ScienceVessel", "Firebat", "WarHound",
    "Warhound", "Goliath", "ArbiterMP", "Arbiter", "Reaver", "ScoutMP", "Scout", "CorsairMP", "Corsair",
    "DefilerMP", "Defiler", "Valkyrie", "Medic", "Vulture", "GuardianMP", "Guardian", "Ravasaur", "Terrorzor",
    "InfestedAbomination", "QueenClassic", "FirebatHeavyArmor",
    "Overlord", "Devourer", "Scourge", "EnergizerPhasingMode",
}
ALIASES = {
    "SiegeTankSieged": "SiegeTank", "WidowMineBurrowed": "WidowMine", "HellionTank": "Hellbat",
    "VikingAssault": "VikingFighter", "LiberatorAG": "Liberator", "ThorAP": "Thor",
    "ThorHighImpactPayload": "Thor", "ObserverSiegeMode": "Observer", "ObserverSurveillanceMode": "Observer",
    "WarpPrismPhasing": "WarpPrism", "BanelingBurrowed": "Baneling", "BanelingCocoon": "Baneling",
    "RoachBurrowed": "Roach", "RavagerCocoon": "Ravager", "RavagerBurrowed": "Ravager",
    "HydraliskBurrowed": "Hydralisk", "LurkerMPBurrowed": "LurkerMP", "LurkerMPEgg": "LurkerMP",
    "InfestorBurrowed": "Infestor", "QueenBurrowed": "Queen", "UltraliskBurrowed": "Ultralisk",
    "SwarmHostBurrowedMP": "SwarmHostMP", "BroodLordCocoon": "BroodLord", "OverlordCocoon": "Overseer",
    "OverseerSiegeMode": "Overseer", "CommandCenterFlying": "CommandCenter", "OrbitalCommandFlying": "OrbitalCommand",
    "BarracksFlying": "Barracks", "FactoryFlying": "Factory", "StarportFlying": "Starport",
    "SupplyDepotLowered": "SupplyDepot", "SporeCrawlerUprooted": "SporeCrawler", "SpineCrawlerUprooted": "SpineCrawler",
}


def _text(value) -> str:
    return value.decode("utf8", "ignore") if isinstance(value, bytes) else str(value or "")


def _canon(value) -> str:
    name = _text(value)
    if name.startswith("BPM_"):
        name = name[4:]
    return ALIASES.get(name, name)


def _sec(loop: int | float | None) -> float | None:
    if loop is None or loop < 0:
        return None
    return round(float(loop) / LOOPS_PER_SECOND, 1)


def _tag(index: int, recycle: int) -> int:
    return (index << 18) | recycle


def _q(value: float) -> int:
    return round(float(value) * TRACK_SCALE)


def _delta_track(points: list[tuple[int, float, float]]) -> list[list[int]]:
    """첫 점은 [t,x,y] 절대값, 이후는 [dt,dx,dy]인 결정론적 델타 배열."""
    if not points:
        return []
    quantized = [(_q(_sec(t) or 0), _q(x), _q(y)) for t, x, y in points]
    out = [list(quantized[0])]
    for prev, cur in zip(quantized, quantized[1:]):
        out.append([cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]])
    return out


def _map_transform(map_name: str | None) -> dict | None:
    """사이트의 단일 지도 에셋 표에서 월드 좌표 경계를 가져온다. 없는 지도는 기능 저하로 처리한다."""
    try:
        index = json.loads((SITE_ROOT / "public" / "maps" / "index.json").read_text(encoding="utf8"))
        asset_id = index.get(map_name)
        asset = json.loads((SITE_ROOT / "public" / "maps" / f"{asset_id}.json").read_text(encoding="utf8"))
        return {"asset": asset_id, "x0": asset["x0"], "y0": asset["y0"], "w": asset["w"], "h": asset["h"]}
    except (OSError, ValueError, TypeError, KeyError):
        return None


def _sum(stats: Mapping, suffix: str) -> int:
    return round(sum(float(stats.get(f"m_scoreValue{resource}{suffix}{kind}", 0))
                     for resource in ("Minerals", "Vespene") for kind in ("Army", "Economy", "Technology")))


def _spent(stats: Mapping) -> int:
    return round(sum(float(stats.get(f"m_scoreValue{resource}UsedActiveForces", 0)) for resource in ("Minerals", "Vespene")))


def _series_point(loop: int, pid: int, stats: Mapping) -> dict:
    return {
        "t": _sec(loop), "owner": pid,
        "minerals": round(float(stats.get("m_scoreValueMineralsCurrent", 0))),
        "gas": round(float(stats.get("m_scoreValueVespeneCurrent", 0))),
        "workers": round(float(stats.get("m_scoreValueWorkersActiveCount", 0))),
        "supply": [round(float(stats.get("m_scoreValueFoodUsed", 0)) / 4096, 1),
                   round(float(stats.get("m_scoreValueFoodMade", 0)) / 4096, 1)],
        "armyValue": round(sum(float(stats.get(f"m_scoreValue{r}UsedCurrentArmy", 0)) for r in ("Minerals", "Vespene"))),
        "incomeMin": round(float(stats.get("m_scoreValueMineralsCollectionRate", 0))),
        "incomeGas": round(float(stats.get("m_scoreValueVespeneCollectionRate", 0))),
        "spent": _spent(stats), "lost": _sum(stats, "Lost"), "killed": _sum(stats, "Killed"),
    }


def _battles(units: list[dict]) -> list[dict]:
    deaths = sorted((u for u in units if u["diedT"] is not None and u.get("deathPos")), key=lambda u: u["diedT"])
    groups: list[list[dict]] = []
    for unit in deaths:
        if not groups:
            groups.append([unit])
            continue
        prev = groups[-1][-1]
        distance = math.dist(unit["deathPos"], prev["deathPos"])
        if unit["diedT"] - prev["diedT"] <= 15 and distance <= 20:
            groups[-1].append(unit)
        else:
            groups.append([unit])
    out = []
    for group in groups:
        owners = {u["owner"] for u in group if u["owner"] in (1, 2)}
        if owners != {1, 2} or len(group) < 4:
            continue
        types = Counter(u["type"] for u in group)
        cx = round(sum(u["deathPos"][0] for u in group) / len(group), 1)
        cy = round(sum(u["deathPos"][1] for u in group) / len(group), 1)
        lost_a = sum(u["owner"] == 1 for u in group)
        lost_b = sum(u["owner"] == 2 for u in group)
        out.append({"id": len(out) + 1, "t0": group[0]["diedT"], "t1": group[-1]["diedT"], "cx": cx, "cy": cy,
                    "lostA": lost_a, "lostB": lost_b, "shareA": None, "shareB": None,
                    "units": dict(sorted(types.items())), "importance": len(group)})
    return out


def build_timeline(tracker: Iterable[Mapping], decoded: Mapping, analyzer_version: str) -> dict:
    """L0 이벤트로 timeline 스키마 v1 객체를 만든다."""
    units: list[dict] = []
    row_of: dict[tuple[int, int], int] = {}
    live_by_index: dict[int, int] = {}
    tracks: defaultdict[int, list[tuple[int, float, float]]] = defaultdict(list)
    stats_at: defaultdict[int, list[tuple[int, float]]] = defaultdict(list)
    build_events: list[tuple[int, int, str, str]] = []
    upgrades: list[tuple[int, int, str]] = []

    for event in tracker:
        name = event["_event"].rsplit(".", 1)[-1]
        loop = int(event.get("_gameloop", 0))
        if name in ("SUnitBornEvent", "SUnitInitEvent"):
            idx, rec = int(event["m_unitTagIndex"]), int(event["m_unitTagRecycle"])
            owner = int(event.get("m_controlPlayerId") or 0)
            unit_type = _canon(event.get("m_unitTypeName"))
            row = len(units)
            kind = "structure" if name == "SUnitInitEvent" or unit_type in TOWNHALLS | GAS else ("worker" if unit_type in WORKERS else "army" if unit_type in ARMY else "other")
            units.append({"tag": _tag(idx, rec), "type": unit_type, "owner": owner, "kind": kind,
                          "bornT": _sec(loop), "doneT": _sec(loop) if name == "SUnitBornEvent" else None,
                          "diedT": None, "killerOwner": None, "killerType": None,
                          "x0": round(float(event.get("m_x", 0)), 1), "y0": round(float(event.get("m_y", 0)), 1),
                          "deathPos": None, "track": []})
            row_of[(idx, rec)] = row
            live_by_index[idx] = row
            if owner in (1, 2) and kind in ("structure", "worker", "army"):
                build_events.append((loop, owner, "build" if kind == "structure" else "unit", unit_type))
        elif name == "SUnitDoneEvent":
            row = row_of.get((int(event["m_unitTagIndex"]), int(event["m_unitTagRecycle"])))
            if row is not None:
                units[row]["doneT"] = _sec(loop)
        elif name == "SUnitTypeChangeEvent":
            row = row_of.get((int(event["m_unitTagIndex"]), int(event["m_unitTagRecycle"])))
            if row is not None:
                units[row]["type"] = _canon(event.get("m_unitTypeName"))
                build_events.append((loop, units[row]["owner"], "morph", units[row]["type"]))
        elif name == "SUnitDiedEvent":
            key = (int(event["m_unitTagIndex"]), int(event.get("m_unitTagRecycle", 0)))
            row = row_of.get(key)
            if row is not None:
                unit = units[row]
                unit["diedT"] = _sec(loop)
                x, y = event.get("m_x"), event.get("m_y")
                if x is not None and y is not None:
                    unit["deathPos"] = [round(float(x), 1), round(float(y), 1)]
                unit["killerOwner"] = int(event.get("m_killerPlayerId") or 0) or None
                killer = row_of.get((int(event.get("m_killerUnitTagIndex") or -1), int(event.get("m_killerUnitTagRecycle") or 0)))
                unit["killerType"] = units[killer]["type"] if killer is not None else None
                if live_by_index.get(key[0]) == row:
                    del live_by_index[key[0]]
        elif name == "SUnitPositionsEvent":
            idx = int(event["m_firstUnitIndex"])
            items = list(event.get("m_items", []))
            for pos in range(0, len(items) - 2, 3):
                idx += int(items[pos])
                row = live_by_index.get(idx)
                if row is not None:
                    tracks[row].append((loop, float(items[pos + 1]), float(items[pos + 2])))
        elif name == "SPlayerStatsEvent":
            pid = int(event["m_playerId"])
            st = event["m_stats"]
            stats_at[pid].append((loop, float(st.get("m_scoreValueFoodUsed", 0)) / 4096))
        elif name == "SUpgradeEvent":
            pid, upgrade = int(event["m_playerId"]), _text(event.get("m_upgradeTypeName"))
            upgrades.append((loop, pid, upgrade))
            if not upgrade.startswith(("BPM_Ban_", "BPM_Pick_", "BPM_Upgrade_")):
                build_events.append((loop, pid, "upgrade", upgrade))

    series = []
    for event in tracker:
        if event["_event"].endswith("SPlayerStatsEvent"):
            series.append(_series_point(int(event.get("_gameloop", 0)), int(event["m_playerId"]), event["m_stats"]))

    def supply_at(pid: int, loop: int) -> float | None:
        before = [value for at, value in stats_at[pid] if at <= loop]
        return round(before[-1], 1) if before else None

    output_units = []
    mode_counts = Counter()
    for row, unit in enumerate(units):
        if unit["owner"] not in (1, 2) or unit["kind"] == "other":
            continue
        unit["track"] = _delta_track(tracks.get(row, []))
        if unit["kind"] == "structure":
            mode = "static"
        elif unit["track"]:
            mode = "tracked"
        elif unit["deathPos"]:
            mode = "event-endpoints"
        else:
            mode = "birth-only"
        unit["positionMode"] = mode
        mode_counts[mode] += 1
        output_units.append(unit)

    players = [{"owner": p["playerId"], "race": p.get("race"), "result": p.get("result"), "isAi": bool(p.get("isAi")),
                "handleKey": handle_key(p.get("handle"))} for p in decoded.get("players", [])]
    draft = {"players": [{"owner": p["playerId"], "picks": p.get("picks", []), "bans": p.get("bans", []),
                           "displaced": p.get("displaced", [])} for p in decoded.get("players", [])]}
    build_order = [{"t": _sec(loop), "owner": pid, "supply": supply_at(pid, loop), "kind": kind, "id": item}
                   for loop, pid, kind, item in sorted(build_events) if pid in (1, 2)]
    tech = [{"t": _sec(loop), "owner": pid, "id": upgrade} for loop, pid, upgrade in sorted(upgrades)
            if not upgrade.startswith(("BPM_Ban_", "BPM_Pick_", "BPM_Upgrade_"))]
    return {
        "schema": TIMELINE_SCHEMA,
        "meta": {"map": decoded.get("map"), "mapTransform": _map_transform(decoded.get("map")),
                 "build": decoded.get("baseBuild"), "durationSec": decoded.get("durationSec"),
                 "analyzerVersion": analyzer_version, "timeScale": TRACK_SCALE, "coordinateScale": TRACK_SCALE,
                 "trackEncoding": "first-absolute-then-delta", "positionPolicy": {
                     "tracked": "linear-interpolation", "static": "fixed", "event-endpoints": "fade-at-birth-and-death",
                     "birth-only": "fade-at-birth", "endpointWindowSec": 3,
                 }, "positionModes": dict(sorted(mode_counts.items()))},
        "players": players, "draft": draft, "series": series, "units": output_units,
        "buildOrder": build_order, "battles": _battles(output_units), "tech": tech,
    }


def gzip_timeline(timeline: Mapping) -> bytes:
    """동일 입력이 바이트 단위로 같은 UTF-8 JSON gzip을 만든다."""
    raw = json.dumps(timeline, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf8")
    return gzip.compress(raw, compresslevel=9, mtime=0)
