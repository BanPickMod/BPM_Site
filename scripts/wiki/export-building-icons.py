"""Convert the game's building button textures (DDS) to PNG for the replay viewer and write an index from building name to file.

  python scripts/wiki/export-building-icons.py "<folder with btn-building-*.dds>" [--out public/images/icons/buildings]

The folder is the balance-data "Textures" folder that ships with the game's map-editor documentation (BalanceData ... /Textures).
Needs Pillow (pip install pillow). Writes public/images/icons/buildings/<race>-<name>.png and data/generated/building-icons.json:
  { "<name, lower case, no punctuation>": "/images/icons/buildings/<race>-<name>.png" }
The viewer looks a building up by its replay id (lib/replay/units.ts, buildingIcon).
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from PIL import Image

SITE = Path(__file__).resolve().parents[2]
RACES = ("terran", "protoss", "zerg")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("--out", type=Path, default=SITE / "public" / "images" / "icons" / "buildings")
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    index: dict[str, str] = {}
    for f in sorted(args.src.iterdir()):
        m = re.fullmatch(r"btn-building-([a-z]+)-(.+)\.dds", f.name, re.I)
        if not m or m.group(1).lower() not in RACES:       # campaign heroes and co-op commanders have their own sets: not used by 1v1 replays
            continue
        race, name = m.group(1).lower(), m.group(2).lower()
        im = Image.open(f).convert("RGBA")
        target = args.out / f"{race}-{name}.png"
        im.save(target, optimize=True)
        key = re.sub(r"[^a-z0-9]", "", name)
        # the plain building wins over a themed variant (spinecrawler over spinecrawler-mecha)
        if key not in index or len(name) < len(Path(index[key]).stem.split("-", 1)[1]):
            index[key] = f"/images/icons/buildings/{target.name}"
    (SITE / "data" / "generated" / "building-icons.json").write_text(json.dumps(dict(sorted(index.items())), indent=1), encoding="utf-8")
    print(f"{len(index)} building icons -> {args.out}")


if __name__ == "__main__":
    main()
