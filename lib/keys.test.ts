import test from "node:test";
import assert from "node:assert/strict";
import { deriveKey, hourlyRateKey, readSessionValue, signSessionValue } from "./keys.ts";

const M = "a-test-master-secret-with-more-than-32-chars";
const H = 3600_000;
const T = Date.UTC(2026, 9, 28, 10, 30, 0);

test("every purpose has its own key and a different master gives different keys", () => {
  assert.notDeepEqual(deriveKey(M, "session"), deriveKey(M, "reporter"));
  assert.deepEqual(deriveKey(M, "session"), deriveKey(M, "session"));
  assert.notDeepEqual(deriveKey(M, "session"), deriveKey(M + "x", "session"));
  assert.equal(deriveKey(M, "session").length, 32);
});

test("the same sender in the same hour gets the same key, in another hour an unrelated one", () => {
  const a = hourlyRateKey(M, "report", "203.0.113.5", T);
  assert.equal(a.key, hourlyRateKey(M, "report", "203.0.113.5", T + 20 * 60_000).key);
  assert.notEqual(a.key, hourlyRateKey(M, "report", "203.0.113.5", T + H).key);
  assert.notEqual(a.key, hourlyRateKey(M, "report", "203.0.113.6", T).key);
  assert.notEqual(a.key, hourlyRateKey(M, "user", "203.0.113.5", T).key);
  assert.notEqual(a.key, hourlyRateKey(M + "x", "report", "203.0.113.5", T).key);
  assert.match(a.key, /^[0-9a-f]{32}$/);
  assert.ok(!a.key.includes("203"));
});

test("a rate key lives until the end of the following hour", () => {
  const { expiresAt } = hourlyRateKey(M, "report", "x", T);
  assert.equal(expiresAt.toISOString(), "2026-10-28T12:00:00.000Z");
  assert.ok(expiresAt.getTime() - T > H && expiresAt.getTime() - T <= 2 * H);
});

test("a session value carries the user and the version and cannot be forged, aged or moved to another secret", () => {
  const v = signSessionValue(M, 7, T + H, 3);
  assert.deepEqual(readSessionValue(M, v, T), { id: 7, version: 3 });
  assert.equal(readSessionValue(M, v, T + 2 * H), null);                        // expired
  assert.equal(readSessionValue(M + "x", v, T), null);                          // another secret
  const [body, sig] = v.split(".");
  const forged = Buffer.from(`8.${T + H}.3`).toString("base64url");
  assert.equal(readSessionValue(M, `${forged}.${sig}`, T), null);               // body changed, signature kept
  assert.equal(readSessionValue(M, `${body}.`, T), null);
  assert.equal(readSessionValue(M, "", T), null);
  assert.equal(readSessionValue(M, null, T), null);
});

test("the session key is not the key rate limits use", () => {
  // a value signed for the reporter purpose must not pass as a session
  const body = Buffer.from(`7.${T + H}.0`).toString("base64url");
  const fake = `${body}.${Buffer.from(hourlyRateKey(M, "x", body, T).key, "hex").toString("base64url")}`;
  assert.equal(readSessionValue(M, fake, T), null);
});
