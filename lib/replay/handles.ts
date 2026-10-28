import { gunzipSync, gzipSync } from "node:zlib";

/**
 * The site never keeps a player's Battle.net handle (docs/Privacy_Compliance_Additional_Plan.md, A3). The worker replaces it
 * with `handleKey`, a keyed hash, before anything is sent. These functions are the second lock: if a worker that predates
 * that change (or a bug) still sends a raw `handle`, it is removed on arrival, and rows stored earlier are removed on read.
 */

/** A copy of an analysis object without any raw handle. Anything that is not an object with a players array comes back unchanged. */
export function scrubAnalysis<T>(raw: T): T {
  const a = raw as unknown as Record<string, unknown> | null;
  if (!a || typeof a !== "object" || !Array.isArray(a.players)) return raw;
  return { ...a, players: (a.players as unknown[]).map(scrubPlayer) } as T;
}

function scrubPlayer(p: unknown): unknown {
  if (!p || typeof p !== "object") return p;
  const { handle: _dropped, ...rest } = p as Record<string, unknown>;
  void _dropped;
  return rest;
}

const MAX_TIMELINE_TEXT = 256 * 1024 * 1024;

/** The gzip timeline with raw handles removed. The same bytes come back when there was nothing to remove. */
export function scrubTimelineGzip(data: Uint8Array): Uint8Array {
  const text = gunzipSync(data, { maxOutputLength: MAX_TIMELINE_TEXT }).toString("utf8");
  if (!text.includes('"handle"')) return data;
  const tl = JSON.parse(text) as { players?: unknown[] };
  if (!Array.isArray(tl.players)) return data;
  tl.players = tl.players.map(scrubPlayer);
  return gzipSync(Buffer.from(JSON.stringify(tl), "utf8"));
}
