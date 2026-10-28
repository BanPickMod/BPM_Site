// Parses the base-game balance export (base_balance_data_LOTV/*.xml) into a normalized unit table.
// Values are converted from "normal" game seconds to "Faster" (x1.4), the way players read them in-game.
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "..", "..", "base_balance_data_LOTV");
const F = 1.4;

function parseXml(src) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const re = /<(\/?)([\w:-]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(src))) {
    const [, close, tag, rawAttrs, self] = m;
    if (close) { stack.pop(); continue; }
    const attrs = {};
    rawAttrs.replace(/([\w:-]+)="([^"]*)"/g, (_, k, v) => (attrs[k] = v));
    const node = { tag, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!self) stack.push(node);
  }
  return root.children[0];
}
const kids = (n, tag) => (n ? n.children.filter((c) => c.tag === tag) : []);
const kid = (n, tag) => kids(n, tag)[0];
const num = (v, d = null) => (v === undefined || v === "" ? d : parseFloat(v));
const r2 = (x) => (x === null ? null : Math.round(x * 100) / 100);

// id, race, KO name, EN name, group
const ROSTER = [
  ["SCV", "terran", "SCV", "SCV", "worker"], ["Marine", "terran", "해병", "Marine", "ground"], ["Marauder", "terran", "불곰", "Marauder", "ground"],
  ["Reaper", "terran", "화염기갑병", "Reaper", "ground"], ["Ghost", "terran", "유령", "Ghost", "ground"], ["Hellion", "terran", "화염차", "Hellion", "ground"],
  ["HellionTank", "terran", "헬바트", "Hellbat", "ground"], ["WidowMine", "terran", "땅거미 지뢰", "Widow Mine", "ground"], ["Cyclone", "terran", "사이클론", "Cyclone", "ground"],
  ["SiegeTank", "terran", "공성전차", "Siege Tank", "ground"], ["SiegeTankSieged", "terran", "공성전차 (공성 모드)", "Siege Tank (Sieged)", "mode"],
  ["Thor", "terran", "토르", "Thor", "ground"], ["ThorAP", "terran", "토르 (고폭 모드)", "Thor (High Impact)", "mode"],
  ["VikingFighter", "terran", "바이킹", "Viking", "air"], ["VikingAssault", "terran", "바이킹 (착륙)", "Viking (Landed)", "mode"],
  ["Medivac", "terran", "의료선", "Medivac", "air"], ["Liberator", "terran", "해방선", "Liberator", "air"], ["LiberatorAG", "terran", "해방선 (수호기 모드)", "Liberator (Defender)", "mode"],
  ["Banshee", "terran", "밴시", "Banshee", "air"], ["Raven", "terran", "밤까마귀", "Raven", "air"], ["Battlecruiser", "terran", "전투순양함", "Battlecruiser", "air"],
  ["Probe", "protoss", "탐사정", "Probe", "worker"], ["Zealot", "protoss", "광전사", "Zealot", "ground"], ["Stalker", "protoss", "추적자", "Stalker", "ground"],
  ["Sentry", "protoss", "파수기", "Sentry", "ground"], ["Adept", "protoss", "사도", "Adept", "ground"], ["HighTemplar", "protoss", "고위 기사", "High Templar", "ground"],
  ["DarkTemplar", "protoss", "암흑 기사", "Dark Templar", "ground"], ["Archon", "protoss", "집정관", "Archon", "ground"], ["Immortal", "protoss", "불멸자", "Immortal", "ground"],
  ["Colossus", "protoss", "거신", "Colossus", "ground"], ["Disruptor", "protoss", "분열기", "Disruptor", "ground"], ["Observer", "protoss", "관측선", "Observer", "air"],
  ["WarpPrism", "protoss", "차원 분광기", "Warp Prism", "air"], ["Phoenix", "protoss", "불사조", "Phoenix", "air"], ["VoidRay", "protoss", "공허 포격기", "Void Ray", "air"],
  ["Oracle", "protoss", "예언자", "Oracle", "air"], ["Tempest", "protoss", "폭풍함", "Tempest", "air"], ["Carrier", "protoss", "우주모함", "Carrier", "air"], ["Mothership", "protoss", "모선", "Mothership", "air"],
  ["Drone", "zerg", "일벌레", "Drone", "worker"], ["Zergling", "zerg", "저글링", "Zergling", "ground"], ["Baneling", "zerg", "맹독충", "Baneling", "ground"],
  ["Roach", "zerg", "바퀴", "Roach", "ground"], ["Ravager", "zerg", "궤멸충", "Ravager", "ground"], ["Hydralisk", "zerg", "히드라리스크", "Hydralisk", "ground"],
  ["LurkerMP", "zerg", "가시지옥", "Lurker", "ground"], ["Infestor", "zerg", "감염충", "Infestor", "ground"], ["SwarmHostMP", "zerg", "군단 숙주", "Swarm Host", "ground"],
  ["Ultralisk", "zerg", "울트라리스크", "Ultralisk", "ground"], ["Queen", "zerg", "여왕", "Queen", "ground"], ["Overlord", "zerg", "대군주", "Overlord", "air"],
  ["Overseer", "zerg", "감시군주", "Overseer", "air"], ["Mutalisk", "zerg", "뮤탈리스크", "Mutalisk", "air"], ["Corruptor", "zerg", "타락귀", "Corruptor", "air"],
  ["BroodLord", "zerg", "무리 군주", "Brood Lord", "air"], ["Viper", "zerg", "살모사", "Viper", "air"],
];
const split = (s) => s.replace(/([a-z])([A-Z])/g, "$1 $2");

