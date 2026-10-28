// Generates the 12 variant pages + index hub. Run: node design-lab/build-pages.js
const fs = require("fs");
const path = require("path");
const W = { 1: "console", 2: "manual", 3: "arena", 4: "arena" };
const FONTS = {
  1: "family=Chakra+Petch:wght@500;600;700&family=JetBrains+Mono:wght@400;600;700",
  2: "family=Bricolage+Grotesque:opsz,wght@12..96,700;800&family=JetBrains+Mono:wght@400;600;700",
  3: "family=Big+Shoulders+Display:wght@700;800;900&family=JetBrains+Mono:wght@400;600;700",
  4: "family=Big+Shoulders+Display:wght@700;800;900&family=JetBrains+Mono:wght@400;600;700",
};
const sections = ["landing", "guide", "wiki", "patches"];
const page = (sec, w) => `<!doctype html>
<html lang="ko" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BPM Lab · ${sec} ${w}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${FONTS[w]}&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
<link rel="stylesheet" href="base.css">
<link rel="stylesheet" href="shared.css">
<link rel="stylesheet" href="${W[w]}.css">${w === 4 ? `
<link rel="stylesheet" href="hybrid.css">` : ""}
</head>
<body data-world="${w}" data-section="${sec}">
<div id="app"></div>
<script src="data.js"></script>
<script src="lab.js"></script>
${sec === "guide" ? `<script src="draft.js"></script>
` : ""}<script src="${sec}.js"></script>${sec === "wiki" ? `
<script src="wiki4.js"></script>` : ""}
</body>
</html>
`;
// Order: base, shared, then the world so the world can override.
sections.forEach((s) => [1, 2, 3, 4].forEach((w) => fs.writeFileSync(path.join(__dirname, `${s}-${w}.html`), page(s, w))));

