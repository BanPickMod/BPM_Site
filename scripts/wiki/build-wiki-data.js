// Builds the wiki and guide data the site reads: data/generated/wiki.json and data/generated/site.json.
//
//   node scripts/wiki/build-wiki-data.js
//
// Inputs
//   scripts/wiki/curated/*.json        hand-maintained: BPM extension unit baselines, maps, tutorials, draft flow
//   scripts/wiki/source/<version>/     mod XML snapshots (v2.0 from release/bpm-modules, older ones from retired builds)
//   base_balance_data_LOTV/            base-game balance export (57 base units, icon textures)
// Patch notes are NOT built here. They are Markdown files in content/patches/.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SITE = path.join(__dirname, "..", "..");
const REPO = path.join(SITE, "..");
const C = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "curated", f), "utf8"));
const outDir = path.join(SITE, "data", "generated");
fs.mkdirSync(outDir, { recursive: true });

const loadMod = require("./mod-data");
const live = require("./live");
const extractUpgrades = require("./extract-upgrades");
const extractBase = require("./extract-base");
const { resolveBase, resolveExt } = require("./resolve");

// Version axis. `source` is the snapshot directory the values come from.
// Only v2.0 is read from the game and XML; v1.4.3 and v1.4.1 are derived from it (see "older versions" below).
const VERSIONS = [
  { id: "v2.0", status: "current", source: "v2.0" },
  { id: "v1.4.3", status: "previous", source: "v1.4.3" },
  { id: "v1.4.1", status: "archive", source: "v1.4.2" },
];
const MOD = Object.fromEntries(VERSIONS.map((v) => [v.id, loadMod(v.source)]));

const enName = (n) => (n.match(/\(([^)]+)\)/) || [])[1] || n;
const koName = (n) => n.replace(/\s*\([^)]+\)/, "");

// extension unit -> the base unit it replaces in the hidden pick
const PAIR = { firebat: "Marauder", goliath: "Thor", warhound: "SiegeTank", wraith: "VikingFighter", science_vessel: "Raven", dragoon: "Stalker", energizer: "Sentry", corsair: "Phoenix", scout: "VoidRay", reaver: "Disruptor", arbiter: "Mothership", aberration: "Roach", ravasaur: "Ravager", defiler: "Infestor", queen: "Viper", tyrannozor: "Ultralisk", guardian: "BroodLord" };
// extension unit -> its id in the mod XML
const EXT_MOD = { firebat: "Firebat", goliath: "Goliath", warhound: "WarHound", wraith: "Wraith", science_vessel: "ScienceVessel", dragoon: "Dragoon", energizer: "Energizer", corsair: "CorsairMP", scout: "ScoutMP", reaver: "Reaver", arbiter: "ArbiterMP", aberration: "InfestedAbomination", ravasaur: "Ravasaur", defiler: "DefilerMP", queen: "QueenClassic", tyrannozor: "Terrorzor", guardian: "GuardianMP" };

