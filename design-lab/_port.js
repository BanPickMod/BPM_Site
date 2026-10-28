// One-off: ports the "Mix" (world 4) design into ui-prototype/website. Run from design-lab: node _port.js
const fs = require("fs");
const path = require("path");
const SRC = __dirname;
const DST = path.join(__dirname, "..", "..", "ui-prototype", "website");
const rd = (f) => fs.readFileSync(path.join(SRC, f), "utf8");
const wr = (f, s) => { const p = path.join(DST, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const cut = (s, from, to) => { const a = s.indexOf(from), b = s.indexOf(to); if (a < 0 || b < 0 || b < a) throw new Error("marker missing: " + from + " / " + to); return s.slice(0, a) + s.slice(b); };

/* ---- data + assets ---- */
fs.copyFileSync(path.join(SRC, "..", "data", "ptr_diffs.json"), path.join(DST, "data", "ptr_diffs.json"));
["supply-depot.png", "reactor-techlab.png"].forEach((f) => { const d = path.join(DST, "assets", "images", "icons", f); if (!fs.existsSync(d)) fs.copyFileSync(path.join(SRC, "assets", "icons", f), d); });

/* ---- build tools (kept in the site so data.js can be regenerated) ---- */
let ex = rd("extract-base.js").replace('path.join(__dirname, "..", "..", "base_balance_data_LOTV")', 'path.join(__dirname, "..", "..", "..", "base_balance_data_LOTV")');
ex = ex.slice(0, ex.indexOf("if (require.main === module)")) + 'if (require.main === module) console.log(module.exports().length, "units parsed");\n';
wr("tools/extract-base.js", ex);
let bd = rd("build-data.js")
  .replace('const std', "const std")
  .replace('"assets/icons/" + path.basename(u.icon)', '"assets/images/icons/" + path.basename(u.icon)')
  .replace('path.join(__dirname, "..", "..", "base_balance_data_LOTV", "Assets", "Textures")', 'path.join(__dirname, "..", "..", "..", "base_balance_data_LOTV", "Assets", "Textures")')
  .replace('path.join(__dirname, "assets", "icons", "base", u.id + ".png")', 'path.join(__dirname, "..", "assets", "images", "icons", "base", u.id + ".png")')
  .replace('"assets/icons/base/" + u.id + ".png"', '"assets/images/icons/base/" + u.id + ".png"')
  .replace('fs.writeFileSync(path.join(__dirname, "data.js")', 'fs.mkdirSync(path.join(__dirname, "..", "assets", "js"), { recursive: true });\nfs.mkdirSync(path.join(__dirname, "..", "assets", "images", "icons", "base"), { recursive: true });\nfs.writeFileSync(path.join(__dirname, "..", "assets", "js", "data.js")')
  .replace("// Design-lab data builder. Run: node design-lab/build-data.js", "// Site data builder. Run: node tools/build-data.js (needs ffmpeg for the base-game icons)");
// the icon dir must exist before icons are converted
bd = bd.replace("const base = require(\"./extract-base\")();", 'fs.mkdirSync(path.join(__dirname, "..", "assets", "images", "icons", "base"), { recursive: true });\nconst base = require("./extract-base")();');
wr("tools/build-data.js", bd);

/* ---- css: one stylesheet ---- */
const css = ["base.css", "shared.css", "arena.css", "hybrid.css"].map(rd).join("\n").replace(/\/\* lab bar[\s\S]*?\.main\{min-height:60vh;padding-bottom:80px\}/, ".main{min-height:60vh;padding-bottom:80px}").replace(/\.lab-grp a\.mixl\{[^}]*\}\n?/, "");
wr("assets/css/site.css", "/* BPM site. Arena stage base + Console bracket panels + Field Manual document and table rigor. */\n" + css);

/* ---- js ---- */
let core = rd("lab.js");
core = core
  .replace(/bpmlab\./g, "bpm.")
  .replace(/world: document\.body\.dataset\.world,/, 'world: "4",')
  .replace(/\{ id: "landing", href: \(w\) => `landing-\$\{w\}\.html`/, '{ id: "landing", href: () => "index.html"')
  .replace(/href: \(w\) => `landing-\$\{w\}\.html#news`/, 'href: () => "index.html#news"')
  .replace(/href: \(w\) => `guide-\$\{w\}\.html`/, 'href: () => "guide.html"')
  .replace(/href: \(w\) => `wiki-\$\{w\}\.html`/, 'href: () => "wiki.html"')
  .replace(/href: \(w\) => `patches-\$\{w\}\.html`/, 'href: () => "patches.html"');
core = cut(core, "  const brand = (w) => {", "  function shell(w, section, inner) {") .replace("  function shell(w, section, inner) {", '  const brand = () => `<a class="brand" href="index.html" aria-label="BPM"><span class="brand-mark">BAN<i>/</i>PICK</span></a>`;\n  function shell(w, section, inner) {');
core = cut(core, "    const mix = [[", "    return `\n    <div class=\"site\"");
core = core.replace('${w === "1" ? ico(n.icon) : ""}', "")
  .replace("${brand(w)}", "${brand()}")
  .replace(/<footer class="foot">[\s\S]*?<\/footer>/, `<footer class="foot">
        <div class="foot-in"><div><b>StarCraft II: BanPickMod</b><br><small>\${t("비영리 팬 제작 프로젝트", "Non-profit fan project")}</small></div><span>\${t("StarCraft II는 Blizzard Entertainment, Inc.의 등록 상표입니다.", "StarCraft II is a registered trademark of Blizzard Entertainment, Inc.")}</span><a class="lnk" href="https://github.com/BanPickMod/BanPickMod" target="_blank" rel="noopener noreferrer">GitHub</a></div>
      </footer>`)
  .replace(/\n    <div class="labbar"[\s\S]*?<\/div>`;/, "`;")
  .replace("document.title = `BPM Lab · ${L.section} ${L.world}`;", "document.title = { landing: \"BPM · StarCraft II BanPick Mod\", guide: t(\"가이드\", \"Guide\") + \" · BPM\", wiki: t(\"유닛 위키\", \"Unit wiki\") + \" · BPM\", patches: t(\"패치 내역\", \"Patch history\") + \" · BPM\" }[L.section];");
wr("assets/js/site.js", core);

let landing = rd("landing.js");
landing = cut(landing, "  /* Draft demo shared by 1 and 3 */", "  /* ============ 4. MIX");
landing = landing.replace(/wiki-4\.html/g, "wiki.html").replace(/guide-4\.html/g, "guide.html").replace(/patches-4\.html/g, "patches.html").replace("newsRows(4,", "newsRows(").replace(/const newsRows = \(w, cls\) =>/, "const newsRows = (w, cls) =>");
landing = landing.replace(/href="patches-\$\{w\}\.html#/, 'href="patches.html#').replace('<section class="l4-patch wrap">', '<section class="l4-patch wrap" id="updates">').replace(/S\.landing\[4\]/, "S.landing[4]");
// the draft demo is gone from the landing: drop the now-unused helpers that referenced it
wr("assets/js/landing.js", landing);

let guide = rd("guide.js");
guide = cut(guide, "  /* ============ 1. CONSOLE: configurator", "  /* ============ 2. MANUAL");
wr("assets/js/guide.js", guide);

wr("assets/js/draft.js", rd("draft.js"));
wr("assets/js/wiki.js", rd("wiki.js").replace(/guide-3|wiki-3|wiki-2/g, "wiki"));
wr("assets/js/wiki4.js", rd("wiki4.js"));
wr("assets/js/patches.js", rd("patches.js").replace(/wiki-4\.html/g, "wiki.html").replace(/wiki-2\.html/g, "wiki.html").replace('"assets/icons/" + g.unitId', '"assets/images/icons/" + g.unitId'));

/* ---- pages ---- */
const FONTS = "family=Big+Shoulders+Display:wght@700;800;900&family=JetBrains+Mono:wght@400;600;700";
const page = (file, sec, extra) => `<!doctype html>
<html lang="ko" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#07080f">
<meta name="description" content="스타크래프트 II 밴픽 모드 BPM: 밴·히든 픽 규칙, 로비 가이드, 전체 유닛 밸런스 위키, 버전별 패치 내역">
<title>BPM · StarCraft II BanPick Mod</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${FONTS}&display=swap">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
<link rel="stylesheet" href="assets/css/site.css">
</head>
<body data-world="4" data-section="${sec}">
<div id="app"></div>
<noscript><p style="padding:24px">이 사이트는 JavaScript가 필요합니다. / This site needs JavaScript.</p></noscript>
<script src="assets/js/data.js"></script>
<script src="assets/js/site.js"></script>
${extra.map((s) => `<script src="assets/js/${s}.js"></script>`).join("\n")}
</body>
</html>
`;
wr("index.html", page("index.html", "landing", ["landing"]));
wr("guide.html", page("guide.html", "guide", ["draft", "guide"]));
wr("wiki.html", page("wiki.html", "wiki", ["wiki", "wiki4"]));
wr("patches.html", page("patches.html", "patches", ["patches"]));
for (const f of ["app.js"]) { const p = path.join(DST, f); if (fs.existsSync(p)) fs.unlinkSync(p); }
console.log("ported");
