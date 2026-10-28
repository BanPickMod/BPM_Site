// Reads the catalog XML snapshots in scripts/wiki/source/<version>/ (see extract-release.js).
// The mod XML is a DELTA over its dependencies: only fields the mod sets appear. This module returns exactly those
// explicit values (so callers know which numbers are authoritative) plus research/train costs and localized names.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "source");
const F = 1.4; // the game stores normal-speed seconds; players read "Faster" seconds

function parse(src) {
  src = src.replace(/<!--[\s\S]*?-->/g, "");
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const re = /<(\/?)([\w:-]+)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(src))) {
    const [, close, tag, rawAttrs, self] = m;
    if (close) { stack.pop(); continue; }
    const attrs = {};
    rawAttrs.replace(/([\w:.-]+)="([^"]*)"/g, (_, k, v) => (attrs[k] = v));
    const node = { tag, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!self) stack.push(node);
  }
  return root.children[0];
}
let DIR = ROOT;
const read = (name) => { const f = path.join(DIR, "Base.SC2Data__GameData__" + name + ".xml"); return fs.existsSync(f) ? parse(fs.readFileSync(f, "utf8")) : { children: [] }; };
const num = (v) => (v === undefined || v === "" ? null : parseFloat(v));
const r2 = (x) => (x === null ? null : Math.round(x * 100) / 100);
const kids = (n, tag) => n.children.filter((c) => c.tag === tag);
const val = (n, tag) => { const c = n.children.find((x) => x.tag === tag && x.attrs.removed !== "1"); return c ? c.attrs.value : undefined; };

function strings(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  fs.readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/).forEach((l) => { const i = l.indexOf("="); if (i > 0) out[l.slice(0, i)] = l.slice(i + 1); });
  return out;
}

