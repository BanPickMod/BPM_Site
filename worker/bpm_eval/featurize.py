"""특징 평탄화와 정찰 이력(기억) 추적(마스터 플랜 11장 M1~M4, 18.2 1.1). 추출 v3의 한 구간 표본(JSON)과 봇의 실시간 스냅숏을 **같은 코드**로 고정 순서의 수치 벡터로 바꾼다.
학습(`train/features.py`)과 봇(`cognition/state.py`)이 이 모듈 하나를 쓰므로 특징 이름이 곧 계약이다(번들 manifest의 feature_names).
정책 입력(`observed`)과 특권 평가자 입력(`priv`)은 접두어로 구분한다: `self.*`·`obs_enemy.*`는 정책이 쓸 수 있고, `priv_enemy.*`는 M1(특권)에만 쓴다."""
from __future__ import annotations

import math

import numpy as np

ROLES = ["frontline", "firepower", "anti_air", "detector", "splash", "siege", "mobile", "transport", "support", "worker", "structure", "production", "tech"]
COSMETIC_PREFIX = ("Reward", "Spray", "GameHeart", "Portrait", "Banner", "Animation")
RACES = ["Terran", "Protoss", "Zerg"]
VIS = ["none", "camera_and_unit_sight"]
TIME_BUCKETS = [(0, 240), (240, 480), (480, 840), (840, 1e9)]


def real_upgrades(items) -> int:
    return sum(1 for u in items or [] if not str(u).startswith(COSMETIC_PREFIX))


def _num(v):
    return float("nan") if v is None else float(v)


def side_features(d: dict, start, opp_start) -> dict:
    """한 쪽 상태 → {이름: 값}. 값이 없으면 NaN."""
    out = {}
    if d is None:
        return out
    out["workers"] = _num(d.get("worker_count"))
    out["bases"] = _num(d.get("base_count"))
    out["mineral_rate"] = _num(d.get("mineral_collection_rate"))
    out["gas_rate"] = _num(d.get("vespene_collection_rate"))
    out["supply_used"] = _num(d.get("supply_used"))
    out["supply_cap"] = _num(d.get("supply_cap"))
    out["army_value"] = _num(d.get("army_value"))
    out["n_production_types"] = float(len(d.get("production") or {}))
    out["n_production"] = float(sum((d.get("production") or {}).values()))
    out["n_tech"] = float(sum((d.get("tech") or {}).values()))
    out["upgrades_done"] = float(real_upgrades(d.get("upgrades")))
    out["research_running"] = float(len(d.get("research_in_progress") or []))
    for r in ROLES:
        x = (d.get("roles") or {}).get(r) or {}
        out[f"role.{r}.count"] = _num(x.get("count"))
        out[f"role.{r}.supply"] = _num(x.get("supply"))
        out[f"role.{r}.value"] = _num(x.get("value"))
    ap = d.get("army_position") or {}
    c = ap.get("center")
    out["army_dispersion"] = _num(ap.get("dispersion"))
    if c is not None and start is not None:
        out["army_dist_own_start"] = math.dist(c, start)
        out["army_dist_opp_start"] = math.dist(c, opp_start) if opp_start is not None else float("nan")
    else:
        out["army_dist_own_start"] = out["army_dist_opp_start"] = float("nan")
    bp = d.get("base_positions") or []
    if bp and opp_start is not None:
        out["nearest_base_to_enemy_start"] = min(math.dist(p, opp_start) for p in bp)
        out["farthest_base_from_start"] = max(math.dist(p, start) for p in bp) if start is not None else float("nan")
    else:
        out["nearest_base_to_enemy_start"] = out["farthest_base_from_start"] = float("nan")
    return out


def row_features(t: float, race: str, opp_race: str, vis: str, patch: int, obs_self: dict, obs_enemy: dict, priv_enemy: dict, start, opp_start, with_priv: bool) -> dict:
    f = {"time": float(t), "patch": float(patch), "vis_camera": 1.0 if vis != "none" else 0.0}
    for r in RACES:
        f[f"race_self.{r}"] = 1.0 if race == r else 0.0
        f[f"race_opp.{r}"] = 1.0 if opp_race == r else 0.0
    f.update({f"self.{k}": v for k, v in side_features(obs_self, start, opp_start).items()})
    f.update({f"obs_enemy.{k}": v for k, v in side_features(obs_enemy, opp_start, start).items()})
    if with_priv:
        f.update({f"priv_enemy.{k}": v for k, v in side_features(priv_enemy, opp_start, start).items()})
        # 양측 격차 특징(특권 평가자 전용): 후반 교착에서 단순 격차가 기준선을 이기도록 명시한다
        for k in ("army_value", "supply_used", "workers", "bases", "mineral_rate", "gas_rate", "n_production", "upgrades_done"):
            a, b = f.get(f"self.{k}", float("nan")), f.get(f"priv_enemy.{k}", float("nan"))
            f[f"priv_diff.{k}"] = a - b
        a, b = f.get("self.army_value", float("nan")), f.get("priv_enemy.army_value", float("nan"))
        f["priv_diff.log_army_ratio"] = math.log((max(a, 0.0) + 100.0) / (max(b, 0.0) + 100.0)) if a == a and b == b else float("nan")
    return f


