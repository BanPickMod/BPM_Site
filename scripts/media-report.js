// `npm run media:report`. Writes docs/media-slots.md: a checklist of every media slot, what it should show, and
// whether its file is in public/media yet. Slots are defined in content/media/slots.json.
const fs = require("fs");
const path = require("path");

const SITE = path.join(__dirname, "..");
const slots = JSON.parse(fs.readFileSync(path.join(SITE, "content", "media", "slots.json"), "utf8"));
const dir = path.join(SITE, "public", "media");
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => !f.startsWith(".")) : [];
const MEDIA_EXT = /\.(png|jpe?g|webp|gif|mp4|webm)$/i;

const find = (id) => files.find((f) => MEDIA_EXT.test(f) && f.replace(MEDIA_EXT, "") === id);
const sidecar = (id) => files.includes(id + ".json");
const state = (id) => {
  if (find(id)) return "있음";
  if (sidecar(id)) return "있음 (YouTube)";
  return "비어 있음";
};

const AREAS = { home: "홈", guide: "가이드", "patch-v2.0": "패치노트 v2.0" };
const byArea = new Map();
slots.forEach((s) => byArea.set(s.area, [...(byArea.get(s.area) || []), s]));

const lines = [
  "# 미디어 슬롯 체크리스트",
  "",
  "`npm run media:report`가 만드는 파일입니다. 직접 수정하지 마세요.",
  "",
  "## 넣는 방법",
  "",
  "1. 아래 표의 **슬롯 ID**를 파일 이름으로 해서 `BPM_Site/public/media/`에 넣습니다. 예: `v2.0-effect-nuke.gif`",
  "2. 형식: `png`, `jpg`, `webp`, `gif`, `mp4`, `webm`. 파일이 있으면 다음 빌드에서 자동으로 표시되고, 없으면 아무것도 표시되지 않습니다.",
  "3. 영어 클라이언트 화면이 따로 있으면 `<슬롯 ID>.en.png`처럼 `.en`을 붙입니다. 영어 페이지에서만 그 파일을 씁니다.",
  "4. 영상의 미리보기 이미지는 `<슬롯 ID>.poster.jpg`로 넣을 수 있습니다.",
  "5. 긴 영상은 파일 대신 YouTube를 쓸 수 있습니다. `<슬롯 ID>.json` 파일에 `{\"youtube\": \"영상ID\"}`를 적습니다.",
  "6. 설명 문구를 바꾸려면 같은 JSON에 `{\"caption\": {\"ko\": \"…\", \"en\": \"…\"}}`를 적습니다.",
  "7. 개발 서버(`npm run dev`)에서는 비어 있는 슬롯이 점선 상자로 보여 위치를 확인할 수 있습니다.",
  "",
  "용량 기준: GIF는 8MB 이하, 이미지는 1MB 이하를 권장합니다. 더 큰 GIF는 `mp4`로 바꾸면 훨씬 작습니다.",
  "",
];

let have = 0;
for (const [area, list] of byArea) {
  lines.push("## " + (AREAS[area] || area), "", "| 슬롯 ID | 상태 | 무엇을 찍을지 |", "|---|---|---|");
  for (const s of list) {
    const st = state(s.id);
    if (st !== "비어 있음") have++;
    lines.push(`| \`${s.id}\` | ${st} | ${s.hint} |`);
  }
  lines.push("");
}

const known = new Set(slots.map((s) => s.id));
const stray = files.filter((f) => {
  const id = f.replace(MEDIA_EXT, "").replace(/\.json$/, "").replace(/\.(en|poster)$/, "");
  return !known.has(id);
});
if (stray.length) lines.push("## 슬롯과 이름이 맞지 않는 파일", "", ...stray.map((f) => "- `" + f + "`"), "");

fs.writeFileSync(path.join(SITE, "docs", "media-slots.md"), lines.join("\n"));
console.log("media slots: " + have + "/" + slots.length + " filled -> docs/media-slots.md" + (stray.length ? " (" + stray.length + " unmatched files)" : ""));
