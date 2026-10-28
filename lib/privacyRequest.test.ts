import test from "node:test";
import assert from "node:assert/strict";
import { dueAt, isOverdue, parseRequest, REQUEST_TYPES, REQUEST_LABEL } from "./privacyRequest.ts";

test("a valid request is cleaned and a contact is optional", () => {
  const r = parseRequest({ type: "access", details: "  Please show what you hold about me  ", contact: " me@example.com " });
  assert.ok(r.ok && r.value.details === "Please show what you hold about me" && r.value.contact === "me@example.com" && r.value.type === "access");
  const n = parseRequest({ type: "deletion", details: "delete my replays please" });
  assert.ok(n.ok && n.value.contact === null);
  const blank = parseRequest({ type: "other", details: "something here", contact: "   " });
  assert.ok(blank.ok && blank.value.contact === null);
});

test("an unknown type, a short text and a bad address are refused with their own code", () => {
  assert.deepEqual(parseRequest({ type: "spam", details: "long enough text" }), { ok: false, code: "BAD_TYPE" });
  assert.deepEqual(parseRequest({ details: "long enough text" }), { ok: false, code: "BAD_TYPE" });
  assert.deepEqual(parseRequest({ type: "access", details: "hey" }), { ok: false, code: "TOO_SHORT" });
  assert.deepEqual(parseRequest({ type: "access", details: "    x   " }), { ok: false, code: "TOO_SHORT" });
  assert.deepEqual(parseRequest({ type: "access", details: "long enough text", contact: "not-an-email" }), { ok: false, code: "BAD_CONTACT" });
  assert.deepEqual(parseRequest({ type: "access", details: "long enough text", contact: "a@b" }), { ok: false, code: "BAD_CONTACT" });
  assert.deepEqual(parseRequest({ type: "access", details: "long enough text", contact: "x".repeat(130) + "@example.com" }), { ok: false, code: "BAD_CONTACT" });
  assert.deepEqual(parseRequest(null), { ok: false, code: "BAD_TYPE" });
});

test("a long text is cut, not refused", () => {
  const r = parseRequest({ type: "other", details: "y".repeat(9000) });
  assert.ok(r.ok && r.value.details.length === 4000);
});

test("every type has a Korean and an English label", () => {
  for (const t of REQUEST_TYPES) assert.ok(REQUEST_LABEL[t][0] && REQUEST_LABEL[t][1], t);
});

test("due date and overdue: only an open request past its date is overdue", () => {
  const created = "2026-10-01T00:00:00Z";
  assert.equal(dueAt(created, 10).toISOString(), "2026-10-11T00:00:00.000Z");
  const day = (d: number) => new Date(Date.parse(created) + d * 86400_000);
  assert.equal(isOverdue(created, 10, "OPEN", day(9)), false);
  assert.equal(isOverdue(created, 10, "OPEN", day(11)), true);
  assert.equal(isOverdue(created, 10, "RESOLVED", day(30)), false);
});