def time_bucket(t: float) -> int:
    for i, (a, b) in enumerate(TIME_BUCKETS):
        if a <= t < b:
            return i
    return len(TIME_BUCKETS) - 1


ACTION_HEADS = ["expansion_started", "production_added", "tech_started", "upgrade_started", "offense_started", "harass_started"]


def action_targets(labels: dict):
    a = (labels or {}).get("actions_20s") or {}
    return [
        float(bool(a.get("expansion_started"))), float(bool(a.get("production_added"))), float(bool(a.get("tech_started"))),
        float(bool(a.get("upgrade_started"))), float(bool(a.get("offense_started"))), float(bool(a.get("harass_started"))),
    ]


def feature_matrix(rows: list[dict], names: list[str]) -> np.ndarray:
    X = np.full((len(rows), len(names)), np.nan, dtype=np.float32)
    idx = {n: i for i, n in enumerate(names)}
    for r, row in enumerate(rows):
        for k, v in row.items():
            i = idx.get(k)
            if i is not None:
                X[r, i] = v
    return X


# ---------------------------------------------------------------- 정찰 이력(기억) — 학습 표의 `mem_*`·`delta60.*`와 같은 정의의 온라인 계산
MEM_MAX_FIELDS = ["obs_enemy.bases", "obs_enemy.n_production", "obs_enemy.n_production_types", "obs_enemy.n_tech", "obs_enemy.army_value", "obs_enemy.workers",
                  "obs_enemy.supply_used", "obs_enemy.role.structure.count", "obs_enemy.role.frontline.count", "obs_enemy.role.mobile.count", "obs_enemy.role.firepower.count",
                  "obs_enemy.role.production.count", "obs_enemy.role.tech.count", "obs_enemy.role.anti_air.count", "obs_enemy.role.siege.count"]
MEM_SEEN_FIELDS = ("obs_enemy.role.structure.count", "obs_enemy.role.frontline.count", "obs_enemy.role.mobile.count", "obs_enemy.role.worker.count")
MEM_DELTA_FIELDS = ["self.workers", "self.army_value", "self.bases", "self.supply_used", "self.n_production", "self.mineral_rate"]
MEM_DELTA_LAG = 6          # 10초 구간 6개 = 60초


class MemoryTracker:
    """한 경기(한 관점)의 구간 행을 시간순으로 넣으면 그 시점까지의 이력 특징을 돌려준다. 미래 정보는 쓰지 않는다."""

    def __init__(self):
        self.mx = {}
        self.last_seen = None
        self.first_seen = None
        self.seen_rows = 0
        self.hist = {f: [] for f in MEM_DELTA_FIELDS}

    def update(self, row: dict) -> dict:
        t = float(row["time"])
        out = {}
        for f in MEM_MAX_FIELDS:
            v = row.get(f, float("nan"))
            if v == v:
                self.mx[f] = v if f not in self.mx else max(self.mx[f], v)
            # 학습 표(add_memory의 pandas cummax)와 같은 정의: 이번 구간에 관측값이 없으면 NaN(최댓값은 내부에 유지). 최댓값을 구간 사이에 유지하도록 바꾸면 재학습이 필요하다(개선 후보).
            out["mem_max." + f[len("obs_enemy."):]] = self.mx.get(f, float("nan")) if v == v else float("nan")
        seen = any((row.get(f, 0.0) if row.get(f, 0.0) == row.get(f, 0.0) else 0.0) > 0 for f in MEM_SEEN_FIELDS)
        if seen:
            self.last_seen = t
            if self.first_seen is None:
                self.first_seen = t
            self.seen_rows += 1
        out["mem_age.enemy_seen"] = t if self.last_seen is None else t - self.last_seen
        out["mem_first_seen_time"] = -1.0 if self.first_seen is None else self.first_seen
        out["mem_seen_rows"] = float(self.seen_rows)
        out["mem_seen_now"] = 1.0 if seen else 0.0
        for f in MEM_DELTA_FIELDS:
            v = row.get(f, float("nan"))
            h = self.hist[f]
            prev = h[-MEM_DELTA_LAG] if len(h) >= MEM_DELTA_LAG else float("nan")
            out["delta60." + f[len("self."):]] = v - prev if (v == v and prev == prev) else float("nan")
            h.append(v)
        return out