// ---- base units (+ icon conversion, DDS -> PNG via ffmpeg, skipped when the PNG already exists) ----
const iconDir = path.join(SITE, "public", "images", "icons", "base");
fs.mkdirSync(iconDir, { recursive: true });
const TEX = path.join(REPO, "base_balance_data_LOTV", "Assets", "Textures");
const base = extractBase();
base.forEach((u) => {
  const out = path.join(iconDir, u.id + ".png");
  const src = u.iconName && fs.readdirSync(TEX).find((f) => f.toLowerCase() === u.iconName.toLowerCase() + ".dds");
  if (src && !fs.existsSync(out)) {
    try { execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", path.join(TEX, src), "-vf", "scale=96:96", out]); } catch (e) { console.warn("icon failed:", u.id); }
  }
  u.icon = fs.existsSync(out) ? "/images/icons/base/" + u.id + ".png" : null;
  delete u.iconName;
});

// ---- extension units ----
const NOTES = C("unit-notes.json");
const units = C("units.json").map((u) => ({
  id: u.id, race: u.race, icon: "/images/icons/" + path.basename(u.icon),
  ko: koName(u.name), en: enName(u.name),
  pairKo: koName(u.pairUnit), pairEn: enName(u.pairUnit), pairId: PAIR[u.id],
  buildingKo: u.building, techKo: u.techReq,
  cost: u.cost, stats: u.stats,
  notes: NOTES[u.id],
  modId: EXT_MOD[u.id],
}));

// ---- per-version value blocks ----
for (const v of VERSIONS) {
  base.forEach((u) => { (u.v = u.v || {})[v.id] = resolveBase(u, MOD[v.id]); });
  units.forEach((e) => { (e.v = e.v || {})[v.id] = resolveExt(e, e.modId, MOD[v.id]); });
}

// ---- current version: values read from a running game win over the XML snapshots (scripts/wiki/live.js) ----
const liveData = live.load();
if (liveData) {
  const noLive = [];
  for (const u of base) if (!live.applyLive(u.v["v2.0"], u.id, liveData)) noLive.push(u.id);
  for (const e of units) if (!live.applyLive(e.v["v2.0"], e.modId, liveData)) noLive.push(e.id);
  if (noLive.length) console.warn("No live data for: " + noLive.join(", "));
} else console.warn("scripts/wiki/live/live-v2.0.json not found; v2.0 uses the XML snapshot only.");

// ---- older versions: v2.0 has no balance change against v1.4.3 (docs/reports/v1.4.3_to_v2.0_value_diff.txt), so v1.4.3 takes the
// current values; v1.4.1 is v1.4.3 with the changes stated in the v1.4.3 patch notes reversed. v1.4.2 was a bug-fix release. ----
const knownRaw = C("known-changes.json");
const clone = (x) => JSON.parse(JSON.stringify(x));
function reverse(block, c) {
  const set = (arr) => new Set(arr || []);
  const COST = ["minerals", "gas", "supply", "time"];
  if (c.field === "attrs") {
    const out = set(block.attrs);
    for (const a of set(c.after)) if (!set(c.before).has(a)) out.delete(a);
    for (const a of set(c.before)) out.add(a);
    block.attrs = [...out];
  } else if (COST.includes(c.field)) block.cost[c.field] = c.before;
  else block[c.field] = c.before;
  block.prov[COST.includes(c.field) ? "cost." + c.field : c.field] = "notes";
}
if (liveData) {
  for (const u of [...base, ...units]) {
    u.v["v1.4.3"] = clone(u.v["v2.0"]);
    const old = clone(u.v["v1.4.3"]);
    for (const c of knownRaw["v1.4.3"] || []) if (c.unit === u.id) reverse(old, c);
    u.v["v1.4.1"] = old;
  }
}

// ---- stated value changes (see curated/known-changes.json), verified against the resolved data ----
const changes = {};
const mismatches = [];
const FIELD = { minerals: (b) => b.cost.minerals, gas: (b) => b.cost.gas, supply: (b) => b.cost.supply, time: (b) => b.cost.time };
for (const [ver, list] of Object.entries(knownRaw)) {
  if (ver.startsWith("_")) continue;
  for (const c of list) {
    const u = [...base, ...units].find((x) => x.id === c.unit);
    if (!u) { mismatches.push(ver + " " + c.unit + ": unit not found"); continue; }
    const block = u.v[ver];
    const now = FIELD[c.field] ? FIELD[c.field](block) : block[c.field];
    const same = Array.isArray(c.after) ? c.after.every((a) => (now || []).includes(a)) : now === c.after;
    if (!same) mismatches.push(ver + " " + c.unit + "." + c.field + ": notes say " + JSON.stringify(c.after) + ", data has " + JSON.stringify(now));
    ((changes[ver] = changes[ver] || {})[c.unit] = changes[ver][c.unit] || {})[c.field] = c.before;
  }
}
if (mismatches.length) {
  console.error(["Stated changes that do not match the mod data:", ...mismatches.map((m) => "  " + m)].join("\n"));
  process.exitCode = 1;
}

const badNotes = units.filter((e) => !e.notes || !e.notes.role || !e.notes.producer || !e.notes.requires || !Array.isArray(e.notes.diff)).map((e) => e.id);
if (badNotes.length) { console.error("Missing or incomplete curated/unit-notes.json entries: " + badNotes.join(", ")); process.exitCode = 1; }

// Numbers belong to the XML-generated tables; authored notes must not repeat them (they go stale).
const numeric = [];
for (const e of units) {
  const walk = (v, where) => { if (typeof v === "string") { if (/[0-9]/.test(v)) numeric.push(e.id + " " + where + ": " + v); } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + "[" + i + "]")); else if (v && typeof v === "object") for (const k of Object.keys(v)) walk(v[k], where + "." + k); };
  walk({ role: e.notes.role, producer: e.notes.producer, requires: e.notes.requires, diff: e.notes.diff }, "notes");
}
if (numeric.length) {
  console.error(["Numbers found in curated/unit-notes.json (use the generated tables instead):", ...numeric.map((m) => "  " + m)].join(String.fromCharCode(10)));
  process.exitCode = 1;
}

