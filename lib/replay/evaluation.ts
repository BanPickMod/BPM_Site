/**
 * The AI "form" curve of a replay (docs/BPM_Backend_Plan.md section 5.1, bpm-ai-engine docs/reports/bpm_value_validation.md).
 *
 * `a[i]` is player 1's form minus player 2's at `t[i]` seconds, in -1..1 (positive: player 1 ahead). It comes from a model trained
 * on professional games and not yet calibrated on BPM games, so it is a score for a rough read of the game, never a probability.
 * The validation showed that it cannot be trusted early: before 4 minutes it is not shown at all, from 4 to 8 minutes it is shown
 * faded, and only from 8 minutes on as a solid line. The thresholds live here (not in the stored data) so they can be tightened
 * once more games are validated, without recomputing anything.
 */
export const HIDE_BEFORE_SEC = 240;
export const LOW_UNTIL_SEC = 480;

export interface Evaluation {
  t: number[];
  a: number[];
  model: string;
  evalVersion: string;
  validated: boolean;
  lengthSec: number;
}

export type Trust = "hidden" | "low" | "ok";
export const trustAt = (t: number): Trust => (t < HIDE_BEFORE_SEC ? "hidden" : t < LOW_UNTIL_SEC ? "low" : "ok");

const MAX_POINTS = 2000;

/** Stored JSON -> Evaluation, or null when it is missing or malformed. The same checks guard what a worker may store. */
export function parseEvaluation(raw: unknown): Evaluation | null {
  const e = raw as Record<string, unknown> | null;
  if (!e || typeof e !== "object" || e.schema !== 1) return null;
  const { t, a } = e;
  if (!Array.isArray(t) || !Array.isArray(a) || t.length !== a.length || t.length === 0 || t.length > MAX_POINTS) return null;
  let prev = -Infinity;
  for (let i = 0; i < t.length; i++) {
    const ti = t[i], ai = a[i];
    if (typeof ti !== "number" || typeof ai !== "number" || !Number.isFinite(ti) || !Number.isFinite(ai)) return null;
    if (ti <= prev || ti < 0 || ti > 86_400 || ai < -1 || ai > 1) return null;
    prev = ti;
  }
  if (typeof e.model !== "string" || typeof e.evalVersion !== "string") return null;
  return {
    t: t as number[], a: a as number[], model: e.model.slice(0, 60), evalVersion: e.evalVersion.slice(0, 40),
    validated: e.validated === true, lengthSec: typeof e.lengthSec === "number" && Number.isFinite(e.lengthSec) ? e.lengthSec : (t.at(-1) as number),
  };
}

export interface Swing { t: number; delta: number; toward: 1 | 2 }

/**
 * Where the form changed most: for each point from 4 minutes on, the change over the following `windowSec`, largest first.
 * Neighbouring picks are at least `gapSec` apart so one fight is not listed three times.
 */
export function swings(ev: Evaluation, count = 3, windowSec = 60, gapSec = 90): Swing[] {
  const cands: Swing[] = [];
  for (let i = 0; i < ev.t.length; i++) {
    if (ev.t[i] < HIDE_BEFORE_SEC) continue;
    let j = i;
    while (j + 1 < ev.t.length && ev.t[j + 1] - ev.t[i] <= windowSec) j++;
    if (j === i) continue;
    const d = ev.a[j] - ev.a[i];
    if (Math.abs(d) >= 0.15) cands.push({ t: ev.t[i], delta: d, toward: d > 0 ? 1 : 2 });
  }
  cands.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const out: Swing[] = [];
  for (const c of cands) {
    if (out.every((o) => Math.abs(o.t - c.t) >= gapSec)) out.push(c);
    if (out.length >= count) break;
  }
  return out.sort((x, y) => x.t - y.t);
}

/** Form at a time, for the player-1-minus-player-2 reading; null while it is hidden or outside the data. */
export function formAt(ev: Evaluation, t: number): number | null {
  if (trustAt(t) === "hidden" || t < ev.t[0] || t > (ev.t.at(-1) as number)) return null;
  let lo = 0, hi = ev.t.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ev.t[mid] <= t) lo = mid; else hi = mid - 1;
  }
  return ev.a[lo];
}
