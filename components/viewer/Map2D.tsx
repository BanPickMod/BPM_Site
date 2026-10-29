"use client";

import { useEffect, useRef } from "react";
import type { Clock } from "@/lib/replay/clock";
import type { MapGrid } from "@/lib/replay/mapAsset";
import { posAt, type Model, type Unit } from "@/lib/replay/timeline";
import { squadsAt, type CostOf, type Squad } from "@/lib/replay/squads";
import { flatMapCanvas } from "./terrain";
import { drawBadge, imageCache } from "./squadBadge";

export interface Hover { unit: Unit; x: number; y: number }

const OWNER_CSS = { 1: "#38bdf8", 2: "#f59e0b" } as const;
const PICK_CSS = "#d6f542";

/** Flat top-down map on a canvas: the fallback for phones, weak GPUs and replays whose map has no terrain asset. */
export function Map2D({ model, map, clock, onHover, onSelect, selected, squads = false, iconOfType, costOf }: { squads?: boolean; iconOfType?: (type: string) => string | null; costOf?: CostOf; model: Model; map: MapGrid | null; clock: Clock; onHover: (h: Hover | null) => void; onSelect: (u: Unit | null) => void; selected: Unit | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = wrap.current!, canvas = cv.current!, g = canvas.getContext("2d")!;
    // world bounds in full-map cells
    let bx0 = 0, by0 = 0, bw = 1, bh = 1;
    if (map) { bx0 = map.x0; by0 = map.y0; bw = map.w; bh = map.h; }
    else {
      let x1 = 0, y1 = 0, x0 = Infinity, y0 = Infinity;
      for (const u of model.units) { x0 = Math.min(x0, u.x0); y0 = Math.min(y0, u.y0); x1 = Math.max(x1, u.x0); y1 = Math.max(y1, u.y0); }
      if (x0 === Infinity) { x0 = 0; y0 = 0; x1 = 100; y1 = 100; }
      bx0 = x0 - 6; by0 = y0 - 6; bw = x1 - x0 + 12; bh = y1 - y0 + 12;
    }
    const terrain: HTMLCanvasElement | null = map ? flatMapCanvas(map, 4) : null;   // drawn once, with the map's features marked
    let cw = 0, ch = 0, s = 1, ox = 0, oy = 0, dpr = 1;
    const sx = (x: number) => ox + (x - bx0) * s, sy = (y: number) => oy + (bh - (y - by0)) * s;

    const iconImage = imageCache(() => { squadAt = -1; draw(); });
    let squadAt = -1, squadList: Squad[] = [];
    const badge = document.createElement("canvas"); badge.width = 256; badge.height = 88;
    function drawSquads(t: number) {
      if (!squads || !costOf || !iconOfType) return;
      if (squadAt < 0 || Math.abs(t - squadAt) >= 0.4) {
        squadAt = t;
        squadList = [...squadsAt(model, 1, t, costOf).slice(0, 8), ...squadsAt(model, 2, t, costOf).slice(0, 8)];
      }
      const bw2 = Math.min(104, Math.max(70, cw * 0.1)), bh2 = bw2 * 88 / 256;
      for (const q of squadList) {
        drawBadge(badge.getContext("2d")!, 256, 88, q, (type) => iconImage(iconOfType(type)));
        g.drawImage(badge, sx(q.x) - bw2 / 2, sy(q.y) - bh2 - 8, bw2, bh2);
      }
    }

    function draw() {
      const t = clock.t, W = model.windowSec;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = "#07080f"; g.fillRect(0, 0, cw, ch);
      if (terrain) { g.imageSmoothingEnabled = false; g.drawImage(terrain, ox, oy, bw * s, bh * s); }
      else { g.strokeStyle = "#242a4a"; g.strokeRect(ox, oy, bw * s, bh * s); }
      if (map) {
        g.fillStyle = "#4aa8ff";
        map.res.forEach(([x, y], i) => { g.fillStyle = map.resRich[i] ? "#ffe660" : "#4aa8ff"; g.fillRect(sx(x + map.x0) - 1, sy(y + map.y0) - 1, map.resRich[i] ? 3 : 2, map.resRich[i] ? 3 : 2); });
      }
      for (const b of model.battles) {
        if (t < b.t0 - 3 || t > b.t1 + 6) continue;
        g.beginPath(); g.arc(sx(b.cx), sy(b.cy), 13 * s, 0, 6.283); g.fillStyle = `rgba(255,68,88,${0.14 + 0.1 * Math.sin(t * 5)})`; g.fill();
      }
      for (const u of model.units) {
        if (u.kind !== "structure") continue;
        const p = posAt(u, t, W); if (!p) continue;
        g.fillStyle = OWNER_CSS[u.owner]; const r = /commandcenter|orbital|planetary|hatchery|lair|hive|nexus/i.test(u.type) ? 3.2 : 1.7;
        g.globalAlpha = 1 - 0.45 * (p.air ?? 0);          // a building in the air is drawn paler
        g.fillRect(sx(p.x) - r * s, sy(p.y) - r * s, r * 2 * s, r * 2 * s);
        g.globalAlpha = 1;
      }
      for (const u of model.units) {
        if (u.kind !== "army") continue;
        const p = posAt(u, t, W); if (!p) continue;
        const px = sx(p.x), py = sy(p.y), r = Math.max(2, 0.9 * s);
        g.globalAlpha = 0.35 + 0.65 * p.a;
        g.fillStyle = OWNER_CSS[u.owner]; g.beginPath(); g.arc(px, py, r, 0, 6.283); g.fill();
        if (u.pick) { g.strokeStyle = PICK_CSS; g.lineWidth = 1.5; g.beginPath(); g.arc(px, py, r + 2.2, 0, 6.283); g.stroke(); }
        g.globalAlpha = 1;
      }
      drawSquads(t);
      if (selected) {
        const sp = posAt(selected, t, W);
        if (sp) { g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.arc(sx(sp.x), sy(sp.y), Math.max(7, 3 * s), 0, 6.283); g.stroke(); }
      }
      for (const d of model.units) {                                         // death flashes
        if (d.kind !== "army" || !d.death || d.died > t || t - d.died > 2.2) continue;
        const a = (t - d.died) / 2.2;
        g.beginPath(); g.arc(sx(d.death[0]), sy(d.death[1]), (2 + a * 6) * Math.max(1, s / 3), 0, 6.283); g.strokeStyle = `rgba(255,190,130,${1 - a})`; g.lineWidth = 1.5; g.stroke();
      }
    }

    function resize() {
      const r = host.getBoundingClientRect(); if (!r.width || !r.height) return;
      dpr = Math.min(2, window.devicePixelRatio || 1); cw = r.width; ch = r.height;
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      s = Math.min(cw / bw, ch / bh); ox = (cw - bw * s) / 2; oy = (ch - bh * s) / 2;
      draw();
    }
    const ro = new ResizeObserver(resize); ro.observe(host); resize();
    const unsub = clock.subscribe(draw);

    const nearest = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, t = clock.t;
      let best: Unit | null = null, bd = 144;
      for (const u of model.units) {
        if (u.kind === "worker") continue;
        const p = posAt(u, t, model.windowSec);
        if (!p) continue;
        const d = (sx(p.x) - mx) ** 2 + (sy(p.y) - my) ** 2;
        if (d < bd) { bd = d; best = u; }
      }
      return { best, mx, my };
    };
    let last = 0;
    const onMove = (e: PointerEvent) => {
      const now = performance.now(); if (now - last < 60) return; last = now;
      const { best, mx, my } = nearest(e);
      onHover(best ? { unit: best, x: mx, y: my } : null);
    };
    const onLeave = () => onHover(null);
    const onClick = (e: MouseEvent) => onSelect(nearest(e as PointerEvent).best);
    canvas.addEventListener("pointermove", onMove); canvas.addEventListener("pointerleave", onLeave); canvas.addEventListener("click", onClick);
    return () => { unsub(); ro.disconnect(); canvas.removeEventListener("pointermove", onMove); canvas.removeEventListener("pointerleave", onLeave); canvas.removeEventListener("click", onClick); };
  }, [model, map, clock, onHover, onSelect, selected, squads, iconOfType, costOf]);

  return (
    <div ref={wrap} className="vw-canvas">
      <canvas ref={cv} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
}
