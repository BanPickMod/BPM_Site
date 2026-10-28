// Design-lab data builder. Run: node design-lab/build-data.js
// Merges the real site JSON into one window.BPM payload so the static mock pages work from file://.
const fs = require("fs");
const path = require("path");
const D = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", f), "utf8"));

const units = D("units.json");
const standard = D("standard_units.json");
const modified = D("modified_units.json");
const tutorials = D("tutorials.json");
const maps = D("maps.json");
const meta = D("site_meta.json");
const ptr = D("ptr_diffs.json");
const patchesOld = D("patches.json");

// ---- EN names / KO->EN glossary (lab-only; the real schema will carry both languages) ----
const glossary = [
  ["모든 피해 면역", "Immune to all damage"], ["원거리 50%, 근접 30% 감소", "Ranged -50%, melee -30%"],
  ["경장갑", "Light"], ["중장갑", "Armored"], ["기계", "Mechanical"], ["단일", "single"],
  ["회 타격", " hits"], ["2회 연속 타격, 총 40 산성 폭격", "2 hits, 40 total acid bombardment"],
  ["광역 방사", "splash"], ["대공/지상 올라운더", "Air/ground all-rounder"],
  ["업 시 8사거리", "range 8 when upgraded"], ["업그레이드", "upgrade"],
  ["방사 피해", "splash damage"], ["피격 반사 오라", "damage-reflect aura"],
  ["초", "s"], ["병영 기술실", "Barracks Tech Lab"], ["병영", "Barracks"], ["군수공장", "Factory"],
  ["우주공항", "Starport"], ["기술실", "Tech Lab"], ["무기고", "Armory"], ["필요", "required"],
  ["BPM 평타 무기", "BPM basic weapon"], ["A무빙 호신용", "A-move self-defense"],
  ["마법 지원", "Support caster"], ["전술 마법", "Tactical caster"], ["에너지", "Energy"],
  ["대형 보행 브루저", "Heavy walking bruiser"], ["장거리 고화력 공성 폭격", "Long-range siege bombardment"],
  ["장거리 중장갑 저격", "Long-range anti-armor sniper"], ["기계 특화 탱커", "Anti-mech tank"],
  ["최종 전선 파쇄 괴수", "Frontline-breaker monster"], ["공중 비행 마법", "Flying caster"],
  ["원거리 속사 소총", "Rapid-fire rifle"], ["초근접 경장갑 광역 방사 화염 타격", "Close-range flame splash"],
];
const enName = (n) => (n.match(/\(([^)]+)\)/) || [])[1] || n;
const koName = (n) => n.replace(/\s*\([^)]+\)/, "");

const unitsOut = units.map((u) => ({
  id: u.id, race: u.race, icon: "assets/icons/" + path.basename(u.icon),
  ko: koName(u.name), en: enName(u.name),
  pairKo: koName(u.pairUnit), pairEn: enName(u.pairUnit),
  buildingKo: u.building, techKo: u.techReq,
  cost: u.cost, stats: u.stats,
  diff: u.diffFromPair, upgrades: u.upgrades,
}));

// ---- Version axis. units.json is the v1.4.1 baseline; v1.4.3 overrides are from docs/v1.4.3 patch notes ----
const overrides = {
  "v1.4.3": {
    firebat: { stats: { hp: 75 } },
    aberration: { stats: { hp: 200, range: 1.75, groundDmg: "15 (+15 vs 중장갑)" }, cost: { supply: 2 } },
    guardian: { stats: { hp: 200, speed: 2.2 } },
    defiler: { cost: { gas: 200, time: 34 } },
  },
};

const versions = [
  { id: "v1.5", status: "ptr", date: null },
  { id: "v1.4.3", status: "current", date: null },
  { id: "v1.4.1", status: "previous", date: "2026-09-14" },
];

