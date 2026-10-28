"use client";

import type { Evaluation } from "@/lib/replay/evaluation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./viewer.css";
import type { Lang } from "@/lib/i18n/config";
import { Clock } from "@/lib/replay/clock";
import { decodeMap, type MapGrid, type RawMapAsset } from "@/lib/replay/mapAsset";
import { buildModel, fmtTime, pickUsage, type Model, type Owner, type RawTimeline, type Unit } from "@/lib/replay/timeline";
import { unitInfo } from "@/lib/replay/units";
import { OWNER_COLOR } from "./charts";
import { Map2D, type Hover } from "./Map2D";
import { BattleBanner, Legend, Minimap, Roster, StatCard, UnitCard } from "./Hud";
import { Map3D, type Map3DApi } from "./Map3D";
import { Panels } from "./Panels";
import { typeName } from "./names";
import { useClockPlaying, useClockSpeed, useClockTime } from "./useClock";

type Loaded = { model: Model; map: MapGrid | null };
type State = { s: "loading" } | { s: "error"; code: "timeline" | "format" } | { s: "ready"; data: Loaded };

async function gunzipJson(res: Response): Promise<RawTimeline> {
  const buf = new Uint8Array(await res.arrayBuffer());
  const gz = buf[0] === 0x1f && buf[1] === 0x8b;
  const text = gz ? await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text() : new TextDecoder().decode(buf);
  return JSON.parse(text) as RawTimeline;
}

