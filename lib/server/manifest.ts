/**
 * Per-game metadata that accompanies an event replay upload (see docs/Colosseum_Ingest.md).
 * Written by the AI match harness, not parsed from the replay, so it is trusted only
 * because the endpoint is admin-only.
 */
export const RACES = ["terran", "protoss", "zerg"] as const;
export type Race = (typeof RACES)[number];

export interface ManifestPlayer {
  slot: 1 | 2;
  name: string;
  race: Race;
  persona?: string;
  modelVersion?: string;
  result: "win" | "loss";
}

export interface ManifestDraft {
  seq: number;
  slot: 1 | 2;
  action: "BAN" | "PICK" | "REPLACE";
  unitId: string;
  replacesUnitId?: string;
}

export interface Manifest {
  event: string;
  round: number;
  /** Stable id of one Bo3 series; all games of the series share it. */
  seriesKey: string;
  gameNo: number;
  map: string;
  banMode: string;
  banCount: number;
  modVersion?: string;
  balanceVersion?: string;
  playedAt?: string;
  durationSec?: number;
  /** ISO time the game becomes public; omitted means immediately. */
  publishAt?: string;
  players: [ManifestPlayer, ManifestPlayer];
  draft: ManifestDraft[];
  /** Free-form highlights shown on the game page (e.g. { battles: [{ atSec, label }] }). */
  summary?: Record<string, unknown>;
}

const raceLetter: Record<Race, string> = { terran: "T", protoss: "P", zerg: "Z" };

/** "TvZ"-style matchup from slot order. */
export function matchupOf(m: Manifest): string {
  return `${raceLetter[m.players[0].race]}v${raceLetter[m.players[1].race]}`;
}

const isStr = (v: unknown, max = 200): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const isInt = (v: unknown, min = 0, max = 1_000_000): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isIso = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

/** Returns the parsed manifest or a list of human-readable problems. */
export function parseManifest(raw: unknown): { ok: true; value: Manifest } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const m = (raw ?? {}) as Record<string, unknown>;
  if (!isStr(m.event, 60) || !/^[a-z0-9-]+$/.test(m.event)) errors.push("event: slug required");
  if (!isInt(m.round, 1, 99)) errors.push("round: integer 1-99");
  if (!isStr(m.seriesKey, 120)) errors.push("seriesKey: required");
  if (!isInt(m.gameNo, 1, 9)) errors.push("gameNo: integer 1-9");
  if (!isStr(m.map)) errors.push("map: required");
  if (!isStr(m.banMode, 40)) errors.push("banMode: required");
  if (!isInt(m.banCount, 0, 20)) errors.push("banCount: integer 0-20");
  for (const k of ["playedAt", "publishAt"] as const) {
    if (m[k] !== undefined && !isIso(m[k])) errors.push(`${k}: ISO date`);
  }
  if (m.durationSec !== undefined && !isInt(m.durationSec, 1, 100_000)) errors.push("durationSec: integer");

  const players = Array.isArray(m.players) ? (m.players as Record<string, unknown>[]) : [];
  if (players.length !== 2) errors.push("players: exactly 2");
  else {
    const slots = players.map((p) => p.slot).sort();
    if (slots[0] !== 1 || slots[1] !== 2) errors.push("players: slots must be 1 and 2");
    players.forEach((p, i) => {
      if (!isStr(p.name, 80)) errors.push(`players[${i}].name`);
      if (!RACES.includes(p.race as Race)) errors.push(`players[${i}].race`);
      if (p.result !== "win" && p.result !== "loss") errors.push(`players[${i}].result`);
    });
    if (players[0].result === players[1].result) errors.push("players: exactly one winner");
  }

  const draft = Array.isArray(m.draft) ? (m.draft as Record<string, unknown>[]) : null;
  if (!draft) errors.push("draft: array required");
  else {
    const seen = new Set<number>();
    draft.forEach((d, i) => {
      if (!isInt(d.seq, 0, 500) || seen.has(d.seq as number)) errors.push(`draft[${i}].seq: unique integer`);
      else seen.add(d.seq as number);
      if (d.slot !== 1 && d.slot !== 2) errors.push(`draft[${i}].slot`);
      if (d.action !== "BAN" && d.action !== "PICK" && d.action !== "REPLACE") errors.push(`draft[${i}].action`);
      if (!isStr(d.unitId, 80)) errors.push(`draft[${i}].unitId`);
      if (d.action === "REPLACE" && !isStr(d.replacesUnitId, 80)) errors.push(`draft[${i}].replacesUnitId`);
    });
  }
  if (m.summary !== undefined && (typeof m.summary !== "object" || m.summary === null || Array.isArray(m.summary))) {
    errors.push("summary: object");
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: m as unknown as Manifest };
}
