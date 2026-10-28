/* Guide: 3 variants. 1 = lobby configurator, 2 = procedure document, 3 = step wizard */
(function () {
  const { S, B, t, esc, ico } = window.H;
  const cfg = { map: "washout", bans: 3, snake: false, conv: true, obs: false };
  const mapOf = (id) => B.maps.find((m) => m.id === id);
  const mname = (m) => t(m.ko, m.en);

  const buildSteps = () => {
    const m = mapOf(cfg.map), s = [];
    s.push(t("스타크래프트 II 메인 메뉴에서 [사용자 지정] ➔ [섬멸전] 탭으로 이동합니다.", "In the StarCraft II main menu, open Custom, then the Melee tab."));
    s.push(t(`검색창에 'BPM_'을 입력하고 '${mname(m)}'(${m.key})를 선택합니다.`, `Type 'BPM_' in the search box and pick ${mname(m)} (${m.key}).`));
    if (cfg.obs) {
      s.push(t("[방 만들기]가 아니라 바로 옆의 [모드로 만들기](Create with Mod)를 누릅니다.", "Do not press Create Game. Press Create with Mod next to it."));
      s.push(t("확장 모드 검색창에 'BPM_Observer'를 입력해 선택하고 [모드로 방 만들기]를 누릅니다.", "Search for 'BPM_Observer' in the mod search, select it, and press Create Game with Mod."));
      s.push(t("대기실에서 선수 2명은 플레이어 슬롯, 중계진과 심판은 [관전자] 슬롯으로 입장합니다.", "In the lobby, the two players take player slots; casters and referees take Observer slots."));
    } else {
      s.push(t("[방 만들기]를 누르고 상대를 초대합니다.", "Press Create Game and invite your opponent."));
    }
    s.push(t(`방장이 대기실 하단에서 [편의성 모드]를 ${cfg.conv ? "켜고" : "끄고"}, [밴 개수]를 ${cfg.bans}밴으로 설정합니다.`, `As host, set Convenience Mode ${cfg.conv ? "on" : "off"} and the ban count to ${cfg.bans} at the bottom of the lobby.`));
    if (cfg.snake && cfg.bans >= 3) s.push(t("스네이크 밴 옵션을 켭니다. 3밴이면 1→2→2→1→1→2 순서로 진행됩니다.", "Turn on the snake ban option. With 3 bans the order is 1→2→2→1→1→2."));
    s.push(cfg.bans === 0
      ? t("게임을 시작합니다. 밴 단계 없이 곧바로 비공개 히든 픽이 열립니다.", "Start the game. There is no ban phase; the hidden pick opens right away.")
      : t(`게임을 시작합니다. ${cfg.bans}밴을 각 30초 제한 시간 안에 진행한 뒤 비공개 히든 픽이 열립니다.`, `Start the game. Run ${cfg.bans} bans with a 30-second limit each, then the hidden pick opens.`));
    if (cfg.obs) s.push(t("게임 시작 즉시 관전자에게 전용 밴픽 오버레이와 경기 중계 HUD가 켜집니다.", "As soon as the game starts, observers get the broadcast draft overlay and match HUD."));
    return s;
  };
  const optRows = () => ([
    [t("전장", "Map"), "Washout · Fear and Faith · Rorschach", t("방 만들기 전에 'BPM_'으로 검색해 고릅니다.", "Pick one by searching 'BPM_' before creating the room."), "v1.0"],
    [t("밴 개수", "Ban count"), "0 · 1 · 3 · 5", t("공개·셀프·쉐도우 밴 라운드를 진행하는 횟수입니다.", "How many open, self and shadow ban rounds are played."), "v1.0"],
    [t("스네이크 밴", "Snake ban"), "ON / OFF", t("3밴에서 1→2→2→1→1→2 순서로 진행합니다.", "With 3 bans the order runs 1→2→2→1→1→2."), "v1.4.3"],
    [t("편의성 모드", "Convenience Mode"), "ON / OFF", t("생산·연구·공방업·보급품 HUD와 가스 일꾼 자동 배치를 켭니다. 기본값은 켜짐입니다.", "Enables production, research, upgrade and supply HUD plus gas-worker auto-fill. On by default."), "v1.4.1"],
    [t("옵저버", "Observer"), "BPM_Observer", t("[모드로 만들기]로 확장 모드를 결합하면 전용 밴픽 오버레이가 켜집니다.", "Combine the extension mod via Create with Mod to enable the broadcast draft overlay."), "v1.4"],
  ]);

  const ctlHtml = (cls) => `
    <div class="field"><span class="lbl">${t("전장", "Map")}</span>
      <div class="${cls}-maps">${B.maps.map((m) => `<button class="opt ${cfg.map === m.id ? "on" : ""}" data-map="${m.id}" aria-pressed="${cfg.map === m.id}">${esc(mname(m))}</button>`).join("")}</div></div>
    <div class="field"><span class="lbl">${t("밴 개수", "Ban count")}</span>
      <div class="seg" role="group">${[0, 1, 3, 5].map((n) => `<button data-bans="${n}" aria-pressed="${cfg.bans === n}">${n}</button>`).join("")}</div></div>
    <div class="field"><label class="tgl"><input type="checkbox" data-k="snake" ${cfg.snake ? "checked" : ""} ${cfg.bans < 3 ? "disabled" : ""}><span class="sw"></span><span>${t("스네이크 밴 (3밴 이상)", "Snake ban (3+ bans)")}</span></label></div>
    <div class="field"><label class="tgl"><input type="checkbox" data-k="conv" ${cfg.conv ? "checked" : ""}><span class="sw"></span><span>${t("편의성 모드", "Convenience Mode")}</span></label></div>
    <div class="field"><label class="tgl"><input type="checkbox" data-k="obs" ${cfg.obs ? "checked" : ""}><span class="sw"></span><span>${t("옵저버 포함", "Include observers")}</span></label></div>`;
  const bindCtl = (root, redraw) => {
    root.querySelectorAll("[data-map]").forEach((b) => b.addEventListener("click", () => { cfg.map = b.dataset.map; redraw(true); }));
    root.querySelectorAll("[data-bans]").forEach((b) => b.addEventListener("click", () => { cfg.bans = +b.dataset.bans; if (cfg.bans < 3) cfg.snake = false; redraw(true); }));
    root.querySelectorAll("[data-k]").forEach((i) => i.addEventListener("change", () => { cfg[i.dataset.k] = i.checked; redraw(true); }));
  };
  const lobbyHtml = () => {
    const m = mapOf(cfg.map);
    return `<div class="lobby"><div class="lobby-h mono">${esc(m.key)}</div>
      <ul class="lobby-s"><li><span class="s p">P1</span>${t("선수 1", "Player 1")}</li><li><span class="s p">P2</span>${t("선수 2", "Player 2")}</li>${cfg.obs ? `<li><span class="s o">OBS</span>${t("관전자", "Observer")}</li>` : ""}</ul>
      <dl class="lobby-o"><div><dt>${t("밴 개수", "Ban count")}</dt><dd class="mono">${cfg.bans}</dd></div><div><dt>${t("스네이크", "Snake")}</dt><dd class="mono">${cfg.snake && cfg.bans >= 3 ? "ON" : "OFF"}</dd></div><div><dt>${t("편의성", "Convenience")}</dt><dd class="mono">${cfg.conv ? "ON" : "OFF"}</dd></div>${cfg.obs ? `<div><dt>${t("확장 모드", "Mod")}</dt><dd class="mono">BPM_Observer</dd></div>` : ""}</dl></div>`;
  };
  const stepsOl = (cls) => `<ol class="${cls}">${buildSteps().map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`;
  const convList = () => B.convenience.map((c, i) => {
    const en = ["Army and worker supply shown separately", "12-slot production panel with click-to-select", "5 basic upgrade tracks with research buttons", "Research overlay for up to 4 projects", "One-click gas worker auto-fill (up to 3)", "Optimal mineral worker count display restored", "Host toggles it in the lobby; on by default"][i];
    const ko = c.title + ": " + c.description;
    return t(ko, en);
  });

  /* ============ 1. CONSOLE: configurator ============ */
  S.guide[1] = () => ({
    html: `<section class="wrap g1">
      <header class="pg-h"><h1 class="h1">${t("로비 설정 가이드", "Lobby setup guide")}</h1><p class="lede">${t("옵션을 고르면 그 조합에 맞는 방 만드는 순서가 바로 만들어집니다.", "Pick your options and get the exact room-creation steps for that combination.")}</p></header>
      <div class="g1-grid">
        <div class="g1-cfg bracket" data-cfg></div>
        <div class="g1-steps bracket"><h2 class="h2">${t("진행 순서", "Steps")}</h2><div data-steps></div></div>
        <div class="g1-prev bracket"><h2 class="h2">${t("대기실 미리보기", "Lobby preview")}</h2><div data-prev></div>
          <div class="g1-conv"><h3>${t("편의성 모드 기능", "Convenience Mode features")}</h3><ul>${convList().map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div></div>
      </div></section>`,
    mount(root) {
      const c = root.querySelector("[data-cfg]"), s = root.querySelector("[data-steps]"), p = root.querySelector("[data-prev]");
      const draw = () => { c.innerHTML = ctlHtml("g1"); s.innerHTML = stepsOl("steps"); p.innerHTML = lobbyHtml(); bindCtl(c, draw); };
      draw();
    },
  });

  /* ============ 2. MANUAL: procedure document ============ */
  S.guide[2] = () => {
    const toc = [["rooms", t("방 만들기", "Create a room")], ["bans", t("밴 개수 설정", "Set the ban count")], ["observer", t("옵저버 포함 방", "Room with observers")], ["convenience", t("편의성 모드", "Convenience Mode")], ["params", t("옵션 요약표", "Option summary")]];
    const base = (o) => { const keep = { ...cfg }; Object.assign(cfg, o); const r = buildSteps(); Object.assign(cfg, keep); return r; };
    const ol = (arr) => `<ol class="l2-steps">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`;
    return {
      html: `<div class="wrap g2">
        <aside class="g2-toc" aria-label="${t("목차", "Contents")}"><b>${t("이 문서", "On this page")}</b>${toc.map(([id, l]) => `<a href="#${id}">${l}</a>`).join("")}</aside>
        <article class="g2-doc">
          <h1 class="h1">${t("로비 옵션별 실행 방법", "Running BPM by lobby option")}</h1>
          <p class="lede">${t("이 문서는 방 만들기부터 경기 시작까지를 옵션별 절차로 정리합니다. 각 절차는 위에서 아래로 순서대로 따릅니다.", "This page lists the procedure from room creation to match start, per option. Follow each procedure top to bottom.")}</p>
          <section id="rooms"><h2 class="h2">${t("방 만들기", "Create a room")}</h2>${ol(base({ obs: false, bans: 3, snake: false }).slice(0, 3))}
            <p class="note">${t("전장은 BPM_Washout, BPM_Fear and Faith, BPM_Rorschach 중에서 고릅니다.", "Choose from BPM_Washout, BPM_Fear and Faith or BPM_Rorschach.")}</p></section>
          <section id="bans"><h2 class="h2">${t("밴 개수 설정", "Set the ban count")}</h2>
            <p>${t("방장은 대기실 하단의 [밴 개수]에서 0, 1, 3, 5 중 하나를 고릅니다. 각 밴은 30초 제한 시간 안에 진행하고, 밴이 끝나면 비공개 히든 픽이 열립니다.", "The host picks 0, 1, 3 or 5 under Ban count at the bottom of the lobby. Each ban has a 30-second limit; the hidden pick opens when bans end.")}</p>
            <p class="note"><b>v1.4.3</b> ${t("3밴에서 스네이크 밴 옵션을 켜면 1→2→2→1→1→2 순서로 진행합니다. 관측선, 의료선, 차원 분광기는 밴 풀에서 제외됩니다.", "With 3 bans the snake option runs 1→2→2→1→1→2. Observer, Medivac and Warp Prism are not in the ban pool.")}</p></section>
          <section id="observer"><h2 class="h2">${t("옵저버 포함 방", "Room with observers")}</h2>${ol(base({ obs: true }).slice(2, 5).concat(base({ obs: true }).slice(-1)))}
            <p class="note"><b>${t("중요", "Important")}</b> ${t("일반 [방 만들기]로 만든 방에는 옵저버 오버레이가 켜지지 않습니다.", "Rooms made with plain Create Game do not get the observer overlay.")}</p></section>
          <section id="convenience"><h2 class="h2">${t("편의성 모드", "Convenience Mode")}</h2>
            <p>${t("방장이 대기실에서 켜고 끌 수 있으며 기본값은 켜짐입니다. 켜진 경기에서는 다음 기능을 사용할 수 있습니다.", "The host toggles it in the lobby; it is on by default. When on, these features are available.")}</p>
            <ul class="bul">${convList().map((c) => `<li>${esc(c)}</li>`).join("")}</ul></section>
          <section id="params"><h2 class="h2">${t("옵션 요약표", "Option summary")}</h2>
            <div class="tscroll"><table class="tbl"><thead><tr><th>${t("옵션", "Option")}</th><th>${t("값", "Values")}</th><th>${t("효과", "Effect")}</th><th>${t("추가", "Since")}</th></tr></thead>
            <tbody>${optRows().map((r) => `<tr><td><b>${esc(r[0])}</b></td><td class="mono">${esc(r[1])}</td><td class="wrapc">${esc(r[2])}</td><td class="mono">${esc(r[3])}</td></tr>`).join("")}</tbody></table></div></section>
        </article></div>`,
    };
  };

  /* ============ 3. ARENA: wizard ============ */
  const wiz = { step: 0 };
  S.guide[3] = () => ({
    html: `<section class="wrap g3">
      <header class="pg-h"><h1 class="h1">${t("로비 세팅", "Lobby setup")}</h1></header>
      <ol class="g3-prog" data-prog></ol>
      <div class="g3-stage" data-stage></div>
      <div class="g3-nav"><button class="btn btn-sec" data-prev>${t("이전", "Back")}</button><button class="btn btn-pri" data-next>${t("다음", "Next")}${ico("arrow-right")}</button></div>
    </section>`,
    mount(root) {
      const labels = [t("전장", "Map"), t("밴", "Bans"), t("추가 옵션", "Extras"), t("실행 순서", "Your steps")];
      const stage = root.querySelector("[data-stage]"), prog = root.querySelector("[data-prog]");
      const draw = () => {
        prog.innerHTML = labels.map((l, i) => `<li class="${i === wiz.step ? "on" : i < wiz.step ? "done" : ""}"><button data-go="${i}">${l}</button></li>`).join("");
        prog.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { wiz.step = +b.dataset.go; draw(); }));
        root.querySelector("[data-prev]").disabled = wiz.step === 0;
        root.querySelector("[data-next]").style.visibility = wiz.step === 3 ? "hidden" : "visible";
        if (wiz.step === 0) stage.innerHTML = `<h2 class="g3-q">${t("어느 전장에서 하시나요?", "Which map?")}</h2><div class="g3-maps">${B.maps.map((m) => `<button class="g3-map ${cfg.map === m.id ? "on" : ""}" data-map="${m.id}" aria-pressed="${cfg.map === m.id}"><b>${esc(mname(m))}</b><span>${esc(t(m.terrainKo, m.terrainEn))}</span></button>`).join("")}</div>`;
        if (wiz.step === 1) stage.innerHTML = `<h2 class="g3-q">${t("밴은 몇 개로 할까요?", "How many bans?")}</h2><div class="g3-bans">${[0, 1, 3, 5].map((n) => `<button class="g3-ban ${cfg.bans === n ? "on" : ""}" data-bans="${n}" aria-pressed="${cfg.bans === n}"><b class="mono">${n}</b><span>${Array.from({ length: n }, () => "<i></i>").join("") || "&nbsp;"}</span></button>`).join("")}</div>
          <label class="tgl g3-snake"><input type="checkbox" data-k="snake" ${cfg.snake ? "checked" : ""} ${cfg.bans < 3 ? "disabled" : ""}><span class="sw"></span><span>${t("스네이크 밴 (3밴 이상에서 사용)", "Snake ban (needs 3+ bans)")}</span></label>`;
        if (wiz.step === 2) stage.innerHTML = `<h2 class="g3-q">${t("추가로 켤 옵션이 있나요?", "Anything else to switch on?")}</h2><div class="g3-extras">
          <label class="g3-ex"><span class="tgl"><input type="checkbox" data-k="conv" ${cfg.conv ? "checked" : ""}><span class="sw"></span></span><b>${t("편의성 모드", "Convenience Mode")}</b><span>${t("생산, 연구, 공방업, 보급품 HUD와 가스 일꾼 자동 배치", "Production, research, upgrade and supply HUD with gas-worker auto-fill")}</span></label>
          <label class="g3-ex"><span class="tgl"><input type="checkbox" data-k="obs" ${cfg.obs ? "checked" : ""}><span class="sw"></span></span><b>${t("옵저버 포함", "Include observers")}</b><span>${t("중계진과 심판을 위한 전용 밴픽 오버레이", "Broadcast draft overlay for casters and referees")}</span></label></div>`;
        if (wiz.step === 3) stage.innerHTML = `<h2 class="g3-q">${t("이 순서대로 따라 하세요", "Follow these steps")}</h2>${stepsOl("steps g3-steps")}<button class="btn btn-sec" data-copy>${ico("copy")}<span>${t("순서 복사", "Copy steps")}</span></button>`;
        stage.querySelectorAll("[data-map]").forEach((b) => b.addEventListener("click", () => { cfg.map = b.dataset.map; draw(); }));
        stage.querySelectorAll("[data-bans]").forEach((b) => b.addEventListener("click", () => { cfg.bans = +b.dataset.bans; if (cfg.bans < 3) cfg.snake = false; draw(); }));
        stage.querySelectorAll("[data-k]").forEach((i) => i.addEventListener("change", () => { cfg[i.dataset.k] = i.checked; draw(); }));
        const cp = stage.querySelector("[data-copy]");
        cp && cp.addEventListener("click", () => { try { navigator.clipboard.writeText(buildSteps().map((x, i) => `${i + 1}. ${x}`).join("\n")); cp.lastElementChild.textContent = t("복사됨", "Copied"); } catch (e) { cp.lastElementChild.textContent = t("복사 불가", "Copy unavailable"); } });
      };
      root.querySelector("[data-prev]").addEventListener("click", () => { wiz.step = Math.max(0, wiz.step - 1); draw(); });
      root.querySelector("[data-next]").addEventListener("click", () => { wiz.step = Math.min(3, wiz.step + 1); draw(); });
      draw();
    },
  });

  /* ============ 4. MIX: document (2) wrapping the wizard (3) + draft replay ============ */
  S.guide[4] = () => {
    const wz = S.guide[3](), doc = S.guide[2]().html;
    const tailHtml = doc.slice(doc.indexOf('<section id="rooms">'), doc.lastIndexOf("</article>"));
    const toc = [["setup", t("로비 세팅", "Lobby setup")], ["draft", t("드래프트 체험", "Draft rehearsal")], ["rooms", t("방 만들기", "Create a room")], ["bans", t("밴 개수 설정", "Set the ban count")], ["observer", t("옵저버 포함 방", "Room with observers")], ["convenience", t("편의성 모드", "Convenience Mode")], ["params", t("옵션 요약표", "Option summary")]];
    return {
      html: `<div class="wrap g2 g4">
        <aside class="g2-toc" aria-label="${t("목차", "Contents")}"><b>${t("이 문서", "On this page")}</b>${toc.map(([id, l]) => `<a href="#${id}">${l}</a>`).join("")}</aside>
        <article class="g2-doc">
          <header class="pg-h"><h1 class="h1">${t("가이드", "Guide")}</h1><p class="lede">${t("옵션을 고르면 방 만드는 순서가 만들어지고, 아래에서 밴과 히든 픽을 미리 연습할 수 있습니다.", "Pick your options to get the room steps, then rehearse the ban and hidden pick below.")}</p></header>
          <section id="setup"><h2 class="h2">${t("로비 세팅", "Lobby setup")}</h2>${wz.html}</section>
          <section id="draft"><h2 class="h2">${t("드래프트 체험", "Draft rehearsal")}</h2>
            <p>${t("밴 개수를 고르고 유닛을 눌러 밴해 보세요. 재생 버튼은 무작위 밴을 자동으로 보여줍니다. 밴이 끝나면 히든 픽 연습이 열립니다.", "Choose a ban count and click units to ban them. Replay shows random bans automatically. When bans end, the hidden pick rehearsal opens.")}</p>
            ${window.H.draftKit.html()}</section>
          ${tailHtml}
        </article></div>`,
      mount(root) { wz.mount(root); window.H.draftKit.mount(root); },
    };
  };
})();
