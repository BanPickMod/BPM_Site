/* Patches: 3 variants. 1 = Console (version rail + race tabs), 2 = Manual (changelog table + filters), 3 = Arena (match-recap board) */
(function () {
  const { dunit, S, B, tr, t, esc, ico, raceName, raceGlyph, delta, fmtDate, verLabel, uname } = window.H;
  const st = { ver: "v1.4.3", race: "all", q: "" };
  const hashInit = () => { const h = decodeURIComponent(location.hash.slice(1)); if (B.patches.find((p) => p.version === h)) st.ver = h; };
  const P = (v) => B.patches.find((p) => p.version === v);
  const title = (p) => t(p.titleKo, p.titleEn || p.titleKo);
  const sum = (p) => t(p.sumKo, p.sumEn || p.sumKo);
  const verBtn = (p, cls) => `<button class="${cls} ${st.ver === p.version ? "on" : ""}" data-ver="${p.version}" aria-pressed="${st.ver === p.version}"><b class="mono">${esc(p.version)}</b><span>${esc(verLabel(p.version) || t("이전", "Earlier"))}</span></button>`;
  const dchip = (b, a) => { const x = delta(b, a); return `<span class="diff ${x.dir}">${x.dir === "up" ? ico("arrow-up") : x.dir === "down" ? ico("arrow-down") : ico("arrows-left-right")}${esc(x.label)}</span>`; };
  const filt = (p) => (p.diffs || []).filter((d) => (st.race === "all" || d.race === st.race) && (!st.q || (d.unit + d.ko + d.en).toLowerCase().includes(st.q.toLowerCase())));
  const raceSeg = () => `<div class="seg" role="group" aria-label="${t("종족", "Race")}">${["all", "terran", "protoss", "zerg"].map((r) => `<button data-race="${r}" aria-pressed="${st.race === r}">${r === "all" ? t("전체", "All") : raceName(r)}</button>`).join("")}</div>`;
  const bind = (root, redraw) => {
    root.querySelectorAll("[data-ver]").forEach((b) => b.addEventListener("click", () => { st.ver = b.dataset.ver; history.replaceState(null, "", "#" + st.ver); redraw(); }));
    root.querySelectorAll("[data-race]").forEach((b) => b.addEventListener("click", () => { st.race = b.dataset.race; redraw(); }));
  };
  /* body for versions that have no structured diffs: v1.4.1/older use categorized lines, v1.5 uses PTR groups */
  const legacyBody = (p, cls) => `<ul class="${cls}">${p.changes.map((c) => `<li><span class="tagc">${esc(c.tag)}</span><span class="cat">${esc(c.category)}</span><p>${esc(t(c.text, c.en || c.text))}</p></li>`).join("")}</ul>`;
  const ptrBody = (p, cls) => ["terran", "protoss", "zerg"].map((r) => {
    const g = p.ptr.filter((x) => x.race === r);
    if (!g.length || (st.race !== "all" && st.race !== r)) return "";
    return `<section class="${cls}-race"><h3>${raceName(r)}</h3>${g.map((x) => `<article class="${cls}-ptr"><h4>${esc(x.title)}</h4><ul>${x.changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></article>`).join("")}</section>`;
  }).join("");
  const hlFix = (p) => `${p.highlights ? `<div class="pcols"><div><h3>${t("주요 변경", "Highlights")}</h3><ul class="bul">${p.highlights.map((h) => `<li>${esc(t(h.ko, h.en))}</li>`).join("")}</ul></div>
    <div><h3>${t("버그 수정", "Fixes")}</h3><ul class="bul">${p.fixes.map((h) => `<li>${esc(t(h.ko, h.en))}</li>`).join("")}</ul>
    <h3>${t("알려진 문제", "Known issues")}</h3><ul class="bul">${p.known.map((h) => `<li>${esc(t(h.ko, h.en))}</li>`).join("")}</ul></div></div>` : ""}`;
  const diffCards = (rows) => ["terran", "protoss", "zerg"].map((r) => { const g = rows.filter((d) => d.race === r); return g.length ? `<section class="drace ${r}"><h3><span class="rtag ${r}">${raceGlyph(r)}</span>${raceName(r)}</h3><ul>${g.map((d) => `<li><span class="du">${esc(dunit(d))}</span><span class="di">${esc(t(d.ko, d.en))}</span><span class="dv"><s class="mono">${esc(tr(d.before))}</s>${ico("arrow-right")}<b class="mono">${esc(tr(d.after))}</b></span>${dchip(d.before, d.after)}</li>`).join("")}</ul></section>` : ""; }).join("") || `<p class="empty">${t("조건에 맞는 변경이 없습니다.", "No changes match the filter.")}</p>`;

  /* ============ 1. CONSOLE ============ */
  S.patches[1] = () => {
    hashInit();
    return {
      html: `<section class="wrap p1"><header class="pg-h"><h1 class="h1">${t("패치 내역", "Patch history")}</h1></header>
        <div class="p1-grid"><nav class="p1-rail" aria-label="${t("버전", "Versions")}">${B.patches.map((p) => verBtn(p, "p1-v")).join("")}</nav><div class="p1-body" data-body></div></div></section>`,
      mount(root) {
        const body = root.querySelector("[data-body]"), rail = root.querySelector(".p1-rail");
        const draw = () => {
          const p = P(st.ver);
          rail.innerHTML = B.patches.map((x) => verBtn(x, "p1-v")).join("");
          body.innerHTML = `<div class="p1-head bracket"><div class="p1-vt"><span class="pill mono">${esc(p.version)}</span><span class="mute">${esc(fmtDate(p.date))}</span></div><h2 class="p1-title">${esc(title(p))}</h2><p class="lede">${esc(sum(p))}</p></div>
            ${p.diffs ? `${hlFix(p)}<div class="p1-filter"><h3>${t("수치 변경", "Value changes")}</h3>${raceSeg()}</div><div class="dlist">${diffCards(filt(p))}</div>` : p.ptr ? `<div class="p1-filter"><h3>${t("시험 중인 변경", "Changes under test")}</h3>${raceSeg()}</div>${ptrBody(p, "p1")}` : `<h3>${t("변경 사항", "Changes")}</h3>${legacyBody(p, "legacy")}`}`;
          bind(body, draw); bind(rail, draw);
        };
        draw();
      },
    };
  };

  /* ============ 2. MANUAL ============ */
  S.patches[2] = () => {
    hashInit();
    return {
      html: `<section class="wrap p2"><header class="pg-h"><h1 class="h1">${t("변경 내역", "Changelog")}</h1><p class="lede">${t("모든 수치 변경을 이전 값과 이후 값으로 정리한 표입니다.", "Every value change as a before and after table.")}</p></header>
        <div class="p2-bar" data-bar></div><div data-body></div></section>`,
      mount(root) {
        const bar = root.querySelector("[data-bar]"), body = root.querySelector("[data-body]");
        const rest = () => {
          const p = P(st.ver);
          body.innerHTML = `<article class="p2-art" id="${p.version}"><header><h2 class="h2"><span class="mono">${esc(p.version)}</span>&nbsp; ${esc(title(p))}</h2><p class="mute">${esc(fmtDate(p.date))} · ${verLabel(p.version) || t("이전", "Earlier")}</p><p class="lede">${esc(sum(p))}</p></header>
            ${p.diffs ? `${hlFix(p)}<h3>${t("수치 변경표", "Value changes")}</h3><div class="tscroll"><table class="tbl p2-tbl"><thead><tr><th>${t("종족", "Race")}</th><th>${t("대상", "Unit")}</th><th>${t("항목", "Item")}</th><th>${t("이전", "Before")}</th><th>${t("이후", "After")}</th><th>Δ</th></tr></thead><tbody>${filt(p).map((d) => `<tr><td><span class="rtag ${d.race}">${raceGlyph(d.race)}</span></td><td>${d.unitId ? `<a class="lnk" href="wiki-2.html#${d.unitId}">${esc(dunit(d))}</a>` : esc(dunit(d))}</td><td>${esc(t(d.ko, d.en))}</td><td class="mono mute">${esc(tr(d.before))}</td><td class="mono"><b>${esc(tr(d.after))}</b></td><td>${dchip(d.before, d.after)}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">${t("조건에 맞는 변경이 없습니다.", "No changes match the filter.")}</td></tr>`}</tbody></table></div>`
              : p.ptr ? ptrBody(p, "p2") : legacyBody(p, "legacy")}</article>`;
        };
        const draw = () => {
          bar.innerHTML = `<div class="seg" role="group" aria-label="${t("버전", "Version")}">${B.patches.map((p) => `<button data-ver="${p.version}" aria-pressed="${st.ver === p.version}">${esc(p.version)}</button>`).join("")}</div>${raceSeg()}<div class="wsearch">${ico("magnifying-glass")}<input class="inp" type="search" data-q value="${esc(st.q)}" placeholder="${t("유닛 또는 항목 검색", "Filter by unit or item")}" aria-label="${t("필터", "Filter")}"></div>`;
          bind(bar, draw); const q = bar.querySelector("[data-q]"); q.addEventListener("input", () => { st.q = q.value; rest(); }); rest();
        };
        draw();
      },
    };
  };

  /* ============ 3. ARENA ============ */
  S.patches[3] = () => {
    hashInit();
    return {
      html: `<section class="wrap p3"><div class="p3-tabs" data-tabs></div><div data-body></div></section>`,
      mount(root) {
        const tabs = root.querySelector("[data-tabs]"), body = root.querySelector("[data-body]");
        const draw = () => {
          const p = P(st.ver);
          tabs.innerHTML = B.patches.map((x) => verBtn(x, "p3-v")).join("");
          const top = (p.diffs || []).filter((d) => ["Health", "Range", "Supply", "Speed"].includes(d.en)).slice(0, 4);
          body.innerHTML = `<header class="p3-hero"><span class="mono p3-ver">${esc(p.version)}</span><h1>${esc(title(p))}</h1><p>${esc(sum(p))}</p><span class="mute">${esc(fmtDate(p.date))}</span></header>
            ${top.length ? `<div class="p3-top">${top.map((d) => `<div class="p3-t ${d.race}"><b>${esc(dunit(d))}</b><span>${esc(t(d.ko, d.en))}</span><div class="p3-v2"><s class="mono">${esc(tr(d.before))}</s><i></i><strong class="mono">${esc(tr(d.after))}</strong></div></div>`).join("")}</div>` : ""}
            ${p.diffs ? `${hlFix(p)}<div class="p1-filter"><h2 class="h2">${t("전체 변경", "All changes")}</h2>${raceSeg()}</div><div class="dlist">${diffCards(filt(p))}</div>` : p.ptr ? `<div class="p1-filter"><h2 class="h2">${t("시험 중인 변경", "Changes under test")}</h2>${raceSeg()}</div>${ptrBody(p, "p3")}` : legacyBody(p, "legacy")}`;
          bind(body, draw); bind(tabs, draw);
        };
        draw();
      },
    };
  };

  /* ============ 4. MIX: recap header + per-unit cards (default) or the filterable table ============ */
  const pv = { view: "cards" };
  const iconFor = (d) => {
    const e = d.unitId && B.units.find((u) => u.id === d.unitId);
    if (e) return e.icon;
    const b = B.base.find((u) => u.en.toLowerCase() === String(d.unit || d.title || "").toLowerCase().split(" (")[0]);
    return b ? b.icon : null;
  };
  const ptrIcon = (g) => {
    const e = B.units.find((u) => u.id === g.unitId); if (e) return e.icon;
    const b = B.base.find((u) => u.id.toLowerCase() === g.unitId.replace(/_/g, "").toLowerCase()); if (b) return b.icon;
    return "assets/icons/" + g.unitId.replace(/_/g, "-") + ".png";
  };
  const cardIcon = (src, race) => (src ? `<img src="${src}" alt="" width="56" height="56" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'rtag ${race} big',textContent:'${raceGlyph(race)}'}))">` : `<span class="rtag ${race} big">${raceGlyph(race)}</span>`);
  const unitCards = (p) => {
    const by = new Map();
    filt(p).forEach((d) => { const k = d.unit; if (!by.has(k)) by.set(k, { d, rows: [] }); by.get(k).rows.push(d); });
    const cards = [...by.values()].map(({ d, rows }) => `<article class="ucard ${d.race}"><header>${cardIcon(iconFor(d), d.race)}<div><h3>${esc(dunit(d))}</h3><span class="mute">${raceName(d.race)}</span></div><span class="ucnt mono">${rows.length}</span></header>
      <ul>${rows.map((x) => `<li><span class="ui">${esc(t(x.ko, x.en))}</span><span class="uv"><s class="mono">${esc(tr(x.before))}</s>${ico("arrow-right")}<b class="mono">${esc(tr(x.after))}</b></span>${dchip(x.before, x.after)}</li>`).join("")}</ul>
      ${d.unitId ? `<a class="lnk" href="wiki-4.html#${d.unitId}">${t("위키에서 보기", "Open in wiki")}${ico("arrow-right")}</a>` : `<a class="lnk" href="wiki-4.html#${(B.base.find((b) => b.en === d.unit) || {}).id || ""}">${t("위키에서 보기", "Open in wiki")}${ico("arrow-right")}</a>`}</article>`).join("");
    return cards ? `<div class="ucards">${cards}</div>` : `<p class="empty">${t("조건에 맞는 변경이 없습니다.", "No changes match the filter.")}</p>`;
  };
  const ptrCards = (p) => {
    const gs = p.ptr.filter((g) => (st.race === "all" || g.race === st.race) && (!st.q || g.title.toLowerCase().includes(st.q.toLowerCase())));
    return gs.length ? `<div class="ucards">${gs.map((g) => `<article class="ucard ${g.race}"><header>${cardIcon(ptrIcon(g), g.race)}<div><h3>${esc(g.title)}</h3><span class="mute">${raceName(g.race)} · PTR</span></div><span class="ucnt mono">${g.changes.length}</span></header><ul class="plain">${g.changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></article>`).join("")}</div>` : `<p class="empty">${t("조건에 맞는 변경이 없습니다.", "No changes match the filter.")}</p>`;
  };
  const legacyCards = (p) => {
    const by = new Map();
    p.changes.forEach((c) => { if (!by.has(c.category)) by.set(c.category, []); by.get(c.category).push(c); });
    return `<div class="ucards">${[...by.entries()].map(([cat, cs]) => `<article class="ucard sys"><header><span class="rtag big sysg">${ico("gear-six")}</span><div><h3>${esc(cat)}</h3></div><span class="ucnt mono">${cs.length}</span></header><ul class="plain">${cs.map((c) => `<li><span class="mono mute">${esc(c.tag)}</span> ${esc(t(c.text, c.en || c.text))}</li>`).join("")}</ul></article>`).join("")}</div>`;
  };
  S.patches[4] = () => {
    hashInit();
    return {
      html: `<section class="wrap p3 p4"><div class="p3-tabs" data-tabs></div><div data-body></div></section>`,
      mount(root) {
        const tabs = root.querySelector("[data-tabs]"), body = root.querySelector("[data-body]");
        const draw = () => {
          const p = P(st.ver);
          tabs.innerHTML = B.patches.map((x) => verBtn(x, "p3-v")).join("");
          const top = (p.diffs || []).filter((d) => ["Health", "Range", "Supply", "Speed"].includes(d.en)).slice(0, 4);
          const toolbar = `<div class="p4-tools">${raceSeg()}<div class="seg" role="group" aria-label="${t("보기", "View")}"><button data-pview="cards" aria-pressed="${pv.view === "cards"}">${ico("squares-four")}${t("유닛별 카드", "Unit cards")}</button><button data-pview="table" aria-pressed="${pv.view === "table"}">${ico("table")}${t("변경표", "Table")}</button></div><div class="wsearch">${ico("magnifying-glass")}<input class="inp" type="search" data-q value="${esc(st.q)}" placeholder="${t("유닛 또는 항목 검색", "Filter by unit or item")}" aria-label="${t("필터", "Filter")}"></div></div>`;
          const sec = p.diffs ? `${hlFix(p)}<div class="p1-filter"><h2 class="h2">${t("유닛별 변경", "Changes by unit")}</h2>${toolbar}</div><div data-list></div>`
            : p.ptr ? `<div class="p1-filter"><h2 class="h2">${t("시험 중인 변경", "Changes under test")}</h2>${toolbar}</div><div data-list></div>`
            : `<div class="p1-filter"><h2 class="h2">${t("변경 사항", "Changes")}</h2></div><div data-list></div>`;
          body.innerHTML = `<header class="p3-hero"><span class="mono p3-ver">${esc(p.version)}</span><h1>${esc(title(p))}</h1><p>${esc(sum(p))}</p><span class="mute">${esc(fmtDate(p.date))}</span></header>
            ${top.length ? `<div class="p3-top">${top.map((d) => `<div class="p3-t ${d.race}"><b>${esc(dunit(d))}</b><span>${esc(t(d.ko, d.en))}</span><div class="p3-v2"><s class="mono">${esc(tr(d.before))}</s><i></i><strong class="mono">${esc(tr(d.after))}</strong></div></div>`).join("")}</div>` : ""}${sec}`;
          const list = body.querySelector("[data-list]");
          const fill = () => {
            if (p.diffs) {
              if (pv.view === "cards") list.innerHTML = unitCards(p);
              else list.innerHTML = `<div class="tscroll"><table class="tbl p2-tbl"><thead><tr><th>${t("종족", "Race")}</th><th>${t("대상", "Unit")}</th><th>${t("항목", "Item")}</th><th>${t("이전", "Before")}</th><th>${t("이후", "After")}</th><th>Δ</th></tr></thead><tbody>${filt(p).map((d) => `<tr><td><span class="rtag ${d.race}">${raceGlyph(d.race)}</span></td><td>${esc(dunit(d))}</td><td>${esc(t(d.ko, d.en))}</td><td class="mono mute">${esc(tr(d.before))}</td><td class="mono"><b>${esc(tr(d.after))}</b></td><td>${dchip(d.before, d.after)}</td></tr>`).join("") || `<tr><td colspan="6" class="empty">${t("조건에 맞는 변경이 없습니다.", "No changes match the filter.")}</td></tr>`}</tbody></table></div>`;
            } else if (p.ptr) list.innerHTML = ptrCards(p);
            else list.innerHTML = legacyCards(p);
          };
          fill();
          const q = body.querySelector("[data-q]"); q && q.addEventListener("input", () => { st.q = q.value; fill(); });
          body.querySelectorAll("[data-pview]").forEach((b) => b.addEventListener("click", () => { pv.view = b.dataset.pview; draw(); }));
          bind(body, draw); bind(tabs, draw);
        };
        draw();
      },
    };
  };
})();