/** Loads the owner-only timeline and the map terrain, then hands them to the player. */
export function Viewer({ timelineUrl, lang, shareable = false, evaluation = null, evaluationPending = false }: { timelineUrl: string; lang: Lang; shareable?: boolean; evaluation?: Evaluation | null; evaluationPending?: boolean }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [state, setState] = useState<State>({ s: "loading" });

  useEffect(() => {
    const ctl = new AbortController();
    (async () => {
      try {
        const res = await fetch(timelineUrl, { signal: ctl.signal });
        if (!res.ok) return setState({ s: "error", code: "timeline" });
        const raw = await gunzipJson(res);
        if (raw.schema !== 1) return setState({ s: "error", code: "format" });
        let map: MapGrid | null = null;
        let asset = raw.meta.mapTransform?.asset;
        if (!asset && raw.meta.map) {            // timelines made before the worker knew the map assets: look the map up by name
          const idx = await fetch("/maps/index.json", { signal: ctl.signal }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
          asset = (idx as Record<string, string>)[raw.meta.map];
        }
        if (asset && /^[a-z0-9-]+$/.test(asset)) {
          const mr = await fetch(`/maps/${asset}.json`, { signal: ctl.signal }).catch(() => null);
          if (mr?.ok) map = decodeMap((await mr.json()) as RawMapAsset);
        }
        setState({ s: "ready", data: { model: buildModel(raw), map } });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState({ s: "error", code: "format" });
      }
    })();
    return () => ctl.abort();
  }, [timelineUrl]);

  if (state.s === "loading") return <div className="vw-msg" role="status">{t("타임라인을 불러오는 중…", "Loading the timeline…")}</div>;
  if (state.s === "error") {
    return <div className="vw-msg" role="alert">{state.code === "timeline" ? t("이 리플레이의 타임라인을 불러오지 못했습니다.", "Could not load this replay's timeline.") : t("타임라인 형식을 읽을 수 없습니다. 분석이 다시 실행되면 해결될 수 있습니다.", "The timeline format could not be read. Re-analysis may fix it.")}</div>;
  }
  return <Player data={state.data} lang={lang} shareable={shareable} evaluation={evaluation} evaluationPending={evaluationPending} />;
}

const SPEEDS = [1, 2, 4, 8, 16];

function Player({ data, lang, shareable, evaluation, evaluationPending }: { data: Loaded; lang: Lang; shareable: boolean; evaluation: Evaluation | null; evaluationPending: boolean }) {
  const { model, map } = data;
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const [clock] = useState(() => new Clock(model.duration));
  useEffect(() => () => clock.dispose(), [clock]);
  // a shared link may carry ?t=8:25 (or seconds): start there
  useEffect(() => {
    const raw = new URLSearchParams(location.search).get("t");
    const m = raw?.match(/^(?:(\d{1,3}):)?(\d{1,5})$/);
    if (m) clock.set((m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]));
  }, [clock]);
  // the first screen is exactly as tall as the room left under the page title, so it fits at any window size (measured, not guessed)
  const first = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = first.current;
    if (!el) return;
    const fit = () => {
      if (window.innerWidth <= 760) { el.style.height = ""; return; }   // phones: stacked layout with its own heights
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.height = `${Math.max(460, window.innerHeight - top - 12)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    void document.fonts?.ready.then(fit);                                 // the title's font can change its height
    return () => window.removeEventListener("resize", fit);
  }, []);
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    const url = `${location.origin}${location.pathname}?t=${Math.floor(clock.t)}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt(t("이 주소를 복사하세요", "Copy this link"), url); }
  };

  const [mode, setMode] = useState<"3d" | "2d">(() => {
    if (!map) return "2d";
    try {
      if (window.matchMedia("(pointer:coarse) and (max-width:700px)").matches) return "2d";
      const c = document.createElement("canvas");
      return c.getContext("webgl2") || c.getContext("webgl") ? "3d" : "2d";
    } catch { return "2d"; }
  });
  const here = usePathname();
  const [hover, setHover] = useState<Hover | null>(null);
  const [follow, setFollow] = useState(false);
  const [features, setFeatures] = useState(true);
  const [selected, setSelected] = useState<Unit | null>(null);
  const [followingUnit, setFollowingUnit] = useState(false);
  const select = useCallback((u: Unit | null) => { setSelected(u); setFollowingUnit(false); api.current?.followUnit(null); }, []);
  const api = useRef<Map3DApi>(null);
  const races = useMemo(() => Object.fromEntries(model.raw.players.map((p) => [p.owner, (p.race ?? "").toLowerCase()])), [model]);
  const iconOf = useCallback((u: Unit) => {
    const draft = model.raw.draft.players.find((p) => p.owner === u.owner);
    const pk = draft?.picks.find((p) => unitInfo(u.type, lang).wikiId === unitInfo(p.unit, lang).wikiId && unitInfo(p.unit, lang).wikiId);
    return pk ? unitInfo(pk.unit, lang).icon : null;
  }, [model, lang]);
  const fail3d = useCallback(() => setMode("2d"), []);

  const trackedShare = useMemo(() => {
    const army = model.units.filter((u) => u.kind === "army");
    return army.length ? Math.round((army.filter((u) => u.mode === "tracked").length / army.length) * 100) : 100;
  }, [model]);

  // keyboard: space plays, arrows seek
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("button,input,a,[role=tab]") && e.key === " ") return;
    if (e.key === " ") { e.preventDefault(); clock.toggle(); }
    else if (e.key === "ArrowRight") clock.set(clock.t + (e.shiftKey ? 30 : 5));
    else if (e.key === "ArrowLeft") clock.set(clock.t - (e.shiftKey ? 30 : 5));
  };

  return (
    <div className="vw" onKeyDown={onKey}>
      {/* the first screen: draft, map and controls fit the window together; everything after it scrolls */}
      <div className="vw-first" ref={first}>
      <DraftBoard model={model} clock={clock} lang={lang} />
      <div className="vw-stage">
        {mode === "3d" && map ? (
          <Map3D model={model} map={map} clock={clock} races={races} iconOf={iconOf} onHover={setHover} onSelect={select} selected={selected} onFail={fail3d} api={api} />
        ) : (
          <Map2D model={model} map={map} clock={clock} onHover={setHover} onSelect={select} selected={selected} />
        )}
        <div className="hud-col left"><StatCard model={model} clock={clock} owner={1} lang={lang} /><Roster model={model} clock={clock} owner={1} lang={lang} /></div>
        <div className="hud-col right"><StatCard model={model} clock={clock} owner={2} lang={lang} /><Roster model={model} clock={clock} owner={2} lang={lang} /></div>
        <BattleBanner model={model} clock={clock} lang={lang} />
        <div className="hud-bl">
          <Minimap model={model} map={map} clock={clock} selected={selected} lang={lang} onFocus={mode === "3d" ? (x, y) => api.current?.focus(x, y) : undefined} />
          <Legend lang={lang} map={map} />
        </div>
        {selected && (
          <UnitCard
            unit={selected} model={model} clock={clock} lang={lang} following={followingUnit}
            onFollow={mode === "3d" ? () => { const on = !followingUnit; setFollowingUnit(on); api.current?.followUnit(on ? selected : null); } : undefined}
            onClose={() => select(null)}
          />
        )}
        <div className="vw-tools">
          {map && <button className="btn" onClick={() => setMode(mode === "3d" ? "2d" : "3d")} aria-pressed={mode === "3d"}>{mode === "3d" ? "2D" : "3D"}</button>}
          {mode === "3d" && (
            <>
              <button className="btn" onClick={() => api.current?.resetView()}>{t("시점 초기화", "Reset view")}</button>
              <button className="btn" onClick={() => api.current?.topView()}>{t("위에서", "Top")}</button>
              {map && map.doodads.length > 0 && <button className="btn" aria-pressed={features} onClick={() => { api.current?.setFeatures(!features); setFeatures(!features); }}>{t("지형 요소", "Map features")}</button>}
              <button className="btn" aria-pressed={follow} onClick={() => { api.current?.setFollow(!follow); setFollow(!follow); }}>{t("교전 따라가기", "Follow fights")}</button>
            </>
          )}
        </div>
        {hover && (
          <div className="vw-tip" style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 14 }}>
            <strong style={{ color: OWNER_COLOR[hover.unit.owner] }}>{typeName(hover.unit.type, lang)}</strong>
            {hover.unit.pick && <span className="pk"> · {t("고른 유닛", "picked")}</span>}
            <br /><span className="dim">{t("생성", "born")} {fmtTime(hover.unit.born)}{hover.unit.died < Infinity && <> · {t("사망", "died")} {fmtTime(hover.unit.died)}</>}</span>
          </div>
        )}
        {!map && <p className="vw-nomap">{t(`이 지도(${model.raw.meta.map ?? "알 수 없음"})의 지형 데이터가 아직 없어 위치만 표시합니다.`, `No terrain data for this map (${model.raw.meta.map ?? "unknown"}) yet; showing positions only.`)}</p>}
      </div>
      <Transport clock={clock} model={model} lang={lang} onShare={shareable ? copyLink : undefined} copied={copied} />
      </div>
      <p className="dim vw-note">
        {t(`군대 유닛의 ${trackedShare}%만 이동 경로가 기록됩니다. 나머지는 생성·사망 지점에서만 잠깐 나타납니다(리플레이에 남는 위치 표본이 적습니다). 건물은 완공 위치에 고정입니다.`,
          `Movement was recorded for only ${trackedShare}% of army units. The rest only appear briefly where they were created or died (replays keep few position samples). Buildings are fixed at their location.`)}
        {" "}<Link href={`/${lang}/feedback?${new URLSearchParams({ from: here })}`}>{t("재생기 문제 신고", "Report a viewer problem")}</Link>
      </p>
      <Panels model={model} clock={clock} lang={lang} evaluation={evaluation} evaluationPending={evaluationPending} />
    </div>
  );
}

