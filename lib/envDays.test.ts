import test from "node:test";
import assert from "node:assert/strict";
import { envDays } from "./envDays.ts";

test("unset, empty and blank values give the fallback, never 0", () => {
  for (const v of [undefined, "", "  ", "\t"]) assert.equal(envDays(v, 365), 365, String(v));
});

test("a whole number is used, including an explicit 0 where 0 is allowed", () => {
  assert.equal(envDays("30", 365), 30);
  assert.equal(envDays("0", 365), 0);
  assert.equal(envDays("0", 10, 1), 10);                 // a minimum of 1: 0 falls back
});

test("junk, fractions and negatives give the fallback", () => {
  for (const v of ["abc", "1.5", "-3", "NaN", "Infinity", "7d"]) assert.equal(envDays(v, 9), 9, v);
});