function unitFrom(id, race, ko, en, group) {
  const file = path.join(DIR, id + ".xml");
  const u = parseXml(fs.readFileSync(file, "utf8"));
  const life = kid(u, "life") || { attrs: {} }, sh = kid(u, "shields"), ar = kid(u, "armor"), sar = kid(u, "shieldArmor"), cost = kid(u, "cost");
  const mv = kid(u, "movement"), misc = kid(u, "misc"), en_ = kid(u, "energy"), prod = kid(u, "producer");
  const attrs = kids(kid(u, "attributes"), "attribute").map((a) => a.attrs.type);
  const req = kids(kid(u, "requires"), "unit").map((a) => a.attrs.id);
  const weapons = kids(kid(u, "weapons"), "weapon").map((w) => {
    const m = kid(w, "misc"), e = kid(w, "effect");
    if (!m || !e) return null;
    const count = num(m.attrs.count, 1), cd = num(m.attrs.speed) / F, dmg = num(e.attrs.damage, 0);
    const bonus = kids(e, "bonus").map((b) => ({ type: b.attrs.type, dmg: num(b.attrs.damage), max: num(b.attrs.max) }));
    const best = dmg + Math.max(0, ...bonus.map((b) => b.dmg));
    return {
      id: split(w.attrs.id), targets: m.attrs.targets, range: num(m.attrs.range), cd: r2(cd), count, dmg, max: num(e.attrs.max), splash: num(e.attrs.radius) > 0 ? num(e.attrs.radius) : null,
      bonus, dps: cd > 0 ? r2((dmg * count) / cd) : null, dpsBonus: cd > 0 && bonus.length ? r2((best * count) / cd) : null,
    };
  }).filter(Boolean);
  // abilities that carry a cost, cooldown or range are the numbers a player compares
  const abilities = [];
  kids(kid(u, "abilities"), "ability").forEach((a) => kids(a, "command").forEach((c) => {
    const cc = kid(c, "cost"), mm = kid(c, "misc");
    if (!cc && !(mm && num(mm.attrs.range, 0) > 1)) return;
    if (/^(Stop|Execute|Cancel|Move|Patrol|HoldPos)$/.test(c.attrs.id)) return;
    abilities.push({ id: split(c.attrs.id), energy: cc ? num(cc.attrs.energy) : null, minerals: cc ? num(cc.attrs.minerals) : null, gas: cc ? num(cc.attrs.vespene) : null, cd: cc && cc.attrs.cooldown ? r2(num(cc.attrs.cooldown) / F) : null, time: cc && cc.attrs.time ? r2(num(cc.attrs.time) / F) : null, range: mm ? num(mm.attrs.range) : null });
  }));
  return {
    id, race, ko, en, group, src: "base", iconName: kid(u, "meta") ? kid(u, "meta").attrs.icon : null,
    hp: num(life.attrs.max), shields: sh ? num(sh.attrs.max) : 0, armor: num(ar.attrs.start, 0), shieldArmor: sar ? num(sar.attrs.start, 0) : 0,
    energy: en_ ? { start: num(en_.attrs.start), max: num(en_.attrs.max) } : null,
    cost: cost ? { minerals: num(cost.attrs.minerals, 0), gas: num(cost.attrs.vespene, 0), supply: Math.abs(num(misc && misc.attrs.supply, 0)) || num(cost.attrs.supply, 0), time: cost.attrs.time ? Math.round(num(cost.attrs.time) / F) : null } : null,
    speed: mv ? r2(num(mv.attrs.speed) * F) : null, move: mv ? mv.attrs.type : null, sight: misc ? num(misc.attrs.sightRadius) : null, radius: misc ? num(misc.attrs.radius) : null, cargo: misc ? num(misc.attrs.cargoSize, 0) : 0,
    attrs, producer: prod ? split(prod.attrs.id) : null, requires: req.map(split), weapons, abilities,
  };
}
module.exports = () => ROSTER.map((r) => unitFrom(...r));
if (require.main === module) {
  const out = module.exports();
  console.log(out.length, "units");
  const std = require("../data/standard_units.json");
  const idmap = { siege_tank: "SiegeTank", thor: "Thor", viking: "VikingFighter", raven: "Raven", marine: "Marine", marauder: "Marauder", reaper: "Reaper", ghost: "Ghost", zealot: "Zealot", stalker: "Stalker", sentry: "Sentry", colossus: "Colossus", disruptor: "Disruptor", phoenix: "Phoenix", zergling: "Zergling", roach: "Roach", ravager: "Ravager", infestor: "Infestor", viper: "Viper" };
  for (const s of std) {
    const b = out.find((x) => x.id === idmap[s.id]);
    if (!b) { console.log("no base for", s.id); continue; }
    const diffs = [];
    const chk = (n, a, c) => { if (a !== c) diffs.push(`${n}: json=${a} base=${c}`); };
    chk("hp", s.stats.hp, b.hp); chk("armor", s.stats.armor, b.armor); chk("speed", s.stats.speed, b.speed); chk("range", s.stats.range, b.weapons[0] && b.weapons[0].range);
    chk("min", s.cost.minerals, b.cost.minerals); chk("gas", s.cost.gas, b.cost.gas); chk("sup", s.cost.supply, b.cost.supply); chk("time", s.cost.time, b.cost.time);
    console.log(s.id.padEnd(11), diffs.join(" | ") || "same");
  }
}