def row_vector(row: dict, names: list) -> np.ndarray:
    """행 사전을 번들 특징 이름 순서의 벡터로(없는 특징은 NaN)."""
    v = np.full(len(names), np.nan, dtype=np.float64)
    for i, n in enumerate(names):
        x = row.get(n)
        if x is not None:
            v[i] = x
    return v


# ---- 경제 진행도·시작 경제 특징(마스터 플랜 30.3 J−1.1~1.3) ----
ECON_SCHEMA_VERSION = 2
ECON_NAMES = ["econ.start_workers", "econ.start_workers_enemy", "econ.start_workers_enemy_estimated", "econ.start_workers_enemy_confidence", "econ.start_supply_used", "econ.start_supply_cap",
              "econ.start_minerals", "econ.start_gas", "econ.start_estimated", "econ.start_confidence", "econ.ruleset_bpm", "econ.regime8", "econ.minerals", "econ.gas", "econ.free_supply",
              "econ.workers_created", "econ.worker_seconds", "econ.worker_seconds_event_based", "econ.worker_seconds_anchor_age", "econ.income_per_base", "econ.t_since_first_supply", "econ.t_since_first_production", "econ.t_since_first_gas",
              "econ.t_since_second_base"]
_SUPPLY_S = {"SUPPLYDEPOT", "SUPPLYDEPOTLOWERED", "PYLON", "OVERLORD"}
_GAS_S = {"REFINERY", "REFINERYRICH", "ASSIMILATOR", "ASSIMILATORRICH", "EXTRACTOR", "EXTRACTORRICH"}
_BASE_S = {"COMMANDCENTER", "ORBITALCOMMAND", "PLANETARYFORTRESS", "NEXUS", "HATCHERY", "LAIR", "HIVE"}
_PROD_S = {"BARRACKS", "FACTORY", "STARPORT", "GATEWAY", "WARPGATE", "ROBOTICSFACILITY", "STARGATE", "SPAWNINGPOOL"}


def struct_kind(name: str) -> str | None:
    """건물 이름(대소문자 무관) → 'supply' | 'production' | 'gas' | 'base' | None. 오프라인(리플레이 이름)과 라이브(유닛형 이름)가 같은 정의를 쓴다."""
    n = name.upper()
    if n in _SUPPLY_S:
        return "supply"
    if n in _GAS_S:
        return "gas"
    if n in _BASE_S:
        return "base"
    if n in _PROD_S:
        return "production"
    return None


def second_base_start(base_starts, structure_starts=()) -> float | None:
    """추출 v3의 시작 본진 포함 ``base_starts``에서 첫 추가 기지 시각을 구한다.

    정상 계약은 ``[0, 첫 확장, ...]``이다. 과거/부분 추출물처럼 ``base_starts``가
    없을 때만 구조물 착공 목록의 첫 기지로 폴백한다. 궤도사령부·레어 같은 변형을
    새 기지로 잘못 세지 않도록 정상 자료에서는 구조물 목록보다 base_starts를 우선한다.
    """
    times = sorted(float(t) for t in (base_starts or []) if t is not None)
    if times:
        non_initial = [t for t in times if t > 1.0]
        return non_initial[0] if non_initial else None
    candidates = [float(e[1]) for e in (structure_starts or []) if len(e) >= 2 and struct_kind(str(e[0])) == "base"]
    return min(candidates) if candidates else None


def integrate_count_events(sample_times, changes) -> np.ndarray:
    """``(시각, 증감)`` 사건으로 개체-초를 정확히 적분해 각 표본 시각의 누적값을 반환한다."""
    ordered = sorted((float(t), float(delta)) for t, delta in changes)
    out = np.zeros(len(sample_times), dtype=np.float64)
    count = area = previous_t = 0.0
    event_i = 0
    for i, sample_t in enumerate(map(float, sample_times)):
        if sample_t < previous_t:
            raise ValueError("sample_times는 시간순이어야 합니다")
        while event_i < len(ordered) and ordered[event_i][0] <= sample_t:
            event_t, delta = ordered[event_i]
            if event_t < previous_t:
                event_i += 1
                continue
            area += count * (event_t - previous_t)
            count = max(0.0, count + delta)
            previous_t = event_t
            event_i += 1
        area += count * (sample_t - previous_t)
        previous_t = sample_t
        out[i] = area
    return out


