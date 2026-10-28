"""게임에 의존하지 않는 상태 누적·관측 마스크·라벨 생성기.

추출기와 이후 봇 스냅숏이 같은 정의를 쓰도록 입력을 작은 정규화 이벤트
사전으로 제한한다. 시간 단위는 초, 위치 단위는 게임 월드 타일이다.
"""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Iterable, Mapping


BASE_TYPES = {
    "CommandCenter", "OrbitalCommand", "PlanetaryFortress",
    "Nexus", "Hatchery", "Lair", "Hive",
}
PRODUCTION_TYPES = {
    "Barracks", "Factory", "Starport", "Gateway", "WarpGate", "RoboticsFacility",
    "Stargate", "Hatchery", "Lair", "Hive", "CommandCenter", "OrbitalCommand", "Nexus",
}
TECH_TYPES = {
    "EngineeringBay", "Armory", "GhostAcademy", "FusionCore", "TechLab",
    "BarracksTechLab", "FactoryTechLab", "StarportTechLab", "CyberneticsCore",
    "Forge", "TwilightCouncil", "TemplarArchive", "DarkShrine", "RoboticsBay",
    "FleetBeacon", "SpawningPool", "EvolutionChamber", "RoachWarren", "BanelingNest",
    "HydraliskDen", "LurkerDenMP", "InfestationPit", "Spire", "GreaterSpire",
    "UltraliskCavern", "NydusNetwork",
}


def _unit_key(event: Mapping) -> tuple[int, int]:
    """정규화 이벤트의 안정적인 유닛 키를 만든다."""
    return int(event["tag_index"]), int(event.get("tag_recycle", 0))


@dataclass
class UnitState:
    tag: tuple[int, int]
    owner: int
    unit_type: str
    x: float
    y: float
    complete: bool
    alive: bool = True


@dataclass
class PlayerState:
    stats: dict = field(default_factory=dict)
    upgrades: set[str] = field(default_factory=set)
    research: set[str] = field(default_factory=set)


class StateAccumulator:
    """시간순 정규화 이벤트를 누적해 선수별 전지적 상태를 만든다."""

    def __init__(self, role_map: Mapping):
        self.units: dict[tuple[int, int], UnitState] = {}
        self.players: dict[int, PlayerState] = defaultdict(PlayerState)
        self.role_map = role_map
        self.replay_aliases = role_map.get("replay_name_to_unit_id", {})
        self.unit_roles = role_map.get("unit_roles", {})
        self.unit_values = role_map.get("unit_values", {})
        self.excluded_from_state = set(role_map.get("excluded_from_state", []))
        self.time = 0.0

    def canonical(self, unit_type: str) -> str:
        if unit_type in self.replay_aliases:
            return self.replay_aliases[unit_type]
        for suffix in ("Burrowed", "Sieged", "Lowered", "Flying", "Phasing", "Transport"):
            if unit_type.endswith(suffix) and unit_type[: -len(suffix)] in self.unit_roles:
                return unit_type[: -len(suffix)]
        return unit_type

    def apply(self, event: Mapping) -> None:
        self.time = max(self.time, float(event.get("time", self.time)))
        kind = event["kind"]
        if kind in {"unit_born", "unit_init"}:
            key = _unit_key(event)
            self.units[key] = UnitState(
                key, int(event.get("owner", 0)), self.canonical(str(event["unit_type"])),
                float(event.get("x", 0.0)), float(event.get("y", 0.0)), kind == "unit_born",
            )
        elif kind == "unit_done":
            unit = self.units.get(_unit_key(event))
            if unit:
                unit.complete = True
        elif kind == "unit_died":
            unit = self.units.get(_unit_key(event))
            if unit:
                unit.alive = False
                if unit.owner in self.players:
                    self.players[unit.owner].research.clear()
        elif kind == "unit_type_change":
            unit = self.units.get(_unit_key(event))
            if unit:
                unit.unit_type = self.canonical(str(event["unit_type"]))
        elif kind == "unit_position":
            unit = self.units.get(_unit_key(event))
            if unit:
                unit.x, unit.y = float(event["x"]), float(event["y"])
        elif kind == "stats":
            self.players[int(event["player_id"])].stats.update(event.get("stats", {}))
        elif kind == "upgrade":
            p = self.players[int(event["player_id"])]
            name = str(event["upgrade"])
            p.upgrades.add(name)
            p.research.discard(name)
        elif kind == "upgrade_start":
            self.players[int(event["player_id"])].research.add(str(event["upgrade"]))

    def live_units(self, player_id: int, tags: set[tuple[int, int]] | None = None) -> list[UnitState]:
        return [
            u for u in self.units.values()
            if u.alive and u.owner == player_id and (tags is None or u.tag in tags)
        ]

    def snapshot(
        self,
        player_id: int,
        tags: set[tuple[int, int]] | None = None,
        observed_enemy: bool = False,
    ) -> dict:
        """한 선수 상태를 JSON 직렬화 가능한 사전으로 반환한다."""
        units = self.live_units(player_id, tags)
        counts = Counter(u.unit_type for u in units if u.complete)
        stats = {} if observed_enemy else self.players[player_id].stats
        roles = {role: {"count": 0, "supply": 0.0, "value": 0.0} for role in self.role_map["roles"]}
        army_xy = []
        supply_cap_from_units = 0.0
        for u in units:
            if not u.complete:
                continue
            if u.unit_type in self.excluded_from_state:
                continue
            unit_roles = self.unit_roles.get(u.unit_type, [])
            value = self.unit_values.get(u.unit_type, {})
            supply = float(value.get("supply", 0.0))
            supply_cap_from_units += float(value.get("supply_provided", 0.0))
            total_value = float(value.get("minerals", 0.0)) + float(value.get("vespene", 0.0))
            for role in unit_roles:
                if role in roles:
                    roles[role]["count"] += 1
                    roles[role]["supply"] += supply
                    roles[role]["value"] += total_value
            if "worker" not in unit_roles and "structure" not in unit_roles:
                army_xy.append((u.x, u.y))
        bases = [[u.x, u.y] for u in units if u.complete and u.unit_type in BASE_TYPES]
        if army_xy:
            cx = sum(p[0] for p in army_xy) / len(army_xy)
            cy = sum(p[1] for p in army_xy) / len(army_xy)
            dispersion = math.sqrt(sum((x - cx) ** 2 + (y - cy) ** 2 for x, y in army_xy) / len(army_xy))
            army_position = {"center": [round(cx, 3), round(cy, 3)], "dispersion": round(dispersion, 3)}
        else:
            army_position = {"center": None, "dispersion": None}
        worker_from_units = sum(counts[k] for k, rs in self.unit_roles.items() if "worker" in rs)
        return {
            "worker_count": int(stats.get("workers_active", worker_from_units)),
            "base_count": len(bases),
            "base_positions": bases,
            "mineral_collection_rate": stats.get("mineral_rate"),
            "vespene_collection_rate": stats.get("vespene_rate"),
            "supply_used": stats.get("supply_used"),
            "supply_cap": min(200.0, supply_cap_from_units) if supply_cap_from_units else stats.get("supply_cap"),
            "army_value": stats.get("army_value"),
            "production": {k: counts[k] for k in sorted(counts) if k in PRODUCTION_TYPES},
            "tech": {k: counts[k] for k in sorted(counts) if k in TECH_TYPES},
            "upgrades": [] if observed_enemy else sorted(self.players[player_id].upgrades),
            "research_in_progress": [] if observed_enemy else sorted(self.players[player_id].research),
            "roles": roles,
            "army_position": army_position,
        }


