import test from "node:test";
import assert from "node:assert/strict";
import { formatError, scrubText } from "./logScrub.ts";

const SECRETS = [
  "203.0.113.45", "2001:db8:85a3:0:0:8a2e:370:7334", "2001:db8::1", "fe80::1ff:fe23:4567:890a", "player@example.com", "2-S2-1-1234567", "Jaemin#1234",
  "Bearer abcdef0123456789abcdef", "bpm_session=eyJ1c2VyIjo3fQ.AbCdEf", "postgres://user:pw@db.internal:5432/bpm",
  "access_token=zzTOPSECRETzz", "0123456789abcdef0123456789abcdef0123456789abcdef",
];

test("every kind of identifying or secret value is removed from log text", () => {
  for (const s of SECRETS) {
    const out = scrubText(`failed for ${s} while saving`);
    assert.ok(!out.includes(s.replace(/^Bearer /, "").replace(/^[a-z_]+=/i, "")), `${s} -> ${out}`);
  }
});

test("urls keep their path and lose the query", () => {
  assert.equal(scrubText("GET https://site.example/api/x?code=abc123&state=xyz failed"), "GET https://site.example/api/x?[query] failed");
  assert.equal(scrubText("/ko/replay-analysis/mine/12?tab=2"), "/ko/replay-analysis/mine/12?[query]");
});

test("ordinary text and short numbers survive", () => {
  assert.equal(scrubText("job 12 attempt 3 took 450 ms"), "job 12 attempt 3 took 450 ms");
  assert.equal(scrubText("analysis timeline stored"), "analysis timeline stored");
});

test("formatError keeps kind, status, code and where, scrubbed and short", () => {
  const e = Object.assign(new Error("insert failed for 203.0.113.45 and player@example.com"), { status: 500, code: "DB" });
  const out = formatError(e);
  assert.match(out, /^Error \[500 DB\]: insert failed for \[ip\] and \[email\]/);
  assert.ok(out.split("\n").length <= 1 + 4);
  assert.ok(!out.includes("203.0.113.45") && !out.includes("player@example.com"));
});

test("formatError ignores extra properties an error may carry and handles non-errors", () => {
  const e = Object.assign(new Error("boom"), { request: { headers: { cookie: "bpm_session=SECRETVALUE" } }, row: { handle: "2-S2-1-999999" } });
  assert.ok(!formatError(e).includes("SECRETVALUE"));
  assert.ok(!formatError(e).includes("999999"));
  assert.equal(formatError("plain 203.0.113.45"), "plain [ip]");
  assert.equal(formatError(null), "null");
});

test("a long message is cut", () => {
  assert.ok(formatError(new Error("x ".repeat(1000))).length < 900);
});
