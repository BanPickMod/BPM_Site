"""Turn the engine's terrain grids into small static assets the replay viewer loads (docs/Replay_Viewer_Plan.md section 6.3).

  python scripts/maps/export_map_assets.py [--src <engine>/runs/maps] [--out public/maps]

The private engine repo is only read here, at build time; the site never references it at runtime.
Each map becomes public/maps/<id>.json (cropped to the playable area):
  { id, name, w, h, x0, y0, ht, flags, starts, exps, res, gas, tileSet, classes, doodads, units }
    ht     base64 of w*h bytes, terrain height, row 0 = lowest y (SC2 y points up)
    flags  base64 of w*h bytes: bit0 = pathable, bit1 = buildable
    starts / exps / res / gas  positions in full-map cells (subtract x0, y0 to get cropped cells); res = mineral fields only
    doodads  [class index, x, y, rotation degrees, scale] for what the map maker placed (grass, trees, rocks, ruins, buildings...),
             classified by name in scripts/maps/map_features.py; only names/positions are read, no art is copied
    units    [kind, x, y, w, h, diagonal] destructible rocks, unbuildable plates, Xel'Naga towers
public/maps/index.json maps the map names found in replays to asset ids.
Terrain data is derived from map files by the engine's dump_map.py; no Blizzard texture or model is included.
"""
from __future__ import annotations

import argparse
import base64
import json
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from map_features import read_features  # noqa: E402

SITE = Path(__file__).resolve().parents[2]
DEFAULT_SRC = SITE.parent / "bpm-ai-engine" / "runs" / "maps"
DEFAULT_MAPS = Path("D:/StarCraft II/Maps/BPM")

# asset id -> (engine grid file, display name, replay map names that use this terrain)
MAPS = {
    "bpm-rorschach": ("BPM_AI_Rorschach", "Rorschach", ["BPM_Rorschach"]),
    "bpm-washout": ("BPM_AI_Washout", "Washout", ["BPM_Washout", "BPM_Washout_Test"]),
    "bpm-fear-and-faith": ("BPM_AI_FearAndFaith", "Fear and Faith", ["BPM_Fear and Faith"]),
    "blackrock-le": ("BPM_AI_S_Blackrock_LE", "Blackrock LE", ["Blackrock LE"]),
    "at-eternitys-edge-le": ("BPM_AI_S_At_Eternitys_Edge_LE", "At Eternity's Edge LE", ["At Eternity's Edge LE"]),
}
MARGIN = 3


def export_one(asset_id: str, src: Path, out: Path, maps_dir: Path | None = None) -> dict:
    grid_name, display, _ = MAPS[asset_id]
    z = np.load(src / f"{grid_name}.npz", allow_pickle=True)
    pa, pl, ht = z["pa"].astype(np.uint8), z["pl"].astype(np.uint8), z["ht"].astype(np.uint8)
    ys, xs = np.nonzero(pa)
    if not len(xs):
        raise ValueError(f"{grid_name}: no pathable cells")
    x0, x1 = max(0, xs.min() - MARGIN), min(pa.shape[1], xs.max() + 1 + MARGIN)
    y0, y1 = max(0, ys.min() - MARGIN), min(pa.shape[0], ys.max() + 1 + MARGIN)
    flags = (pa[y0:y1, x0:x1] & 1) | ((pl[y0:y1, x0:x1] & 1) << 1)
    doc = {
        "id": asset_id, "name": display, "w": int(x1 - x0), "h": int(y1 - y0), "x0": int(x0), "y0": int(y0),
        "ht": base64.b64encode(ht[y0:y1, x0:x1].tobytes()).decode(),
        "flags": base64.b64encode(flags.astype(np.uint8).tobytes()).decode(),
        "starts": z["starts"].round(1).tolist(), "exps": z["exps"].round(1).tolist(), "res": z["res"].round(1).tolist(),
    }
    map_file = (maps_dir or DEFAULT_MAPS) / f"{grid_name}.SC2Map"
    if map_file.exists():
        f = read_features(map_file)
        gas = f["gas"]
        # the engine grid lists minerals and geysers together: keep only what is not a geyser
        doc["res"] = [r for r in doc["res"] if all(math.hypot(r[0] - g[0], r[1] - g[1]) > 2.5 for g in gas)]
        doc.update({"gas": gas, "tileSet": f["tileSet"], "classes": f["classes"], "doodads": f["doodads"], "units": f["units"]})
    else:
        print(f"NOTE {asset_id}: no map file at {map_file}, exported without features", file=sys.stderr)
    (out / f"{asset_id}.json").write_text(json.dumps(doc, separators=(",", ":")), encoding="utf8")
    return doc


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", type=Path, default=DEFAULT_SRC)
    ap.add_argument("--maps", type=Path, default=DEFAULT_MAPS, help="folder with the .SC2Map files")
    ap.add_argument("--out", type=Path, default=SITE / "public" / "maps")
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    index = {}
    for asset_id, (_, display, names) in MAPS.items():
        try:
            d = export_one(asset_id, a.src, a.out, a.maps)
        except (FileNotFoundError, ValueError) as e:
            print(f"SKIP {asset_id}: {e}", file=sys.stderr)
            continue
        size = (a.out / f"{asset_id}.json").stat().st_size
        print(f"{asset_id:24s} {d['w']}x{d['h']} cells  {size / 1024:.0f} KB  doodads={len(d.get('doodads', []))} units={len(d.get('units', []))} gas={len(d.get('gas', []))}")
        for n in names:
            index[n] = asset_id
    (a.out / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf8")
    print(f"index.json: {len(index)} replay map names")
    return 0


if __name__ == "__main__":
    sys.exit(main())