// Structured diff rows (before/after) so patch pages and wiki share one record format.
const R = (race, unit, ko, en, before, after, unitId) => ({ race, unit, ko, en, before, after, unitId });
const diffs = {
  "v1.4.3": [
    R("terran", "Firebat", "생명력", "Health", "100", "75", "firebat"),
    R("terran", "Firebat", "방어 속성", "Armor type", "중장갑", "경장갑", "firebat"),
    R("terran", "Marauder", "생명력", "Health", "125", "100"),
    R("terran", "Marauder", "방어 속성", "Armor type", "중장갑", "경장갑"),
    R("terran", "WarHound", "폭주 미사일 추가 피해", "Haywire Missile bonus damage", "30", "20", "warhound"),
    R("terran", "WarHound", "폭주 미사일 연구", "Haywire Missile research", "100/100/110초", "150/150/79초", "warhound"),
    R("terran", "Science Vessel", "이레디에이트 에너지", "Irradiate energy", "25", "75", "science_vessel"),
    R("terran", "Science Vessel", "디펜시브 매트릭스 에너지", "Defensive Matrix energy", "100", "50", "science_vessel"),
    R("terran", "Science Vessel", "디펜시브 매트릭스 범위", "Defensive Matrix radius", "1.5", "1.75", "science_vessel"),
    R("terran", "Science Vessel", "디펜시브 매트릭스 흡수량", "Defensive Matrix absorb", "16", "24", "science_vessel"),
    R("zerg", "Aberration", "생명력", "Health", "275", "200", "aberration"),
    R("zerg", "Aberration", "공격력", "Damage", "20 (+20 중장갑)", "15 (+15 중장갑)", "aberration"),
    R("zerg", "Aberration", "사거리", "Range", "1.25", "1.75", "aberration"),
    R("zerg", "Aberration", "인구수", "Supply", "3", "2", "aberration"),
    R("zerg", "Defiler", "생산 비용·시간", "Cost and build time", "50/150/40초", "50/200/34초", "defiler"),
    R("zerg", "Defiler", "다크 스웜", "Dark Swarm", "모든 피해 면역", "원거리 50%, 근접 30% 감소", "defiler"),
    R("zerg", "Guardian", "생명력", "Health", "150", "200", "guardian"),
    R("zerg", "Guardian", "이동 속도", "Speed", "1.97", "2.2", "guardian"),
  ],
};

const UKO = { Firebat: "파이어뱃", Marauder: "불곰", WarHound: "투견", "Science Vessel": "사이언스 베슬", Aberration: "변형체", Defiler: "디파일러", Guardian: "가디언" };
diffs["v1.4.3"].forEach((d) => (d.unitKo = UKO[d.unit] || d.unit));
// Hand-translated headline copy for the patch pages (KO source: docs/v1.4.3 patch notes.md, data/patches.json)
const patches = [
  {
    version: "v1.5", status: "ptr", date: null,
    titleKo: "PTR 테스트 빌드", titleEn: "PTR test build",
    sumKo: "별도 모드로 먼저 배포되는 시험 변경입니다. 확정 전 수치는 바뀔 수 있습니다.",
    sumEn: "Experimental changes shipped first as a separate mod. Values may change before they go live.",
    ptr: ptr.filter((p) => p.unitId).map((p) => ({ unitId: p.unitId, race: p.category.toLowerCase(), title: p.title, changes: p.changes })),
  },
  {
    version: "v1.4.3", status: "current", date: null,
    titleKo: "전투 역할 재정립과 스네이크 밴", titleEn: "Combat roles reworked, snake ban order",
    sumKo: "보병 전열은 초반 내구도를 낮추는 대신 연구 선택으로 화력이나 중장갑 전환을 고를 수 있습니다. 밴 순서에 스네이크 방식이 추가되고 필수 탐지·수송 유닛은 밴 풀에서 빠졌습니다.",
    sumEn: "Infantry line trades early durability for research-driven firepower or armor conversion. Snake ban order added; detection and transport units leave the ban pool.",
    highlights: [
      { ko: "스네이크 밴: 3밴은 1→2→2→1→1→2 순서", en: "Snake ban: with 3 bans the order runs 1→2→2→1→1→2" },
      { ko: "관측선·의료선·차원 분광기는 밴 풀에서 제외", en: "Observer, Medivac and Warp Prism are removed from the ban pool" },
      { ko: "편의성 모드에서 Alt 키로 밴 HUD와 생산 창을 함께 토글", en: "With Convenience Mode, Alt toggles the ban HUD and production panel together" },
      { ko: "선택하지 않은 유닛의 전용 업그레이드를 숨김", en: "Upgrades for units you did not pick are now hidden" },
    ],
    fixes: [
      { ko: "골리앗 등 일부 추가 유닛에 공업·방업이 적용되지 않던 문제 수정", en: "Fixed attack/armor upgrades not applying to Goliath and some extension units" },
      { ko: "밴픽 종료 후 타이머가 초기화되지 않던 문제 수정", en: "Fixed the draft timer not resetting after the draft ends" },
      { ko: "여왕의 점막 밖 이동 속도가 점막 위 속도로 유지되던 문제 수정", en: "Fixed Queen keeping creep speed off creep" },
    ],
    known: [
      { ko: "동력기 위상 모드 전환 시 모델이 올바르게 바뀌지 않음", en: "Energizer model does not swap correctly when entering phase mode" },
    ],
    diffs: diffs["v1.4.3"],
  },
  ...patchesOld.filter((p) => p.version === "v1.4.1").map((p) => ({ ...p, status: p.version === "v1.4.1" ? "previous" : "archive", titleKo: p.title, sumKo: p.summary })),
];
// English for v1.4.1 (the earliest version the site shows in full)
const en141 = {
  titleEn: "Convenience HUD and smart resource management",
  sumEn: "Production, research, upgrade and supply info now live on the match screen, with gas-worker auto-fill and a lobby convenience option.",
  changes: [
    "Separate army/worker supply, 12-slot production panel, 5 basic upgrade tracker",
    "Research overlay shows up to 4 projects with progress and done/cancelled state",
    "Auto-assign adjacent workers to gas from gas buildings or the main command card",
    "Lobby Convenience Mode ON/OFF option wired to map attribute 107",
    "Restored optimal mineral worker count and default game UI after match-start lock",
  ],
};
const p141 = patches.find((p) => p.version === "v1.4.1");
Object.assign(p141, { titleEn: en141.titleEn, sumEn: en141.sumEn });
p141.changes = p141.changes.map((c, i) => ({ ...c, en: en141.changes[i] }));

