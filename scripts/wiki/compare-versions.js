// Lists every balance value that differs between two source snapshots.
//
//   node scripts/wiki/compare-versions.js v1.4.3 v2.0
//
// Compares what the mod XML sets explicitly: unit stats/attributes/weapon links, weapons, damage effects,
// research and production cost/time, morph durations, ability costs and behavior numbers.
// Use it to confirm a patch note's numeric claims, and to spot changes the note does not mention.
const loadMod = require("./mod-data");

const [fromV, toV] = [process.argv[2], process.argv[3]];
if (!fromV || !toV) { console.error("usage: node scripts/wiki/compare-versions.js <from> <to>"); process.exit(1); }
const A = loadMod(fromV), B = loadMod(toV);

const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const out = {};
const rec = (section, line) => (out[section] = out[section] || []).push(line);

function diffMap(section, a, b, pick = (x) => x) {
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id] === undefined ? undefined : pick(a[id]);
    const y = b[id] === undefined ? undefined : pick(b[id]);
    if (same(x, y)) continue;
    if (x === undefined) rec(section, "+ " + id + "  " + JSON.stringify(y));
    else if (y === undefined) rec(section, "- " + id + "  " + JSON.stringify(x));
    else if (x && y && typeof x === "object" && !Array.isArray(x)) {
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
        if (!same(x[k], y[k])) rec(section, "~ " + id + "." + k + "  " + JSON.stringify(x[k]) + " -> " + JSON.stringify(y[k]));
      }
    } else rec(section, "~ " + id + "  " + JSON.stringify(x) + " -> " + JSON.stringify(y));
  }
}

diffMap("unit.set", A.units, B.units, (u) => u.set);
diffMap("unit.attrs", A.units, B.units, (u) => u.attrs);
diffMap("unit.weapons", A.units, B.units, (u) => u.weapons.map((w) => w.link).join(","));
diffMap("weapon", A.weapons, B.weapons, (w) => ({ range: w.range, period: w.period, effect: w.effect, targets: w.targets }));
diffMap("effect", A.effects, B.effects, (e) => ({ type: e.type, amount: e.amount, bonus: e.bonus }));
const key = (r) => (r.upgrade || r.unit) + "@" + r.abil;
const idx = (list) => Object.fromEntries(list.map((r) => [key(r), { minerals: r.minerals, gas: r.gas, time: r.time, requirements: r.requirements }]));
diffMap("research", idx(A.research), idx(B.research));
diffMap("train", idx(A.train), idx(B.train));
diffMap("morph", A.morph, B.morph);
diffMap("ability", A.abilities, B.abilities);
diffMap("behavior", A.behaviors, B.behaviors);

const total = Object.values(out).reduce((n, l) => n + l.length, 0);
console.log("Compared " + A.source + " (" + fromV + ") with " + B.source + " (" + toV + ")");
for (const [section, lines] of Object.entries(out)) {
  console.log("\n[" + section + "] " + lines.length);
  lines.forEach((l) => console.log("  " + l));
}
console.log("\n" + total + " differences");
