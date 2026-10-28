export type RaceKey = "terran" | "protoss" | "zerg";

/**
 * Official race emblem (Terran Dominion eagle, Zerg swirl, Protoss glyph), drawn as a background so it needs no text.
 * `label` is spoken by screen readers; pass `decorative` when the race name is printed right next to it.
 */
export function RaceMark({ race, label, decorative = false, big = false }: { race: RaceKey; label?: string; decorative?: boolean; big?: boolean }) {
  return (
    <span className={`rtag ${race}${big ? " big" : ""}`} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined}>
      <i className="rglyph" />
    </span>
  );
}

const KEYS: Record<string, RaceKey> = { T: "terran", P: "protoss", Z: "zerg", terran: "terran", protoss: "protoss", zerg: "zerg" };
export const toRaceKey = (v: string): RaceKey | undefined => KEYS[v] ?? KEYS[v.toUpperCase()];
