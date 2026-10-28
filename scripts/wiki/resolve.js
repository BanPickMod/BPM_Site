// Builds per-version value blocks for every unit the wiki shows.
//   base unit : base-game balance export  <- mod XML values (current / previous build)
//   BPM unit  : hand-curated units.json   <- mod XML values (current / previous build)
// Each block records `prov[field]` = "mod" (the mod XML sets it), "base" (base-game export) or "curated" (units.json),
// so the site can show which numbers are authoritative and which are inherited from dependencies the XML does not contain.
const F = 1.4;
const r2 = (x) => (x === null || x === undefined ? null : Math.round(x * 100) / 100);

function targetsOf(filters, fallback) {
  if (!filters) return fallback || null;
  const inc = filters.split(";")[0];
  const g = /Ground/.test(inc), a = /Air/.test(inc);
  return g && a ? "any" : g ? "ground" : a ? "air" : fallback || null;
}
function finishWeapon(w) {
  const cd = w.cd, count = w.count || 1, dmg = w.dmg;
  const best = dmg === null || dmg === undefined ? null : dmg + Math.max(0, ...w.bonus.map((b) => b.dmg || 0));
  return { ...w, dps: cd && dmg !== null && dmg !== undefined ? r2((dmg * count) / cd) : null, dpsBonus: cd && best !== null && w.bonus.length ? r2((best * count) / cd) : null };
}

// rebuild one weapon from the mod definition, falling back to whatever base data exists for the same id
function weaponFromMod(link, M, baseW, curatedRange) {
  const mw = M.weapons[link];
  // the damage effect is usually reached through the weapon, but the mod also overrides effects that share the weapon's id
  const own = M.effects[link] && M.effects[link].type === "CEffectDamage" ? { effect: link, amount: M.effects[link].amount, bonus: M.effects[link].bonus } : null;
  const dmgInfo = (mw ? M.damageOf(mw.effect) : null) || own;
  const eff = baseW && baseW.effectId && M.effects[baseW.effectId] ? M.effects[baseW.effectId] : null;
  const range = mw && mw.range !== null ? mw.range : baseW ? baseW.range : curatedRange ?? null;
  const cd = mw && mw.period !== null ? r2(mw.period / F) : baseW ? baseW.cd : null;
  const dmg = dmgInfo && dmgInfo.amount !== null ? dmgInfo.amount : eff && eff.amount !== null ? eff.amount : baseW ? baseW.dmg : null;
  const bonus = dmgInfo && dmgInfo.bonus.length ? dmgInfo.bonus.map((b) => ({ type: b.type, dmg: b.amount, max: b.amount })) : eff && eff.bonus.length ? eff.bonus.map((b) => ({ type: b.type, dmg: b.amount, max: b.amount })) : baseW ? baseW.bonus : [];
  return finishWeapon({
    id: (baseW && baseW.id) || link.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^BPM_/, ""), rawId: link, nameKo: baseW ? baseW.nameKo || null : null, targets: targetsOf(mw && mw.targets, baseW && baseW.targets), range, cd, count: baseW ? baseW.count : 1, dmg, max: baseW ? baseW.max : null,
    splash: baseW ? baseW.splash : null, bonus,
    complete: range !== null && cd !== null && dmg !== null, src: mw || dmgInfo ? "mod" : "base",
  });
}

