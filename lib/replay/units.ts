import wikiJson from "@/data/generated/wiki.json";
import buildingIconJson from "@/data/generated/building-icons.json";
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
const ALIASES: Record<string, string> = { queenclassic: "queen", guardianmp: "guardian", infestedabomination: "aberration", terrorzor: "tyrannozor", marauderheavyarmor: "marauder", firebatheavyarmor: "firebat" };

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

/**
 * Button images of the buildings (scripts/wiki/export-building-icons.py), by building name. The wiki lists units only, so a building
 * is looked up here by its replay id: a few ids share an image with the building they came from.
 */
const buildingIcons = buildingIconJson as Record<string, string>;
const BUILDING_ALIASES: Record<string, string> = {
  orbitalcommand: "commandcenter", sensortower: "sensordome", templararchive: "templararchives", roboticsbay: "roboticssupportbay",
  refineryrich: "refinery", assimilatorrich: "assimilator", extractorrich: "extractor",
};

export function buildingIcon(replayId: string): string | null {
  const key = norm(replayId.replace(/^BPM_/, ""));
  const direct = buildingIcons[key] ?? buildingIcons[BUILDING_ALIASES[key] ?? ""];
  if (direct) return direct;
  if (key.endsWith("techlab")) return buildingIcons.techlab ?? null;
  if (key.endsWith("reactor")) return buildingIcons.reactor ?? null;
  const base = key.replace(/(burrowed|uprooted|flying|queen)$/, "");
  return base !== key ? (buildingIcons[base] ?? buildingIcons[BUILDING_ALIASES[base] ?? ""] ?? null) : null;
}

export function unitInfo(replayId: string, lang: Lang): UnitInfo {
  const key = norm(replayId);
  const u = index.get(ALIASES[key] ?? key);
  if (!u) return { wikiId: null, name: replayId, icon: buildingIcon(replayId), race: null };
  return { wikiId: u.id, name: lang === "ko" ? u.ko : u.en, icon: u.icon, race: u.race };
}

export interface UnitCost { minerals: number; gas: number; supply: number }

/** Cost of each unit in the version the game is played on (the wiki's "current" one), with the base game's value when the mod block has none. */
const currentVersion = wiki.versions.find((v) => v.status === "current")?.id;
const costs = new Map<string, UnitCost>();
for (const u of [...wiki.base, ...wiki.units] as { id: string; cost?: { minerals: number | null; gas: number | null; supply: number | null }; v?: Record<string, { cost?: { minerals: number | null; gas: number | null; supply: number | null } }> }[]) {
  const c = (currentVersion && u.v?.[currentVersion]?.cost) || u.cost;
  if (c) costs.set(norm(u.id), { minerals: c.minerals ?? 0, gas: c.gas ?? 0, supply: c.supply ?? 0 });
}

/** What a unit cost (minerals, gas, supply) by its replay id, or null when the wiki does not know it (buildings and mod-internal ids). */
export function unitCost(replayId: string): UnitCost | null {
  const key = norm(replayId.replace(/^BPM_/, ""));
  return costs.get(ALIASES[key] ?? key) ?? null;
}
