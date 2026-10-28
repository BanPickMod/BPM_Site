"""G2: 실제 리플레이의 위치 표본 누락 정책을 비교하는 보고서와 재생 검수 HTML을 만든다.

사용:
  python -X utf8 worker/tools/g2_position_trial.py a.SC2Replay [b.SC2Replay ...] --out .data/g2

세 안을 같은 데이터로 비교한다.
  tracked-only: 표본이 있는 병력만 표시
  straight-line: 표본 없는 병력을 출생점→사망점으로 평생 직선 보간(왜곡 대조군)
  event-endpoints: 출생 직후/사망 직전 3초만 반투명 표시, 중간은 집계에만 포함(채택안)
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

WORKER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(WORKER))
from bpm_replay.draft_decode import decode_draft  # noqa: E402


def summarize(path: Path) -> tuple[dict, dict]:
    decoded = decode_draft(path)
    timeline = decoded.get("timeline")
    if not timeline:
        raise ValueError("BPM timeline을 만들 수 없는 리플레이")
    army = [u for u in timeline["units"] if u["kind"] == "army"]
    tracked = [u for u in army if u["positionMode"] == "tracked"]
    endpoints = [u for u in army if u["positionMode"] == "event-endpoints"]
    birth_only = [u for u in army if u["positionMode"] == "birth-only"]
    fake_distance = sum(math.dist((u["x0"], u["y0"]), u["deathPos"]) for u in endpoints)
    fake_seconds = sum(max(0, u["diedT"] - u["bornT"]) for u in endpoints)
    return timeline, {
        "file": path.name, "map": timeline["meta"]["map"], "durationSec": timeline["meta"]["durationSec"],
        "army": len(army), "tracked": len(tracked), "trackedRate": round(len(tracked) / max(1, len(army)), 3),
        "eventEndpoints": len(endpoints), "birthOnly": len(birth_only),
        "straightLineInventedDistanceTiles": round(fake_distance, 1),
        "straightLineInventedUnitSeconds": round(fake_seconds, 1),
    }


HTML = r"""<!doctype html><html lang="ko"><meta charset="utf-8"><title>G2 위치 표본 정책 시험</title>
<style>body{margin:0;background:#11161d;color:#dce6ee;font:14px system-ui}.wrap{max-width:1200px;margin:auto;padding:28px}h1{font-size:22px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.panel{border:1px solid #33414d;background:#171e26;padding:12px}canvas{width:100%;aspect-ratio:1;background:#0b1015}button{background:#d7ff3f;border:0;padding:9px 16px;font-weight:700}.muted{color:#92a2ad}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style>
<div class="wrap"><h1>G2 · 위치 표본 누락 정책 비교</h1><p id="meta" class="muted"></p><button id="play">재생/정지</button><input id="time" type="range" min="0" value="0" step=".1" style="width:60%"><span id="clock"></span>
<div class="grid"><div class="panel"><b>표본 유닛만</b><p class="muted">정확하지만 병력이 비어 보임</p><canvas data-mode="tracked"></canvas></div>
<div class="panel"><b>출생→사망 직선 보간</b><p class="muted">밀도는 높지만 가짜 경로</p><canvas data-mode="linear"></canvas></div>
<div class="panel"><b>사건 끝점 페이드 · 채택안</b><p class="muted">중간 경로를 꾸미지 않음</p><canvas data-mode="endpoint"></canvas></div></div></div>
<script>const T=__TIMELINE__;const army=T.units.filter(u=>u.kind==='army');const end=T.meta.durationSec;const slider=document.querySelector('#time');slider.max=end;let t=0,playing=false,last=0;
document.querySelector('#meta').textContent=`${T.meta.map} · ${end}s · 병력 ${army.length} · 추적 ${army.filter(u=>u.positionMode==='tracked').length}`;
const all=army.flatMap(u=>[[u.x0,u.y0],...(u.deathPos?[u.deathPos]:[])]);const xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);const box=[Math.min(...xs)-5,Math.min(...ys)-5,Math.max(...xs)+5,Math.max(...ys)+5];
function decode(u){if(!u.track.length)return[];let [tt,x,y]=u.track[0],a=[[tt/10,x/10,y/10]];for(let i=1;i<u.track.length;i++){tt+=u.track[i][0];x+=u.track[i][1];y+=u.track[i][2];a.push([tt/10,x/10,y/10])}return a}army.forEach(u=>u.points=decode(u));
function lerp(a,b,q){return a+(b-a)*q}function pos(u,mode){if(t<u.bornT||u.diedT!==null&&t>u.diedT)return null;if(u.points.length){let b=u.points.findIndex(p=>p[0]>=t);if(b<0)return u.points.at(-1).slice(1);if(b===0)return u.points[0].slice(1);let a=u.points[b-1],z=u.points[b],q=(t-a[0])/(z[0]-a[0]);return[lerp(a[1],z[1],q),lerp(a[2],z[2],q),1]}if(mode==='tracked')return null;if(mode==='linear'&&u.deathPos&&u.diedT>u.bornT){let q=(t-u.bornT)/(u.diedT-u.bornT);return[lerp(u.x0,u.deathPos[0],q),lerp(u.y0,u.deathPos[1],q),.45]}if(mode==='endpoint'){if(t-u.bornT<=3)return[u.x0,u.y0,.35];if(u.deathPos&&u.diedT-t<=3)return[...u.deathPos,.35]}return null}
function draw(c){const d=devicePixelRatio,w=c.clientWidth;c.width=c.height=w*d;let x=c.getContext('2d');x.scale(d,d);x.strokeStyle='#263542';for(let i=1;i<8;i++){x.beginPath();x.moveTo(w*i/8,0);x.lineTo(w*i/8,w);x.moveTo(0,w*i/8);x.lineTo(w,w*i/8);x.stroke()}for(const u of army){let p=pos(u,c.dataset.mode);if(!p)continue;let px=(p[0]-box[0])/(box[2]-box[0])*w,py=w-(p[1]-box[1])/(box[3]-box[1])*w;x.globalAlpha=p[2]??1;x.fillStyle=u.owner===1?'#48d8ff':'#ff5b79';x.beginPath();x.arc(px,py,3,0,7);x.fill()}x.globalAlpha=1}function render(){document.querySelector('#clock').textContent=Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');document.querySelectorAll('canvas').forEach(draw)}
document.querySelector('#play').onclick=()=>playing=!playing;slider.oninput=()=>{t=+slider.value;render()};function frame(n){if(playing){if(last)t=Math.min(end,t+(n-last)/1000*4);if(t===end)playing=false;slider.value=t}last=n;render();requestAnimationFrame(frame)}requestAnimationFrame(frame);</script></html>"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("replays", nargs="+")
    parser.add_argument("--out", default=".data/g2")
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    summaries, skipped, first, first_army = [], [], None, -1
    for name in args.replays:
        try:
            timeline, row = summarize(Path(name))
            summaries.append(row)
            if row["army"] > first_army:
                first, first_army = timeline, row["army"]
        except (ValueError, OSError) as exc:
            skipped.append({"file": Path(name).name, "reason": str(exc)})
    if first is None:
        raise SystemExit("BPM timeline을 만들 수 있는 입력이 없습니다")
    aggregate = {
        "policy": "event-endpoints", "endpointWindowSec": 3, "games": summaries, "skipped": skipped,
        "trackedRateWeighted": round(sum(r["tracked"] for r in summaries) / max(1, sum(r["army"] for r in summaries)), 3),
        "decision": "표본 유닛만 선형 보간. 무표본 병력은 출생·사망 3초 창에서 반투명 표시하고 중간에는 집계만 표시.",
    }
    (out / "report.json").write_text(json.dumps(aggregate, ensure_ascii=False, indent=2), encoding="utf8")
    embedded = json.dumps(first, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    (out / "viewer.html").write_text(HTML.replace("__TIMELINE__", embedded), encoding="utf8")
    print(json.dumps(aggregate, ensure_ascii=False, indent=2))
    print(f"viewer: {(out / 'viewer.html').resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
