/* Wiki: 3 variants. 1 = Console (matrix + docked panel), 2 = Manual (datasheet + compare + CSV), 3 = Arena (roster cards + versus + drawer) */
(function () {
  const { S, B, L, t, esc, ico, raceName, raceGlyph, uname, upair, tr, unitAt } = window.H;
  const st = { ver: "v1.4.3", race: "all", q: "", grp: { tech: true, cost: true, combat: true }, sel: null, cmp: [], view: "cards", versus: [], drawer: null };
  const hashInit = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    if (["terran", "protoss", "zerg"].includes(h)) st.race = h;
    else if (B.units.find((u) => u.id === h)) st.sel = h;
  };

  const COLS = [
    { k: "name", g: "id", ko: "유닛", en: "Unit", get: (u) => `<span class="uc"><img class="uico" src="${u.icon}" alt="" width="28" height="28"><b>${esc(uname(u))}</b></span>` },
    { k: "race", g: "id", ko: "종족", en: "Race", get: (u) => `<span class="rtag ${u.race}" title="${raceName(u.race)}">${raceGlyph(u.race)}</span>` },
    { k: "pair", g: "tech", ko: "대응 기본 유닛", en: "Paired base unit", get: (u) => esc(upair(u)) },
    { k: "bld", g: "tech", ko: "생산 건물", en: "Built at", get: (u) => esc(tr(u.buildingKo)) },
    { k: "req", g: "tech", ko: "기술 요구", en: "Tech required", get: (u) => esc(tr(u.techKo)) },
    { k: "c_minerals", g: "cost", n: 1, ko: "광물", en: "Minerals", raw: (x) => x.cost.minerals },
    { k: "c_gas", g: "cost", n: 1, ko: "가스", en: "Gas", raw: (x) => x.cost.gas },
    { k: "c_supply", g: "cost", n: 1, ko: "인구수", en: "Supply", raw: (x) => x.cost.supply },
    { k: "c_time", g: "cost", n: 1, ko: "생산(초)", en: "Build (s)", raw: (x) => x.cost.time },
    { k: "hp", g: "combat", n: 1, ko: "생명력", en: "Health", raw: (x) => x.stats.hp },
    { k: "shields", g: "combat", n: 1, ko: "보호막", en: "Shields", raw: (x) => x.stats.shields },
    { k: "armor", g: "combat", n: 1, ko: "방어력", en: "Armor", raw: (x) => x.stats.armor },
    { k: "speed", g: "combat", n: 1, ko: "이동 속도", en: "Speed", raw: (x) => x.stats.speed },
    { k: "range", g: "combat", n: 1, ko: "사거리", en: "Range", raw: (x) => x.stats.range },
    { k: "groundDmg", g: "combat", w: 1, ko: "대지 공격", en: "Ground attack", raw: (x) => tr(x.stats.groundDmg) },
    { k: "airDmg", g: "combat", w: 1, ko: "대공 공격", en: "Air attack", raw: (x) => tr(x.stats.airDmg) },
    { k: "damageType", g: "combat", w: 1, ko: "역할", en: "Role", raw: (x) => tr(x.stats.damageType) },
  ];
  const cols = () => COLS.filter((c) => c.g === "id" || st.grp[c.g]);
  const cell = (c, u) => {
    const x = unitAt(u, st.ver);
    if (c.get) return { h: c.get(u), chg: false };
    const v = c.raw(x), was = x.changed[c.k.startsWith("c_") ? c.k : c.k];
    const key = c.k;
    const old = x.changed[key];
    return { h: `${esc(v)}${old !== undefined ? `<span class="was">${esc(tr(old))}</span>` : ""}`, chg: old !== undefined };
  };
  const list = () => B.units.filter((u) => (st.race === "all" || u.race === st.race) && (!st.q || (u.ko + u.en + u.pairKo + u.pairEn).toLowerCase().includes(st.q.toLowerCase())));

  const tableHtml = (rows, opt = {}) => `
    <div class="tscroll ${opt.cls || ""}"><table class="tbl wk">
      <thead><tr>${opt.cmp ? `<th class="cmpc"><span class="vh">${t("비교", "Compare")}</span></th>` : ""}${cols().map((c) => `<th class="${c.n ? "n" : ""}${c.k === "name" ? " sticky" : ""}" scope="col">${t(c.ko, c.en)}</th>`).join("")}</tr></thead>
      <tbody>${rows.length ? rows.map((u, i) => {
        const prev = rows[i - 1];
        const head = opt.group && (!prev || prev.race !== u.race) ? `<tr class="grp ${u.race}"><th colspan="${cols().length + (opt.cmp ? 1 : 0)}" scope="colgroup"><span class="rtag ${u.race}">${raceGlyph(u.race)}</span> ${raceName(u.race)}</th></tr>` : "";
        return head + `<tr class="${st.sel === u.id ? "is-sel" : ""}" data-id="${u.id}" id="${u.id}" tabindex="0">${opt.cmp ? `<td class="cmpc"><input type="checkbox" data-cmp="${u.id}" aria-label="${t("비교에 추가", "Add to compare")}: ${esc(uname(u))}" ${st.cmp.includes(u.id) ? "checked" : ""}></td>` : ""}${cols().map((c) => { const r = cell(c, u); return `<td class="${c.n ? "n" : ""}${r.chg ? " chg" : ""}${c.w ? " wrapc" : ""}${c.k === "name" ? " sticky" : ""}">${r.h}</td>`; }).join("")}</tr>`;
      }).join("") : `<tr><td colspan="${cols().length}" class="empty">${t("조건에 맞는 유닛이 없습니다. 종족이나 검색어를 바꿔 보세요.", "No units match. Change the race filter or search.")}</td></tr>`}</tbody></table></div>`;

  const detailHtml = (u) => {
    const x = unitAt(u, st.ver);
    const hist = (B.patches.find((p) => p.version === "v1.4.3").diffs || []).filter((d) => d.unitId === u.id);
    const cell2 = (lbl, v, key) => `<div class="kv ${x.changed[key] !== undefined ? "chg" : ""}"><dt>${lbl}</dt><dd class="${typeof v === "number" ? "mono" : ""}">${esc(tr(v))}${x.changed[key] !== undefined ? `<span class="was">${esc(tr(x.changed[key]))}</span>` : ""}</dd></div>`;
    return `<div class="det">
      <div class="det-h"><img src="${u.icon}" alt="" width="56" height="56"><div><h3>${esc(uname(u))}</h3><p class="mute">${raceName(u.race)} · ${t("대응", "pairs with")} ${esc(upair(u))}</p></div></div>
      <dl class="det-g">
        ${cell2(t("광물", "Minerals"), x.cost.minerals, "c_minerals")}${cell2(t("가스", "Gas"), x.cost.gas, "c_gas")}${cell2(t("인구수", "Supply"), x.cost.supply, "c_supply")}${cell2(t("생산(초)", "Build (s)"), x.cost.time, "c_time")}
        ${cell2(t("생명력", "Health"), x.stats.hp, "hp")}${cell2(t("보호막", "Shields"), x.stats.shields, "shields")}${cell2(t("방어력", "Armor"), x.stats.armor, "armor")}${cell2(t("이동 속도", "Speed"), x.stats.speed, "speed")}
        ${cell2(t("사거리", "Range"), x.stats.range, "range")}
      </dl>
      <dl class="det-l">${cell2(t("대지 공격", "Ground attack"), x.stats.groundDmg, "groundDmg")}${cell2(t("대공 공격", "Air attack"), x.stats.airDmg, "airDmg")}${cell2(t("역할", "Role"), x.stats.damageType, "damageType")}${cell2(t("생산 건물", "Built at"), u.buildingKo, "_")}${cell2(t("기술 요구", "Tech required"), u.techKo, "_")}</dl>
      <h4>${t("기본 유닛과의 차이", "Versus the base unit")}</h4>
      <table class="tbl det-t"><thead><tr><th>${t("항목", "Item")}</th><th>${esc(upair(u))}</th><th>${esc(uname(u))}</th></tr></thead><tbody>${u.diff.map((d) => `<tr><td>${esc(tr(d.item))}</td><td class="wrapc">${esc(tr(d.pair))}</td><td class="wrapc"><b>${esc(tr(d.unit))}</b></td></tr>`).join("")}</tbody></table>
      ${u.upgrades.length ? `<h4>${t("전용 업그레이드", "Upgrades")}</h4><ul class="det-u">${u.upgrades.map((g) => `<li><b>${esc(tr(g.name))}</b><span class="mono">${esc(g.cost)}</span><span>${esc(tr(g.building))}</span><span>${esc(tr(g.statDiff))}</span></li>`).join("")}</ul>` : ""}
      ${hist.length ? `<h4>${t("v1.4.3 변경", "v1.4.3 changes")}</h4><ul class="det-u">${hist.map((d) => `<li><b>${esc(t(d.ko, d.en))}</b><span class="mono">${esc(tr(d.before))} → ${esc(tr(d.after))}</span></li>`).join("")}</ul>` : ""}
    </div>`;
  };

  const verSeg = () => `<div class="seg" role="group" aria-label="${t("버전", "Version")}">${[["v1.4.3", t("v1.4.3 현재", "v1.4.3 current")], ["v1.4.1", t("v1.4.1 직전", "v1.4.1 previous")]].map(([v, l]) => `<button data-ver="${v}" aria-pressed="${st.ver === v}">${l}</button>`).join("")}</div>`;
  const raceTabs = () => `<div class="seg" role="group" aria-label="${t("종족", "Race")}">${[["all", t("전체", "All"), B.units.length], ...["terran", "protoss", "zerg"].map((r) => [r, raceName(r), B.units.filter((u) => u.race === r).length])].map(([r, l, n]) => `<button data-race="${r}" aria-pressed="${st.race === r}">${l} <span class="mono">${n}</span></button>`).join("")}</div>`;
  const grpChips = () => (L.world >= "3" && st.view === "cards") ? "" : `<div class="grpchips" role="group" aria-label="${t("열 그룹", "Column groups")}">${[["tech", t("건물·요구", "Tech")], ["cost", t("비용", "Cost")], ["combat", t("전투", "Combat")]].map(([g, l]) => `<button class="chip" data-grp="${g}" aria-pressed="${st.grp[g]}">${st.grp[g] ? ico("check") : ico("plus")}${l}</button>`).join("")}</div>`;
  const search = () => `<div class="wsearch">${ico("magnifying-glass")}<input class="inp" type="search" data-q value="${esc(st.q)}" placeholder="${t("유닛 이름 검색", "Search units")}" aria-label="${t("유닛 검색", "Search units")}"></div>`;
  const toolbar = () => `<div class="wtool">${raceTabs()}${verSeg()}${grpChips()}${search()}</div>`;
  const bindTool = (root, redraw) => {
    root.querySelectorAll("[data-ver]").forEach((b) => b.addEventListener("click", () => { st.ver = b.dataset.ver; redraw(); }));
    root.querySelectorAll("[data-race]").forEach((b) => b.addEventListener("click", () => { st.race = b.dataset.race; redraw(); }));
    root.querySelectorAll("[data-grp]").forEach((b) => b.addEventListener("click", () => { st.grp[b.dataset.grp] = !st.grp[b.dataset.grp]; redraw(); }));
  };
  const verNote = () => st.ver === "v1.4.3" ? `<p class="vnote">${ico("info")}${t("값이 바뀐 칸은 강조되고, 취소선은 v1.4.1의 값입니다.", "Changed cells are highlighted; the struck-through value is from v1.4.1.")}</p>` : `<p class="vnote">${ico("clock-counter-clockwise")}${t("v1.4.1 기준 수치입니다.", "Values as of v1.4.1.")}</p>`;

  /* ============ 1. CONSOLE ============ */
  S.wiki[1] = () => {
    hashInit();
    return {
      html: `<section class="wrap w1"><header class="pg-h"><h1 class="h1">${t("유닛 위키", "Unit wiki")}</h1></header><div data-bar></div>
        <div class="w1-grid"><div class="w1-main" data-main></div><aside class="w1-dock bracket" data-dock aria-live="polite"></aside></div></section>`,
      mount(root) {
        const bar = root.querySelector("[data-bar]"), main = root.querySelector("[data-main]"), dock = root.querySelector("[data-dock]");
        const rest = () => {
          const rows = list();
          if (!st.sel || !rows.find((u) => u.id === st.sel)) st.sel = rows[0] && rows[0].id;
          main.innerHTML = `${verNote()}${tableHtml(rows)}`;
          const u = B.units.find((x) => x.id === st.sel);
          dock.innerHTML = u ? detailHtml(u) : "";
          main.querySelectorAll("tbody tr[data-id]").forEach((tr_) => { const go = () => { st.sel = tr_.dataset.id; rest(); }; tr_.addEventListener("click", go); tr_.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); }); });
        };
        const draw = () => { bar.innerHTML = toolbar(); bindTool(bar, draw); const q = bar.querySelector("[data-q]"); q.addEventListener("input", () => { st.q = q.value; rest(); }); rest(); };
        draw();
      },
    };
  };

  /* ============ 2. MANUAL ============ */
  const csv = (rows) => {
    const hdr = cols().filter((c) => c.k !== "name" || true).map((c) => t(c.ko, c.en));
    const body = rows.map((u) => cols().map((c) => { if (c.k === "name") return uname(u); if (c.k === "race") return raceName(u.race); if (c.get) return c.get(u).replace(/<[^>]+>/g, ""); return String(c.raw(unitAt(u, st.ver))); }).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    return [hdr.map((h) => `"${h}"`).join(","), ...body].join("\n");
  };
  S.wiki[2] = () => {
    hashInit();
    return {
      html: `<section class="wrap w2"><header class="pg-h"><h1 class="h1">${t("유닛 데이터시트", "Unit datasheet")}</h1><p class="lede">${t("모든 열이 기본으로 펼쳐져 있습니다. 필요한 열 그룹만 접어서 보세요.", "Every column is open by default. Collapse the groups you do not need.")}</p></header>
        <div data-bar></div><div data-main></div><div class="w2-cmp" data-cmp></div></section>`,
      mount(root) {
        const bar = root.querySelector("[data-bar]"), main = root.querySelector("[data-main]"), cmp = root.querySelector("[data-cmp]");
        const drawCmp = () => {
          if (st.cmp.length < 2) { cmp.innerHTML = st.cmp.length ? `<p class="mute">${t("비교하려면 유닛을 하나 더 선택하세요 (최대 4).", "Select one more unit to compare (up to 4).")}</p>` : ""; return; }
          const us = st.cmp.map((id) => B.units.find((u) => u.id === id));
          const rows = COLS.filter((c) => c.raw);
          cmp.innerHTML = `<h2 class="h2">${t("비교", "Compare")}</h2><div class="tscroll"><table class="tbl"><thead><tr><th></th>${us.map((u) => `<th>${esc(uname(u))}</th>`).join("")}</tr></thead><tbody>${rows.map((c) => `<tr><th scope="row">${t(c.ko, c.en)}</th>${us.map((u) => `<td class="${c.n ? "n" : ""} ${c.w ? "wrapc" : ""}">${esc(c.raw(unitAt(u, st.ver)))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
        };
        const rest = () => {
          const rows = list();
          main.innerHTML = `<div class="w2-meta">${verNote()}<button class="btn btn-sec" data-csv>${ico("download-simple")}${t("현재 표를 CSV로", "Export view as CSV")}</button></div>${tableHtml(rows, { group: true, cmp: true })}<div class="w2-open" data-open></div>`;
          main.querySelectorAll("[data-cmp]").forEach((i) => i.addEventListener("change", () => { const id = i.dataset.cmp; if (i.checked) { if (st.cmp.length >= 4) { i.checked = false; return; } st.cmp.push(id); } else st.cmp = st.cmp.filter((x) => x !== id); drawCmp(); }));
          main.querySelectorAll("tbody tr[data-id]").forEach((r) => r.addEventListener("click", (e) => { if (e.target.closest("input")) return; st.sel = st.sel === r.dataset.id ? null : r.dataset.id; rest(); }));
          const op = main.querySelector("[data-open]"), u = B.units.find((x) => x.id === st.sel);
          if (u) { op.innerHTML = `<div class="w2-detail">${detailHtml(u)}</div>`; }
          main.querySelector("[data-csv]").addEventListener("click", () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv(list())], { type: "text/csv" })); a.download = `bpm-units-${st.ver}.csv`; a.click(); });
        };
        const draw = () => { bar.innerHTML = toolbar(); bindTool(bar, draw); const q = bar.querySelector("[data-q]"); q.addEventListener("input", () => { st.q = q.value; rest(); }); rest(); drawCmp(); };
        draw();
      },
    };
  };

  /* ============ 3. ARENA ============ */
  const bar_ = (label, a, b, max) => `<div class="vs-row"><span class="vs-a mono">${a}</span><div class="vs-bar"><i style="width:${Math.min(100, (a / max) * 100)}%" class="a"></i><i style="width:${Math.min(100, (b / max) * 100)}%" class="b"></i></div><span class="vs-b mono">${b}</span><em>${label}</em></div>`;
  S.wiki[3] = () => {
    hashInit();
    return {
      html: `<section class="wrap w3"><header class="pg-h"><h1 class="h1">${t("로스터", "Roster")}</h1></header><div data-bar></div><div class="w3-vs" data-vs></div><div data-main></div></section><aside class="w3-drawer" data-drawer aria-hidden="true"></aside>`,
      mount(root) {
        const bar = root.querySelector("[data-bar]"), main = root.querySelector("[data-main]"), vs = root.querySelector("[data-vs]"), dr = root.querySelector("[data-drawer]");
        const drawVs = () => {
          if (st.versus.length < 2) { vs.innerHTML = st.versus.length ? `<p class="mute">${t("VS 비교: 상대 유닛을 하나 더 고르세요.", "Versus: pick one more unit.")}</p>` : ""; return; }
          const [a, b] = st.versus.map((id) => B.units.find((u) => u.id === id)), xa = unitAt(a, st.ver), xb = unitAt(b, st.ver);
          const mx = (k) => Math.max(xa.stats[k], xb.stats[k], 1);
          vs.innerHTML = `<div class="vs"><div class="vs-h"><div class="vs-u a"><img src="${a.icon}" alt="" width="64" height="64"><b>${esc(uname(a))}</b></div><span class="vs-x">VS</span><div class="vs-u b"><img src="${b.icon}" alt="" width="64" height="64"><b>${esc(uname(b))}</b></div></div>
            ${bar_(t("생명력", "Health"), xa.stats.hp, xb.stats.hp, mx("hp"))}${bar_(t("이동 속도", "Speed"), xa.stats.speed, xb.stats.speed, mx("speed"))}${bar_(t("사거리", "Range"), xa.stats.range, xb.stats.range, mx("range"))}${bar_(t("방어력", "Armor"), xa.stats.armor, xb.stats.armor, mx("armor"))}${bar_(t("광물", "Minerals"), xa.cost.minerals, xb.cost.minerals, Math.max(xa.cost.minerals, xb.cost.minerals))}${bar_(t("가스", "Gas"), xa.cost.gas, xb.cost.gas, Math.max(xa.cost.gas, xb.cost.gas, 1))}
            <button class="btn btn-sec" data-clear>${t("비교 해제", "Clear")}</button></div>`;
          vs.querySelector("[data-clear]").addEventListener("click", () => { st.versus = []; draw(false); });
        };
        const card = (u) => {
          const x = unitAt(u, st.ver), n = Object.keys(x.changed).length;
          return `<article class="w3-card ${u.race} ${st.versus.includes(u.id) ? "is-vs" : ""}" id="${u.id}"><button class="w3-open" data-open="${u.id}" aria-label="${t("자세히", "Details")}: ${esc(uname(u))}"></button>
            ${n && st.ver === "v1.4.3" ? `<span class="w3-chg">${t("변경", "Changed")} ${n}</span>` : ""}
            <img src="${u.icon}" alt="" width="72" height="72"><h3>${esc(uname(u))}</h3><p class="mute">${esc(upair(u))}</p>
            <dl><div><dt>HP</dt><dd class="mono">${x.stats.hp}${x.changed.hp !== undefined ? `<span class="was">${x.changed.hp}</span>` : ""}</dd></div><div><dt>${t("사거리", "RNG")}</dt><dd class="mono">${x.stats.range}${x.changed.range !== undefined ? `<span class="was">${x.changed.range}</span>` : ""}</dd></div><div><dt>${t("속도", "SPD")}</dt><dd class="mono">${x.stats.speed}${x.changed.speed !== undefined ? `<span class="was">${x.changed.speed}</span>` : ""}</dd></div><div><dt>${t("비용", "COST")}</dt><dd class="mono">${x.cost.minerals}/${x.cost.gas}</dd></div></dl>
            <button class="chip w3-vsb" data-vs="${u.id}" aria-pressed="${st.versus.includes(u.id)}">VS</button></article>`;
        };
        const rest = () => {
          const rows = list();
          const body = st.view === "table" ? tableHtml(rows, { group: true }) : ["terran", "protoss", "zerg"].filter((r) => rows.some((u) => u.race === r)).map((r) => `<section class="w3-race ${r}" id="${r}"><h2>${raceName(r)}</h2><div class="w3-cards">${rows.filter((u) => u.race === r).map(card).join("")}</div></section>`).join("") || `<p class="empty">${t("조건에 맞는 유닛이 없습니다.", "No units match.")}</p>`;
          main.innerHTML = `<div class="w2-meta">${verNote()}<div class="seg" role="group" aria-label="${t("보기", "View")}"><button data-view="cards" aria-pressed="${st.view === "cards"}">${ico("squares-four")}${t("카드", "Cards")}</button><button data-view="table" aria-pressed="${st.view === "table"}">${ico("table")}${t("표", "Table")}</button></div></div>${body}`;
          main.querySelectorAll("[data-view]").forEach((b) => b.addEventListener("click", () => { st.view = b.dataset.view; draw(); }));
          main.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openDrawer(b.dataset.open)));
          main.querySelectorAll("tbody tr[data-id]").forEach((r) => r.addEventListener("click", () => openDrawer(r.dataset.id)));
          main.querySelectorAll("[data-vs]").forEach((b) => b.addEventListener("click", () => { const id = b.dataset.vs; st.versus = st.versus.includes(id) ? st.versus.filter((x) => x !== id) : [...st.versus, id].slice(-2); rest(); drawVs(); }));
        };
        const openDrawer = (id) => { const u = B.units.find((x) => x.id === id); st.drawer = id; dr.innerHTML = `<button class="w3-x" data-x aria-label="${t("닫기", "Close")}">${ico("x")}</button>${detailHtml(u)}`; dr.classList.add("open"); dr.setAttribute("aria-hidden", "false"); dr.querySelector("[data-x]").focus(); dr.querySelector("[data-x]").addEventListener("click", closeDrawer); };
        const closeDrawer = () => { dr.classList.remove("open"); dr.setAttribute("aria-hidden", "true"); };
        document.onkeydown = (e) => { if (e.key === "Escape") closeDrawer(); };
        const draw = (full = true) => { bar.innerHTML = toolbar(); bindTool(bar, draw); const q = bar.querySelector("[data-q]"); q.addEventListener("input", () => { st.q = q.value; rest(); }); rest(); drawVs(); };
        draw();
      },
    };
  };
  window.H.detailHtml = detailHtml; window.H.wikiSt = st;
  S.wiki[4] = S.wiki[3];
})();
