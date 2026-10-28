"""s2protocol 사전을 공용 상태 이벤트와 학습 표본으로 바꾸는 순수 변환 코드."""
from __future__ import annotations

import bisect
import json
import math
import statistics
from collections import Counter, defaultdict
from typing import Iterable, Mapping

from .state import BASE_TYPES, StateAccumulator, action_labels, outcome_label, visible_enemy_tags

LOOPS_PER_SECOND = 22.4
FOOD_SCALE = 4096.0


def _research_times() -> dict:
    import json as _json
    from pathlib import Path
    try:
        d = _json.loads((Path(__file__).with_name("research_times.json")).read_text(encoding="utf8"))
        return {k: float(v["seconds"]) for k, v in d.items()}
    except (OSError, ValueError):
        return {}


def add_upgrade_starts(events: list, times: dict | None = None) -> list:
    """트래커에는 업그레이드 완료(`upgrade`)만 있어 `upgrade_start`가 한 번도 만들어지지 않았다(연구 중 특징·upgrade_started 라벨이 전 구간 0).
    연구 시간표(`research_times.json`: 명령-완료 시각 차의 봉우리로 데이터에서 추정, 신뢰 항목만)로 시작 = 완료 - 연구 시간 이벤트를 만든다. 표에 없는 업그레이드는 만들지 않는다.
    입력 리스트는 바꾸지 않고 시간순으로 합친 새 리스트를 돌려준다."""
    tt = _research_times() if times is None else times
    extra = []
    for e in events:
        if e["kind"] == "upgrade" and e["upgrade"] in tt:
            extra.append({"kind": "upgrade_start", "time": max(0.0, e["time"] - tt[e["upgrade"]]), "player_id": e["player_id"], "upgrade": e["upgrade"], "derived": True})
    return sorted(events + extra, key=lambda event: event["time"]) if extra else list(events)


def _text(value) -> str:
    return value.decode("utf8", "ignore") if isinstance(value, bytes) else str(value)


def normalize_tracker_events(raw_events: Iterable[Mapping]) -> tuple[list[dict], dict[int, int]]:
    """트래커 이벤트를 누적기가 이해하는 작은 계약으로 정규화한다."""
    out: list[dict] = []
    recycle_by_index: dict[int, int] = {}
    user_to_player: dict[int, int] = {}
    for raw in raw_events:
        event_name = raw["_event"].rsplit(".", 1)[-1]
        time = float(raw.get("_gameloop", 0)) / LOOPS_PER_SECOND
        if event_name == "SPlayerSetupEvent" and raw.get("m_userId") is not None:
            user_to_player[int(raw["m_userId"])] = int(raw["m_playerId"])
        elif event_name in {"SUnitBornEvent", "SUnitInitEvent"}:
            idx, rec = int(raw["m_unitTagIndex"]), int(raw["m_unitTagRecycle"])
            recycle_by_index[idx] = rec
            out.append({
                "kind": "unit_born" if event_name == "SUnitBornEvent" else "unit_init",
                "time": time, "tag_index": idx, "tag_recycle": rec,
                "unit_type": _text(raw["m_unitTypeName"]),
                "owner": int(raw.get("m_controlPlayerId", 0)),
                "x": float(raw.get("m_x", 0)), "y": float(raw.get("m_y", 0)),
            })
        elif event_name in {"SUnitDoneEvent", "SUnitDiedEvent", "SUnitTypeChangeEvent"}:
            idx = int(raw["m_unitTagIndex"])
            item = {
                "kind": {"SUnitDoneEvent": "unit_done", "SUnitDiedEvent": "unit_died", "SUnitTypeChangeEvent": "unit_type_change"}[event_name],
                "time": time, "tag_index": idx,
                "tag_recycle": int(raw.get("m_unitTagRecycle", recycle_by_index.get(idx, 0))),
            }
            if event_name == "SUnitTypeChangeEvent":
                item["unit_type"] = _text(raw["m_unitTypeName"])
            out.append(item)
        elif event_name == "SUnitPositionsEvent":
            unit_index = int(raw["m_firstUnitIndex"])
            items = list(raw.get("m_items", []))
            for pos in range(0, len(items) - 2, 3):
                unit_index += int(items[pos])
                out.append({
                    "kind": "unit_position", "time": time, "tag_index": unit_index,
                    "tag_recycle": recycle_by_index.get(unit_index, 0),
                    "x": float(items[pos + 1]), "y": float(items[pos + 2]),
                })
        elif event_name == "SUpgradeEvent":
            out.append({
                "kind": "upgrade", "time": time, "player_id": int(raw["m_playerId"]),
                "upgrade": _text(raw["m_upgradeTypeName"]),
            })
        elif event_name == "SPlayerStatsEvent":
            stats = raw["m_stats"]
            army_value = (
                stats.get("m_scoreValueMineralsUsedCurrentArmy", 0)
                + stats.get("m_scoreValueVespeneUsedCurrentArmy", 0)
            )
            out.append({
                "kind": "stats", "time": time, "player_id": int(raw["m_playerId"]),
                "stats": {
                    "workers_active": int(stats.get("m_scoreValueWorkersActiveCount", 0)),
                    "mineral_rate": float(stats.get("m_scoreValueMineralsCollectionRate", 0)),
                    "vespene_rate": float(stats.get("m_scoreValueVespeneCollectionRate", 0)),
                    "supply_used": float(stats.get("m_scoreValueFoodUsed", 0)) / FOOD_SCALE,
                    "supply_cap": float(stats.get("m_scoreValueFoodMade", 0)) / FOOD_SCALE,
                    "army_value": float(army_value),
                },
            })
    out.sort(key=lambda event: event["time"])
    return out, user_to_player


