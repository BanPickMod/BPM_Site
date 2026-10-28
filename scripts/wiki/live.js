// Overlays values read from a running game (live/live-v2.0.json, written by bpm-ai-engine/scripts/wiki_live_dump.py)
// onto the resolved v2.0 blocks. The game is the source of truth for the current version: it already resolves
// dependency inheritance, behaviors and the installed game patch, which the XML snapshots cannot do.
// Not touched: build time (the game reports it unreliably), energy and abilities.
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "live", "live-v2.0.json");
const FASTER = 1.4; // the game reports speed and cooldown in "normal" seconds; the wiki uses Faster seconds
const ATTR = { 1: "Light", 2: "Armored", 3: "Biological", 4: "Mechanical", 5: "Robotic", 6: "Psionic", 7: "Massive", 8: "Structure", 9: "Hover", 10: "Heroic", 11: "Summoned" };
const TARGET = { 1: "ground", 2: "air", 3: "any" };
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function load() {
  if (!fs.existsSync(FILE)) return null;
  return JSON.parse(fs.readFileSync(FILE, "utf8")).units;
}

function weaponsFrom(proto, previous) {
  // Carry the data name and the in-game name over from the XML weapon with the same target, in order.
  const pool = (previous || []).map((w) => ({ w, used: false }));
  const take = (targets) => { const hit = pool.find((p) => !p.used && p.w.targets === targets); if (hit) hit.used = true; return hit ? hit.w : null; };
  return proto.weapons.map((w, i) => {
    const cd = round(w.cooldown / FASTER, 2);
    const bonus = w.damage_bonus || w.bonus || [];
    const best = bonus.reduce((m, b) => Math.max(m, b.bonus), 0);
    const per = w.attacks / (cd || Infinity);
    const targets = TARGET[w.type] || null;
    const prev = take(targets) || (pool.every((p) => !p.used) && previous && previous[i] && previous.length === proto.weapons.length ? previous[i] : null);
    return {
      id: prev ? prev.id : `live-${targets || "weapon"}-${i + 1}`,
      rawId: prev ? prev.rawId : null,
      nameKo: prev ? prev.nameKo || null : null,
      targets,
      range: round(w.range),
      cd: cd || null,
      count: w.attacks,
      dmg: round(w.damage),
      bonus: bonus.map((b) => ({ type: ATTR[b.attribute] || String(b.attribute), dmg: round(b.bonus) })),
      splash: prev ? prev.splash : null,
      dps: cd ? round(w.damage * per) : null,
      dpsBonus: cd && best ? round((w.damage + best) * per) : null,
      src: "live",
    };
  });
}

/** Applies the live values for one game unit name to `block` and returns the list of fields it changed. */
function applyLive(block, gameName, live) {
  const g = live && live[gameName];
  if (!g || !g.live) return null;
  const p = g.proto, l = g.live;
  block.hp = round(l.health_max);
  block.shields = round(l.shield_max);
  block.armor = round(p.armor);
  block.speed = round(p.speed * FASTER, 2);
  block.sight = round(l.sight);
  block.radius = round(l.radius, 3);
  block.cost.minerals = p.minerals;
  block.cost.gas = p.gas;
  block.cost.supply = p.supply;
  block.attrs = p.attributes.map((a) => ATTR[a]).filter(Boolean);
  block.weapons = weaponsFrom(p, block.weapons);
  for (const k of ["hp", "shields", "armor", "speed", "sight", "radius", "attrs", "weapons", "cost.minerals", "cost.gas", "cost.supply"]) block.prov[k] = "live";
  return true;
}

module.exports = { load, applyLive };
