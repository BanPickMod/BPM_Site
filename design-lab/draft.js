/* Draft replay: ban sandbox + hidden-pick rehearsal. Lives in the guide (not on the landing page). */
(function () {
  const { B, t, esc, ico, uname, upair, raceName } = window.H;
  const st = { n: 3, banned: [], picks: {}, timers: [] };
  const clear = () => { st.timers.forEach(clearTimeout); st.timers = []; };
  const reduce = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const locked = () => st.banned.length >= st.n;
  const groups = () => ["terran", "protoss", "zerg"].map((r) => B.units.find((u) => u.race === r && !st.banned.includes(u.id))).filter(Boolean);

  const tile = (u) => {
    const b = st.banned.includes(u.id);
    return `<button class="l3-tile ${b ? "is-ban" : ""}" data-u="${u.id}" aria-pressed="${b}" ${st.n === 0 ? "disabled" : ""}>
      <img src="${u.icon}" alt="" width="44" height="44"><span class="tn">${esc(uname(u))}</span><span class="stamp">BAN</span></button>`;
  };
  const status = () => {
    const left = st.n - st.banned.length;
    if (st.n === 0) return t("0밴: 밴 없이 곧바로 히든 픽으로 넘어갑니다.", "0 bans: skip straight to the hidden pick.");
    if (left > 0) return t(`상대 선택지를 ${left}개 더 밴하세요. 유닛을 누르면 밴됩니다.`, `Ban ${left} more option${left > 1 ? "s" : ""}. Click a unit to ban it.`);
    return t("밴 종료. 이제 그룹별로 비공개 히든 픽을 합니다.", "Bans locked. Now make your hidden pick for each group.");
  };
  const pickHtml = () => {
    if (!locked()) return "";
    const g = groups();
    const done = g.every((u) => st.picks[u.id]);
    return `<div class="dk-pick"><h3>${t("히든 픽", "Hidden pick")}</h3>
      <p class="mute">${t("각 그룹에서 기본 유닛과 확장 유닛 중 하나를 고르세요. 상대에게는 선택 결과가 보이지 않습니다.", "In each group choose the base or the extension unit. Your opponent cannot see the choice.")}</p>
      <div class="dk-groups">${g.map((u) => `<div class="dk-g"><div class="dk-gh"><img src="${u.icon}" alt="" width="40" height="40"><b>${raceName(u.race)}</b></div>
        <div class="dk-opts"><button class="opt ${st.picks[u.id] === "base" ? "on" : ""}" data-pick="${u.id}:base" aria-pressed="${st.picks[u.id] === "base"}">${esc(upair(u))}<small>${t("기본", "Base")}</small></button>
        <button class="opt ${st.picks[u.id] === "ext" ? "on" : ""}" data-pick="${u.id}:ext" aria-pressed="${st.picks[u.id] === "ext"}">${esc(uname(u))}<small>${t("확장", "Extension")}</small></button></div>
        <p class="dk-opp mono">${t("상대 화면", "Opponent sees")}: ${st.picks[u.id] ? "?" : "..."}</p></div>`).join("")}</div>
      <p class="dk-done" role="status">${done ? t("모든 픽 완료. 결과가 양측 테크트리에 적용되고 3, 2, 1 카운트다운 뒤 경기가 시작됩니다.", "All picks locked. Results apply to both tech trees and a 3, 2, 1 countdown starts the match.") : ""}</p></div>`;
  };

  window.H.draftKit = {
    html() {
      return `<div class="dk" data-dk>
        <div class="dk-head"><div class="seg" role="group" aria-label="${t("밴 개수", "Ban count")}">${[0, 1, 3, 5].map((n) => `<button data-dk-n="${n}" aria-pressed="${st.n === n}">${n}${t("밴", " ban")}</button>`).join("")}</div>
          <div class="dk-acts"><button class="btn btn-pri" data-dk-run>${ico("play")}${t("드래프트 재생", "Replay draft")}</button><button class="btn btn-sec" data-dk-reset>${ico("arrow-counter-clockwise")}${t("처음부터", "Reset")}</button></div></div>
        <div class="l3-grid" data-dk-grid>${B.units.map(tile).join("")}</div>
        <p class="l3-status" data-dk-status role="status"></p><div data-dk-pick></div></div>`;
    },
    mount(root) {
      clear();
      const grid = root.querySelector("[data-dk-grid]"), stat = root.querySelector("[data-dk-status]"), pk = root.querySelector("[data-dk-pick]");
      if (!grid) return;
      const draw = () => {
        grid.innerHTML = B.units.map(tile).join("");
        stat.textContent = status();
        pk.innerHTML = pickHtml();
        grid.querySelectorAll(".l3-tile").forEach((b) => b.addEventListener("click", () => {
          const id = b.dataset.u, i = st.banned.indexOf(id);
          if (i >= 0) st.banned.splice(i, 1); else if (st.banned.length < st.n) st.banned.push(id);
          st.picks = {}; draw();
        }));
        pk.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => { const [id, v] = b.dataset.pick.split(":"); st.picks[id] = v; draw(); }));
      };
      root.querySelectorAll("[data-dk-n]").forEach((b) => b.addEventListener("click", () => { clear(); st.n = +b.dataset.dkN; st.banned = []; st.picks = {}; root.querySelectorAll("[data-dk-n]").forEach((x) => x.setAttribute("aria-pressed", x === b)); draw(); }));
      root.querySelector("[data-dk-reset]").addEventListener("click", () => { clear(); st.banned = []; st.picks = {}; draw(); });
      root.querySelector("[data-dk-run]").addEventListener("click", () => {
        clear(); st.banned = []; st.picks = {};
        const pool = B.units.map((u) => u.id).sort(() => Math.random() - 0.5).slice(0, st.n);
        if (reduce()) { st.banned = pool; draw(); return; }
        pool.forEach((id, i) => st.timers.push(setTimeout(() => { st.banned.push(id); draw(); }, 420 * (i + 1))));
        draw();
      });
      draw();
    },
  };
})();