def visible_enemy_tags(
    accumulator: StateAccumulator,
    me: int,
    enemy: int,
    camera: tuple[float, float] | None,
    camera_radius: float = 24.0,
    unit_sight_radius: float = 11.0,
) -> set[tuple[int, int]]:
    """카메라와 아군 주변 시야의 합집합에 들어온 현재 적 태그를 반환한다."""
    if camera is None:
        return set()
    friendlies = accumulator.live_units(me)
    visible = set()
    for unit in accumulator.live_units(enemy):
        in_camera = abs(unit.x - camera[0]) <= camera_radius and abs(unit.y - camera[1]) <= camera_radius
        near_friendly = any(math.hypot(unit.x - f.x, unit.y - f.y) <= unit_sight_radius for f in friendlies)
        if in_camera or near_friendly:
            visible.add(unit.tag)
    return visible


def action_labels(
    events: Iterable[Mapping],
    player_id: int,
    start: float,
    end: float,
    state_now: Mapping | None = None,
    state_future: Mapping | None = None,
    enemy_bases: Iterable[tuple[float, float]] = (),
) -> dict:
    """(start, end] 구간의 운영 행동과 위치 기반 공세·견제를 라벨링한다."""
    window = [e for e in events if start < float(e.get("time", -1)) <= end]
    init_types = [str(e["unit_type"]) for e in window if e["kind"] == "unit_init" and int(e.get("owner", 0)) == player_id]
    upgrade_starts = [str(e["upgrade"]) for e in window if e["kind"] == "upgrade_start" and int(e.get("player_id", 0)) == player_id]
    production = Counter(x for x in init_types if x in PRODUCTION_TYPES)
    tech = Counter(x for x in init_types if x in TECH_TYPES)
    expansion = any(x in BASE_TYPES for x in init_types)
    offense = False
    harass = False
    c0 = (state_now or {}).get("army_position", {}).get("center")
    c1 = (state_future or {}).get("army_position", {}).get("center")
    bases = list(enemy_bases)
    if c0 and c1 and bases:
        d0 = min(math.hypot(c0[0] - x, c0[1] - y) for x, y in bases)
        d1 = min(math.hypot(c1[0] - x, c1[1] - y) for x, y in bases)
        offense = d0 - d1 >= 12.0
        harass = d1 <= 25.0 and not offense
    return {
        "expansion_started": expansion,
        "production_added": dict(sorted(production.items())),
        "tech_started": dict(sorted(tech.items())),
        "upgrade_started": sorted(set(upgrade_starts)),
        "offense_started": offense,
        "harass_started": harass,
    }


def outcome_label(state: Mapping | None) -> dict | None:
    if state is None:
        return None
    return {
        "worker_count": state["worker_count"],
        "base_count": state["base_count"],
        "army_value": state["army_value"],
        "supply_used": state["supply_used"],
        "supply_cap": state["supply_cap"],
    }
