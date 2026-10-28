// Compares the hand-curated unit text (curated/units.json) with the v2.0 mod XML values and writes
// docs/reports/wiki_curated_audit.md. Run after build-wiki-data.js.
//   node scripts/wiki/audit-curated.js
const fs = require("fs");
const path = require("path");

const SITE = path.join(__dirname, "..", "..");
const curated = JSON.parse(fs.readFileSync(path.join(__dirname, "curated", "units.json"), "utf8"));
const wiki = JSON.parse(fs.readFileSync(path.join(SITE, "data", "generated", "wiki.json"), "utf8"));
const VER = "v2.0";

const rows = [];
const review = [];
let mismatches = 0;

for (const c of curated) {
  const u = wiki.units.find((x) => x.id === c.id);
  const x = u && u.v[VER];
  if (!x) { rows.push(`| ${c.id} | (XML에 없음) |  |  |  |`); continue; }
  const checks = [
    ["생명력", c.stats.hp, x.hp, x.prov.hp],
    ["보호막", c.stats.shields, x.shields, x.prov.shields],
    ["방어력", c.stats.armor, x.armor, x.prov.armor],
    ["이동 속도", c.stats.speed, x.speed, x.prov.speed],
    ["사거리", c.stats.range, x.weapons && x.weapons.length ? Math.max(...x.weapons.map((w) => w.range ?? 0)) : null, x.prov.weapons],
    ["광물", c.cost.minerals, x.cost.minerals, x.prov["cost.minerals"]],
    ["가스", c.cost.gas, x.cost.gas, x.prov["cost.gas"]],
    ["인구", c.cost.supply, x.cost.supply, x.prov["cost.supply"]],
    ["생산 시간", c.cost.time, x.cost.time, x.prov["cost.time"]],
  ];
  for (const [label, was, now, src] of checks) {
    if (now === null || now === undefined) continue;
    if (src !== "mod" && src !== "partial") continue;
    if (Number(was) !== Number(now)) { mismatches++; rows.push(`| ${c.name} | ${label} | ${was} | ${now} | ${src} |`); }
  }
  for (const w of x.weapons || []) {
    if (w.src !== "mod") continue;
    const bonus = w.bonus.map((b) => `+${b.dmg} ${b.type}`).join(", ") || "-";
    review.push(`- **${c.name}** 무기 \`${w.id}\`: 피해 ${w.dmg}${w.count > 1 ? `×${w.count}` : ""} (${bonus}), 쿨다운 ${w.cd}, 사거리 ${w.range} / 수동 텍스트: "${c.stats.groundDmg}" 공중 "${c.stats.airDmg}"`);
  }
  for (const d of c.diffFromPair) review.push(`  - 차이 [${d.item}] 기본: ${d.pair} → 모드: ${d.unit}`);
  for (const g of c.upgrades) review.push(`  - 업그레이드 ${g.name} (${g.cost}, ${g.building}): ${g.statDiff}`);
}

const out = [
  "# 위키 수동 정리 값 대조 (v2.0 XML 기준)",
  "",
  "`scripts/wiki/curated/units.json`의 수치를 v2.0 모드 XML에서 읽은 값과 비교했습니다. XML 값이 위키 표에 쓰이고, 수동 텍스트는 상세 패널의 무기 문구, 기본 유닛과의 차이, 업그레이드에 쓰입니다.",
  "",
  `## 수치 불일치 (${mismatches}건)`,
  "",
  "| 유닛 | 항목 | 수동 값 | XML 값 | 출처 |",
  "|---|---|---|---|---|",
  ...rows,
  "",
  "## 문구 검수 목록",
  "",
  "XML과 비교한 무기 정보 옆에 수동 문구를 나란히 둡니다. 숫자가 다르면 수동 문구를 고쳐야 합니다.",
  "",
  ...review,
  "",
].join("\n");
const dest = path.join(SITE, "docs", "reports", "wiki_curated_audit.md");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log(`audit: ${mismatches} numeric mismatches -> ${path.relative(SITE, dest)}`);