class EconTracker:
    """한 경기(한 관점)의 10초 행을 시간순으로 넣으면 경제 진행도 특징을 돌려준다. 미래 정보는 쓰지 않는다.
    ext(경기 밖 입력): start_workers, start_supply_cap, minerals, gas, workers_created(진행 중 지출은 라이브에서 얻을 수 없어 뺐다). 건물 착공은 `observe_struct`로 먼저 알려 준다."""

    def __init__(self):
        self.first = {}
        self.bases_started = 0          # 시작 기지는 세지 않는다(두 번째 기지 시각 = 첫 번째 새 기지)
        self.worker_seconds = 0.0
        self.prev_t = None
        self.prev_workers = None
        self.worker_seconds_event_based = 0.0
        self.worker_seconds_anchor_t = None

    def observe_struct(self, name: str, t: float, initial: bool = False) -> None:
        k = struct_kind(name)
        if k is None or initial:
            return
        if k == "base":
            self.bases_started += 1
            k = "second_base" if self.bases_started == 1 else None
        if k is not None and k not in self.first:
            self.first[k] = float(t)

    def observe_second_base(self, t: float) -> None:
        """추출기의 권위 있는 base_starts에서 얻은 첫 추가 기지 시각을 기록한다."""
        if "second_base" not in self.first:
            self.first["second_base"] = float(t)

    def update(self, row: dict, ext: dict) -> dict:
        t = float(row["time"])
        w = row.get("self.workers", float("nan"))
        exact_worker_seconds = ext.get("worker_seconds", float("nan"))
        if exact_worker_seconds is not None and float(exact_worker_seconds) == float(exact_worker_seconds):
            exact_t = float(ext.get("worker_seconds_time", t))
            # 리플레이 사건 적분은 PlayerStats 시각까지 정확하다. 현재 10초 행까지의 짧은 꼬리는
            # 현재 일꾼 수로 외삽하고, 같은 anchor가 반복될 때는 아래 증분 적분을 사용한다.
            anchored = float(exact_worker_seconds) + (w * max(0.0, t - exact_t) if w == w else 0.0)
            # 다음 PlayerStats anchor가 직전 꼬리 외삽보다 작더라도 누적량은 감소할 수 없다.
            self.worker_seconds = max(self.worker_seconds, anchored)
            self.worker_seconds_event_based = 1.0
            self.worker_seconds_anchor_t = exact_t
        elif self.prev_t is not None and w == w and self.prev_workers == self.prev_workers:
            self.worker_seconds += 0.5 * (w + self.prev_workers) * (t - self.prev_t)
        elif self.prev_t is None and w == w:
            self.worker_seconds += w * t
        self.prev_t, self.prev_workers = t, w
        nan = float("nan")
        cap, used = row.get("self.supply_cap", nan), row.get("self.supply_used", nan)
        bases = row.get("self.bases", nan)
        rate = row.get("self.mineral_rate", nan)
        sw = float(ext.get("start_workers", nan))

        def since(k):
            return t - self.first[k] if k in self.first else nan
        return {"econ.start_workers": sw, "econ.start_workers_enemy": float(ext.get("start_workers_enemy", nan)),
                "econ.start_workers_enemy_estimated": float(ext.get("start_workers_enemy_estimated", nan)),
                "econ.start_workers_enemy_confidence": float(ext.get("start_workers_enemy_confidence", nan)),
                "econ.start_supply_used": float(ext.get("start_supply_used", nan)), "econ.start_supply_cap": float(ext.get("start_supply_cap", nan)),
                "econ.start_minerals": float(ext.get("start_minerals", nan)), "econ.start_gas": float(ext.get("start_gas", nan)),
                "econ.start_estimated": float(ext.get("start_estimated", nan)), "econ.start_confidence": float(ext.get("start_confidence", nan)),
                "econ.ruleset_bpm": float(ext.get("ruleset_bpm", nan)), "econ.regime8": 1.0 if sw == 8.0 else 0.0,
                "econ.minerals": float(ext.get("minerals", nan)), "econ.gas": float(ext.get("gas", nan)),
                "econ.free_supply": cap - used if (cap == cap and used == used) else nan, "econ.workers_created": float(ext.get("workers_created", nan)),
                "econ.worker_seconds": self.worker_seconds, "econ.worker_seconds_event_based": self.worker_seconds_event_based,
                "econ.worker_seconds_anchor_age": t - self.worker_seconds_anchor_t if self.worker_seconds_anchor_t is not None else nan,
                "econ.income_per_base": rate / max(bases, 1.0) if (rate == rate and bases == bases) else nan,
                "econ.t_since_first_supply": since("supply"), "econ.t_since_first_production": since("production"), "econ.t_since_first_gas": since("gas"),
                "econ.t_since_second_base": since("second_base")}
