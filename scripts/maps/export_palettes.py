"""Read what each map's own file says and the game data does not: its colours (from the minimap picture stored inside the .SC2Map)
and which mineral fields and geysers are the rich ones. Both are written into public/maps/<id>.json.

  python scripts/maps/export_palettes.py [--maps "D:/StarCraft II/Maps/BPM"]

The replay viewer used to pick ground colours from the tile-set NAME (Aiur4City -> gold, Purification -> sand). The name says little:
Rorschach is an Aiur4City map but dark teal and silver, and Washout is green. The minimap that ships in the map file is what the
map actually looks like from above, so its colours are the source.

Rich resources: "rich" and "richGas" are the positions (full-map cells) of every RichMineralField* and RichVespeneGeyser the map places,
so the viewer can show them in gold.

Writes "palette": { lo, mid, hi, cliff, stone, building, rockTop } (each [r, g, b] in 0..1) next to the terrain data. Needs
mpyq, numpy and Pillow. Only colours are read from the map; no image is copied into the site.
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

import xml.etree.ElementTree as ET

import mpyq
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_map_assets import DEFAULT_MAPS, MAPS  # noqa: E402

SITE = Path(__file__).resolve().parents[2]
GAIN = 1.18          # the minimap is drawn a little darker than the ground looks under the viewer's light
TRIM = 0.07          # the picture has a frame (often white); only the inside is read
CLUSTERS = 6


def kmeans(px: np.ndarray, k: int, seed: int = 7, steps: int = 12) -> tuple[np.ndarray, np.ndarray]:
    """Plain k-means on colours, deterministic (seeded k-means++ start). Returns the centres and how many pixels each took."""
    rng = np.random.default_rng(seed)
    sample = px[rng.choice(len(px), size=min(len(px), 20000), replace=False)].astype(float)
    centres = [sample[rng.integers(len(sample))]]
    for _ in range(k - 1):
        d = np.min([((sample - c) ** 2).sum(axis=1) for c in centres], axis=0)
        centres.append(sample[rng.choice(len(sample), p=d / d.sum())] if d.sum() > 0 else sample[rng.integers(len(sample))])
    centres = np.array(centres)
    for _ in range(steps):
        label = np.argmin(((sample[:, None, :] - centres[None]) ** 2).sum(axis=2), axis=1)
        for j in range(k):
            if (label == j).any():
                centres[j] = sample[label == j].mean(axis=0)
    label = np.argmin(((px[:, None, :].astype(float) - centres[None]) ** 2).sum(axis=2), axis=1) if len(px) <= 60000 else None
    if label is None:
        label = np.concatenate([np.argmin(((px[i:i + 60000, None, :].astype(float) - centres[None]) ** 2).sum(axis=2), axis=1) for i in range(0, len(px), 60000)])
    return centres, np.bincount(label, minlength=k)


def palette_of(image: Image.Image) -> dict[str, list[float]]:
    full = np.asarray(image.convert("RGB")).astype(int)
    ys, xs = np.nonzero(full.mean(axis=2) > 12)                      # the playable picture inside the black padding
    box = full[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    ty, tx = int(box.shape[0] * TRIM), int(box.shape[1] * TRIM)
    px = box[ty:box.shape[0] - ty, tx:box.shape[1] - tx].reshape(-1, 3)
    lum = px.mean(axis=1)
    px = px[(lum > 22) & (lum < 215)]                                # not the void, not the frame
    centres, counts = kmeans(px, CLUSTERS)
    cl = centres.mean(axis=1)
    sat = (centres.max(axis=1) - centres.min(axis=1)) / np.maximum(centres.max(axis=1), 1)
    # Dark and grey is the shadowed rock or the void beside the ground. Dark but coloured (a deep green, a dark teal) is ground.
    is_rock = (cl < 70) & (sat < 0.14)
    ground = [i for i in range(len(centres)) if not is_rock[i] and counts[i] >= 0.05 * counts.sum()]
    if not ground:
        ground = [int(np.argmax(counts))]
    ground.sort(key=lambda i: cl[i])
    lo, hi = centres[ground[0]] / 255.0, centres[ground[-1]] / 255.0
    mid = centres[max(ground, key=lambda i: counts[i] * (0.35 + sat[i]))] / 255.0      # the common colour, favouring the coloured ground over grey rock
    if len(ground) == 1:
        lo, hi = mid * 0.72, np.minimum(mid * 1.35, 1.0)
    # the low and high ground stay within reach of the common colour, so a dark gully is not black and a bright patch is not white
    lum_of = lambda c: float(c.mean())
    if lum_of(lo) < 0.55 * lum_of(mid):
        lo = mid * 0.6
    if lum_of(hi) < 1.15 * lum_of(mid):
        hi = np.minimum(mid * 1.3, 1.0)
    elif lum_of(hi) > 3.4 * lum_of(mid):
        hi = np.minimum(mid * 3.4, 1.0)
    rocks = [i for i in range(len(centres)) if is_rock[i]]
    rock = (np.average(centres[rocks], axis=0, weights=counts[rocks]) / 255.0) if rocks else lo * 0.5
    grey = lambda c: np.array([c.mean()] * 3)
    out = {
        "lo": lo * GAIN, "mid": mid * GAIN, "hi": hi * GAIN,
        "cliff": mid * 0.82 * GAIN,
        "stone": np.minimum((hi * 0.75 + grey(hi) * 0.25) * GAIN, 1.0),             # a lighter, less saturated version of the high ground
        "building": (mid * 0.5 + grey(mid) * 0.5) * GAIN * 0.95,
        "rockTop": np.minimum(rock * 0.6, 0.2),
    }
    return {k: [round(float(min(1.0, max(0.0, v))), 3) for v in c] for k, c in out.items()}


def rich_of(arc: "mpyq.MPQArchive") -> dict[str, list[list[float]]]:
    """Positions of the rich mineral fields and rich geysers a map places (full-map cells)."""
    rich: list[list[float]] = []
    rich_gas: list[list[float]] = []
    for e in ET.fromstring(arc.read_file("Objects")):
        if e.tag != "ObjectUnit":
            continue
        name = e.get("UnitType") or e.get("Type") or ""
        if "Rich" not in name:
            continue
        x, y = (float(v) for v in e.get("Position", "0,0,0").split(",")[:2])
        if "Mineral" in name:
            rich.append([round(x, 1), round(y, 1)])
        elif "Vespene" in name or "Geyser" in name:
            rich_gas.append([round(x, 1), round(y, 1)])
    return {"rich": rich, "richGas": rich_gas}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--maps", type=Path, default=DEFAULT_MAPS)
    args = ap.parse_args()
    for asset_id, (grid_name, display, _) in MAPS.items():
        path = args.maps / f"{grid_name}.SC2Map"
        target = SITE / "public" / "maps" / f"{asset_id}.json"
        if not path.exists() or not target.exists():
            print(f"skip {asset_id}: {path if not path.exists() else target} not found")
            continue
        arc = mpyq.MPQArchive(str(path))
        image = Image.open(io.BytesIO(arc.read_file("Minimap.tga")))
        asset = json.loads(target.read_text(encoding="utf-8"))
        asset["palette"] = palette_of(image)
        asset.update(rich_of(arc))
        target.write_text(json.dumps(asset, separators=(",", ":")), encoding="utf-8")
        p = asset["palette"]
        print(f"{asset_id:22} lo {p['lo']}  mid {p['mid']}  hi {p['hi']}  cliff {p['cliff']} | rich minerals {len(asset['rich'])}, rich geysers {len(asset['richGas'])}")


if __name__ == "__main__":
    main()