def normalize_game_events(raw_events: Iterable[Mapping], user_to_player: Mapping[int, int]) -> list[dict]:
    out = []
    for raw in raw_events:
        event_name = raw["_event"].rsplit(".", 1)[-1]
        user = raw.get("_userid", {})
        user_id = user.get("m_userId") if isinstance(user, Mapping) else None
        player_id = user_to_player.get(int(user_id)) if user_id is not None else None
        if player_id is None:
            continue
        time = float(raw.get("_gameloop", 0)) / LOOPS_PER_SECOND
        if event_name == "SCameraUpdateEvent" and raw.get("m_target"):
            out.append({
                "kind": "camera", "time": time, "player_id": player_id,
                "x": float(raw["m_target"]["x"]) / 256.0,
                "y": float(raw["m_target"]["y"]) / 256.0,
            })
        elif event_name == "SSelectionDeltaEvent":
            delta = raw.get("m_delta", {})
            out.append({
                "kind": "selection", "time": time, "player_id": player_id,
                "added": sum(int(x.get("m_count", 0)) for x in delta.get("m_addSubgroups", [])),
            })
        elif event_name == "SCmdEvent":
            ability = raw.get("m_abil") or {}
            out.append({
                "kind": "command", "time": time, "player_id": player_id,
                "ability": f"{ability.get('m_abilLink', -1)}:{ability.get('m_abilCmdIndex', -1)}",
            })
    out.sort(key=lambda event: event["time"])
    return out


def _summary(values: list[float]) -> dict:
    if not values:
        return {"count": 0, "mean": None, "median": None, "p90": None}
    ordered = sorted(values)
    p90 = ordered[min(len(ordered) - 1, math.ceil(0.9 * len(ordered)) - 1)]
    return {
        "count": len(values), "mean": round(statistics.fmean(values), 4),
        "median": round(statistics.median(values), 4), "p90": round(p90, 4),
    }


