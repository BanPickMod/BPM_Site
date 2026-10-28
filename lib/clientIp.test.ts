import test from "node:test";
import assert from "node:assert/strict";
import { pickClientIp } from "./clientIp.ts";

test("one proxy in front: the last entry is the address the proxy saw", () => {
  assert.equal(pickClientIp("203.0.113.5", 1), "203.0.113.5");
  assert.equal(pickClientIp("1.2.3.4, 203.0.113.5", 1), "203.0.113.5");
});

test("what the sender typed on the left cannot change the key", () => {
  assert.equal(pickClientIp("spoof-1, spoof-2, 203.0.113.5", 1), "203.0.113.5");
  assert.equal(pickClientIp("random-123, 203.0.113.5", 1), pickClientIp("random-456, 203.0.113.5", 1));
});

test("two proxies in front: the second from the right", () => {
  assert.equal(pickClientIp("spoof, 203.0.113.5, 10.0.0.7", 2), "203.0.113.5");
  assert.equal(pickClientIp("203.0.113.5", 2), "203.0.113.5");                       // fewer entries than hops: the first one
});

test("no proxy configured or no header: one shared bucket, not a spoofable one", () => {
  assert.equal(pickClientIp("1.2.3.4", 0), "unknown");
  assert.equal(pickClientIp(undefined, 1), "unknown");
  assert.equal(pickClientIp("", 1), "unknown");
  assert.equal(pickClientIp(" , ,", 1), "unknown");
});
