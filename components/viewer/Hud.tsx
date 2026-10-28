"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Lang } from "@/lib/i18n/config";
import type { Clock } from "@/lib/replay/clock";
import type { MapGrid } from "@/lib/replay/mapAsset";
import { aliveByType, aliveCounts, fmtTime, posAt, statAt, type Model, type Owner, type Unit } from "@/lib/replay/timeline";
import { unitInfo } from "@/lib/replay/units";
import { OWNER_COLOR } from "./charts";
import { typeName } from "./names";
import { flatMapCanvas } from "./terrain";
import { useClockTime } from "./useClock";

const num = (v: number) => Math.round(v).toLocaleString();

/** Resources, supply and army for one player at the playhead. */
export function StatCard({ model, clock, owner, lang }: { model: Model; clock: Clock; owner: Owner; lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const now = useClockTime(clock, 1);
  const s = statAt(model, owner, now), a = aliveCounts(model, owner, now);
  const used = s?.supply[0] ?? 0, cap = s?.supply[1] ?? 0, race = model.raw.players.find((p) => p.owner === owner)?.race;
  return (
    <div className="hud-card" style={{ ["--oc" as string]: OWNER_COLOR[owner] }}>
      <header><b>{t(`플레이어 ${owner}`, `Player ${owner}`)}</b>{race && <span className="dim">{race}</span>}</header>
      <div className="hud-res">
        <span title={t("광물 (분당 수입)", "Minerals (income per minute)")}><i className="ic min" />{num(s?.minerals ?? 0)}<small>+{num(s?.incomeMin ?? 0)}</small></span>
        <span title={t("가스 (분당 수입)", "Gas (income per minute)")}><i className="ic gas" />{num(s?.gas ?? 0)}<small>+{num(s?.incomeGas ?? 0)}</small></span>
      </div>
      <div className="hud-supply" title={t("인구", "Supply")} role="img" aria-label={`${t("인구", "Supply")} ${Math.round(used)}/${Math.round(cap)}`}>
        <i style={{ width: `${cap ? Math.min(100, (used / cap) * 100) : 0}%` }} /><span>{Math.round(used)}/{Math.round(cap)}</span>
      </div>
      <div className="hud-row">
        <span title={t("일꾼", "Workers")}>⚒ {s?.workers ?? 0}</span>
        <span title={t("군대 유닛", "Army units")}>⚔ {a.units}</span>
        <span title={t("건물", "Buildings")}>▣ {a.buildings}</span>
        <span title={t("군대 가치", "Army value")}>◈ {num(s?.armyValue ?? 0)}</span>
      </div>
    </div>
  );
}

/** What each player has alive right now, picked units first. */
export function Roster({ model, clock, owner, lang }: { model: Model; clock: Clock; owner: Owner; lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const now = useClockTime(clock, 1);
  const rows = useMemo(() => aliveByType(model, owner, now), [model, owner, now]);
  const army = rows.filter((r) => !r.building), buildings = rows.filter((r) => r.building);
  const row = (r: (typeof rows)[number]) => {
    const info = unitInfo(r.type, lang);
    return (
      <li key={r.type} className={r.pick ? "pick" : ""}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small static wiki icon */}
        {info.icon ? <img src={info.icon} alt="" width={18} height={18} /> : <i className="ic none" />}
        <span>{typeName(r.type, lang)}</span><b>×{r.count}</b>
      </li>
    );
  };
  return (
    <details className="hud-roster" open style={{ ["--oc" as string]: OWNER_COLOR[owner] }}>
      <summary>{t("병력", "Forces")} <small>{army.reduce((n, r) => n + r.count, 0)}</small></summary>
      {army.length === 0 && buildings.length === 0 ? <p className="dim">{t("아직 없음", "none yet")}</p> : (
        <ul>
          {army.map(row)}
          {buildings.length > 0 && <li className="sep">{t("건물", "Buildings")}</li>}
          {buildings.map(row)}
        </ul>
      )}
    </details>
  );
}

/** A fight in progress. */
export function BattleBanner({ model, clock, lang }: { model: Model; clock: Clock; lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const now = useClockTime(clock, 1);
  const b = model.battles.find((x) => now >= x.t0 - 3 && now <= x.t1 + 6);
  if (!b) return null;
  return (
    <div className="hud-battle" role="status">
      <b>⚔ {t("교전", "Fight")} {b.label}</b> <span className="mono">{fmtTime(b.t0)}–{fmtTime(b.t1)}</span>
      <span> · <b style={{ color: OWNER_COLOR[1] }}>{b.lost[0]}</b> : <b style={{ color: OWNER_COLOR[2] }}>{b.lost[1]}</b> {t("손실", "lost")}</span>
      {b.picksLost > 0 && <span className="pk"> · {t(`고른 유닛 ${b.picksLost}기`, `${b.picksLost} picked`)}</span>}
    </div>
  );
}

/** Top-down overview. Click to move the 3D camera there. */
export function Minimap({ model, map, clock, selected, onFocus, lang }: { model: Model; map: MapGrid | null; clock: Clock; selected: Unit | null; onFocus?: (x: number, y: number) => void; lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const cv = useRef<HTMLCanvasElement>(null);
  const bounds = useMemo(() => {
    if (map) return { x0: map.x0, y0: map.y0, w: map.w, h: map.h };
    let x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;
    for (const u of model.units) { x0 = Math.min(x0, u.x0); y0 = Math.min(y0, u.y0); x1 = Math.max(x1, u.x0); y1 = Math.max(y1, u.y0); }
    if (x0 === Infinity) return { x0: 0, y0: 0, w: 100, h: 100 };
    return { x0: x0 - 6, y0: y0 - 6, w: x1 - x0 + 12, h: y1 - y0 + 12 };
  }, [map, model]);
  const W = 184, H = Math.round(W * (bounds.h / bounds.w));

  useEffect(() => {
    const c = cv.current!, g = c.getContext("2d")!, dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr; c.height = H * dpr;
    const terrain = map ? flatMapCanvas(map, 2) : null;
    const sx = (x: number) => ((x - bounds.x0) / bounds.w) * W, sy = (y: number) => H - ((y - bounds.y0) / bounds.h) * H;
    const draw = () => {
      const now = clock.t;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = "#07080f"; g.fillRect(0, 0, W, H);
      if (terrain) { g.imageSmoothingEnabled = true; g.globalAlpha = 0.9; g.drawImage(terrain, 0, 0, W, H); g.globalAlpha = 1; }
      for (const b of model.battles) { if (now < b.t0 - 3 || now > b.t1 + 6) continue; g.beginPath(); g.arc(sx(b.cx), sy(b.cy), 9, 0, 6.283); g.fillStyle = "rgba(255,68,88,.35)"; g.fill(); }
      for (const u of model.units) {
        if (u.kind === "worker") continue;
        if (u.kind === "structure") { if (now >= u.born && now < u.died) { g.fillStyle = OWNER_COLOR[u.owner]; g.fillRect(sx(u.x0) - 1.6, sy(u.y0) - 1.6, 3.2, 3.2); } continue; }
        const p = posAt(u, now, model.windowSec); if (!p) continue;
        g.globalAlpha = 0.4 + 0.6 * p.a; g.fillStyle = u.pick ? "#d6f542" : OWNER_COLOR[u.owner]; g.beginPath(); g.arc(sx(p.x), sy(p.y), u.pick ? 2.2 : 1.5, 0, 6.283); g.fill(); g.globalAlpha = 1;
      }
      if (selected) {
        const p = selected.kind === "structure" ? (now >= selected.born && now < selected.died ? { x: selected.x0, y: selected.y0 } : null) : posAt(selected, now, model.windowSec);
        if (p) { g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.beginPath(); g.arc(sx(p.x), sy(p.y), 5, 0, 6.283); g.stroke(); }
      }
    };
    draw();
    return clock.subscribe(draw);
  }, [model, map, clock, bounds, W, H, selected]);

  return (
    <canvas
      ref={cv} className="hud-mini" style={{ width: W, height: H }} role="img" aria-label={t("미니맵 (눌러서 이동)", "Minimap (click to move the view)")}
      onPointerDown={(e) => {
        if (!onFocus) return;
        const r = e.currentTarget.getBoundingClientRect();
        onFocus(bounds.x0 + ((e.clientX - r.left) / r.width) * bounds.w, bounds.y0 + (1 - (e.clientY - r.top) / r.height) * bounds.h);
      }}
    />
  );
}

/** Details of the clicked unit. */
export function UnitCard({ unit, model, clock, lang, following, onFollow, onClose }: {
  unit: Unit; model: Model; clock: Clock; lang: Lang; following: boolean; onFollow?: () => void; onClose: () => void;
}) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const now = useClockTime(clock, 1);
  const info = unitInfo(unit.type, lang);
  const draft = model.raw.draft.players.find((p) => p.owner === unit.owner);
  const pick = unit.pick ? draft?.picks.find((p) => unitInfo(p.unit, lang).wikiId && unitInfo(p.unit, lang).wikiId === info.wikiId) : undefined;
  const alive = now >= unit.born && now < unit.died;
  const life = Math.max(0, Math.min(now, unit.died === Infinity ? now : unit.died) - unit.born);
  const modeText = unit.mode === "tracked" ? t("이동 경로가 기록됨", "movement recorded") : unit.mode === "static" ? t("고정 위치", "fixed position") : t("생성·사망 지점만 기록됨", "only where it appeared or died");
  return (
    <aside className="hud-unit" style={{ ["--oc" as string]: OWNER_COLOR[unit.owner] }} aria-label={t("선택한 유닛", "Selected unit")}>
      <header>
        {/* eslint-disable-next-line @next/next/no-img-element -- small static wiki icon */}
        {info.icon && <img src={info.icon} alt="" width={36} height={36} />}
        <div><strong>{typeName(unit.type, lang)}</strong><span className="dim">{t(`플레이어 ${unit.owner}`, `Player ${unit.owner}`)} · {unit.kind === "structure" ? t("건물", "building") : t("군대 유닛", "army unit")}</span></div>
        <button className="vw-link" onClick={onClose} aria-label={t("닫기", "Close")}>✕</button>
      </header>
      <dl>
        <div><dt>{t("상태", "Status")}</dt><dd className={alive ? "ok" : "no"}>{alive ? t("생존", "alive") : now < unit.born ? t("아직 없음", "not yet") : t("사망", "dead")}</dd></div>
        <div><dt>{t("생성", "Born")}</dt><dd><button className="vw-link" onClick={() => clock.set(unit.born)}>{fmtTime(unit.born)}</button></dd></div>
        {unit.died < Infinity && <div><dt>{t("사망", "Died")}</dt><dd><button className="vw-link" onClick={() => clock.set(unit.died)}>{fmtTime(unit.died)}</button></dd></div>}
        <div><dt>{t("활동 시간", "Time alive")}</dt><dd>{fmtTime(life)}</dd></div>
        {unit.killer && <div><dt>{t("처치한 쪽", "Killed by")}</dt><dd style={{ color: OWNER_COLOR[(unit.killer.owner === 2 ? 2 : 1) as Owner] }}>{typeName(unit.killer.type, lang)}</dd></div>}
      </dl>
      {pick && <p className="pk">{t("밴픽에서 고른 유닛", "Picked in the draft")}{pick.replaces ? ` · ${t("대체", "replaces")} ${typeName(pick.replaces, lang)}` : ""}</p>}
      <p className="dim">{modeText}</p>
      {onFollow && unit.kind !== "structure" && <button className="btn" aria-pressed={following} onClick={onFollow}>{following ? t("따라가는 중", "Following") : t("카메라로 따라가기", "Follow with camera")}</button>}
    </aside>
  );
}

export function Legend({ lang, map }: { lang: Lang; map: MapGrid | null }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const has = (...c: string[]) => !!map?.doodads.some((d) => c.includes(d.cls));
  const features: [string, string, boolean][] = map ? [
    ["#4fae3a", t("풀·부쉬", "Grass / bushes"), has("grass")],
    ["#2e7a3c", t("나무", "Trees"), has("tree")],
    ["#9a9486", t("바위·기둥", "Rocks / columns"), has("rock", "column")],
    ["#7f8aa6", t("건물·유적", "Buildings / ruins"), has("building", "ruin", "wall")],
    ["#ff8c3c", t("파괴 가능 바위", "Destructible rocks"), map.special.some((u) => u.kind === "dest")],
    ["#5af0e6", t("쐐기 탑", "Xel'Naga tower"), map.special.some((u) => u.kind === "tower")],
    ["#5ee08a", t("가스", "Geyser"), map.gas.length > 0],
  ] : [];
  return (
    <ul className="vw-legend">
      {features.filter((f) => f[2]).map(([c, label]) => <li key={label} className="feat"><i style={{ background: c }} />{label}</li>)}
      <li><i style={{ background: OWNER_COLOR[1] }} />{t("플레이어 1", "Player 1")}</li>
      <li><i style={{ background: OWNER_COLOR[2] }} />{t("플레이어 2", "Player 2")}</li>
      <li><i className="pk" />{t("고른 유닛", "Picked")}</li>
      <li><i className="bt" />{t("교전", "Fight")}</li>
    </ul>
  );
}