def summarize_game_events(events: Iterable[Mapping], player_ids: Iterable[int]) -> dict[str, dict]:
    """선수별 APM, 명령/카메라 간격, selection→command 묶음 길이를 요약한다."""
    by_player = defaultdict(list)
    for event in events:
        by_player[int(event["player_id"])].append(event)
    result = {}
    for player_id in player_ids:
        player_events = by_player[player_id]
        commands = [e for e in player_events if e["kind"] == "command"]
        cameras = [e for e in player_events if e["kind"] == "camera"]
        selections = [e for e in player_events if e["kind"] == "selection"]
        per_minute = Counter(int(e["time"] // 60) for e in commands)
        command_intervals = [b["time"] - a["time"] for a, b in zip(commands, commands[1:])]
        camera_intervals = [b["time"] - a["time"] for a, b in zip(cameras, cameras[1:])]
        pac_lengths = []
        timeline = sorted(commands + selections, key=lambda e: e["time"])
        current = None
        for event in timeline:
            if event["kind"] == "selection":
                if current is not None:
                    pac_lengths.append(current)
                current = 0
            elif current is not None:
                current += 1
        if current is not None:
            pac_lengths.append(current)
        result[str(player_id)] = {
            "command_count": len(commands),
            "apm_by_minute": {str(k): v for k, v in sorted(per_minute.items())},
            "apm_summary": _summary([float(v) for v in per_minute.values()]),
            "command_interval_seconds": _summary(command_intervals),
            "camera_count": len(cameras),
            "camera_interval_seconds": _summary(camera_intervals),
            "selection_count": len(selections),
            "selection_command_bundle_length": _summary([float(v) for v in pac_lengths]),
            "command_abilities": dict(Counter(e["ability"] for e in commands).most_common(32)),
        }
    return result


def _camera_series(game_events: Iterable[Mapping]) -> dict[int, tuple[list[float], list[tuple[float, float]]]]:
    series = defaultdict(lambda: ([], []))
    for event in game_events:
        if event["kind"] == "camera":
            series[int(event["player_id"])][0].append(float(event["time"]))
            series[int(event["player_id"])][1].append((float(event["x"]), float(event["y"])))
    return dict(series)


def build_samples(
    tracker_events: list[dict],
    game_events: list[dict],
    players: list[dict],
    game_length: float,
    role_map: Mapping,
) -> list[dict]:
    """10초 간격 양 관점 표본과 20/60/180초 라벨을 만든다."""
    accumulator = StateAccumulator(role_map)
    cameras = _camera_series(game_events)
    player_ids = [int(p["player_id"]) for p in players]
    race_by_id = {int(p["player_id"]): p["race"] for p in players}
    result_by_time: dict[float, dict[int, dict]] = {}
    sample_records = []
    event_index = 0
    for second in range(10, int(game_length) + 1, 10):
        while event_index < len(tracker_events) and tracker_events[event_index]["time"] <= second:
            accumulator.apply(tracker_events[event_index])
            event_index += 1
        result_by_time[float(second)] = {}
        for me in player_ids:
            enemy = next(pid for pid in player_ids if pid != me)
            camera_times, camera_points = cameras.get(me, ([], []))
            camera_index = bisect.bisect_right(camera_times, second) - 1
            camera = camera_points[camera_index] if camera_index >= 0 else None
            has_camera_stream = bool(camera_times)
            my_state = accumulator.snapshot(me)
            enemy_priv = accumulator.snapshot(enemy)
            if has_camera_stream:
                tags = visible_enemy_tags(accumulator, me, enemy, camera)
                enemy_observed = accumulator.snapshot(enemy, tags, observed_enemy=True)
                mask = "camera_and_unit_sight"
            else:
                enemy_observed = {}
                mask = "none"
            record = {
                "time_seconds": float(second), "player_id": me, "opponent_id": enemy,
                "race": race_by_id[me], "visibility_mask": mask,
                "observed": {"self": my_state, "enemy": enemy_observed},
                "priv": {"enemy": enemy_priv},
            }
            result_by_time[float(second)][me] = my_state
            sample_records.append(record)
    for record in sample_records:
        time = record["time_seconds"]
        me, enemy = record["player_id"], record["opponent_id"]
        enemy_bases = result_by_time[time][enemy]["base_positions"]
        future20 = result_by_time.get(time + 20, {}).get(me)
        actions = action_labels(tracker_events, me, time, time + 20, record["observed"]["self"], future20, enemy_bases)
        player = next(p for p in players if int(p["player_id"]) == me)
        record["label"] = {
            "actions_20s": actions,
            "outcome_60s": outcome_label(result_by_time.get(time + 60, {}).get(me)),
            "outcome_180s": outcome_label(result_by_time.get(time + 180, {}).get(me)),
            "final": {"won": int(player["result"]) == 1, "game_length_seconds": game_length},
        }
    return sample_records


def json_compact(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def base_start_events(tracker_events: Iterable[Mapping]) -> dict[str, list[float]]:
    out = defaultdict(list)
    for event in tracker_events:
        if event["kind"] in {"unit_init", "unit_born"} and event.get("unit_type") in BASE_TYPES and int(event.get("owner", 0)) > 0:
            out[str(int(event["owner"]))].append(round(float(event["time"]), 3))
    return dict(out)
