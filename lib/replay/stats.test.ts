// node --test lib/replay/stats.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { aggregate, fingerprint, pairing, wilson } from "./stats.ts";
import { matchFacts } from "./matchKey.ts";

type Race = "terran" | "zerg" | "protoss";
const player = (race: Race, result: "win" | "loss", picks: string[] = [], bans: string[] = [], isAi = false) =>
  ({ playerId: 1, race, result, isAi, bans, picks: picks.map((unit) => ({ unit, replaces: null })), displaced: [] });
const game = (id: number, userId: number, a: ReturnType<typeof player>, b: ReturnType<typeof player>, dur = 600) =>
  ({ id, userId, analysis: { map: "BPM_Rorschach", durationSec: dur, convenienceMode: false, players: [a, b] } });
const race = (u: string): Race | null => (u === "Cyclone" ? "terran" : null);
const rules = { minGames: 3, minUsers: 2, perUserCap: 50 };

test("a game uploaded by both players counts once", () => {
  const a = player("terran", "win", ["Cyclone"]), b = player("zerg", "loss");
  const r = aggregate([game(1, 1, a, b), game(2, 2, a, b)], race, { ...rules, minGames: 1, minUsers: 1 });
  assert.equal(r.games, 1);
});

test("the same game from two players counts once even when their clocks and last frames differ", () => {
  const a = player("terran", "win", ["Cyclone"]), b = player("zerg", "loss");
  const facts = (startedAt: string, loops: number, handles: string[]) =>
    matchFacts({ schema: 1, map: "BPM_Rorschach", startedAt, gameLoops: loops, players: handles.map((handleKey) => ({ handleKey, isAi: false })) });
  // Different durations: the legacy fingerprint would call these two games.
  const g1 = { ...game(1, 1, a, b, 600), match: facts("2026-10-27T09:46:57Z", 13440, ["1-S2-1-1", "1-S2-1-2"]) };
  const g2 = { ...game(2, 2, a, b, 601), match: facts("2026-10-27T09:47:03Z", 13460, ["1-S2-1-2", "1-S2-1-1"]) };
  assert.equal(aggregate([g1, g2], race, { ...rules, minGames: 1, minUsers: 1 }).games, 1);
  // A rematch of the same two players with the same draft and result is a different game.
  const g3 = { ...game(3, 1, a, b, 600), match: facts("2026-10-27T11:00:00Z", 13440, ["1-S2-1-1", "1-S2-1-2"]) };
  assert.equal(aggregate([g1, g3], race, { ...rules, minGames: 1, minUsers: 1 }).games, 2);
});

test("the cap does not let a game that was not counted hide its other copy", () => {
  const a = player("terran", "win", ["Cyclone"]), b = player("zerg", "loss");
  const m = (n: number) => matchFacts({ schema: 1, map: "M", startedAt: `2026-10-27T0${n}:00:00Z`, gameLoops: 1000, players: [{ handleKey: "h1", isAi: false }, { handleKey: "h2", isAi: false }] });
  // User 1 has two games over the cap of 1; the newer is dropped by the cap, so user 2's copy of it must still count.
  const gs = [{ ...game(1, 1, a, b, 600), match: m(1) }, { ...game(3, 1, a, b, 700), match: m(3) }, { ...game(4, 2, a, b, 701), match: m(3) }];
  assert.equal(aggregate(gs, race, { minGames: 1, minUsers: 1, perUserCap: 1 }).games, 2);
});

test("AI games are left out", () => {
  const r = aggregate([game(1, 1, player("terran", "win", ["Cyclone"], [], true), player("zerg", "loss"))], race, { ...rules, minGames: 1, minUsers: 1 });
  assert.equal(r.games, 0);
});

test("a cell below the sample rules shows no numbers", () => {
  const gs = [1, 2].map((i) => game(i, 1, player("terran", "win", ["Cyclone"]), player("zerg", "loss"), 600 + i));
  const [u] = aggregate(gs, race, rules).units;
  assert.equal(u.shown, false);
  assert.equal(u.pickRate, null);
  assert.equal(u.picked, 0);
});

test("enough games from enough users gives rates and a win interval", () => {
  const gs = [1, 2, 3, 4].map((i) => game(i, (i % 2) + 1, player("terran", i === 1 ? "loss" : "win", ["Cyclone"]), player("zerg", i === 1 ? "win" : "loss"), 600 + i));
  const [u] = aggregate(gs, race, rules).units;
  assert.equal(u.shown, true);
  assert.equal(u.pickRate, 1);
  assert.equal(u.winRate, 0.75);
  assert.ok(u.winLow! < 0.75 && u.winHigh! > 0.75);
});

test("one user cannot fill the table (per-user cap) and bans are counted against the banned player's race", () => {
  const gs = [1, 2, 3, 4, 5].map((i) => game(i, 1, player("terran", "win", ["Cyclone"]), player("zerg", "loss", [], ["Cyclone"]), 600 + i));
  const r = aggregate(gs, race, { minGames: 1, minUsers: 1, perUserCap: 2 });
  assert.equal(r.games, 2);
});

test("pairing treats TvZ and ZvT as one", () => {
  const g = game(1, 1, player("zerg", "win"), player("terran", "loss")).analysis;
  assert.equal(pairing(g), "TvZ");
  assert.equal(aggregate([game(1, 1, player("zerg", "win"), player("terran", "loss"))], race, { ...rules, matchup: "TvZ" }).games, 1);
  assert.equal(aggregate([game(1, 1, player("zerg", "win"), player("terran", "loss"))], race, { ...rules, matchup: "TvT" }).games, 0);
});

test("wilson interval stays within 0..1 and widens for small samples", () => {
  const [l1, h1] = wilson(5, 10), [l2, h2] = wilson(50, 100);
  assert.ok(l1 >= 0 && h1 <= 1 && h1 - l1 > h2 - l2);
  assert.deepEqual(wilson(0, 0), [0, 0]);
});

test("fingerprint ignores pick order", () => {
  const x = game(1, 1, player("terran", "win", ["A", "B"]), player("zerg", "loss")).analysis;
  const y = game(2, 2, player("terran", "win", ["B", "A"]), player("zerg", "loss")).analysis;
  assert.equal(fingerprint(x), fingerprint(y));
});