function DraftBoard({ model, clock, lang }: { model: Model; clock: Clock; lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const now = useClockTime(clock, 1);
  return (
    <div className="vw-draft">
      {([1, 2] as Owner[]).map((o) => {
        const d = model.raw.draft.players.find((p) => p.owner === o), pl = model.raw.players.find((p) => p.owner === o);
        const usage = pickUsage(model, o, now);
        return (
          <article key={o} className="vw-side" style={{ ["--oc" as string]: OWNER_COLOR[o] }}>
            <header>
              <b>{t(`플레이어 ${o}`, `Player ${o}`)}</b>
              {pl?.result && <span className={`res ${pl.result}`}>{pl.result === "win" ? t("승", "Win") : t("패", "Loss")}</span>}
            </header>
            <ul className="vw-picks">
              {usage.length === 0 && <li className="dim">{t("기본 유닛", "default units")}</li>}
              {usage.map((u) => {
                const info = unitInfo(u.unit, lang);
                return (
                  <li key={u.unit} className={`pick${u.unused ? " unused" : ""}`} title={u.unused ? t("한 번도 생산하지 않음", "never produced") : undefined}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimised static icon, same as the wiki */}
                    {info.icon && <img src={info.icon} alt="" width={22} height={22} />}
                    <span>{typeName(u.unit, lang)}</span>
                    <em>{u.alive}<small>/{u.made}</small></em>
                  </li>
                );
              })}
            </ul>
            {d && d.bans.length > 0 && (
              <ul className="vw-bans" aria-label={t("상대가 막은 유닛", "Banned units")}>
                {d.bans.map((b) => <li key={b} className="ban">{typeName(b, lang)}</li>)}
              </ul>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Transport({ clock, model, lang, onShare, copied }: { clock: Clock; model: Model; lang: Lang; onShare?: () => void; copied: boolean }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const playing = useClockPlaying(clock), speed = useClockSpeed(clock), now = useClockTime(clock, 1);
  return (
    <div className="vw-transport">
      <div className="vw-bar">
        <button className="btn vw-play" onClick={() => clock.toggle()} aria-label={playing ? t("일시정지", "Pause") : t("재생", "Play")}>{playing ? "❚❚" : "▶"}</button>
        <span className="mono vw-time">{fmtTime(now)} / {fmtTime(model.duration)}</span>
        <div className="seg" role="group" aria-label={t("재생 속도", "Speed")}>
          {SPEEDS.map((s) => <button key={s} className={speed === s ? "on" : ""} aria-pressed={speed === s} onClick={() => clock.setSpeed(s)}>{s}×</button>)}
        </div>
        {onShare && <button className="btn" onClick={onShare}>{copied ? t("복사됨", "Copied") : t("이 시점 링크 복사", "Copy link to this moment")}</button>}
      </div>
      <Timeline clock={clock} model={model} lang={lang} />
    </div>
  );
}

/** Scrubber with a lane per player: lime ticks where a picked unit first appears, red bars for fights. */
function Timeline({ clock, model, lang }: { clock: Clock; model: Model; lang: Lang }) {
  const t = (ko: string, en: string) => (lang === "ko" ? ko : en);
  const head = useRef<HTMLDivElement>(null), box = useRef<HTMLDivElement>(null);
  const D = Math.max(1, model.duration);
  const firsts = useMemo(() => ([1, 2] as Owner[]).map((o) => pickUsage(model, o, model.duration).filter((u) => u.first !== null).map((u) => ({ unit: u.unit, t: u.first! }))), [model]);

  useEffect(() => {
    const move = () => { if (head.current) head.current.style.left = `${(clock.t / D) * 100}%`; };
    move();
    return clock.subscribe(move);
  }, [clock, D]);

  const seekFrom = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    clock.set(((e.clientX - r.left) / r.width) * D);
  };
  const drag = useRef(false);
  const ticks: number[] = [];
  for (let s = 0; s <= D; s += D > 900 ? 300 : 120) ticks.push(s);

  return (
    <div
      ref={box} className="vw-tl" role="slider" tabIndex={0} aria-label={t("타임라인", "Timeline")} aria-valuemin={0} aria-valuemax={Math.round(D)} aria-valuenow={Math.round(clock.t)}
      onPointerDown={(e) => { drag.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); seekFrom(e); }}
      onPointerMove={(e) => { if (drag.current) seekFrom(e); }}
      onPointerUp={() => { drag.current = false; }}
    >
      <div className="vw-ruler">{ticks.map((s) => <span key={s} style={{ left: `${(s / D) * 100}%` }}>{Math.floor(s / 60)}m</span>)}</div>
      {([1, 2] as Owner[]).map((o, i) => (
        <div key={o} className="vw-lane" style={{ ["--oc" as string]: OWNER_COLOR[o] }}>
          <b>P{o}</b>
          {firsts[i].map((f) => <i key={f.unit} className="tick" style={{ left: `${(f.t / D) * 100}%` }} title={`${typeName(f.unit, lang)} ${fmtTime(f.t)}`} />)}
        </div>
      ))}
      <div className="vw-lane vw-fights"><b>⚔</b>
        {model.battles.map((b) => <i key={b.id} className="bar" style={{ left: `${(b.t0 / D) * 100}%`, width: `max(5px, ${((b.t1 - b.t0) / D) * 100}%)` }} title={`${b.label} ${fmtTime(b.t0)}`} />)}
      </div>
      <div ref={head} className="vw-head" />
    </div>
  );
}
