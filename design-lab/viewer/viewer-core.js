/*
 * Shared engine for the replay-viewer layout mockups (design-lab/viewer/viewer-*.html).
 * Real data: one human game on BPM_Rorschach (viewer-data.js), real terrain grid from the engine.
 * Mockup quality, not product code: it exists so layouts can be judged with a moving map, a live clock and real draft data.
 */
(function () {
  const D = window.VIEWER_DATA;
  const P_COLOR = { 1: "#38bdf8", 2: "#f59e0b" };   // not red (= ban) and not lime (= pick)
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  const WORKERS = new Set(["SCV", "Drone", "Probe", "MULE"]);
  const SKIP = /^(Larva|Egg|Broodling|Changeling|Beacon|Creep|Auto|Interceptor|Locust)/;
  const BIG = new Set(["CommandCenter", "OrbitalCommand", "PlanetaryFortress", "Hatchery", "Lair", "Hive", "Nexus"]);

  // ---------- clock ----------
  const Clock = {
    t: 0, speed: 4, playing: false, fns: new Set(), last: 0,
    on(fn) { this.fns.add(fn); fn(this.t); return () => this.fns.delete(fn); },
    set(t) { this.t = Math.max(0, Math.min(D.duration, t)); this.fns.forEach((f) => f(this.t)); },
    play() { if (this.t >= D.duration - 0.5) this.t = 0; this.playing = true; this.last = performance.now(); requestAnimationFrame(this.tick); this.fns.forEach((f) => f(this.t)); },
    pause() { this.playing = false; this.fns.forEach((f) => f(this.t)); },
    toggle() { this.playing ? this.pause() : this.play(); },
    tick: (now) => {
      if (!Clock.playing) return;
      const dt = (now - Clock.last) / 1000; Clock.last = now;
      Clock.set(Clock.t + dt * Clock.speed);
      if (Clock.stopAt != null && Clock.t >= Clock.stopAt) { Clock.stopAt = null; Clock.pause(); return; }
      if (Clock.t >= D.duration) Clock.pause(); else requestAnimationFrame(Clock.tick);
    },
  };

  // ---------- terrain ----------
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const M = D.map;
  const pa = b64(M.pa), ht = b64(M.ht), pl = b64(M.pl);
  // Crop to the playable island: the stored grid has a wide empty border that would shrink the picture.
  const bb = (() => {
    let x0 = M.w, y0 = M.h, x1 = 0, y1 = 0;
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) if (pa[y * M.w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const m = 3;
    return { x0: Math.max(0, x0 - m), y0: Math.max(0, y0 - m), x1: Math.min(M.w, x1 + m), y1: Math.min(M.h, y1 + m) };
  })();
  const BW = bb.x1 - bb.x0, BH = bb.y1 - bb.y0;
  let terrain = null;
  function buildTerrain() {
    if (terrain) return terrain;
    const c = document.createElement("canvas"); c.width = BW; c.height = BH;
    const g = c.getContext("2d"), img = g.createImageData(BW, BH);
    let lo = 255, hi = 0;
    for (let i = 0; i < pa.length; i++) if (pa[i]) { lo = Math.min(lo, ht[i]); hi = Math.max(hi, ht[i]); }
    for (let y = bb.y0; y < bb.y1; y++) for (let x = bb.x0; x < bb.x1; x++) {
      const i = y * M.w + x, o = ((bb.y1 - 1 - y) * BW + (x - bb.x0)) * 4;      // SC2 y points up
      let r, gg, b;
      if (!pa[i]) { r = 9; gg = 11; b = 22; }
      else {
        const h = (ht[i] - lo) / Math.max(1, hi - lo), base = 34 + h * 44;
        r = base; gg = base + 4; b = base + 22;
        if (pl[i]) { r += 6; gg += 8; b += 12; }                       // buildable ground reads slightly lighter
      }
      img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    terrain = c;
    return c;
  }

  // ---------- units ----------
  const pickSets = D.draft.map((p) => p.picks.map((x) => norm(x.unit)));
  const isPick = (owner, type) => pickSets[owner - 1]?.some((n) => norm(type).includes(n)) || false;
  const units = D.units.map((u) => ({
    type: u[0], owner: u[1], t0: u[2], t1: u[3] ?? Infinity, x: u[4], y: u[5], building: !!u[6], dx: u[7], dy: u[8], killer: u[9], track: u[10],
    worker: WORKERS.has(u[0]), skip: SKIP.test(u[0]), pick: isPick(u[1], u[0]),
  })).filter((u) => !u.skip);

  function posAt(u, t) {
    const tr = u.track;
    if (!tr.length) return [u.x, u.y];
    if (t <= tr[0][0]) return [u.x, u.y];
    for (let i = 1; i < tr.length; i++) if (t <= tr[i][0]) {
      const a = tr[i - 1], b = tr[i], k = (t - a[0]) / Math.max(0.01, b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
    const l = tr[tr.length - 1];
    return [l[1], l[2]];
  }

  // ---------- derived: battles, pick first-seen, stats ----------
  const deaths = units.filter((u) => u.t1 < Infinity && u.dx != null && !u.worker).sort((a, b) => a.t1 - b.t1);
  const battles = [];
  (() => {
    let cur = null;
    for (const d of deaths) {
      if (!cur || d.t1 - cur.t1 > 14) { cur = { t0: d.t1, t1: d.t1, ds: [] }; battles.push(cur); }
      cur.t1 = d.t1; cur.ds.push(d);
    }
    for (let i = battles.length - 1; i >= 0; i--) if (battles[i].ds.length < 7) battles.splice(i, 1);
    battles.forEach((b, i) => {
      b.id = String.fromCharCode(65 + i);
      b.cx = b.ds.reduce((s, d) => s + d.dx, 0) / b.ds.length; b.cy = b.ds.reduce((s, d) => s + d.dy, 0) / b.ds.length;
      b.lost = { 1: b.ds.filter((d) => d.owner === 1).length, 2: b.ds.filter((d) => d.owner === 2).length };
      b.picksLost = b.ds.filter((d) => d.pick).length;
      b.winner = b.lost[1] === b.lost[2] ? 0 : b.lost[1] < b.lost[2] ? 1 : 2;
      b.size = b.ds.length;
    });
  })();

  const firstSeen = D.draft.map((p, i) => p.picks.map((pk) => {
    const n = norm(pk.unit), ts = units.filter((u) => u.owner === i + 1 && !u.building && norm(u.type).includes(n)).map((u) => u.t0);
    return { unit: pk.unit, replaces: pk.replaces, t: ts.length ? Math.min(...ts) : null, count: ts.length };
  }));

  function statAt(p, t) {
    const s = D.stats[p]; if (!s || !s.length) return null;
    let lo = 0, hi = s.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m].t <= t) lo = m; else hi = m - 1; }
    return s[lo];
  }
  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
  const num = (n) => Math.round(n).toLocaleString("en-US");

  // ---------- map view ----------
  function mountMap(canvas, opts = {}) {
    const g = canvas.getContext("2d");
    const o = { workers: false, ...opts };
    function size() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    }
    function draw(t) {
      const W = canvas.width, H = canvas.height, sc = Math.min(W / BW, H / BH), ox = (W - BW * sc) / 2, oy = (H - BH * sc) / 2;
      g.fillStyle = "#07080f"; g.fillRect(0, 0, W, H);
      g.imageSmoothingEnabled = true; g.drawImage(buildTerrain(), ox, oy, BW * sc, BH * sc);
      const X = (x) => ox + (x - bb.x0) * sc, Y = (y) => oy + (bb.y1 - y) * sc;
      // buildings
      for (const u of units) {
        if (!u.building || t < u.t0 || t >= u.t1) continue;
        const s = (BIG.has(u.type) ? 5.2 : 2.6) * sc;
        g.fillStyle = P_COLOR[u.owner] + "cc"; g.fillRect(X(u.x) - s / 2, Y(u.y) - s / 2, s, s);
      }
      // moving units
      for (const u of units) {
        if (u.building || u.worker && !o.workers || t < u.t0 || t >= u.t1 || !u.track.length) continue;
        const [x, y] = posAt(u, t), r = (u.pick ? 1.9 : 1.2) * sc;
        g.beginPath(); g.arc(X(x), Y(y), r, 0, 6.283); g.fillStyle = P_COLOR[u.owner]; g.fill();
        if (u.pick) { g.lineWidth = Math.max(1, sc * 0.55); g.strokeStyle = "#d6f542"; g.stroke(); }   // picked units get the lime ring
      }
      // deaths: short fading cross where something died
      for (const u of deaths) {
        if (t < u.t1 || t > u.t1 + 4) continue;
        const a = 1 - (t - u.t1) / 4, s = (2 + (t - u.t1)) * sc;
        g.strokeStyle = `rgba(255,255,255,${a * 0.85})`; g.lineWidth = Math.max(1, sc * 0.4);
        g.beginPath(); g.moveTo(X(u.dx) - s, Y(u.dy) - s); g.lineTo(X(u.dx) + s, Y(u.dy) + s); g.moveTo(X(u.dx) + s, Y(u.dy) - s); g.lineTo(X(u.dx) - s, Y(u.dy) + s); g.stroke();
      }
      // active battle ring
      for (const b of battles) if (t >= b.t0 - 2 && t <= b.t1 + 6) {
        const k = (t - b.t0) % 1.6 / 1.6;
        g.strokeStyle = `rgba(255,68,88,${1 - k})`; g.lineWidth = 2 * sc * 0.5;
        g.beginPath(); g.arc(X(b.cx), Y(b.cy), (6 + k * 10) * sc, 0, 6.283); g.stroke();
      }
    }
    size(); new ResizeObserver(() => { size(); draw(Clock.t); }).observe(canvas);
    Clock.on(draw);
    return { redraw: () => draw(Clock.t), setOpt: (k, v) => { o[k] = v; draw(Clock.t); } };
  }

  // ---------- transport ----------
  function mountTransport(el, opts = {}) {
    el.classList.add("vw-transport");
    el.innerHTML = `<button class="vw-play" aria-label="play">▶</button>
      <span class="vw-speeds">${[1, 2, 4, 8].map((s) => `<button data-s="${s}">${s}x</button>`).join("")}</span>
      <span class="vw-time"><b data-time>0:00</b> / ${fmt(D.duration)}</span>
      ${opts.scrub === false ? "" : `<input class="vw-scrub" type="range" min="0" max="${D.duration}" step="0.5" value="0" aria-label="time" />`}`;
    const play = el.querySelector(".vw-play"), speeds = [...el.querySelectorAll("[data-s]")], scrub = el.querySelector(".vw-scrub");
    play.onclick = () => Clock.toggle();
    speeds.forEach((b) => (b.onclick = () => { Clock.speed = +b.dataset.s; sync(); }));
    if (scrub) scrub.oninput = () => Clock.set(+scrub.value);
    function sync() { speeds.forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.s === Clock.speed))); play.textContent = Clock.playing ? "❚❚" : "▶"; }
    Clock.on((t) => { el.querySelector("[data-time]").textContent = fmt(t); if (scrub && document.activeElement !== scrub) scrub.value = t; sync(); });
    document.addEventListener("keydown", (e) => {
      if (/input|textarea/i.test(e.target.tagName) && e.target.type !== "range") return;
      if (e.code === "Space") { e.preventDefault(); Clock.toggle(); }
      if (e.code === "ArrowRight") Clock.set(Clock.t + 5);
      if (e.code === "ArrowLeft") Clock.set(Clock.t - 5);
    });
  }

  // ---------- timeline with tracks ----------
  function mountTimeline(el, opts = {}) {
    el.classList.add("vw-tl");
    const pct = (t) => (t / D.duration) * 100;
    const ticks = []; for (let m = 0; m * 60 <= D.duration; m += 2) ticks.push(`<i style="left:${pct(m * 60)}%"><span>${m}:00</span></i>`);
    const bt = battles.map((b) => `<button class="vw-b" data-t="${b.t0}" style="left:${pct(b.t0)}%;width:${Math.max(1.2, pct(b.t1 - b.t0))}%" title="${b.id}: ${fmt(b.t0)}">${b.id}</button>`).join("");
    const pk = firstSeen.flatMap((ps, i) => ps.filter((p) => p.t != null).map((p) => `<button class="vw-pk p${i + 1}" data-t="${p.t}" style="left:${pct(p.t)}%" title="${(D.meta[p.unit] || {}).ko || p.unit} ${fmt(p.t)}">◆</button>`)).join("");
    el.innerHTML = `<div class="vw-ruler">${ticks.join("")}</div>
      ${opts.picks === false ? "" : `<div class="vw-track"><em>${opts.pickLabel || "픽 등장"}</em>${pk}</div>`}
      <div class="vw-track"><em>교전</em>${bt}</div>
      ${opts.chart === false ? "" : `<div class="vw-track vw-chart"><em>병력</em><canvas></canvas></div>`}
      <div class="vw-head"></div>`;
    el.querySelectorAll("[data-t]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); Clock.set(+b.dataset.t - 2); }));
    const head = el.querySelector(".vw-head");
    const area = el.querySelector(".vw-ruler");
    const seek = (e) => { const r = area.getBoundingClientRect(); Clock.set(((e.clientX - r.left) / r.width) * D.duration); };
    let drag = false;
    el.addEventListener("pointerdown", (e) => { if (e.target.closest("[data-t]")) return; drag = true; seek(e); el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove", (e) => drag && seek(e));
    el.addEventListener("pointerup", () => (drag = false));
    const cv = el.querySelector("canvas");
    if (cv) drawChart(cv, "army", { head: false });
    // The ruler excludes the label column, so place the playhead from the ruler's own geometry.
    Clock.on((t) => { head.style.left = `${area.offsetLeft + (t / D.duration) * area.offsetWidth}px`; });
  }

  // ---------- line chart of a stat for both players ----------
  function drawChart(cv, key, opts = {}) {
    const g = cv.getContext("2d");
    function render(t) {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      const W = cv.width, H = cv.height, S = D.stats;
      const max = Math.max(1, ...[1, 2].flatMap((p) => S[p].map((s) => s[key])));
      g.clearRect(0, 0, W, H);
      for (const p of [1, 2]) {
        g.beginPath();
        S[p].forEach((s, i) => { const x = (s.t / D.duration) * W, y = H - (s[key] / max) * (H - 4) - 2; i ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.strokeStyle = P_COLOR[p]; g.lineWidth = 1.6 * dpr; g.stroke();
        if (opts.fill) { g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fillStyle = P_COLOR[p] + "22"; g.fill(); }
      }
      if (opts.head !== false) { const x = (t / D.duration) * W; g.fillStyle = "#fff"; g.fillRect(x - 1, 0, 2, H); }
    }
    new ResizeObserver(() => render(Clock.t)).observe(cv);
    if (opts.head === false) render(0); else Clock.on(render);
  }

  // ---------- generic bindings: <b data-stat="1.wk"> follows the clock ----------
  function bindStats(root = document) {
    const els = [...root.querySelectorAll("[data-stat]")];
    const tmpl = { min: num, gas: num, inc: num, incg: num, wk: num, sup: num, cap: num, army: num, killed: num, lost: num };
    Clock.on((t) => els.forEach((e) => {
      const [p, k] = e.dataset.stat.split("."); const s = statAt(+p, t); if (!s) return;
      e.textContent = tmpl[k](s[k]);
    }));
    root.querySelectorAll("[data-time]").forEach(() => {});
  }

  // ---------- draft bits ----------
  const icon = (id) => { const m = D.meta[id]; return m && m.icon ? `../../public${m.icon}` : ""; };
  const name = (id) => (D.meta[id] && D.meta[id].ko) || id;
  const chip = (id, kind, extra = "") => `<span class="vw-unit ${kind || ""}">${icon(id) ? `<img src="${icon(id)}" alt="" width="28" height="28">` : ""}<span>${name(id)}</span>${extra}</span>`;
  const raceImg = (race) => `<img class="vw-race" src="../../public/images/race/${race}.webp" alt="${race}" width="22" height="22">`;
  function draftHTML(i, opts = {}) {
    const p = D.draft[i];
    const picks = p.picks.map((x) => `<li>${chip(x.unit, "pick")}${x.replaces ? `<span class="vw-repl">← ${chip(x.replaces, "")}</span>` : ""}</li>`).join("");
    const bans = p.bans.map((b) => `<li>${chip(b, "ban")}</li>`).join("");
    return { picks: picks || `<li class="vw-dim">기본 유닛 유지</li>`, bans: bans || `<li class="vw-dim">없음</li>` };
  }


  // ---------- pick usage, army composition, build log (draft-centric analysis for the mockups) ----------
  function pickUsage(i, t) {
    return D.draft[i].picks.map((pk) => {
      const n = norm(pk.unit), mine = units.filter((u) => u.owner === i + 1 && !u.building && norm(u.type).includes(n));
      const made = mine.filter((u) => u.t0 <= t), lost = made.filter((u) => u.t1 <= t);
      const all = mine.length;
      return { unit: pk.unit, replaces: pk.replaces, made: made.length, alive: made.length - lost.length, lost: lost.length, total: all,
               first: all ? Math.min(...mine.map((u) => u.t0)) : null, unused: all === 0 };
    });
  }
  const armyUnits = (o) => units.filter((u) => u.owner === o && !u.building && !u.worker && !/Overlord|Overseer|Larva|Egg|Medivac|Drone|MULE/.test(u.type));
  const comp = [1, 2].map((o) => {
    const us = armyUnits(o), out = [];
    for (let t = 0; t <= D.duration; t += 5) {
      let pick = 0, other = 0;
      for (const u of us) if (u.t0 <= t && t < u.t1) (u.pick ? pick++ : other++);
      out.push({ t, pick, other });
    }
    return out;
  });
  function drawComp(cv, o, opts = {}) {
    const g = cv.getContext("2d"), S = comp[o - 1], max = Math.max(1, ...comp.flat().map((s) => s.pick + s.other));
    function render(t) {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
      const W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
      const X = (t_) => (t_ / D.duration) * W, Y = (v) => H - (v / max) * (H - 3);
      const area = (key, color, base) => { g.beginPath(); g.moveTo(X(0), Y(0)); S.forEach((s) => g.lineTo(X(s.t), Y(base(s) + s[key]))); g.lineTo(X(D.duration), Y(0)); g.closePath(); g.fillStyle = color; g.fill(); };
      area("other", P_COLOR[o] + "66", () => 0);
      area("pick", "#d6f542cc", (s) => s.other);
      if (opts.head !== false) { g.fillStyle = "#fff"; g.fillRect(X(t) - 1, 0, 2, H); }
    }
    new ResizeObserver(() => render(Clock.t)).observe(cv); Clock.on(render);
  }
  function buildLog(o, limit = 40) {
    const seen = new Set(), out = [];
    for (const u of units.filter((u) => u.owner === o && !u.worker).sort((a, b) => a.t0 - b.t0)) {
      if (seen.has(u.type) || /^(Supply|Overlord|Extractor|Refinery|Creep)/.test(u.type)) continue;
      seen.add(u.type); out.push({ t: u.t0, type: u.type, building: u.building, pick: u.pick });
    }
    return out.slice(0, limit);
  }
  Clock.range = (t0, t1, speed) => { Clock.speed = speed || 1; Clock.set(t0); Clock.stopAt = t1; Clock.play(); };

  // Korean names for buildings (the wiki has units only) and other types without a wiki entry.
  const BNAMES = { CommandCenter: "사령부", OrbitalCommand: "궤도 사령부", PlanetaryFortress: "행성 요새", Barracks: "병영", BarracksTechLab: "병영 기술 실험실", BarracksReactor: "병영 반응로",
    Factory: "군수공장", FactoryTechLab: "군수공장 기술 실험실", FactoryReactor: "군수공장 반응로", Starport: "우주공항", StarportReactor: "우주공항 반응로", StarportTechLab: "우주공항 기술 실험실",
    SupplyDepot: "보급고", SupplyDepotLowered: "보급고", Refinery: "정제소", EngineeringBay: "공학 연구소", Armory: "병기공장", FusionCore: "융합로", GhostAcademy: "유령 사관학교", Bunker: "벙커",
    MissileTurret: "미사일 포탑", SensorTower: "감지탑", Hatchery: "부화장", Lair: "번식지", Hive: "군락", SpawningPool: "산란못", RoachWarren: "바퀴 소굴", HydraliskDen: "히드라리스크 굴",
    Extractor: "추출장", EvolutionChamber: "진화장", InfestationPit: "감염 구덩이", Spire: "첨탑", SpineCrawler: "가시 촉수", SporeCrawler: "포자 촉수", SporeCrawlerUprooted: "포자 촉수(이동)",
    Nexus: "연결체", Pylon: "수정탑", Gateway: "관문", WarpGate: "차원 관문", Assimilator: "융합로", CyberneticsCore: "사이버네틱스 코어", Forge: "단조소", Stargate: "우주관문", RoboticsFacility: "로봇공학 시설",
    MULE: "MULE", Changeling: "체인질링" };
  const nameOf = (type) => (D.meta[type] && D.meta[type].ko) || BNAMES[type] || type;

  window.Viewer = { nameOf, grid: { pa, ht, pl, M, bb, BW, BH }, posAt, norm, pickUsage, comp, drawComp, buildLog, D, Clock, units, battles, firstSeen, statAt, fmt, num, chip, raceImg, draftHTML, mountMap, mountTransport, mountTimeline, drawChart, bindStats, P_COLOR };
})();
