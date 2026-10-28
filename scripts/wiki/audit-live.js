// Compares the wiki data (data/generated/wiki.json, v2.0) with values read from a running game
// (scripts/wiki/live/live-v2.0.json, written by bpm-ai-engine/scripts/wiki_live_dump.py) and writes
// docs/reports/wiki_live_audit.md.
//   node scripts/wiki/audit-live.js
// Build time is not compared: the game reports it unreliably for morphs and queued units.
// The game reports speed and weapon cooldown in "normal" seconds; the wiki uses Faster seconds (x1.4).
const fs = require("fs");
const path = require("path");

const SITE = path.join(__dirname, "..", "..");
const live = JSON.parse(fs.readFileSync(path.join(__dirname, "live", "live-v2.0.json"), "utf8")).units;
const wiki = JSON.parse(fs.readFileSync(path.join(SITE, "data", "generated", "wiki.json"), "utf8"));
const VER = "v2.0";
const FASTER = 1.4;
const LOOPS = 22.4;

const src = fs.readFileSync(path.join(__dirname, "build-wiki-data.js"), "utf8");
const EXT_MOD = eval("(" + src.match(/const EXT_MOD = (\{[^}]*\})/)[1] + ")");

const ATTR = { 1: "Light", 2: "Armored", 3: "Biological", 4: "Mechanical", 5: "Robotic", 6: "Psionic", 7: "Massive", 8: "Structure", 9: "Hover", 10: "Heroic", 11: "Summoned" };
const TARGET = { 1: "ground", 2: "air", 3: "any" };
const round = (v, d = 2) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d);
const same = (a, b, tol = 0.011) => a === null || b === null || a === undefined || b === undefined || Math.abs(a - b) <= tol;

const rows = [];
const add = (unit, field, wikiVal, gameVal, note = "") => rows.push({ unit, field, wikiVal, gameVal, note });

function check(id, kind, name, block, gameName) {
  const g = live[gameName];
  if (!g || !g.live) { add(name, "(게임 데이터 없음)", "", ""); return; }
  const p = g.proto, l = g.live;
  const eq = (field, w, v, tol) => { if (!same(w, v, tol)) add(name, field, w, v); };
  eq("생명력", block.hp, round(l.health_max));
  eq("보호막", block.shields, round(l.shield_max));
  eq("방어력", block.armor, round(p.armor));
  eq("이동 속도", block.speed, round(p.speed * FASTER, 2), 0.02);
  eq("시야", block.sight, round(l.sight));
  eq("반경", block.radius, round(l.radius, 3), 0.001);
  eq("광물", block.cost.minerals, p.minerals);
  eq("가스", block.cost.gas, p.gas);
  eq("인구", block.cost.supply, p.supply);
  // attributes
  const attrs = p.attributes.map((a) => ATTR[a]).filter(Boolean).sort();
  if (block.attrs) {
    const wa = [...block.attrs].sort();
    if (JSON.stringify(wa) !== JSON.stringify(attrs)) add(name, "속성", wa.join("/"), attrs.join("/"));
  } else add(name, "속성", "(위키에 없음)", attrs.join("/"), "채울 값");
  // weapons: compare by order of damage-bearing weapons
  const gw = p.weapons;
  const ww = block.weapons || [];
  if (ww.length !== gw.length && gw.length) add(name, "무기 수", ww.length, gw.length);
  gw.forEach((w, i) => {
    const x = ww[i];
    if (!x) return;
    eq(`무기${i + 1} 피해`, x.dmg, round(w.damage));
    eq(`무기${i + 1} 사거리`, x.range, round(w.range));
    eq(`무기${i + 1} 쿨다운`, x.cd, round(w.cooldown / FASTER, 2), 0.02);
    eq(`무기${i + 1} 타격 수`, x.count, w.attacks);
    const wb = (x.bonus || []).map((b) => `${b.type}+${b.dmg}`).sort().join(",");
    const gb = w.bonus.map((b) => `${ATTR[b.attribute]}+${round(b.bonus)}`).sort().join(",");
    if (wb !== gb) add(name, `무기${i + 1} 보너스`, wb || "-", gb || "-");
    const gt = TARGET[w.type];
    if (x.targets && gt && x.targets !== gt) add(name, `무기${i + 1} 대상`, x.targets, gt);
  });
}

for (const b of wiki.base) check(b.id, "base", `${b.ko} (${b.id})`, b.v[VER], b.id);
for (const u of wiki.units) check(u.id, "ext", `${u.ko} (${u.en})`, u.v[VER], EXT_MOD[u.id]);

const byUnit = new Map();
for (const r of rows) (byUnit.get(r.unit) || byUnit.set(r.unit, []).get(r.unit)).push(r);

const out = [
  "# 위키 데이터와 실제 게임 값 대조 (v2.0)",
  "",
  "`wiki_live_dump.py`로 BPM_AI_Rel_Test(release 기준 모드)를 실제로 띄워 읽은 값과 위키 데이터를 유닛 74종 전수 비교했습니다. 업그레이드 효과가 섞이지 않게 연구는 하지 않았고, 이동 속도와 쿨다운은 게임의 일반 속도 값에 1.4를 곱해 비교했습니다.",
  "",
  `불일치 ${rows.length}건, 유닛 ${byUnit.size}종 (전체 ${wiki.base.length + wiki.units.length}종).`,
  "",
  "| 유닛 | 항목 | 위키 | 실제 게임 | 비고 |",
  "|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.unit} | ${r.field} | ${r.wikiVal} | ${r.gameVal} | ${r.note} |`),
  "",
].join("\n");
const dest = path.join(SITE, "docs", "reports", "wiki_live_audit.md");
fs.writeFileSync(dest, out);
console.log(`live audit: ${rows.length} mismatches in ${byUnit.size} units -> docs/reports/wiki_live_audit.md`);
const tally = {};
for (const r of rows) tally[r.field.replace(/무기\d/, "무기")] = (tally[r.field.replace(/무기\d/, "무기")] || 0) + 1;
console.log(JSON.stringify(tally));
