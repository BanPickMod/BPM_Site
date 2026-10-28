// Reads the BPM research upgrades from the v2.0 mod snapshot: research building, cost, research time and the in-game
// name/tooltip (Korean strings). English text and the owning units come from curated/upgrade-meta.json.
//   node scripts/wiki/extract-upgrades.js     (prints a table)
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "source", "v2.0");
const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8");

const BUILDING = {
  LairResearch: ["군락", "Lair"], RoachWarrenResearch: ["바퀴 소굴", "Roach Warren"], BarracksTechLabResearch: ["병영 기술실", "Barracks Tech Lab"],
  FactoryTechLabResearch: ["군수공장 기술실", "Factory Tech Lab"], CyberneticsCoreResearch: ["인공제어소", "Cybernetics Core"], RoboticsBayResearch: ["로봇공학지원소", "Robotics Bay"],
  FleetBeaconResearch: ["함대 신호소", "Fleet Beacon"], StarportTechLabResearch: ["우주공항 기술실", "Starport Tech Lab"], InfestationPitResearch: ["감염 구덩이", "Infestation Pit"],
  BPM_DefilerMoundResearch: ["디파일러 언덕", "Defiler Mound"], SpawningPoolResearch: ["산란못", "Spawning Pool"], BPM_UltraliskCavernResearchTyrannozor: ["울트라리스크 동굴", "Ultralisk Cavern"],
  ArmoryResearch: ["무기고", "Armory"], TwilightCouncilResearch: ["황혼 의회", "Twilight Council"], BPM_TemplarArchiveResearch: ["기사단 문서보관소", "Templar Archives"],
};

function strings() {
  const map = {};
  for (const line of read("koKR.SC2Data__LocalizedData__GameStrings.txt").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0) map[line.slice(0, i)] = line.slice(i + 1);
  }
  return map;
}
const plain = (s) => (s || "").replace(/<n\/>/g, " ").replace(/<c val="[^"]*">/g, "").replace(/<\/c>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function extract() {
  const ko = strings();
  const abil = read("Base.SC2Data__GameData__AbilData.xml");
  const upg = read("Base.SC2Data__GameData__UpgradeData.xml");
  const out = {};
  const blockRe = /<CAbilResearch id="([^"]+)">([\s\S]*?)<\/CAbilResearch>/g;
  let b;
  while ((b = blockRe.exec(abil))) {
    const infoRe = /<InfoArray index="[^"]*"(?: Time="([\d.]+)")?[^>]*>([\s\S]*?)<\/InfoArray>/g;
    let i;
    while ((i = infoRe.exec(b[2]))) {
      const up = i[2].match(/<Upgrade value="(BPM_[^"]+)"/);
      if (!up || /^BPM_(Pick|Ban)_/.test(up[1])) continue;
      const res = (name) => { const m = i[2].match(new RegExp(`<Resource index="${name}" value="(\\d+)"`)); return m ? Number(m[1]) : 0; };
      const face = (i[2].match(/DefaultButtonFace="([^"]+)"/) || [])[1];
      const icon = (upg.match(new RegExp(`<CUpgrade id="${up[1]}">[\\s\\S]*?<Icon value="([^"]+)"`)) || [])[1] || null;
      out[up[1]] = {
        id: up[1], ability: b[1], building: BUILDING[b[1]] || null, time: i[1] ? Number(i[1]) : null, minerals: res("Minerals"), gas: res("Vespene"),
        nameKo: plain(ko["Upgrade/Name/" + up[1]] || ko["Button/Name/" + face]), tooltipKo: plain(ko["Button/Tooltip/" + face] || ko["Button/Tooltip/" + up[1]]),
        iconFile: icon ? path.basename(icon.replace(/\\/g, "/")) : null,
      };
    }
  }
  return out;
}

module.exports = extract;
if (require.main === module) {
  const all = extract();
  for (const u of Object.values(all)) console.log([u.id, u.building && u.building[0], `${u.minerals}/${u.gas}/${u.time}s`, u.nameKo, "|", u.tooltipKo, "|", u.iconFile].join("  "));
  console.log(Object.keys(all).length, "upgrades");
}
