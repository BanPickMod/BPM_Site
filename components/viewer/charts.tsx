"use client";

import { useEffect, useId, useRef, type PointerEvent as RPE } from "react";
import type { Clock } from "@/lib/replay/clock";
import { HIDE_BEFORE_SEC, LOW_UNTIL_SEC, trustAt, type Evaluation } from "@/lib/replay/evaluation";

export const OWNER_COLOR = { 1: "#38bdf8", 2: "#f59e0b" } as const;
const W = 600, H = 150, PAD = { l: 38, r: 8, t: 8, b: 18 };

/** A thin playhead line that follows the clock without re-rendering React. */
function Playhead({ clock, duration }: { clock: Clock; duration: number }) {
  const ref = useRef<SVGLineElement>(null);
  useEffect(() => {
    const move = () => {
      const x = PAD.l + (clock.t / Math.max(1, duration)) * (W - PAD.l - PAD.r);
      ref.current?.setAttribute("x1", String(x)); ref.current?.setAttribute("x2", String(x));
    };
    move();
    return clock.subscribe(move);
  }, [clock, duration]);
  return <line ref={ref} y1={PAD.t} y2={H - PAD.b} className="vw-ph" />;
}

function frame(duration: number, max: number, fmt: (v: number) => string) {
  const xs = [];
  for (let t = 0; t <= duration; t += duration > 900 ? 300 : 120) xs.push(t);
  return (
    <>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + (1 - f) * (H - PAD.t - PAD.b)} y2={PAD.t + (1 - f) * (H - PAD.t - PAD.b)} className="vw-grid" />
          <text x={PAD.l - 4} y={PAD.t + (1 - f) * (H - PAD.t - PAD.b) + 3} textAnchor="end" className="vw-axis">{fmt(max * f)}</text>
        </g>
      ))}
      {xs.map((t) => (
        <text key={t} x={PAD.l + (t / Math.max(1, duration)) * (W - PAD.l - PAD.r)} y={H - 4} textAnchor="middle" className="vw-axis">{Math.floor(t / 60)}m</text>
      ))}
    </>
  );
}

const sx = (t: number, duration: number) => PAD.l + (t / Math.max(1, duration)) * (W - PAD.l - PAD.r);
const sy = (v: number, max: number) => PAD.t + (1 - v / Math.max(1, max)) * (H - PAD.t - PAD.b);
const compact = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(Math.round(v)));

function useSeek(clock: Clock, duration: number) {
  return (e: RPE<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    clock.set(((x - PAD.l) / (W - PAD.l - PAD.r)) * duration);
  };
}

export interface Line { color: string; label: string; pts: [number, number][] }

export function LineChart({ lines, duration, clock, unit = "" }: { lines: Line[]; duration: number; clock: Clock; unit?: string }) {
  const seek = useSeek(clock, duration);
  const max = Math.max(1, ...lines.flatMap((l) => l.pts.map((p) => p[1]))) * 1.05;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="vw-chart" role="img" onPointerDown={seek} aria-label={lines.map((l) => l.label).join(" / ") + unit}>
      {frame(duration, max, compact)}
      {lines.map((l) => (
        <polyline key={l.label} fill="none" stroke={l.color} strokeWidth="1.8" strokeLinejoin="round"
          points={l.pts.map(([t, v]) => `${sx(t, duration).toFixed(1)},${sy(v, max).toFixed(1)}`).join(" ")} />
      ))}
      <Playhead clock={clock} duration={duration} />
    </svg>
  );
}