// apply a mod unit's explicit fields over a block
function overlay(block, mu, M, unitId) {
  const prov = block.prov;
  const put = (k, v, target = block) => { target[k] = v; prov[k] = "mod"; };
  if (mu) {
    const s = mu.set;
    ["hp", "shields", "armor", "shieldArmor", "speed", "sight", "radius", "cargo"].forEach((k) => { if (s[k] !== undefined) put(k, s[k]); });
    if (s.energyMax !== undefined) { block.energy = { start: block.energy ? block.energy.start : null, max: s.energyMax }; prov.energy = "mod"; }
    ["minerals", "gas", "supply"].forEach((k) => { if (s[k] !== undefined) { block.cost = { ...block.cost, [k]: s[k] }; prov["cost." + k] = "mod"; } });
    const flags = Object.entries(mu.attrs);
    if (flags.length) {
      const set = new Set(block.attrs || []);
      flags.forEach(([t, on]) => (on ? set.add(t) : set.delete(t)));
      block.attrs = [...set]; prov.attrs = "mod";
    }
  }
  // build / morph time as the mod sets it (raw game seconds -> Faster seconds)
  const morphKey = "MorphTo" + unitId;
  const tr = M.train.filter((t) => t.unit === unitId && t.time !== null);
  if (M.morph[morphKey] !== undefined) { block.cost = { ...block.cost, time: Math.round(M.morph[morphKey] / F) }; prov["cost.time"] = "mod"; block.timeKind = "morph"; }
  else if (tr.length) { block.cost = { ...block.cost, time: Math.round(tr[0].time / F) }; prov["cost.time"] = "mod"; }
}

function resolveBase(u, M) {
  const block = {
    hp: u.hp, shields: u.shields, armor: u.armor, shieldArmor: u.shieldArmor, energy: u.energy, speed: u.speed, sight: u.sight, radius: u.radius, cargo: u.cargo,
    cost: u.cost ? { ...u.cost } : { minerals: null, gas: null, supply: null, time: null }, attrs: [...u.attrs], producer: u.producer, requires: u.requires, move: u.move,
    weapons: u.weapons.map((w) => ({ ...w })), abilities: u.abilities, prov: {},
  };
  const mu = M.units[u.id];
  overlay(block, mu, M, u.id);
  const links = mu ? mu.weapons.filter((w) => w.link !== "None" && !/@/.test(w.link)) : [];
  if (links.length) {
    block.weapons = links.map((l) => weaponFromMod(l.link, M, u.weapons.find((w) => w.rawId === l.link) || null, null)).filter((w) => w.dmg !== null || w.range !== null);
    block.prov.weapons = "mod";
  } else {
    // no weapon list in the mod: keep base weapons but let mod weapon/effect entries with the same ids override the numbers
    let touched = false;
    block.weapons = block.weapons.map((w) => {
      const mw = M.weapons[w.rawId], me = M.effects[w.effectId];
      if (!mw && !(me && (me.amount !== null || me.bonus.length))) return w;
      touched = true;
      return weaponFromMod(w.rawId, M, w, null);
    });
    if (touched) block.prov.weapons = "mod";
  }
  Object.keys(block).forEach((k) => { if (k !== "prov" && !block.prov[k] && !/^cost$/.test(k)) block.prov[k] = block.prov[k] || "base"; });
  return block;
}

function resolveExt(e, modId, M) {
  const s = e.stats, c = e.cost;
  const block = {
    hp: s.hp, shields: s.shields, armor: s.armor, shieldArmor: null, energy: null, speed: s.speed, sight: null, radius: null, cargo: null,
    cost: { ...c }, attrs: null, producer: e.buildingKo, requires: [e.techKo], move: null, weapons: null,
    text: { ground: s.groundDmg, air: s.airDmg, role: s.damageType, range: s.range }, abilities: null, prov: {},
  };
  const mu = M.units[modId];
  overlay(block, mu, M, modId);
  let links = mu ? mu.weapons.filter((w) => w.link !== "None" && !/@/.test(w.link)) : [];
  if (!links.length && M.weapons[modId]) links = [{ link: modId }];
  if (links.length) {
    const ws = links.map((l) => weaponFromMod(l.link, M, null, s.range)).filter((w) => w.dmg !== null || w.range !== null);
    if (ws.length) { block.weapons = ws; block.prov.weapons = ws.every((w) => w.complete) ? "mod" : "partial"; }
  }
  const missing = [];
  ["hp", "shields", "armor", "speed", "sight"].forEach((k) => { if (!block.prov[k]) block.prov[k] = "curated"; });
  return block;
}

module.exports = { resolveBase, resolveExt, finishWeapon };
