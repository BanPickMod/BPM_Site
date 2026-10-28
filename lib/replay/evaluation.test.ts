// node --test lib/replay/evaluation.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { formAt, HIDE_BEFORE_SEC, LOW_UNTIL_SEC, parseEvaluation, swings, trustAt } from "./evaluation.ts";

const raw = (over: Record<string, unknown> = {}) => ({
  schema: 1, model: "M1_v_priv_v0_r16", evalVersion: "eval-1", validated: false, lengthSec: 600,
  t: [10, 20, 30], a: [0.1, -0.2, 0.3], ...over,
});

test("a well-formed evaluation parses and keeps validated=false by default", () => {
  const e = parseEvaluation(raw())!;
  assert.deepEqual(e.t, [10, 20, 30]);
  assert.equal(e.validated, false);
  assert.equal(e.lengthSec, 600);
});

test("malformed evaluations are refused", () => {
  assert.equal(parseEvaluation(null), null);
  assert.equal(parseEvaluation(raw({ schema: 2 })), null);
  assert.equal(parseEvaluation(raw({ a: [0.1, 0.2] })), null, "length mismatch");
  assert.equal(parseEvaluation(raw({ t: [], a: [] })), null, "empty");
  assert.equal(parseEvaluation(raw({ a: [0.1, 1.5, 0] })), null, "out of range");
  assert.equal(parseEvaluation(raw({ t: [10, 10, 30] })), null, "not increasing");
  assert.equal(parseEvaluation(raw({ t: [10, 20, "x"] })), null);
  assert.equal(parseEvaluation(raw({ a: [0.1, NaN, 0] })), null);
  assert.equal(parseEvaluation(raw({ model: 3 })), null);
  assert.equal(parseEvaluation(raw({ t: Array.from({ length: 3000 }, (_, i) => i + 1), a: Array(3000).fill(0) })), null, "too many points");
});

test("trust grows with time: hidden, then faded, then solid", () => {
  assert.equal(trustAt(0), "hidden");
  assert.equal(trustAt(HIDE_BEFORE_SEC - 1), "hidden");
  assert.equal(trustAt(HIDE_BEFORE_SEC), "low");
  assert.equal(trustAt(LOW_UNTIL_SEC - 1), "low");
  assert.equal(trustAt(LOW_UNTIL_SEC), "ok");
});

test("formAt is hidden early and reads the latest point at or before the time", () => {
  const ts = Array.from({ length: 60 }, (_, i) => (i + 1) * 10);
  const e = parseEvaluation(raw({ t: ts, a: ts.map((x) => x / 1000) }))!;
  assert.equal(formAt(e, 100), null);
  assert.equal(formAt(e, 300), 0.3);
  assert.equal(formAt(e, 305), 0.3);
  assert.equal(formAt(e, 9999), null);
});

test("swings: the biggest moves after the hidden zone, spread apart, in time order", () => {
  const ts = Array.from({ length: 60 }, (_, i) => (i + 1) * 10);
  // flat, a big move toward player 1 around 300 s, a bigger one toward player 2 around 450 s, and a move inside the hidden zone
  const a = ts.map((t) => (t < 100 ? (t - 50) / 100 : t < 300 ? 0 : t < 360 ? (t - 300) / 150 : t < 450 ? 0.4 : t < 510 ? 0.4 - (t - 450) / 100 : -0.2));
  const e = parseEvaluation(raw({ t: ts, a }))!;
  const s = swings(e, 3);
  assert.ok(s.length >= 2);
  assert.ok(s.every((x) => x.t >= HIDE_BEFORE_SEC), "nothing from the hidden zone");
  assert.ok(s.every((x, i) => i === 0 || x.t > s[i - 1].t), "in time order");
  assert.ok(s.every((x, i) => s.every((y, j) => i === j || Math.abs(x.t - y.t) >= 90)), "spread apart");
  assert.ok(s.some((x) => x.toward === 1) && s.some((x) => x.toward === 2));
});

test("swings: a flat game has none", () => {
  const ts = Array.from({ length: 40 }, (_, i) => (i + 1) * 10);
  assert.deepEqual(swings(parseEvaluation(raw({ t: ts, a: ts.map(() => 0.05) }))!), []);
});
