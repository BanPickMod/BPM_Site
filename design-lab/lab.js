/* BPM design lab core: i18n, theme, shell per world, shared helpers. Static mock, no build step. */
(function () {
  const S = (window.SECTIONS = { landing: {}, guide: {}, wiki: {}, patches: {} });
  const B = window.BPM;
  const qs = new URLSearchParams(location.search);
  const store = {
    get(k, d) { try { return localStorage.getItem("bpmlab." + k) || d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("bpmlab." + k, v); } catch (e) {} },
  };
  const L = (window.L = {
    lang: qs.get("lang") || store.get("lang", "ko"),
    theme: qs.get("theme") || store.get("theme", "dark"),
    world: document.body.dataset.world,
    section: document.body.dataset.section,
  });

  /* ---------- helpers ---------- */
  const t = (ko, en) => (L.lang === "ko" ? ko : en);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ico = (n, cls = "") => `<i class="ph ph-${n} ${cls}" aria-hidden="true"></i>`;
  const raceName = (r) => ({ terran: t("테란", "Terran"), protoss: t("프로토스", "Protoss"), zerg: t("저그", "Zerg") }[r.toLowerCase()] || r);
  const raceGlyph = (r) => ({ terran: "T", protoss: "P", zerg: "Z" }[r.toLowerCase()]);
  const uname = (u) => (L.lang === "ko" ? u.ko : u.en);
  const upair = (u) => (L.lang === "ko" ? u.pairKo : u.pairEn);
  // KO -> EN glossary for stat strings. Real data will carry both languages.
  const tr = (s) => {
    if (L.lang === "ko" || typeof s !== "string") return s;
    let o = s;
    B.glossary.forEach(([k, v]) => (o = o.split(k).join(v)));
    return o.replace(/\s+/g, " ");
  };
  const num = (s) => { const m = String(s).replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
  const delta = (a, b) => {
    const x = num(a), y = num(b);
    if (x === null || y === null || /[\/%]/.test(a + b) || /[가-힣]/.test(a + b)) return { dir: "text", label: t("변경", "Changed") };
    const d = +(y - x).toFixed(2);
    if (d === 0) return { dir: "flat", label: "0" };
    return { dir: d > 0 ? "up" : "down", label: (d > 0 ? "+" : "") + d };
  };
  const unitAt = (u, ver) => {
    const o = (B.overrides[ver] || {})[u.id] || {};
    const stats = { ...u.stats, ...(o.stats || {}) };
    const cost = { ...u.cost, ...(o.cost || {}) };
    const changed = {};
    Object.keys(o.stats || {}).forEach((k) => { if (u.stats[k] !== o.stats[k]) changed[k] = u.stats[k]; });
    Object.keys(o.cost || {}).forEach((k) => { if (u.cost[k] !== o.cost[k]) changed["c_" + k] = u.cost[k]; });
    return { stats, cost, changed };
  };
  const verLabel = (v) => ({ "v1.5": t("PTR", "PTR"), "v1.4.3": t("현재", "Current"), "v1.4.1": t("직전", "Previous") }[v] || "");
  const fmtDate = (d) => d || t("날짜 미정", "Date TBD");
  const dunit = (d) => (L.lang === "ko" ? d.unitKo || d.unit : d.unit);
  window.H = { dunit, S, B, L, t, esc, ico, raceName, raceGlyph, uname, upair, tr, num, delta, unitAt, verLabel, fmtDate, store };

  /* ---------- shell ---------- */
  const NAV = [
    { id: "landing", href: (w) => `landing-${w}.html`, ko: "홈", en: "Home", icon: "house" },
    { id: "news", href: (w) => `landing-${w}.html#news`, ko: "뉴스", en: "News", icon: "newspaper" },
    { id: "guide", href: (w) => `guide-${w}.html`, ko: "가이드", en: "Guide", icon: "compass" },
    { id: "wiki", href: (w) => `wiki-${w}.html`, ko: "위키", en: "Wiki", icon: "database" },
    { id: "patches", href: (w) => `patches-${w}.html`, ko: "패치", en: "Patches", icon: "git-diff" },
  ];
  const SOON = [
    { ko: "래더", en: "Ladder" }, { ko: "대회", en: "Tournaments" },
    { ko: "버그 리포트", en: "Bug report" }, { ko: "AI", en: "AI" },
  ];
  const controls = () => `
    <div class="ctl">
      <button class="ctl-btn" data-act="lang" aria-label="${t("언어 전환", "Switch language")}">${L.lang === "ko" ? "EN" : "KO"}</button>
      <button class="ctl-btn" data-act="theme" aria-label="${t("테마 전환", "Switch theme")}" aria-pressed="${L.theme === "light"}">
        ${ico(L.theme === "dark" ? "sun" : "moon")}<span class="ctl-lbl">${L.theme === "dark" ? t("라이트", "Light") : t("다크", "Dark")}</span>
      </button>
    </div>`;
  const brand = (w) => {
    if (w === "1") return `<a class="brand" href="landing-1.html"><span class="brand-mark">BPM</span><span class="brand-sub">BanPickMod</span></a>`;
    if (w === "2") return `<a class="brand" href="landing-2.html"><span class="brand-mark">BPM</span><span class="brand-sub">${t("BanPickMod 공식 자료", "BanPickMod reference")}</span></a>`;
    return `<a class="brand" href="landing-${w}.html"><span class="brand-mark">BAN<i>/</i>PICK</span></a>`;
  };
  function shell(w, section, inner) {
    const active = location.hash === "#news" ? "news" : section;
    const links = NAV.map((n) => `<a class="nav-a${n.id === active ? " is-on" : ""}" href="${n.href(w)}" ${n.id === active ? 'aria-current="page"' : ""}>${w === "1" ? ico(n.icon) : ""}<span>${t(n.ko, n.en)}</span></a>`).join("");
    const soon = SOON.map((n) => `<span class="nav-a is-soon" title="${t("준비 중", "Coming soon")}"><span>${t(n.ko, n.en)}</span></span>`).join("");
    const mix = [["landing", t("랜딩", "Landing")], ["guide", t("가이드", "Guide")], ["wiki", t("위키", "Wiki")], ["patches", t("패치", "Patches")]].map(([id, l]) => `<a href="${id}-4.html" class="mixl ${id === section && w === "4" ? "on" : ""}">${l}</a>`).join("");
    const lab = w === "4" ? `<span class="lab-grp"><b>Mix</b>${mix}</span>` : [["landing", t("랜딩", "Landing")], ["guide", t("가이드", "Guide")], ["wiki", t("위키", "Wiki")], ["patches", t("패치", "Patches")]]
      .map(([id, lbl]) => `<span class="lab-grp"><b>${lbl}</b>${[1, 2, 3].map((n) => `<a href="${id}-${n}.html" class="${id === section && String(n) === w ? "on" : ""}">${n}</a>`).join("")}</span>`).join("") + `<span class="lab-grp"><b>Mix</b><a href="landing-4.html" class="mixl">${t("믹스", "Mix")}</a></span>`;
    return `
    <div class="site" data-world="${w}">
      <a class="skip" href="#main">${t("본문으로 건너뛰기", "Skip to content")}</a>
      <header class="top">
        ${brand(w)}
        <nav class="nav" aria-label="${t("주 메뉴", "Primary")}">${links}<span class="nav-sep"></span>${soon}</nav>
        ${controls()}
      </header>
      <main id="main" class="main">${inner}</main>
      <footer class="foot">
        <div class="foot-in"><span>BanPickMod</span><span>${t("StarCraft II 커스텀 모드 비공식 정보 사이트", "Unofficial info site for a StarCraft II custom mod")}</span></div>
      </footer>
    </div>
    <div class="labbar" role="navigation" aria-label="Design lab">
      <a class="lab-hub" href="index.html">${ico("squares-four")}<span>Lab</span></a>${lab}
    </div>`;
  }

  /* ---------- boot / rerender ---------- */
  function render() {
    document.documentElement.lang = L.lang;
    document.documentElement.dataset.theme = L.theme;
    const sec = S[L.section][L.world];
    const y = window.scrollY;
    const view = sec();
    document.getElementById("app").innerHTML = shell(L.world, L.section, view.html);
    document.title = `BPM Lab · ${L.section} ${L.world}`;
    document.querySelectorAll("[data-act=lang]").forEach((b) => b.addEventListener("click", () => { L.lang = L.lang === "ko" ? "en" : "ko"; store.set("lang", L.lang); render(); }));
    document.querySelectorAll("[data-act=theme]").forEach((b) => b.addEventListener("click", () => { L.theme = L.theme === "dark" ? "light" : "dark"; store.set("theme", L.theme); document.documentElement.dataset.theme = L.theme; render(); }));
    view.mount && view.mount(document.getElementById("app"));
    const hid = decodeURIComponent(location.hash.slice(1)); const he = hid && document.getElementById(hid);
    if (he) he.scrollIntoView(); else window.scrollTo(0, y);
  }
  L.rerender = render;
  window.addEventListener("hashchange", render);
  window.addEventListener("DOMContentLoaded", render);
})();
