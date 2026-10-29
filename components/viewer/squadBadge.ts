import type { Squad } from "@/lib/replay/squads";

/** Colours of the two sides, as on the rest of the viewer. */
export const BADGE_COLOR = { 1: "#38bdf8", 2: "#f59e0b" } as const;
const PICK = "#d6f542";

/** Loads each icon once. `onLoad` runs when one arrives so the caller can redraw. */
export function imageCache(onLoad: () => void): (url: string | null) => HTMLImageElement | null {
  const images = new Map<string, HTMLImageElement>();
  return (url) => {
    if (!url) return null;
    let img = images.get(url);
    if (!img) {
      img = new Image();
      img.onload = onLoad;
      img.src = url;
      images.set(url, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  };
}

/**
 * One squad's badge: the icons of the two unit types that make up most of its value, each with its count, in the side's colour.
 * A drafted pick is circled in lime. Drawn on any 2D canvas of size w x h (the 3D view uses it as a texture, the flat map draws it directly).
 */
export function drawBadge(g: CanvasRenderingContext2D, w: number, h: number, squad: Squad, iconOfType: (type: string) => HTMLImageElement | null): void {
  const r = h * 0.22, pad = h * 0.1, top = squad.comp.slice(0, 2);
  g.clearRect(0, 0, w, h);
  g.fillStyle = "rgba(8,10,18,0.86)";
  g.strokeStyle = BADGE_COLOR[squad.owner];
  g.lineWidth = Math.max(2, h * 0.07);
  g.beginPath(); g.roundRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth, r); g.fill(); g.stroke();
  const slotW = (w - pad * 2) / Math.max(1, top.length), icon = h - pad * 2 - g.lineWidth;
  top.forEach((c, i) => {
    const x = pad + i * slotW, y = (h - icon) / 2;
    const img = iconOfType(c.type);
    if (img) g.drawImage(img, x, y, icon, icon);
    else { g.fillStyle = "#1c2433"; g.fillRect(x, y, icon, icon); g.fillStyle = "#cfd8e8"; g.font = `bold ${icon * 0.55}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(c.type[0] ?? "?", x + icon / 2, y + icon / 2); }
    if (c.pick) { g.strokeStyle = PICK; g.lineWidth = Math.max(2, h * 0.06); g.strokeRect(x, y, icon, icon); }
    g.fillStyle = "#ffffff"; g.font = `bold ${h * 0.42}px sans-serif`; g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText(`×${c.count}`, x + icon + h * 0.06, h / 2 + h * 0.02);
  });
}