// News = JSON/MD later. Lab seeds it from real release records only (no invented announcements).
const news = [
  { slug: "v1-4-3", version: "v1.4.3", kind: "patch", date: null,
    ko: "v1.4.3 패치: 스네이크 밴과 전투 역할 재정립", en: "v1.4.3 patch: snake ban and combat role rework" },
  { slug: "v1-5-ptr", version: "v1.5", kind: "ptr", date: null,
    ko: "v1.5 PTR: 보급고, 용기병, 파멸충 등 시험 변경", en: "v1.5 PTR: Supply Depot, Dragoon, Defiler and more under test" },
  { slug: "v1-4-1", version: "v1.4.1", kind: "patch", date: "2026-09-14",
    ko: "v1.4.1 패치: 선택형 편의성 HUD 통합", en: "v1.4.1 patch: optional convenience HUD" },
];

// ---- Full roster from the base-game balance export (+ icon conversion, DDS -> PNG via ffmpeg) ----
const { execFileSync } = require("child_process");
const base = require("./extract-base")();
const TEX = path.join(__dirname, "..", "..", "base_balance_data_LOTV", "Assets", "Textures");
base.forEach((u) => {
  const out = path.join(__dirname, "assets", "icons", "base", u.id + ".png");
  const src = u.iconName && fs.readdirSync(TEX).find((f) => f.toLowerCase() === u.iconName.toLowerCase() + ".dds");
  if (src && !fs.existsSync(out)) { try { execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", path.join(TEX, src), "-vf", "scale=96:96", out]); } catch (e) {} }
  u.icon = fs.existsSync(out) ? "assets/icons/base/" + u.id + ".png" : null;
  delete u.iconName;
});
// documented v1.4.3 changes to base units (docs/v1.4.3 patch notes.md). Anything else needs the BPM mod XML export.
const baseOverrides = { "v1.4.3": { Marauder: { hp: 100, attrs: ["Light", "Biological"] } } };
// extension unit -> the base unit it replaces in the hidden pick
const PAIR = { firebat: "Marauder", goliath: "Thor", warhound: "SiegeTank", wraith: "VikingFighter", science_vessel: "Raven", dragoon: "Stalker", energizer: "Sentry", corsair: "Phoenix", scout: "VoidRay", reaver: "Disruptor", arbiter: "Mothership", aberration: "Roach", ravasaur: "Ravager", defiler: "Infestor", queen: "Viper", tyrannozor: "Ultralisk", guardian: "BroodLord" };
unitsOut.forEach((u) => (u.pairId = PAIR[u.id]));

const BPM = {
  base, baseOverrides,
  meta: { current: "v1.4.3", unitCount: units.length, maps: maps.length, bans: "0·1·3·5" },
  units: unitsOut, overrides, versions, patches, news, glossary,
  maps: maps.map((m) => ({ id: m.id, ko: koName(m.name), en: enName(m.name), key: m.searchKeyword, terrainKo: m.terrain, featuresKo: m.features, terrainEn: ({
    washout: "Standard 2-player map with a narrow central path and a safe natural-to-third route.",
    fear_and_faith: "2-player map with wide outer routes and highland vision points around the third base.",
    rorschach: "2-player map built for aggressive tempo and early skirmishes.",
  })[m.id] })),
  tutorials,
  standardCount: standard.length, modifiedCount: modified.length,
  draftFlow: meta.draftFlow, convenience: meta.convenienceFeatures,
};
fs.writeFileSync(path.join(__dirname, "data.js"), "window.BPM = " + JSON.stringify(BPM) + ";\n");
console.log("data.js written", Buffer.byteLength(JSON.stringify(BPM)), "bytes");
