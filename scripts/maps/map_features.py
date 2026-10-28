"""Map features for the replay viewer: what the map maker actually placed (grass, trees, rocks, ruins, buildings, fences, crystals,
destructible rocks, Xel'Naga towers, geysers), read from the map file's own placement list.

Only names, positions, rotations and scales are read. No model, texture or sound is copied: the viewer draws each class with its own
simple shapes. Used by scripts/maps/export_map_assets.py.
"""
from __future__ import annotations

import math
import re
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

import mpyq

# Doodad classes in the order the viewer draws them. A doodad is classified by the first rule that matches its type name.
CLASSES = ["grass", "tree", "rock", "column", "ruin", "building", "wall", "crystal", "prop"]

# Flat details, effects and markers: nothing to see at map scale.
SKIP = re.compile(
    r"invisible|decal|trim|curtain|logo|splat|smear|light|fog|fire|smoke|sunray|bird|sound|effect|sparkle|firefl|windy|_wind|leaf|ash_"
    r"|waves?$|_waves|shell|symbol|glow|(^|_)mat$|inlay|groundplates|groundcover|sidewalk|curb|walkable|testmodel|moopy|energystreak"
    r"|drifts|blood|beachpeople|zergdamage|puddle|water_|poolsparkles|shadow|bubble|dust|steam|stain|crack|footprint|scorch|gravel|pebble|dirt_|mud",
    re.I,
)
RULES: list[tuple[str, re.Pattern[str]]] = [
    ("tree", re.compile(r"tree|trunk|(^|_)log$|palm|pine", re.I)),
    ("grass", re.compile(r"bush|tallgrass|grass|foliage|weeds?|overgrowth|bramble|vines?|plants?|garden|topiary|shrub|flower|fern|reed|moss", re.I)),
    ("prop", re.compile(r"crate|barrel|suppl|corpse|carcass|trash|garbage", re.I)),
    ("wall", re.compile(r"fence|wall|barrier|railing|banister|skybridge|canal|barricade", re.I)),
    ("crystal", re.compile(r"crystal|mineralformation|caverns_vespene|glowshroom|vespene_piece", re.I)),
    ("column", re.compile(r"column|pillar|archpost|obelisk|spire|(^|_)post$|pole|lamppost", re.I)),
    ("building", re.compile(r"building|skyscraper|warehouse|hut|storefront|store_front|house|mansion|dock|catamaran|station|factory|bunker|lab(?!el)|shed|silo|tank$|tower", re.I)),
    ("ruin", re.compile(r"temple|shrine|statue|altar|pyramid|brick|ruin|slayn_|xelnaga|aiur_|brazier|banner|gate|portal|mechanism|arch", re.I)),
    ("rock", re.compile(r"rock|boulder|stone|rubble|debris|cliffrocks|bonepile|bones|cliff|pointy|formation|outcrop|ridge", re.I)),
    ("prop", re.compile(r"crate|barrel|suppl|furniture|bench|vase|trash|pipes|vent|sign|streetlight|lantern|prop|colonist|decor|cargo|corpse|carcass|car$|cars$|container|tent|bed", re.I)),
]
SIZE_WORDS = [(re.compile(r"huge", re.I), 2.2), (re.compile(r"large|big|giant|tall", re.I), 1.6), (re.compile(r"medium", re.I), 1.2), (re.compile(r"small|skinny|minor", re.I), 0.7), (re.compile(r"tiny|mini", re.I), 0.5)]

DEST = re.compile(r"destructible|collapsible|unbuildable.*destruct|rockex|debris(?=\d|ramp)", re.I)
TOWER = re.compile(r"^xelnagatower$", re.I)
GEYSER = re.compile(r"geyser", re.I)
FOOT = re.compile(r"(\d+)x(\d+)")


def classify(name: str) -> str | None:
    if SKIP.search(name):
        return None
    for cls, rx in RULES:
        if rx.search(name):
            return cls
    return None


def size_factor(name: str) -> float:
    for rx, k in SIZE_WORDS:
        if rx.search(name):
            return k
    return 1.0


def read_features(map_file: Path) -> dict:
    """Placement list of one .SC2Map as compact arrays (positions in full-map cells)."""
    arc = mpyq.MPQArchive(str(map_file))
    root = ET.fromstring(arc.read_file("Objects"))
    terrain = arc.read_file("t3Terrain.xml").decode("utf8", "replace")
    tile = re.search(r'tileSet="([^"]+)"', terrain)

    doodads: list[list[float]] = []
    unknown: Counter[str] = Counter()
    for e in root:
        if e.tag != "ObjectDoodad":
            continue
        name = e.get("Type") or ""
        cls = classify(name)
        if cls is None:
            if not SKIP.search(name):
                unknown[name] += 1
            continue
        x, y = (float(v) for v in e.get("Position", "0,0,0").split(",")[:2])
        sc = float(e.get("Scale", "1,1,1").split(",")[0]) * size_factor(name)
        rot = math.degrees(float(e.get("Rotation", "0"))) % 360
        doodads.append([CLASSES.index(cls), round(x, 1), round(y, 1), round(rot), round(sc, 2)])

    units: list[list[float | str]] = []
    gas: list[list[float]] = []
    for e in root:
        if e.tag != "ObjectUnit":
            continue
        name = e.get("UnitType") or e.get("Type") or ""
        x, y = (float(v) for v in e.get("Position", "0,0,0").split(",")[:2])
        if GEYSER.search(name):
            gas.append([round(x, 1), round(y, 1)])
        elif TOWER.search(name):
            units.append(["tower", round(x, 1), round(y, 1), 2, 2, 0])
        elif DEST.search(name):
            m = FOOT.search(name)
            w, h = (int(m.group(1)), int(m.group(2))) if m else (4, 4)
            diag = 1 if "diagonal" in name.lower() else 0
            kind = "plate" if re.search(r"unbuildable", name, re.I) else "dest"
            units.append([kind, round(x, 1), round(y, 1), min(w, 16), min(h, 16), diag])
    return {"tileSet": tile.group(1) if tile else "", "classes": CLASSES, "doodads": doodads, "units": units, "gas": gas, "_unknown": unknown}


if __name__ == "__main__":
    import sys

    for f in sys.argv[1:]:
        d = read_features(Path(f))
        by = Counter(CLASSES[int(r[0])] for r in d["doodads"])
        print(Path(f).stem, d["tileSet"], dict(by), "units", Counter(u[0] for u in d["units"]), "gas", len(d["gas"]))
        print("  unclassified:", d["_unknown"].most_common(12))
