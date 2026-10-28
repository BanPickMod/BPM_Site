// node --test lib/replay/matchKey.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { GameClusters, LOOPS_TOLERANCE, matchFacts, sameGame, START_TOLERANCE_MS } from "./matchKey.ts";

const raw = (over: Record<string, unknown> = {}, handles: (string | null)[] = ["2-S2-1-111", "2-S2-1-222"]) => ({
  schema: 1, map: "BPM_Rorschach", startedAt: "2026-10-27T09:46:57Z", gameLoops: 13440,
  players: handles.map((handleKey, i) => ({ playerId: i + 1, handleKey, isAi: false })), ...over,
});
const facts = (over = {}, handles?: (string | null)[]) => matchFacts(raw(over, handles))!;

test("facts need a map, every handle, a start time and a length", () => {
  assert.ok(matchFacts(raw()));
  assert.equal(matchFacts(raw({}, ["2-S2-1-111", null])), null);
  assert.equal(matchFacts(raw({ startedAt: undefined })), null);
  assert.equal(matchFacts(raw({ startedAt: "not a date" })), null);
  assert.equal(matchFacts(raw({ gameLoops: 0 })), null);
  assert.equal(matchFacts(raw({ schema: 2 })), null);
  assert.equal(matchFacts(null), null);
  assert.equal(matchFacts(raw({}, ["2-S2-1-111", "2-S2-1-111"])), null);          // one handle twice is not two players
  const ai = raw();
  (ai.players[1] as { isAi: boolean }).isAi = true;
  assert.equal(matchFacts(ai), null);                                              // AI games are not matched
});

test("the same game seen from either seat matches, whatever the player order", () => {
  const a = facts(), b = facts({}, ["2-S2-1-222", "2-S2-1-111"]);
  assert.equal(a.key, b.key);
  assert.ok(sameGame(a, b));
});

test("each client's own start time and last frame may differ a little", () => {
  const a = facts();
  assert.ok(sameGame(a, facts({ startedAt: "2026-10-27T09:47:20Z", gameLoops: 13440 + 40 })));
  assert.ok(sameGame(a, facts({ startedAt: new Date(Date.parse("2026-10-27T09:46:57Z") + START_TOLERANCE_MS).toISOString(), gameLoops: 13440 + LOOPS_TOLERANCE })));
});

test("a rematch, another map or other players is another game", () => {
  const a = facts();
  assert.ok(!sameGame(a, facts({ startedAt: "2026-10-27T10:30:00Z" })), "same pair an hour later");
  assert.ok(!sameGame(a, facts({ gameLoops: 13440 + LOOPS_TOLERANCE + 1 })), "much longer");
  assert.ok(!sameGame(a, facts({ map: "BPM_Washout" })), "other map");
  assert.ok(!sameGame(a, facts({}, ["2-S2-1-111", "2-S2-1-333"])), "other opponent");
});

test("clusters: the second copy of a game is recognised, a rematch is not", () => {
  const c = new GameClusters();
  assert.equal(c.claim(facts(), "L1"), true);
  assert.equal(c.claim(facts({ startedAt: "2026-10-27T09:47:05Z", gameLoops: 13455 }, ["2-S2-1-222", "2-S2-1-111"]), "L2"), false);
  assert.equal(c.claim(facts({ startedAt: "2026-10-27T12:00:00Z" }), "L1"), true, "facts differ, so the equal draft does not make it a duplicate");
});

test("facts win over the legacy fingerprint when both sides have them", () => {
  const c = new GameClusters();
  c.add(facts(), "same-draft");
  assert.equal(c.has(facts({ startedAt: "2026-10-28T09:46:57Z" }), "same-draft"), false);
});

test("without facts the legacy fingerprint decides, also against a copy that has them", () => {
  const c = new GameClusters();
  assert.equal(c.claim(null, "X"), true);
  assert.equal(c.claim(null, "X"), false);
  assert.equal(c.claim(null, "Y"), true);
  assert.equal(c.claim(facts(), "X"), false, "an old analysis and a new one of the same draft are one game");
  const d = new GameClusters();
  d.add(facts(), "Z");
  assert.equal(d.has(null, "Z"), true);
  assert.equal(d.has(null, "other"), false);
});

test("a chain a-b, b-c is one group", () => {
  const c = new GameClusters();
  c.add(facts(), "1");
  c.add(facts({ startedAt: "2026-10-27T09:48:30Z" }), "2");                        // 93 s after the first: within tolerance
  assert.equal(c.has(facts({ startedAt: "2026-10-27T09:50:00Z" }), "3"), true);   // 90 s after the second
});

test("has does not remember, add does", () => {
  const c = new GameClusters();
  assert.equal(c.has(facts(), "A"), false);
  assert.equal(c.has(facts(), "A"), false);
  c.add(facts(), "A");
  assert.equal(c.has(facts(), "A"), true);
});

test("an analysis that still carries a raw handle (stored before the handles were hashed) gives no facts and falls back", () => {
  const old = { schema: 1, map: "m", startedAt: "2026-10-27T10:00:00Z", gameLoops: 1000, players: [{ playerId: 1, handle: "2-S2-1-111", isAi: false }, { playerId: 2, handle: "2-S2-1-222", isAi: false }] };
  assert.equal(matchFacts(old), null);
});
