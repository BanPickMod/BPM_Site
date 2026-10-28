import test from "node:test";
import assert from "node:assert/strict";
import { allows, findOperator, parseOperators } from "./adminTokens.ts";

const T1 = "alice-token-0123456789", T2 = "bob-token-0123456789-x", T3 = "carol-token-0123456789";

test("named tokens and the legacy token become operators", () => {
  const ops = parseOperators({ ADMIN_TOKENS: `alice:owner:${T1}, bob:moderator:${T2}`, ADMIN_TOKEN: T3 });
  assert.deepEqual(ops.map((o) => [o.name, o.role]), [["alice", "owner"], ["bob", "moderator"], ["admin", "owner"]]);
  assert.deepEqual(parseOperators({}), []);
  assert.deepEqual(parseOperators({ ADMIN_TOKEN: "short" }), []);                    // too short to be a token
});

test("bad entries are refused loudly rather than ignored", () => {
  for (const bad of ["alice:owner", "alice:toString:" + T1, "alice:constructor:" + T1, "alice:boss:" + T1, "Alice:owner:" + T1, "alice:owner:short", `alice:owner:${T1}:extra`, "a b:owner:" + T1]) {
    assert.throws(() => parseOperators({ ADMIN_TOKENS: bad }), /ADMIN_TOKENS entries/, bad);
  }
  assert.throws(() => parseOperators({ ADMIN_TOKENS: `a:owner:${T1},a:readonly:${T2}` }), /unique/);
  assert.throws(() => parseOperators({ ADMIN_TOKENS: `a:owner:${T1},b:readonly:${T1}` }), /unique/);
});

test("a token finds its operator; unknown, empty and near-miss tokens find nobody", () => {
  const ops = parseOperators({ ADMIN_TOKENS: `alice:owner:${T1},bob:readonly:${T2}` });
  assert.deepEqual(findOperator(ops, T2), { name: "bob", role: "readonly" });
  for (const g of ["", "x", T1 + "x", T1.slice(0, -1), T3]) assert.equal(findOperator(ops, g), null, g);
  assert.equal(findOperator([], T1), null);
});

test("a role allows its own level and below only", () => {
  const ro = { name: "r", role: "readonly" as const }, mod = { name: "m", role: "moderator" as const }, owner = { name: "o", role: "owner" as const };
  assert.deepEqual([ro, mod, owner].map((o) => allows(o, "readonly")), [true, true, true]);
  assert.deepEqual([ro, mod, owner].map((o) => allows(o, "moderator")), [false, true, true]);
  assert.deepEqual([ro, mod, owner].map((o) => allows(o, "owner")), [false, false, true]);
});
