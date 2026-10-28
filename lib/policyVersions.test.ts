import test from "node:test";
import assert from "node:assert/strict";
import { activeChangelog, changesSince, consentVersion, consentsAffectedSince, formatPending, noticesSince, parsePending, policyVersion, POLICY_CHANGELOG, type PolicyChange } from "./policyVersions.ts";

const log: PolicyChange[] = [
  { version: "v1", kind: "notice", affects: [], ko: "처음", en: "first" },
  { version: "v2", kind: "notice", affects: [], ko: "연락처 변경", en: "contact changed" },
  { version: "v3", kind: "consent", affects: ["c2"], ko: "공개 범위 변경", en: "public scope changed" },
  { version: "v4", kind: "notice", affects: [], ko: "오탈자", en: "typo" },
  { version: "v5", kind: "consent", affects: ["c3", "c1"], ko: "학습 목적 변경", en: "training purpose changed" },
];

test("the policy version is the last entry; the consent version is the last consent-level entry", () => {
  assert.equal(policyVersion(log), "v5");
  assert.equal(consentVersion(log), "v5");
  assert.equal(consentVersion(log.slice(0, 4)), "v3");
  assert.equal(consentVersion(log.slice(0, 2)), "v1");                  // no consent-level change yet: the first entry
});

test("only consent-level changes after the user's version ask again, and only the consents they name", () => {
  assert.deepEqual(consentsAffectedSince(log, "v1"), ["c1", "c2", "c3"]);
  assert.deepEqual(consentsAffectedSince(log, "v2"), ["c1", "c2", "c3"]);
  assert.deepEqual(consentsAffectedSince(log, "v3"), ["c1", "c3"]);
  assert.deepEqual(consentsAffectedSince(log, "v4"), ["c1", "c3"]);
  assert.deepEqual(consentsAffectedSince(log, "v5"), []);
  assert.deepEqual(consentsAffectedSince(log.slice(0, 2), "v1"), []);     // notice-only changes never ask again
});

test("a user whose version is unknown or missing is treated as older than the list", () => {
  assert.deepEqual(consentsAffectedSince(log, null), ["c1", "c2", "c3"]);
  assert.deepEqual(consentsAffectedSince(log, "gone"), ["c1", "c2", "c3"]);
  assert.equal(changesSince(log, undefined).length, 5);
});

test("the banner lists every change after the version the user last saw, in order", () => {
  assert.deepEqual(noticesSince(log, "v2").map((c) => c.version), ["v3", "v4", "v5"]);
  assert.deepEqual(noticesSince(log, "v5"), []);
  assert.deepEqual(noticesSince(log, "v4").map((c) => c.ko), ["학습 목적 변경"]);
});

test("pending consents round-trip as text in a fixed order and ignore junk", () => {
  assert.equal(formatPending(["c3", "c1"]), "c1,c3");
  assert.deepEqual(parsePending("c3, c1,zzz"), ["c1", "c3"]);
  assert.deepEqual(parsePending(""), []);
  assert.deepEqual(parsePending(null), []);
});

test("the compiled list is valid and the test override works only outside production", () => {
  assert.ok(POLICY_CHANGELOG.length >= 1 && POLICY_CHANGELOG.every((c) => c.version && c.ko && c.en));
  assert.equal(new Set(POLICY_CHANGELOG.map((c) => c.version)).size, POLICY_CHANGELOG.length, "versions must be unique");
  const json = JSON.stringify(log);
  assert.equal(activeChangelog({ BPM_POLICY_CHANGELOG_JSON: json }).length, 5);
  assert.equal(activeChangelog({ BPM_POLICY_CHANGELOG_JSON: json, NODE_ENV: "production" }), POLICY_CHANGELOG);
  assert.equal(activeChangelog({ BPM_POLICY_CHANGELOG_JSON: "not json" }), POLICY_CHANGELOG);
  assert.equal(activeChangelog({ BPM_POLICY_CHANGELOG_JSON: "[]" }), POLICY_CHANGELOG);
  assert.equal(activeChangelog({}), POLICY_CHANGELOG);
});
