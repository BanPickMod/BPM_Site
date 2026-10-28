import "server-only";

/**
 * Community statistics are cached for a minute (they are recomputed from every public replay). Anything that changes which replays
 * are public, or adds a finished one, calls bumpStats(), so a consent withdrawal or a takedown shows up in the numbers at once
 * instead of after the cache expires. Kept on globalThis because pages and route handlers are separate module instances.
 */
const g = globalThis as typeof globalThis & { __bpmStatsVersion?: number };
export const statsVersion = () => g.__bpmStatsVersion ?? 0;
export const bumpStats = () => { g.__bpmStatsVersion = statsVersion() + 1; };
