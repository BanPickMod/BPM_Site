// `npm run validate:data`. Fails the build when site data is broken or incomplete.
//
// Checks
//   1. data/generated/*.json exist and have the expected shape
//   2. every extension and base unit has a value block for every version, with the core numbers present
//   3. every referenced icon file exists under public/
//   4. every patch version has both ko.md and en.md, with matching structure and complete frontmatter
//   5. every image a patch note links to exists under public/, and every media: slot it uses is registered in content/media/slots.json
const fs = require("fs");
const path = require("path");

const SITE = path.join(__dirname, "..");
const errors = [];
const fail = (msg) => errors.push(msg);
const readJson = (rel) => {
  const f = path.join(SITE, rel);
  if (!fs.existsSync(f)) { fail(rel + " is missing. Run: node scripts/wiki/build-wiki-data.js"); return null; }
  return JSON.parse(fs.readFileSync(f, "utf8"));
};

/* ---- wiki data ---- */
const wiki = readJson("data/generated/wiki.json");
const site = readJson("data/generated/site.json");
if (wiki) {
  const versionIds = wiki.versions.map((v) => v.id);
  if (!versionIds.length) fail("wiki.json has no versions");
  if (wiki.versions.filter((v) => v.status === "current").length !== 1) fail("wiki.json needs exactly one current version");
  if (wiki.base.length < 50) fail("wiki.json has only " + wiki.base.length + " base units");
  if (wiki.units.length !== 17) fail("wiki.json has " + wiki.units.length + " extension units, expected 17");

  const checkBlock = (kind, id, ver, b) => {
    if (!b) return fail(kind + " " + id + " has no block for " + ver);
    if (typeof b.hp !== "number") fail(kind + " " + id + " " + ver + ": hp is " + b.hp);
    if (!b.cost || b.cost.supply === undefined) fail(kind + " " + id + " " + ver + ": cost is incomplete");
  };
  for (const list of [wiki.units, wiki.base]) {
    for (const u of list) {
      for (const v of versionIds) checkBlock(list === wiki.units ? "unit" : "base", u.id, v, (u.v || {})[v]);
      if (u.icon && !fs.existsSync(path.join(SITE, "public", u.icon))) fail("icon missing for " + u.id + ": " + u.icon);
    }
  }
  for (const u of wiki.units) {
    if (!u.ko || !u.en) fail("unit " + u.id + " lacks a ko or en name");
    if (!wiki.base.some((b) => b.id === u.pairId)) fail("unit " + u.id + " pairs with unknown base unit " + u.pairId);
  }
}
if (site) {
  if (!site.maps.length) fail("site.json has no maps");
  for (const m of site.maps) if (!m.ko || !m.en || !m.terrainEn) fail("map " + m.id + " is missing a translation");
}

/* ---- media slots ---- */
const slotsFile = path.join(SITE, "content", "media", "slots.json");
const slotIds = new Set();
if (fs.existsSync(slotsFile)) {
  for (const s of JSON.parse(fs.readFileSync(slotsFile, "utf8"))) {
    if (slotIds.has(s.id)) fail("media slot " + s.id + " is defined twice");
    slotIds.add(s.id);
    if (!s.hint || !s.caption || !s.caption.ko || !s.caption.en) fail("media slot " + s.id + " needs a hint and a ko/en caption");
  }
}

/* ---- patch notes ---- */
const patchRoot = path.join(SITE, "content", "patches");
const FM_KEYS = ["version", "date", "title", "summary"];
const structure = (md) => ({
  h2: (md.match(/^## /gm) || []).length,
  images: (md.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length,
  numbered: (md.match(/^\s*\d+\. /gm) || []).length,
});
if (fs.existsSync(patchRoot)) {
  for (const dir of fs.readdirSync(patchRoot, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const docs = {};
    for (const lang of ["ko", "en"]) {
      const f = path.join(patchRoot, dir.name, lang + ".md");
      if (!fs.existsSync(f)) { fail("patch " + dir.name + " lacks " + lang + ".md"); continue; }
      const src = fs.readFileSync(f, "utf8").replace(/^﻿/, "");
      const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      if (!m) { fail("patch " + dir.name + "/" + lang + ".md has no frontmatter"); continue; }
      const keys = m[1].split(/\r?\n/).map((l) => l.split(":")[0].trim());
      FM_KEYS.forEach((k) => { if (!keys.includes(k)) fail("patch " + dir.name + "/" + lang + ".md frontmatter lacks " + k); });
      const version = (m[1].match(/^version:\s*(.+)$/m) || [])[1];
      if (version && version.trim() !== dir.name) fail("patch " + dir.name + "/" + lang + ".md says version " + version.trim());
      docs[lang] = m[2];
      for (const slot of m[2].matchAll(/!\[[^\]]*\]\(media:([^)\s]+)\)/g)) {
        if (!slotIds.has(slot[1])) fail("patch " + dir.name + "/" + lang + ".md uses unknown media slot " + slot[1]);
      }
      for (const img of m[2].matchAll(/!\[[^\]]*\]\((\/[^)\s]+)\)/g)) {
        if (!fs.existsSync(path.join(SITE, "public", img[1]))) fail("patch " + dir.name + "/" + lang + ".md links a missing image " + img[1]);
      }
    }
    if (docs.ko && docs.en) {
      const a = structure(docs.ko), b = structure(docs.en);
      for (const k of Object.keys(a)) if (a[k] !== b[k]) fail("patch " + dir.name + ": ko and en differ in " + k + " (" + a[k] + " vs " + b[k] + ")");
    }
  }
}

if (errors.length) {
  console.error("BPM data validation FAILED (" + errors.length + "):");
  errors.forEach((e) => console.error("  - " + e));
  process.exit(1);
}
console.log("BPM data validation: OK");
