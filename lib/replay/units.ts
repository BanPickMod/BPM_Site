import wikiJson from "@/data/generated/wiki.json";
import type { WikiData } from "@/lib/wiki";
import type { Lang } from "@/lib/i18n/config";

/**
 * Replay unit ids (the mod's editor ids, e.g. "ScienceVessel", "LurkerMP") to wiki entries.
 * The wiki spells extended units in snake_case ("science_vessel"), so ids are compared with case and punctuation removed.
 */
const wiki = wikiJson as unknown as WikiData;

const norm = (id: string) => id.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Replay ids that differ from the wiki's by more than spelling. The first two cover draft ids (checked against 1,200+ replays).
 * The last two are the mod's catalog ids for the Aberration and Tyrannozor, which show up as unit types in the tracker stream
 * (UnitData.xml: InfestedAbomination 150/50, Terrorzor 300/200: same costs as the wiki entries).
 */
const ALIASES: Record<string, string> = { queenclassic: "queen", guardianmp: "guardian", infestedabomination: "aberration", terrorzor: "tyrannozor" };

export interface UnitInfo {
  /** Wiki id, usable as /wiki#<id>; null when the wiki has no entry (then only the raw id is shown). */
  wikiId: string | null;
  name: string;
  icon: string | null;
  race: "terran" | "protoss" | "zerg" | null;
}

const index = new Map<string, { id: string; ko: string; en: string; icon: string | null; race: UnitInfo["race"] }>();
for (const u of [...wiki.base, ...wiki.units]) {
  index.set(norm(u.id), { id: u.id, ko: u.ko, en: u.en, icon: u.icon, race: u.race as UnitInfo["race"] });
}

export function unitInfo(replayId: string, lang: Lang): UnitInfo {
  const key = norm(replayId);
  const u = index.get(ALIASES[key] ?? key);
  if (!u) return { wikiId: null, name: replayId, icon: null, race: null };
  return { wikiId: u.id, name: lang === "ko" ? u.ko : u.en, icon: u.icon, race: u.race };
}