/** Army size over time: picked units stacked on top of everything else. */
export function CompChart({ data, color, duration, clock, pickLabel, otherLabel }: {
  data: { t: number; pick: number; other: number }[]; color: string; duration: number; clock: Clock; pickLabel: string; otherLabel: string;
}) {
  const seek = useSeek(clock, duration);
  const max = Math.max(1, ...data.map((d) => d.pick + d.other)) * 1.05;
  const area = (top: (d: { pick: number; other: number }) => number, bottom: (d: { pick: number; other: number }) => number) =>
    data.map((d) => `${sx(d.t, duration).toFixed(1)},${sy(top(d), max).toFixed(1)}`).join(" ") + " " +
    [...data].reverse().map((d) => `${sx(d.t, duration).toFixed(1)},${sy(bottom(d), max).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="vw-chart" role="img" onPointerDown={seek} aria-label={`${otherLabel}, ${pickLabel}`}>
      {frame(duration, max, (v) => String(Math.round(v)))}
      <polygon points={area((d) => d.other, () => 0)} fill={color} opacity="0.45" />
      <polygon points={area((d) => d.other + d.pick, (d) => d.other)} fill="var(--pick)" opacity="0.9" />
      <Playhead clock={clock} duration={duration} />
    </svg>
  );
}


/**
 * The AI form curve: above the middle line player 1 is ahead, below it player 2. Nothing is drawn before the hidden limit (the model
 * cannot be trusted there), the next stretch is faded, and the rest is solid. Click or tap to jump the replay to that time.
 */
export function FormChart({ ev, duration, clock, labels }: { ev: Evaluation; duration: number; clock: Clock; labels: { p1: string; p2: string; hold: string } }) {
  const seek = useSeek(clock, duration);
  const uid = useId().replace(/:/g, "");
  const yMid = PAD.t + (H - PAD.t - PAD.b) / 2;
  const fy = (a: number) => PAD.t + (1 - (a + 1) / 2) * (H - PAD.t - PAD.b);
  const pts = ev.t.map((t, i) => ({ t, a: ev.a[i], trust: trustAt(t) }));
  const low = pts.filter((p) => p.trust === "low"), ok = pts.filter((p) => p.trust === "ok");
  // the faded stretch reaches the first solid point, so the line has no gap and no stretch is drawn twice
  const lowLine = low.length && ok.length ? [...low, ok[0]] : low;
  const okLine = ok;
  const xy = (p: { t: number; a: number }) => `${sx(p.t, duration).toFixed(1)},${fy(p.a).toFixed(1)}`;
  const area = (line: typeof pts) => (line.length ? `${sx(line[0].t, duration).toFixed(1)},${yMid} ${line.map(xy).join(" ")} ${sx(line[line.length - 1].t, duration).toFixed(1)},${yMid}` : "");
  const hideX = sx(Math.min(HIDE_BEFORE_SEC, duration), duration), lowX = sx(Math.min(LOW_UNTIL_SEC, duration), duration);
  const plot = (line: typeof pts, opacity: number, dash?: string) => line.length > 1 && (
    <>
      <g clipPath={`url(#${uid}u)`}><polygon points={area(line)} fill={OWNER_COLOR[1]} opacity={opacity * 0.35} /></g>
      <g clipPath={`url(#${uid}d)`}><polygon points={area(line)} fill={OWNER_COLOR[2]} opacity={opacity * 0.35} /></g>
      <polyline fill="none" stroke="var(--text)" strokeWidth="1.8" strokeLinejoin="round" opacity={opacity} strokeDasharray={dash} points={line.map(xy).join(" ")} />
    </>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="vw-chart" role="img" onPointerDown={seek} aria-label={`${labels.p1} / ${labels.p2}`}>
      <defs>
        <clipPath id={`${uid}u`}><rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={yMid - PAD.t} /></clipPath>
        <clipPath id={`${uid}d`}><rect x={PAD.l} y={yMid} width={W - PAD.l - PAD.r} height={H - PAD.b - yMid} /></clipPath>
      </defs>
      <rect x={PAD.l} y={PAD.t} width={Math.max(0, hideX - PAD.l)} height={H - PAD.t - PAD.b} className="vw-hold" />
      {hideX - PAD.l > 40 && <text x={(PAD.l + hideX) / 2} y={yMid - 4} textAnchor="middle" className="vw-axis">{labels.hold}</text>}
      {[1, 0, -1].map((a) => <line key={a} x1={PAD.l} x2={W - PAD.r} y1={fy(a)} y2={fy(a)} className={a === 0 ? "vw-zero" : "vw-grid"} />)}
      <text x={PAD.l - 4} y={PAD.t + 8} textAnchor="end" className="vw-axis" fill={OWNER_COLOR[1]}>P1</text>
      <text x={PAD.l - 4} y={H - PAD.b - 2} textAnchor="end" className="vw-axis" fill={OWNER_COLOR[2]}>P2</text>
      {lowX > hideX && <line x1={lowX} x2={lowX} y1={PAD.t} y2={H - PAD.b} className="vw-grid" strokeDasharray="2 3" />}
      {plot(lowLine, 0.45, "4 3")}
      {plot(okLine, 1)}
      {Array.from({ length: Math.floor(duration / (duration > 900 ? 300 : 120)) + 1 }, (_, i) => i * (duration > 900 ? 300 : 120)).map((t) => (
        <text key={t} x={sx(t, duration)} y={H - 4} textAnchor="middle" className="vw-axis">{Math.floor(t / 60)}m</text>
      ))}
      <Playhead clock={clock} duration={duration} />
    </svg>
  );
}
