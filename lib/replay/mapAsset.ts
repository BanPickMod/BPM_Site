/**
 * Terrain asset written by scripts/maps/export_map_assets.py (public/maps/<id>.json): the playable area cropped out of the
 * engine's grids. Positions in the timeline are full-map cells; subtract (x0, y0) to index into this crop.
 */
export interface RawMapAsset {
  id: string;
  name: string;
  w: number;
  h: number;
  x0: number;
  y0: number;
  ht: string;
  flags: string;
  starts: [number, number][];
  exps: [number, number][];
  res: [number, number][];
  /** Added with the placement list: geysers, theme name, doodads and special units. Older assets lack them. */
  gas?: [number, number][];
  tileSet?: string;
  classes?: string[];
  doodads?: [number, number, number, number, number][];
  units?: [string, number, number, number, number, number][];
  /** The map's own colours, read from the minimap in the map file (scripts/maps/export_palettes.py). Each is [r, g, b] in 0..1. */
  /** Positions (full-map cells) of the rich mineral fields and rich geysers (scripts/maps/export_palettes.py). */
  rich?: [number, number][];
  richGas?: [number, number][];
  palette?: Record<"lo" | "mid" | "hi" | "cliff" | "stone" | "building" | "rockTop", [number, number, number]>;
}

/** What the map maker placed, classified (grass, tree, rock, column, ruin, building, wall, crystal, prop). Positions are crop cells. */
export interface Doodad { cls: string; x: number; y: number; rot: number; scale: number }
export interface SpecialUnit { kind: "dest" | "plate" | "tower"; x: number; y: number; w: number; h: number; diagonal: boolean }

export interface MapGrid {
  id: string;
  name: string;
  w: number;
  h: number;
  x0: number;
  y0: number;
  /** Row 0 is the lowest y. */
  height: Uint8Array;
  pathable: Uint8Array;
  buildable: Uint8Array;
  /** Already in crop cells. */
  starts: [number, number][];
  exps: [number, number][];
  res: [number, number][];
  hMin: number;
  hMax: number;
  gas: [number, number][];
  tileSet: string;
  doodads: Doodad[];
  special: SpecialUnit[];
  palette: RawMapAsset["palette"] | null;
  /** Same order as `res` and `gas`: true for a rich mineral field or a rich geyser, which the viewer draws in gold. */
  resRich: boolean[];
  gasRich: boolean[];
}

function b64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Whether a listed position is on this one: the object lists and the engine's grids disagree by a fraction of a cell. */
const near = (list: [number, number][] | undefined, x: number, y: number) => !!list?.some(([a, b]) => Math.hypot(a - x, b - y) < 1.6);

export function decodeMap(raw: RawMapAsset): MapGrid {
  const n = raw.w * raw.h;
  const height = b64(raw.ht), flags = b64(raw.flags);
  if (height.length !== n || flags.length !== n) throw new Error("map asset size mismatch");
  const pathable = new Uint8Array(n), buildable = new Uint8Array(n);
  let hMin = 255, hMax = 0;
  for (let i = 0; i < n; i++) {
    pathable[i] = flags[i] & 1;
    buildable[i] = (flags[i] >> 1) & 1;
    if (pathable[i]) { if (height[i] < hMin) hMin = height[i]; if (height[i] > hMax) hMax = height[i]; }
  }
  if (hMin > hMax) { hMin = 0; hMax = 1; }
  const local = (p: [number, number]): [number, number] => [p[0] - raw.x0, p[1] - raw.y0];
  return { id: raw.id, name: raw.name, w: raw.w, h: raw.h, x0: raw.x0, y0: raw.y0, height, pathable, buildable,
    starts: raw.starts.map(local), exps: raw.exps.map(local), res: raw.res.map(local), hMin, hMax,
    gas: (raw.gas ?? []).map(local), tileSet: raw.tileSet ?? "",
    doodads: (raw.doodads ?? []).map(([c, x, y, rot, scale]) => ({ cls: raw.classes?.[c] ?? "prop", x: x - raw.x0, y: y - raw.y0, rot, scale })),
    special: (raw.units ?? []).map(([kind, x, y, w, h, d]) => ({ kind: kind as SpecialUnit["kind"], x: x - raw.x0, y: y - raw.y0, w, h, diagonal: d === 1 })), palette: raw.palette ?? null,
    resRich: raw.res.map(([x, y]) => near(raw.rich, x, y)), gasRich: (raw.gas ?? []).map(([x, y]) => near(raw.richGas, x, y)) };
}
