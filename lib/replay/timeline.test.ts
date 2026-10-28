// node --test lib/replay/timeline.test.ts   (Node 24 strips the types; this file must not import "@/..." paths)
import test from "node:test";
import assert from "node:assert/strict";
import { aliveByType, buildModel, decodeTrack, pickUsage, posAt, statAt, type RawTimeline, type RawUnit } from "./timeline.ts";

const unit = (o: Partial<RawUnit>): RawUnit => ({
  tag: 1, type: "Marine", owner: 1, kind: "army", bornT: 10, doneT: null, diedT: 100, killerOwner: null, killerType: null,
  x0: 50, y0: 60, deathPos: null, track: [], positionMode: "tracked", ...o,
});

const raw = (units: RawUnit[]): RawTimeline => ({
  schema: 1,
  meta: { map: "m", mapTransform: null, build: 1, durationSec: 200, analyzerVersion: "t", timeScale: 10, coordinateScale: 10, positionPolicy: { endpointWindowSec: 3 }, positionModes: {} },
  players: [],
  draft: { players: [{ owner: 1, picks: [{ unit: "Cyclone", replaces: "Hellion", group: null }, { unit: "Thor", replaces: null, group: null }], bans: [], displaced: [] }, { owner: 2, picks: [], bans: [], displaced: [] }] },
  series: [{ t: 0, owner: 1, minerals: 50, gas: 0, workers: 12, supply: [12, 15], armyValue: 0, incomeMin: 0, incomeGas: 0, spent: 0, lost: 0, killed: 0 },
    { t: 10, owner: 1, minerals: 90, gas: 0, workers: 13, supply: [13, 15], armyValue: 50, incomeMin: 0, incomeGas: 0, spent: 0, lost: 0, killed: 0 }],
  units, buildOrder: [], battles: [{ id: 1, t0: 90, t1: 110, cx: 50, cy: 60, lostA: 1, lostB: 3, units: {}, importance: 1 }], tech: [],
});

test("decodeTrack: first point absolute, then deltas, scaled back", () => {
  const { ts, xs, ys } = decodeTrack([[100, 500, 600], [50, 10, -20], [50, 10, -20]], 10, 10);
  assert.deepEqual(Array.from(ts), [10, 15, 20]);
  assert.deepEqual(Array.from(xs).map((v) => Math.round(v)), [50, 51, 52]);
  assert.deepEqual(Array.from(ys).map((v) => Math.round(v)), [60, 58, 56]);
});

test("posAt: tracked units interpolate, clamp at the ends and vanish outside their life", () => {
  const m = buildModel(raw([unit({ track: [[100, 500, 600], [100, 100, 0]] })]));   // t 10 -> 20, x 50 -> 60
  const u = m.units[0];
  assert.equal(posAt(u, 5, 3), null);
  assert.deepEqual(posAt(u, 15, 3), { x: 55, y: 60, a: 1 });
  assert.equal(posAt(u, 50, 3)!.x, 60);
  assert.equal(posAt(u, 100, 3), null);
});

test("posAt: event-endpoints units only show near birth and death and fade", () => {
  const m = buildModel(raw([unit({ positionMode: "event-endpoints", deathPos: [80, 90] })]));
  const u = m.units[0];
  assert.deepEqual(posAt(u, 10, 3), { x: 50, y: 60, a: 1 });
  assert.ok(posAt(u, 11.5, 3)!.a < 1);
  assert.equal(posAt(u, 50, 3), null);
  assert.deepEqual(posAt(u, 98.5, 3)!.x, 80);
});

test("posAt: birth-only units never show a death position; static units stay put", () => {
  const m = buildModel(raw([unit({ positionMode: "birth-only" }), unit({ kind: "structure", positionMode: "static", diedT: null })]));
  assert.equal(posAt(m.units[0], 50, 3), null);
  assert.deepEqual(posAt(m.units[1], 150, 3), { x: 50, y: 60, a: 1 });
});

test("pickUsage counts made, alive, lost and flags picks that were never built", () => {
  const m = buildModel(raw([unit({ type: "Cyclone", diedT: 40 }), unit({ type: "Cyclone", bornT: 20, diedT: null })]));
  const [cyc, thor] = pickUsage(m, 1, 50);
  assert.deepEqual([cyc.made, cyc.alive, cyc.lost], [2, 1, 1]);
  assert.equal(cyc.first, 10);
  assert.equal(thor.unused, true);
  assert.equal(m.units[0].pick, true);
});

test("battles: the side that lost fewer units is ahead, and lost picks are counted", () => {
  const m = buildModel(raw([unit({ type: "Cyclone", diedT: 100 })]));
  assert.equal(m.battles[0].winner, 1);
  assert.equal(m.battles[0].picksLost, 1);
  assert.equal(m.battles[0].label, "A");
});

test("statAt returns the latest sample not after t", () => {
  const m = buildModel(raw([]));
  assert.equal(statAt(m, 1, 5)!.workers, 12);
  assert.equal(statAt(m, 1, 50)!.workers, 13);
  assert.equal(statAt(m, 2, 5), null);
});

test("aliveByType groups what is alive, picks and units before buildings", () => {
  const m = buildModel(raw([
    unit({ type: "Marine" }), unit({ type: "Marine" }), unit({ type: "Cyclone" }), unit({ type: "Barracks", kind: "structure", positionMode: "static" }),
    unit({ type: "Marine", diedT: 20 }),
  ]));
  const list = aliveByType(m, 1, 50);
  assert.deepEqual(list.map((e) => [e.type, e.count]), [["Cyclone", 1], ["Marine", 2], ["Barracks", 1]]);
  assert.equal(list[0].pick, true);
  assert.equal(aliveByType(m, 1, 5).length, 0);
});

test("a unit keeps who killed it", () => {
  const m = buildModel(raw([unit({ killerOwner: 2, killerType: "Zergling" })]));
  assert.deepEqual(m.units[0].killer, { owner: 2, type: "Zergling" });
});
