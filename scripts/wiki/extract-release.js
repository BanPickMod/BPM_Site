// Snapshots the balance XML and GameStrings of the canonical BPM packages (release/bpm-modules) into
// scripts/wiki/source/<version>/, flattened to the file names mod-data.js reads.
//
//   node scripts/wiki/extract-release.js v2.0
//
// The v1.4.x snapshots in source/ were extracted from the retired single-file builds (MPQ) and are kept as-is.
const fs = require("fs");
const path = require("path");

const version = process.argv[2];
if (!version) { console.error("usage: node scripts/wiki/extract-release.js <version label, e.g. v2.0>"); process.exit(1); }

const PKGS = path.join(__dirname, "..", "..", "..", "release", "bpm-modules");
// Balance data lives in CoreExtension. Later packages override earlier ones for GameStrings keys.
const DATA_PKG = "BPM_CoreExtension.SC2Mod";
const STRING_PKGS = ["BPM_CoreExtension.SC2Mod", "BPM_Core.SC2Mod"];

const out = path.join(__dirname, "source", version);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const gd = path.join(PKGS, DATA_PKG, "Base.SC2Data", "GameData");
let n = 0;
for (const f of fs.readdirSync(gd).filter((x) => x.toLowerCase().endsWith(".xml"))) {
  fs.copyFileSync(path.join(gd, f), path.join(out, "Base.SC2Data__GameData__" + f));
  n++;
}

for (const [dir, locale] of [["koKR", "koKR"], ["enUS", "enUS"]]) {
  const merged = new Map();
  for (const pkg of STRING_PKGS) {
    const f = path.join(PKGS, pkg, dir + ".SC2Data", "LocalizedData", "GameStrings.txt");
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, "utf8").replace(/^﻿/, "").split(/\r?\n/).forEach((l) => {
      const i = l.indexOf("=");
      if (i > 0) merged.set(l.slice(0, i), l.slice(i + 1));
    });
  }
  fs.writeFileSync(path.join(out, locale + ".SC2Data__LocalizedData__GameStrings.txt"), [...merged].map(([k, v]) => k + "=" + v).join("\n") + "\n");
}
fs.writeFileSync(path.join(out, "SOURCE.txt"), "release/bpm-modules (" + [DATA_PKG, ...STRING_PKGS.filter((p) => p !== DATA_PKG)].join(", ") + ")\n");
console.log(version + ": " + n + " XML files from " + DATA_PKG);
