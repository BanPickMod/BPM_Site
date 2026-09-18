import siteMetaRaw from "@/data/site_meta.json";
import unitsRaw from "@/data/units.json";
import standardUnitsRaw from "@/data/standard_units.json";
import ptrDiffsRaw from "@/data/ptr_diffs.json";
import patchesRaw from "@/data/patches.json";
import mapsRaw from "@/data/maps.json";
import systemDiffsRaw from "@/data/system_diffs.json";
import modifiedUnitsRaw from "@/data/modified_units.json";

export interface BPMUnit {
  id: string;
  name: string;
  race: "terran" | "protoss" | "zerg";
  category?: "bpm_expansion" | "standard";
  icon: string;
  pairUnit?: string;
  building: string;
  techReq: string;
  cost: {
    minerals: number;
    gas: number;
    supply: number;
    time: number;
  };
  stats: {
    hp: number;
    shields?: number;
    energy?: number;
    armor: number;
    speed: number;
    range: number;
    groundDmg: string;
    airDmg: string;
    damageType: string;
  };
  weapons?: {
    name: string;
    targets: string;
    damage: number;
    attacks?: number;
    period: number;
    dps: number;
    range: number;
  }[];
  diffFromPair?: {
    item: string;
    pair: string;
    unit: string;
  }[];
  abilities?: {
    name: string;
    cost?: string;
    cooldown?: number;
    description: string;
  }[];
  upgrades?: {
    name: string;
    icon?: string;
    building?: string;
    requirement?: string;
    cost: string;
    statDiff: string;
  }[];
  clip?: {
    title: string;
    src: string;
    poster: string;
    simulation: string;
  };
  clipUrl?: string;
  description?: string;
  tactics?: string;
}

export interface PTRDiff {
  category?: string;
  unitId?: string;
  icon?: string;
  title: string;
  changes: string[];
  showcase?: string;
  reasoning?: string;
}

export interface BPMPatch {
  version: string;
  date: string;
  title: string;
  summary: string;
  changes: {
    category: string;
    tag: string;
    text: string;
  }[];
}

export interface BPMMap {
  id: string;
  name: string;
  version: string;
  searchKeyword: string;
  terrain: string;
  features: string[];
}

export interface BPMSystemDiff {
  id: string;
  target: string;
  category: string;
  before: string;
  after: string;
  purpose: string;
}

export const siteMeta = siteMetaRaw;

// 17 BPM Custom Expansion Units
export const bpmUnits: BPMUnit[] = (unitsRaw as unknown as BPMUnit[]).map((u) => ({
  ...u,
  category: "bpm_expansion",
}));

// Standard Melee Units
export const standardUnits: BPMUnit[] = (standardUnitsRaw as unknown as BPMUnit[]).map((u) => ({
  ...u,
  category: "standard",
}));

// All Live Official Units (Combined)
export const allLiveUnits: BPMUnit[] = [...bpmUnits, ...standardUnits];

// PTR Balance Diffs
export const ptrDiffs: PTRDiff[] = ptrDiffsRaw as PTRDiff[];

export const bpmPatches = patchesRaw as BPMPatch[];
export const bpmMaps = mapsRaw as BPMMap[];
export const bpmSystemDiffs = systemDiffsRaw as BPMSystemDiff[];
export const bpmModifiedUnits = modifiedUnitsRaw;

// Helper to get any unit by ID
export function getUnitById(id: string): BPMUnit | undefined {
  return allLiveUnits.find((u) => u.id === id);
}

// Helper to get standard unit paired with expansion unit
export function getStandardPairForUnit(unit: BPMUnit): BPMUnit | undefined {
  if (!unit.pairUnit) return undefined;
  // Match by Korean or English name inside pairUnit string e.g. "불곰 (Marauder)"
  const cleanName = unit.pairUnit.split(" ")[0].trim();
  return (
    standardUnits.find((u) => u.name.includes(cleanName)) ||
    bpmUnits.find((u) => u.name.includes(cleanName))
  );
}
