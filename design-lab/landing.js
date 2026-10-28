/* Landing: 3 variants. 1 = Console (HUD), 2 = Field Manual (index + search), 3 = Arena (broadcast stage) */
(function () {
  const { S, B, L, t, esc, ico, raceName, uname, upair, delta, store } = window.H;
  const cur = () => B.patches.find((p) => p.version === "v1.4.3");
  const headline = () => t("밴으로 흔들고,<br>히든 픽으로 완성하는 전장.", "Ban to shake it up.<br>Hidden-pick to finish it.");
  const sub = () => t("0·1·3·5밴 규칙과 비공개 선택으로 스타크래프트 II 1대1에 전략 한 층을 더하는 커스텀 모드입니다.", "A StarCraft II 1v1 custom mod that adds a ban phase and secret picks before the first worker moves.");
  const hl = (h) => t(h.ko, h.en);
  const newsKind = (k) => (k === "ptr" ? "PTR" : t("패치", "Patch"));
  const newsRows = (w, cls) => B.news.map((n) => `
    <a class="${cls}" href="patches-${w}.html#${n.version}">
      <span class="mono">${esc(n.version)}</span><span>${esc(t(n.ko, n.en))}</span><span class="mono mute">${esc(window.H.fmtDate(n.date))}</span>${ico("arrow-right")}
    </a>`).join("");
  const mapsEn = (m) => t(m.terrainKo, m.terrainEn);

  /* Draft demo shared by 1 and 3 */
  const draft = { n: 3, banned: [], stage: "idle", timers: [] };
  const clearTimers = () => { draft.timers.forEach(clearTimeout); draft.timers = []; };
  const reduce = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tileHtml = (u, cls) => {
    const b = draft.banned.includes(u.id);
    return `<button class="${cls} ${b ? "is-ban" : ""}" data-u="${u.id}" aria-pressed="${b}" ${draft.n === 0 ? "disabled" : ""}>
      <img src="${u.icon}" alt="" width="40" height="40"><span class="tn">${esc(uname(u))}</span><span class="tp">${esc(upair(u))}</span><span class="stamp">BAN</span></button>`;
  };
  const stageMsg = () => {
    const left = draft.n - draft.banned.length;
    if (draft.n === 0) return t("0밴: 밴 없이 바로 히든 픽으로 넘어갑니다.", "0 bans: skip straight to the hidden pick.");
    if (left > 0) return t(`상대 선택지를 ${left}개 더 밴하세요.`, `Ban ${left} more option${left > 1 ? "s" : ""} from the opponent.`);
    return t("밴 종료. 다음은 그룹별 비공개 히든 픽입니다.", "Bans locked. Next: the hidden pick, per group.");
  };

  /* ============ 1. CONSOLE ============ */
  S.landing[1] = () => {
    const p = cur();
    const rows = ["terran", "protoss", "zerg"].map((r) => `
      <div class="l1-row"><span class="l1-race ${r}">${raceName(r)}</span>
      <div class="l1-tiles">${B.units.filter((u) => u.race === r).map((u) => tileHtml(u, "l1-tile")).join("")}</div></div>`).join("");
    return {
      html: `
      <section class="l1-hero wrap">
        <div class="l1-copy">
          <p class="l1-ver mono"><span class="pill">${esc(B.meta.current)}</span> ${t("현재 빌드", "Current build")}</p>
          <h1 class="l1-h1">${headline()}</h1>
          <p class="lede">${sub()}</p>
          <div class="l1-cta"><a class="btn btn-pri" href="guide-1.html">${t("가이드 시작", "Start the guide")}${ico("arrow-right")}</a><a class="btn btn-sec" href="patches-1.html">${t("패치 노트", "Patch notes")}</a></div>
        </div>
        <div class="l1-console bracket" aria-label="${t("밴픽 체험", "Draft sandbox")}">
          <div class="l1-chead">
            <span class="mono">${t("DRAFT 콘솔", "DRAFT CONSOLE")}</span>
            <div class="seg" role="group" aria-label="${t("밴 개수", "Ban count")}">${[0, 1, 3, 5].map((n) => `<button data-n="${n}" aria-pressed="${draft.n === n}">${n}${t("밴", " ban")}</button>`).join("")}</div>
          </div>
          <div class="l1-slots" data-slots></div>
          <div class="l1-grid" data-grid>${rows}</div>
          <p class="l1-status" data-status role="status"></p>
        </div>
      </section>

      <section class="l1-band wrap">
        <div class="l1-patch bracket">
          <div class="l1-phead"><h2 class="h2">${t("최신 패치", "Latest patch")} <span class="mono pill">${esc(p.version)}</span></h2><a class="lnk" href="patches-1.html">${t("전체 변경 보기", "See every change")}${ico("arrow-right")}</a></div>
          <p class="l1-ptitle">${esc(t(p.titleKo, p.titleEn))}</p>
          <ul class="l1-hl">${p.highlights.map((h) => `<li>${ico("caret-right")}<span>${esc(hl(h))}</span></li>`).join("")}</ul>
        </div>
        <div class="l1-flow">
          <h2 class="h2">${t("한 판의 흐름", "How a match starts")}</h2>
          <ol class="l1-steps">${B.draftFlow.map((s, i) => `<li><span class="mono">${i + 1}</span><div><b>${esc(["BAN", "HIDDEN PICK", "DEPLOY"][i])}</b><p>${esc(t(s.description, ["Each side bans options under the 0·1·3·5 rule: open, self or shadow rounds.", "From each group that survives, secretly choose the base or extension unit.", "Bans and picks apply to both tech trees, then a countdown starts the match."][i]))}</p></div></li>`).join("")}</ol>
        </div>
      </section>

      <section class="l1-split wrap" id="news">
        <div>
          <h2 class="h2">${t("뉴스", "News")}</h2>
          <div class="l1-news">${newsRows(1, "l1-nrow")}</div>
        </div>
        <div>
          <h2 class="h2">${t("위키로 바로가기", "Jump into the wiki")}</h2>
          <div class="l1-races">${["terran", "protoss", "zerg"].map((r) => `<a class="l1-race-link ${r}" href="wiki-1.html#${r}"><b>${raceName(r)}</b><span class="mono">${B.units.filter((u) => u.race === r).length} ${t("유닛", "units")}</span>${ico("arrow-up-right")}</a>`).join("")}</div>
          <p class="mute l1-wnote">${t("모든 수치를 열 단위로 확인하고, 직전 버전과 비교할 수 있습니다.", "Every number in a column, comparable against the previous version.")}</p>
        </div>
      </section>`,
      mount(root) {
        const slots = root.querySelector("[data-slots]"), status = root.querySelector("[data-status]");
        const draw = () => {
          slots.innerHTML = draft.n === 0
            ? `<span class="mute">${t("밴 슬롯 없음", "No ban slots")}</span>`
            : Array.from({ length: draft.n }, (_, i) => {
                const id = draft.banned[i], u = B.units.find((x) => x.id === id);
                return `<span class="slot ${u ? "full" : ""}">${u ? `<img src="${u.icon}" alt="" width="28" height="28"><b>${esc(uname(u))}</b>` : `<i class="mono">${i + 1}</i>`}</span>`;
              }).join("");
          status.textContent = stageMsg();
          root.querySelectorAll(".l1-tile").forEach((b) => { const on = draft.banned.includes(b.dataset.u); b.classList.toggle("is-ban", on); b.setAttribute("aria-pressed", on); b.disabled = draft.n === 0; });
        };
        root.querySelectorAll("[data-n]").forEach((b) => b.addEventListener("click", () => { draft.n = +b.dataset.n; draft.banned = []; root.querySelectorAll("[data-n]").forEach((x) => x.setAttribute("aria-pressed", x === b)); draw(); }));
        root.querySelectorAll(".l1-tile").forEach((b) => b.addEventListener("click", () => {
          const id = b.dataset.u, i = draft.banned.indexOf(id);
          if (i >= 0) draft.banned.splice(i, 1); else if (draft.banned.length < draft.n) draft.banned.push(id);
          draw();
        }));
        draw();
      },
    };
  };

  /* ============ 2. FIELD MANUAL ============ */
  S.landing[2] = () => {
    const p = cur();
    const spec = [
      [t("현재 빌드", "Current build"), B.meta.current],
      [t("확장·대체 유닛", "Extension units"), B.meta.unitCount],
      [t("밴 규칙", "Ban rules"), B.meta.bans],
      [t("지원 전장", "Maps"), B.meta.maps],
      [t("옵저버 모드", "Observer mode"), "v1.0"],
    ];
    const rows = p.diffs.slice(0, 6).map((d) => { const x = delta(d.before, d.after); return `<tr><td>${esc(window.H.dunit(d))}</td><td>${esc(t(d.ko, d.en))}</td><td class="mono mute">${esc(window.H.tr(d.before))}</td><td class="mono"><b>${esc(window.H.tr(d.after))}</b></td><td><span class="diff ${x.dir}">${esc(x.label)}</span></td></tr>`; }).join("");
    const areas = [
      ["guide-2.html", t("가이드", "Guide"), t("방 만들기부터 밴 개수, 편의성, 옵저버 설정까지 순서대로.", "From creating a room to ban count, convenience and observer setup, in order.")],
      ["wiki-2.html", t("위키", "Wiki"), t("17개 확장 유닛의 모든 수치를 한 표에서. 직전 버전과 비교.", "Every number for all 17 extension units in one table, comparable to the previous version.")],
      ["patches-2.html", t("패치 내역", "Changelog"), t("버전별로 무엇이 얼마에서 얼마로 바뀌었는지.", "What changed, from what, to what, version by version.")],
      ["#news", t("뉴스", "News"), t("릴리스와 PTR 소식.", "Releases and PTR announcements.")],
    ];
    return {
      html: `
      <section class="l2-hero wrap">
        <h1 class="l2-h1" aria-label="BAN PICK">BAN<br>PICK</h1>
        <div class="l2-side">
          <p class="l2-def">${headline().replace("<br>", " ")}</p>
          <p class="lede">${sub()}</p>
          <dl class="l2-spec">${spec.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="mono">${esc(v)}</dd></div>`).join("")}</dl>
        </div>
      </section>

      <section class="l2-search wrap">
        <label class="vh" for="q">${t("검색", "Search")}</label>
        <div class="l2-sbox">${ico("magnifying-glass")}<input id="q" class="inp" type="search" autocomplete="off" placeholder="${t("유닛, 버전, 옵션 검색 (예: 파이어뱃, v1.4.3, 밴)", "Search units, versions, options (e.g. Firebat, v1.4.3, ban)")}"></div>
        <div class="l2-results" data-results role="status"></div>
      </section>

      <section class="l2-areas wrap">
        <h2 class="h2">${t("자료 구성", "Contents")}</h2>
        ${areas.map(([h, a, d]) => `<a class="l2-area" href="${h}"><b>${a}</b><span>${d}</span>${ico("arrow-right")}</a>`).join("")}
      </section>

      <section class="l2-log wrap">
        <div class="l2-loghead"><h2 class="h2">${t("v1.4.3 주요 수치 변경", "v1.4.3 value changes")}</h2><a class="lnk" href="patches-2.html">${t("전체 표", "Full table")}${ico("arrow-right")}</a></div>
        <div class="tscroll"><table class="tbl l2-tbl"><thead><tr><th>${t("대상", "Unit")}</th><th>${t("항목", "Item")}</th><th>${t("이전", "Before")}</th><th>${t("이후", "After")}</th><th>Δ</th></tr></thead><tbody>${rows}</tbody></table></div>
      </section>

      <section class="l2-news wrap" id="news">
        <h2 class="h2">${t("뉴스", "News")}</h2>
        <div class="l2-nlist">${newsRows(2, "l2-nrow")}</div>
      </section>`,
      mount(root) {
        const q = root.querySelector("#q"), out = root.querySelector("[data-results]");
        const hint = () => `<p class="mute">${t("예시", "Try")}: <button class="chip" data-q="${t("파이어뱃", "Firebat")}">${t("파이어뱃", "Firebat")}</button> <button class="chip" data-q="v1.4.3">v1.4.3</button> <button class="chip" data-q="${t("밴", "ban")}">${t("밴", "ban")}</button></p>`;
        const run = () => {
          const v = q.value.trim().toLowerCase();
          if (!v) { out.innerHTML = hint(); bind(); return; }
          const us = B.units.filter((u) => (u.ko + u.en + u.pairKo + u.pairEn).toLowerCase().includes(v));
          const ps = B.patches.filter((x) => (x.version + (x.titleKo || "") + (x.titleEn || "")).toLowerCase().includes(v));
          const gs = [["guide-2.html#bans", t("밴 개수 설정", "Setting the ban count"), "밴 ban 0 1 3 5"], ["guide-2.html#observer", t("옵저버 방 만들기", "Creating a room with observers"), "옵저버 observer"], ["guide-2.html#convenience", t("편의성 모드", "Convenience mode"), "편의성 convenience hud"]].filter((g) => g[2].toLowerCase().includes(v) || g[1].toLowerCase().includes(v));
          const r = [
            ...us.map((u) => `<a href="wiki-2.html#${u.id}"><span class="rtag ${u.race}">${window.H.raceGlyph(u.race)}</span><b>${esc(uname(u))}</b><span class="mute">${t("위키", "Wiki")} · ${esc(upair(u))}</span></a>`),
            ...ps.map((x) => `<a href="patches-2.html#${x.version}"><span class="rtag" style="background:var(--accent)">v</span><b>${esc(x.version)}</b><span class="mute">${esc(t(x.titleKo, x.titleEn))}</span></a>`),
            ...gs.map((g) => `<a href="${g[0]}"><span class="rtag" style="background:var(--text)">?</span><b>${esc(g[1])}</b><span class="mute">${t("가이드", "Guide")}</span></a>`),
          ];
          out.innerHTML = r.length ? `<div class="l2-hits">${r.join("")}</div>` : `<p class="mute">${t("일치하는 항목이 없습니다. 유닛 이름이나 버전으로 다시 검색해 보세요.", "No matches. Try a unit name or a version number.")}</p>`;
        };
        const bind = () => out.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => { q.value = b.dataset.q; run(); q.focus(); }));
        q.addEventListener("input", run);
        run();
      },
    };
  };

  /* ============ 3. ARENA ============ */
  S.landing[3] = () => {
    const p = cur();
    const maps = B.maps.map((m, i) => `<article class="l3-map m${i}"><h3>${esc(t(m.ko, m.en))}</h3><p>${esc(mapsEn(m))}</p><span class="mono">${esc(m.key)}</span></article>`).join("");
    const marquee = B.units.map((u) => `<span><img src="${u.icon}" alt="" width="28" height="28">${esc(uname(u))}</span>`).join("");
    return {
      html: `
      <section class="l3-hero">
        <div class="wrap l3-hero-in">
          <div class="l3-copy">
            <h1 class="l3-h1">${headline()}</h1>
            <p class="lede">${sub()}</p>
            <div class="l3-cta"><a class="btn btn-pri" href="guide-3.html">${t("가이드 시작", "Start the guide")}</a><a class="btn btn-sec" href="wiki-3.html">${t("유닛 보기", "Browse units")}</a></div>
          </div>
          <div class="l3-board" aria-label="${t("밴픽 데모", "Draft demo")}">
            <div class="l3-bhead">
              <div class="seg" role="group" aria-label="${t("밴 개수", "Ban count")}">${[0, 1, 3, 5].map((n) => `<button data-n="${n}" aria-pressed="${draft.n === n}">${n}${t("밴", " ban")}</button>`).join("")}</div>
              <button class="btn btn-pri l3-run" data-run>${ico("play")}${t("드래프트 재생", "Run draft")}</button>
            </div>
            <div class="l3-grid">${B.units.map((u) => tileHtml(u, "l3-tile")).join("")}</div>
            <p class="l3-status" data-status role="status"></p>
          </div>
        </div>
      </section>

      <section class="l3-phases wrap">
        <h2 class="vh">${t("드래프트 3단계", "Draft in three phases")}</h2>
        <div class="l3-ph ban"><h3>BAN</h3><p>${t("상대의 선택지를 지웁니다. 0·1·3·5밴, 스네이크 순서 지원.", "Strike options from your opponent. 0·1·3·5 bans, snake order supported.")}</p></div>
        <div class="l3-ph pick"><h3>HIDDEN PICK</h3><p>${t("살아남은 그룹에서 기본 유닛과 확장 유닛 중 하나를 숨긴 채 선택합니다.", "From each surviving group, secretly choose the base or the extension unit.")}</p></div>
        <div class="l3-ph go"><h3>DEPLOY</h3><p>${t("결과가 양측 테크트리에 적용되고, 카운트다운 뒤 경기가 시작됩니다.", "Results apply to both tech trees, then a countdown starts the match.")}</p></div>
      </section>

      <div class="l3-marquee" aria-hidden="true"><div class="l3-track">${marquee}${marquee}</div></div>

      <section class="l3-patch wrap">
        <div class="l3-pbig"><span class="mono">${esc(p.version)}</span><h2>${esc(t(p.titleKo, p.titleEn))}</h2><a class="btn btn-pri" href="patches-3.html">${t("변경 내역 보기", "See what changed")}</a></div>
        <ul class="l3-phl">${p.highlights.map((h) => `<li>${esc(hl(h))}</li>`).join("")}</ul>
      </section>

      <section class="l3-maps wrap"><h2 class="h2">${t("전장", "Maps")}</h2><div class="l3-maprow">${maps}</div></section>

      <section class="l3-news wrap" id="news"><h2 class="h2">${t("뉴스", "News")}</h2>${newsRows(3, "l3-nrow")}</section>`,
      mount(root) {
        clearTimers();
        const status = root.querySelector("[data-status]");
        const sync = () => {
          root.querySelectorAll(".l3-tile").forEach((b) => { const on = draft.banned.includes(b.dataset.u); b.classList.toggle("is-ban", on); b.setAttribute("aria-pressed", on); b.disabled = draft.n === 0; });
          status.textContent = stageMsg();
        };
        root.querySelectorAll("[data-n]").forEach((b) => b.addEventListener("click", () => { clearTimers(); draft.n = +b.dataset.n; draft.banned = []; root.querySelectorAll("[data-n]").forEach((x) => x.setAttribute("aria-pressed", x === b)); sync(); }));
        root.querySelectorAll(".l3-tile").forEach((b) => b.addEventListener("click", () => {
          const id = b.dataset.u, i = draft.banned.indexOf(id);
          if (i >= 0) draft.banned.splice(i, 1); else if (draft.banned.length < draft.n) draft.banned.push(id);
          sync();
        }));
        root.querySelector("[data-run]").addEventListener("click", () => {
          clearTimers(); draft.banned = [];
          const pool = B.units.map((u) => u.id).sort(() => Math.random() - 0.5).slice(0, draft.n);
          if (reduce()) { draft.banned = pool; sync(); return; }
          pool.forEach((id, i) => draft.timers.push(setTimeout(() => { draft.banned.push(id); sync(); }, 380 * (i + 1))));
          sync();
        });
        sync();
      },
    };
  };

  /* ============ 4. MIX (Console panels + Arena stage). No draft replay here; it lives in the guide. ============ */
  S.landing[4] = () => {
    const p = cur();
    const board = ["terran", "protoss", "zerg"].map((r) => `
      <div class="l4-row ${r}"><span class="l4-race">${raceName(r)}</span>
      <div class="l4-icons">${B.units.filter((u) => u.race === r).map((u) => `<a class="l4-u" href="wiki-4.html#${u.id}" title="${esc(uname(u))}"><img src="${u.icon}" alt="" width="44" height="44"><span>${esc(uname(u))}</span></a>`).join("")}</div></div>`).join("");
    const marquee = B.units.map((u) => `<span><img src="${u.icon}" alt="" width="28" height="28">${esc(uname(u))}</span>`).join("");
    const maps = B.maps.map((m, i) => `<article class="l3-map m${i}"><h3>${esc(t(m.ko, m.en))}</h3><p>${esc(mapsEn(m))}</p><span class="mono">${esc(m.key)}</span></article>`).join("");
    return {
      html: `
      <section class="l3-hero l4-hero">
        <div class="wrap l3-hero-in">
          <div class="l3-copy">
            <p class="l4-ver mono"><span class="pill">${esc(B.meta.current)}</span> ${t("현재 빌드", "Current build")}</p>
            <h1 class="l3-h1">${headline()}</h1>
            <p class="lede">${sub()}</p>
            <div class="l3-cta"><a class="btn btn-pri" href="guide-4.html">${t("가이드 시작", "Start the guide")}</a><a class="btn btn-sec" href="patches-4.html">${t("패치 노트", "Patch notes")}</a></div>
          </div>
          <div class="l4-board bracket" aria-label="${t("확장 유닛 17종", "17 extension units")}">
            <div class="l4-bhead"><span class="mono">ROSTER 17</span><a class="lnk" href="wiki-4.html">${t("전체 수치", "All stats")}${ico("arrow-right")}</a></div>
            ${board}
          </div>
        </div>
      </section>

      <section class="l3-phases wrap">
        <h2 class="vh">${t("드래프트 3단계", "Draft in three phases")}</h2>
        <div class="l3-ph ban"><h3>BAN</h3><p>${t("상대의 선택지를 지웁니다. 0·1·3·5밴, 스네이크 순서 지원.", "Strike options from your opponent. 0·1·3·5 bans, snake order supported.")}</p></div>
        <div class="l3-ph pick"><h3>HIDDEN PICK</h3><p>${t("살아남은 그룹에서 기본 유닛과 확장 유닛 중 하나를 숨긴 채 선택합니다.", "From each surviving group, secretly choose the base or the extension unit.")}</p></div>
        <div class="l3-ph go"><h3>DEPLOY</h3><p>${t("결과가 양측 테크트리에 적용되고, 카운트다운 뒤 경기가 시작됩니다.", "Results apply to both tech trees, then a countdown starts the match.")}</p></div>
        <a class="lnk l4-try" href="guide-4.html#draft">${t("직접 밴과 픽을 해 보기", "Try a ban and pick yourself")}${ico("arrow-right")}</a>
      </section>

      <div class="l3-marquee" aria-hidden="true"><div class="l3-track">${marquee}${marquee}</div></div>

      <section class="l4-patch wrap">
        <div class="l4-pcard bracket">
          <div class="l4-phead"><span class="mono l4-pver">${esc(p.version)}</span><a class="lnk" href="patches-4.html">${t("전체 변경 보기", "See every change")}${ico("arrow-right")}</a></div>
          <h2>${esc(t(p.titleKo, p.titleEn))}</h2>
          <ul class="l4-hl">${p.highlights.map((h) => `<li>${ico("caret-right")}<span>${esc(hl(h))}</span></li>`).join("")}</ul>
        </div>
        <div class="l4-wiki">
          <h2 class="h2">${t("위키로 바로가기", "Jump into the wiki")}</h2>
          ${["terran", "protoss", "zerg"].map((r) => `<a class="l4-rl ${r}" href="wiki-4.html#${r}"><b>${raceName(r)}</b><span class="mono">${B.units.filter((u) => u.race === r).length} ${t("유닛", "units")}</span>${ico("arrow-up-right")}</a>`).join("")}
          <p class="mute">${t("모든 수치를 한 화면에서 보고, 직전 버전과 비교할 수 있습니다.", "See every number at once and compare with the previous version.")}</p>
        </div>
      </section>

      <section class="l3-maps wrap"><h2 class="h2">${t("전장", "Maps")}</h2><div class="l3-maprow">${maps}</div></section>
      <section class="l3-news wrap" id="news"><h2 class="h2">${t("뉴스", "News")}</h2>${newsRows(4, "l3-nrow")}</section>`,
    };
  };
})();