const missing = units.filter((e) => !MOD["v2.0"].units[e.modId]).map((e) => e.id);
if (missing.length) console.warn("Extension units missing from the v2.0 XML:", missing.join(", "));

// ---- in-game names ----
// Added units: the in-game name is the one in the mod's "<unit> 선택" pick upgrade (or Unit/Name); base units come from S2Strings (extract-base.js).
const koStrings = MOD["v2.0"].names.ko;
const PICK = { aberration: "Aberration", arbiter: "Arbiter", corsair: "Corsair", defiler: "Defiler", dragoon: "Dragoon", firebat: "Firebat", goliath: "Goliath", guardian: "GuardianMP", queen: "QueenClassic", ravasaur: "Ravasaur", reaver: "Reaver", science_vessel: "ScienceVessel", scout: "Scout", tyrannozor: "Tyrannozor", warhound: "WarHound", wraith: "Wraith" };
for (const e of units) {
  const pick = koStrings["Upgrade/Name/BPM_Pick_" + PICK[e.id]];
  const name = pick ? pick.replace(/ 선택$/, "") : koStrings["Unit/Name/" + e.modId];
  if (name) e.ko = name;
}
const baseKo = Object.fromEntries(base.map((b) => [b.id, b.ko]));
for (const e of units) e.pairKo = baseKo[e.pairId] || e.pairKo;
// weapon names the base export lacks (or the mod overrides) come from the mod strings (Weapon/Name/<data id>)
for (const e of [...base, ...units]) for (const ver of Object.values(e.v)) for (const w of ver.weapons || []) if (!w.nameKo && w.rawId) w.nameKo = koStrings["Weapon/Name/" + w.rawId] || null;

// ---- research upgrades: cost, time and in-game text from the mod, owners and English text from curated/upgrade-meta.json ----
const upMeta = C("upgrade-meta.json");
const upMod = extractUpgrades();
const unitIds = new Set([...base.map((b) => b.id), ...units.map((e) => e.id)]);
const upgrades = [];
for (const [id, m] of Object.entries(upMeta)) {
  if (id.startsWith("_")) continue;
  const x = upMod[id];
  if (!x && !m.manual) { console.error("Upgrade " + id + " is in upgrade-meta.json but not in the mod"); process.exitCode = 1; continue; }
  for (const u of m.units) if (!unitIds.has(u)) { console.error("Upgrade " + id + ": unknown unit " + u); process.exitCode = 1; }
  const ko = m.manual ? m.manual.ko : { name: x.nameKo, effect: x.tooltipKo };
  const bld = m.manual ? m.manual.building : x.building;
  upgrades.push({
    id, units: m.units, icon: "/images/upgrades/" + m.icon + ".png", name: { ko: ko.name, en: m.en.name }, effect: { ko: ko.effect, en: m.en.effect },
    building: bld ? { ko: bld[0], en: bld[1] } : null, minerals: x ? x.minerals : null, gas: x ? x.gas : null, time: x ? x.time : null,
  });
}
const unlisted = Object.keys(upMod).filter((id) => !upMeta[id]);
if (unlisted.length) { console.error("Mod upgrades missing from curated/upgrade-meta.json: " + unlisted.join(", ")); process.exitCode = 1; }

const wiki = {
  versions: VERSIONS.map((v) => ({ id: v.id, status: v.status, source: MOD[v.id].source })),
  changes,
  base,
  units,
  upgrades,
};
fs.writeFileSync(path.join(outDir, "wiki.json"), JSON.stringify(wiki));

const maps = C("maps.json");
const meta = C("site_meta.json");
const mapEn = {
  washout: "Standard 2-player map with a narrow central path and a safe natural-to-third route.",
  fear_and_faith: "2-player map with wide outer routes and highland vision points around the third base.",
  rorschach: "2-player map built for aggressive tempo and early skirmishes.",
};
const site = {
  maps: maps.map((m) => ({ id: m.id, ko: koName(m.name), en: enName(m.name), key: m.searchKeyword, terrainKo: m.terrain, featuresKo: m.features, terrainEn: mapEn[m.id] })),
  tutorials: C("tutorials.json"),
  draftFlow: meta.draftFlow,
  convenience: meta.convenienceFeatures,
  extensionUnitCount: units.length,
};
fs.writeFileSync(path.join(outDir, "site.json"), JSON.stringify(site));

console.log("wiki.json: " + base.length + " base units, " + units.length + " extension units, versions " + VERSIONS.map((v) => v.id).join(", "));
console.log("site.json: " + site.maps.length + " maps, " + site.tutorials.length + " tutorials");