const info = {
  landing: [
    ["Console", "HUD 안에서 직접 밴을 눌러 보는 드래프트 콘솔이 첫 화면. 왼쪽 레일 내비게이션."],
    ["Field Manual", "거대한 BAN PICK 워드마크 + 현재 빌드 스펙시트 + 통합 검색. 자료실 같은 첫인상."],
    ["Arena", "중계 화면 같은 무대. 밴 도장이 찍히는 드래프트 재생, 사선 패널, 마키 1개."],
  ],
  guide: [
    ["Configurator", "옵션을 고르면 그 조합의 방 만들기 순서와 대기실 미리보기가 즉시 생성."],
    ["Procedure doc", "고정 목차 + 번호 절차 + 옵션 요약표. 읽고 따라 하는 문서."],
    ["Wizard", "전장, 밴, 추가 옵션 순서로 한 화면에 한 질문. 마지막에 내 순서 복사."],
  ],
  wiki: [
    ["Matrix + dock", "모든 열이 펼쳐진 표 + 우측 고정 상세 패널. 직전 버전과 값 비교."],
    ["Datasheet", "종족별 마스터 표, 최대 4개 비교, CSV 내보내기, 행 펼침 상세."],
    ["Roster + versus", "카드 월 / 표 전환, 두 유닛 VS 막대 비교, 우측 서랍 프로필."],
  ],
  patches: [
    ["Version rail", "왼쪽 버전 레일 + 종족별 변경 목록, 이전값 → 새값 칩."],
    ["Changelog table", "버전·종족·유닛 필터가 있는 이전/이후/Δ 표. 위키로 바로 연결."],
    ["Match recap", "큰 버전 숫자와 핵심 변경 4개를 상단에, 아래에 전체 변경."],
  ],
};
const sTitle = { landing: "랜딩 · 뉴스", guide: "가이드", wiki: "위키", patches: "패치 내역" };
const index = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>BPM Design Lab</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
:root{color-scheme:dark light;--bg:#101012;--panel:#18181b;--line:#2c2c31;--text:#ececf0;--mute:#9a9aa5;--acc:#7aa2ff}
@media (prefers-color-scheme:light){:root{--bg:#f3f3f5;--panel:#fff;--line:#d8d8de;--text:#16161a;--mute:#5d5d68;--acc:#2250e0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 "Pretendard Variable",Pretendard,system-ui,sans-serif;word-break:keep-all}
.w{width:min(100% - 32px,1400px);margin:0 auto;padding:40px 0 80px}h1{font-size:2rem;margin:0 0 6px}h2{font-size:1.25rem;margin:0}
p{margin:0;color:var(--mute)}.sec{margin-top:44px}.sec>header{display:flex;justify-content:space-between;align-items:baseline;gap:12px;border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:16px}
.row{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.row.r4{grid-template-columns:repeat(4,1fr)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;display:grid}
.shot{position:relative;aspect-ratio:16/10;overflow:hidden;background:#000;border-bottom:1px solid var(--line)}
.shot iframe{position:absolute;left:0;top:0;width:1440px;height:900px;border:0;transform-origin:0 0;pointer-events:none}
.shot a{position:absolute;inset:0;z-index:2}
.meta{padding:14px 16px;display:grid;gap:4px}.meta b{font-size:1rem}.meta .n{color:var(--acc);font-weight:700;margin-right:6px}
.meta a{color:var(--acc);font-weight:600;margin-top:6px;display:inline-block}
.note{margin-top:14px;padding:14px 16px;background:var(--panel);border:1px solid var(--line);border-radius:10px;font-size:.92rem}
@media (max-width:1100px){.row.r4{grid-template-columns:repeat(2,1fr)}}@media (max-width:900px){.row,.row.r4{grid-template-columns:1fr}}
</style></head><body><div class="w">
<h1>BPM Design Lab</h1>
<p>섹션마다 3가지 시안입니다. 시안 번호는 같은 월드(1 Console, 2 Field Manual, 3 Arena)라서 한 월드로 쭉 둘러볼 수도, 섹션별로 섞어 고를 수도 있습니다. 각 시안에서 다크/라이트와 KO/EN 전환을 시험해 보세요.</p>
<div class="note">미리보기 썸네일은 실제 페이지(다크 기본)를 축소해서 보여줍니다. 폰트와 아이콘은 CDN을 사용하므로 인터넷 연결이 필요합니다.</div>
${`<section class="sec"><header><h2>2차 · 믹스 (랜딩 1+3, 가이드 2+3, 위키 3, 패치 2+3)</h2></header><div class="row r4">${[["landing","랜딩 · 뉴스","1+3","Arena 무대 + Console 패널. 드래프트 재생은 빠지고 정적 로스터 보드로 대체."],["guide","가이드","2+3","고정 목차 문서 안에 로비 세팅 위저드와 드래프트 체험(밴 + 히든 픽 연습)을 통합."],["wiki","위키","3","로스터 카드 월, VS 비교, 서랍형 프로필. 카드 보기에서는 열 버튼 숨김."],["patches","패치 내역","2+3","큰 버전 헤더와 핵심 변경 4개 + 필터 가능한 이전/이후/Δ 표."]].map(([s,n,mix,d]) => `<div class="card"><div class="shot"><iframe src="${s}-4.html" loading="lazy" tabindex="-1" title="${s} 4"></iframe><a href="${s}-4.html" aria-label="${s} 4"></a></div><div class="meta"><b><span class="n">${mix}</span>${n}</b><p>${d}</p><a href="${s}-4.html">열기</a></div></div>`).join("")}</div></section>`}
${sections.map((s) => `<section class="sec"><header><h2>1차 · ${sTitle[s]}</h2></header><div class="row">${info[s].map(([n, d], i) => `<div class="card"><div class="shot"><iframe src="${s}-${i + 1}.html" loading="lazy" tabindex="-1" title="${s} ${i + 1}" data-scale></iframe><a href="${s}-${i + 1}.html" aria-label="${s} ${i + 1}"></a></div><div class="meta"><b><span class="n">${i + 1}</span>${n}</b><p>${d}</p><a href="${s}-${i + 1}.html">열기</a></div></div>`).join("")}</div></section>`).join("")}
</div>
<script>
function fit(){document.querySelectorAll('.shot').forEach(function(s){var f=s.querySelector('iframe');f.style.transform='scale('+(s.clientWidth/1440)+')';});}
addEventListener('resize',fit);addEventListener('load',fit);fit();
</script></body></html>
`;
fs.writeFileSync(path.join(__dirname, "index.html"), index);
console.log("pages written");