module.exports = function loadMod(which) {
  DIR = path.join(ROOT, which);
  if (!fs.existsSync(path.join(DIR, "Base.SC2Data__GameData__UnitData.xml"))) throw new Error("No snapshot for " + which + ". Run: node scripts/wiki/extract-release.js " + which);
  const source = fs.readFileSync(path.join(DIR, "SOURCE.txt"), "utf8").trim();

  /* ---- units: explicit fields only ---- */
  const units = {};
  read("UnitData").children.filter((n) => n.tag === "CUnit").forEach((u) => {
    const o = { id: u.attrs.id, parent: u.attrs.parent || null, set: {}, attrs: {}, weapons: [] };
    u.children.forEach((c) => {
      const v = c.attrs.value, t = c.tag;
      if (c.attrs.removed === "1") return;
      if (t === "LifeMax") o.set.hp = num(v);
      else if (t === "LifeStart" && o.set.hp === undefined) o.set.hp = num(v);
      else if (t === "LifeArmor") o.set.armor = num(v);
      else if (t === "ShieldsMax") o.set.shields = num(v);
      else if (t === "ShieldsStart" && o.set.shields === undefined) o.set.shields = num(v);
      else if (t === "ShieldArmor") o.set.shieldArmor = num(v);
      else if (t === "Speed") o.set.speed = r2(num(v) * F);
      else if (t === "Food") o.set.supply = Math.abs(num(v));
      else if (t === "Sight") o.set.sight = num(v);
      else if (t === "Radius") o.set.radius = num(v);
      else if (t === "CargoSize") o.set.cargo = num(v);
      else if (t === "EnergyMax") o.set.energyMax = num(v);
      else if (t === "CostResource") { if (c.attrs.index === "Minerals") o.set.minerals = num(v); if (c.attrs.index === "Vespene") o.set.gas = num(v); }
      else if (t === "Attributes") o.attrs[c.attrs.index] = v === "1";
      else if (t === "WeaponArray") { if (c.attrs.Link) o.weapons.push({ index: c.attrs.index === undefined ? null : +c.attrs.index, link: c.attrs.Link }); }
    });
    units[o.id] = o;
  });

  /* ---- weapons and the damage effect chain behind them ---- */
  const weapons = {};
  read("WeaponData").children.filter((n) => n.tag === "CWeaponLegacy").forEach((w) => {
    weapons[w.attrs.id] = { id: w.attrs.id, range: num(val(w, "Range")), period: num(val(w, "Period")), effect: val(w, "Effect"), targets: val(w, "TargetFilters") || null, parent: w.attrs.parent || null };
  });
  const effects = {};
  read("EffectData").children.forEach((e) => {
    const o = { id: e.attrs.id, type: e.tag, parent: e.attrs.parent || null, amount: num(val(e, "Amount")), array: kids(e, "EffectArray").filter((x) => x.attrs.removed !== "1" && x.attrs.value).map((x) => x.attrs.value), impact: val(e, "ImpactEffect") || null,
      bonus: kids(e, "AttributeBonus").filter((x) => x.attrs.removed !== "1").map((x) => ({ type: x.attrs.index, amount: num(x.attrs.value) })) };
    effects[o.id] = o;
  });
  // walk a weapon's effect tree and return its primary damage (first CEffectDamage found)
  function damageOf(effectId, depth = 0, seen = new Set()) {
    if (!effectId || depth > 6 || seen.has(effectId)) return null;
    seen.add(effectId);
    const e = effects[effectId];
    if (!e) return null;
    if (e.type === "CEffectDamage") return { effect: e.id, amount: e.amount, bonus: e.bonus };
    for (const next of [...e.array, e.impact].filter(Boolean)) { const d = damageOf(next, depth + 1, seen); if (d) return d; }
    return null;
  }

  /* ---- research / train / morph: cost and time as the mod sets them ---- */
  const research = [], train = [];
  read("AbilData").children.forEach((a) => {
    if (a.tag !== "CAbilResearch" && a.tag !== "CAbilTrain" && a.tag !== "CAbilMorph") return;
    kids(a, "InfoArray").forEach((info) => {
      const res = {};
      kids(info, "Resource").forEach((r) => { res[r.attrs.index] = num(r.attrs.value); });
      const btn = kids(info, "Button")[0];
      const rec = { abil: a.attrs.id, minerals: res.Minerals ?? null, gas: res.Vespene ?? null, time: num(info.attrs.Time), requirements: btn ? btn.attrs.Requirements || null : null };
      if (a.tag === "CAbilResearch") { const up = kids(info, "Upgrade")[0]; const upg = up ? up.attrs.value : info.attrs.Upgrade; if (upg) research.push({ ...rec, upgrade: upg }); }
      else { const un = kids(info, "Unit").find((x) => x.attrs.value); if (un && (rec.time !== null || rec.minerals !== null)) train.push({ ...rec, unit: un.attrs.value }); }
    });
  });

  /* ---- morph durations, ability costs, behavior numbers (used to verify the patch text) ---- */
  const morph = {};
  read("AbilData").children.forEach((a) => {
    if (a.tag === "CAbilMorph") { const d = []; a.children.forEach((i) => i.children.forEach((s) => s.children.forEach((x) => { if (x.tag === "DurationArray" && x.attrs.index === "Delay") d.push(num(x.attrs.value)); }))); if (d.length) morph[a.attrs.id] = d[0]; }
  });
  const abilities = {};
  read("AbilData").children.forEach((a) => {
    if (a.tag !== "CAbilEffectTarget" && a.tag !== "CAbilEffectInstant") return;
    const cost = kids(a, "Cost")[0]; const energy = cost ? kids(cost, "Vital").find((v) => v.attrs.index === "Energy") : null; const cd = cost ? kids(cost, "Cooldown")[0] : null;
    abilities[a.attrs.id] = { energy: energy ? num(energy.attrs.value) : null, range: num(val(a, "Range")), cooldown: cd ? num(cd.attrs.TimeUse) : null };
  });
  const behaviors = {};
  read("BehaviorData").children.forEach((b) => {
    if (b.tag !== "CBehaviorBuff") return;
    const mod = kids(b, "Modification")[0], dr = kids(b, "DamageResponse")[0];
    behaviors[b.attrs.id] = { duration: num(val(b, "Duration")), speedMult: mod ? num(mod.attrs.MoveSpeedMultiplier) : null, damageFraction: dr ? num(dr.attrs.ModifyFraction) : null };
  });

  /* ---- localized names ---- */
  const names = { ko: strings(path.join(DIR, "koKR.SC2Data__LocalizedData__GameStrings.txt")), en: strings(path.join(DIR, "enUS.SC2Data__LocalizedData__GameStrings.txt")) };

  return { source, units, weapons, effects, damageOf, research, train, morph, abilities, behaviors, names, F };
};

if (require.main === module) {
  const m = module.exports(process.argv[2] || "v2.0");
  console.log("source:", m.source, "| units", Object.keys(m.units).length, "weapons", Object.keys(m.weapons).length, "effects", Object.keys(m.effects).length, "research", m.research.length, "train", m.train.length);
  const show = (id) => { const u = m.units[id]; if (!u) return console.log(id, "-"); console.log(id.padEnd(22), JSON.stringify(u.set), JSON.stringify(u.attrs), u.weapons.map((w) => w.link).join(",")); };
  ["Firebat", "Marauder", "Goliath", "Dragoon", "ScienceVessel", "Raven", "Viper", "Ravager", "InfestedAbomination", "Terrorzor", "DefilerMP", "Energizer"].forEach(show);
  ["BPM_FirebatSCBWWeapon", "GoliathG", "Dragoon", "RavasaurWeapon", "BPM_TerrorzorWeapon", "BPM_RavenWeapon", "BPM_ViperWeapon"].forEach((w) => { const x = m.weapons[w]; console.log(w.padEnd(24), x ? JSON.stringify({ r: x.range, p: x.period, e: x.effect, dmg: m.damageOf(x.effect) }) : "(not a mod weapon)"); });
  console.log("GoliathG effect:", JSON.stringify(m.effects.GoliathG));
  m.research.slice(0, 14).forEach((r) => console.log("research", JSON.stringify(r)));
  m.train.filter((t) => /BPM|Ravager|Defiler|Aberration|Tyranno/.test(t.abil + t.unit)).slice(0, 14).forEach((t) => console.log("train", JSON.stringify(t)));
}
