import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync, gzipSync } from "node:zlib";
import { scrubAnalysis, scrubTimelineGzip } from "./handles.ts";

test("scrubAnalysis removes a raw handle and keeps the pseudonym and everything else", () => {
  const a = { schema: 1, map: "M", players: [{ playerId: 1, handle: "2-S2-1-123", handleKey: "abc", race: "terran" }, { playerId: 2, handleKey: null }] };
  const out = scrubAnalysis(a);
  assert.deepEqual(out.players, [{ playerId: 1, handleKey: "abc", race: "terran" }, { playerId: 2, handleKey: null }]);
  assert.equal(out.map, "M");
  assert.ok("handle" in a.players[0], "the input is not changed");
});

test("scrubAnalysis leaves things without players alone", () => {
  assert.equal(scrubAnalysis(null), null);
  assert.deepEqual(scrubAnalysis({ schema: 1 }), { schema: 1 });
});

test("scrubTimelineGzip strips handles from players and returns the same bytes when there is nothing to strip", () => {
  const dirty = gzipSync(JSON.stringify({ schema: 1, players: [{ owner: 1, handle: "2-S2-1-123", handleKey: "k" }], units: [] }));
  const clean = JSON.parse(gunzipSync(scrubTimelineGzip(dirty)).toString());
  assert.deepEqual(clean.players, [{ owner: 1, handleKey: "k" }]);
  assert.deepEqual(clean.units, []);
  const fine = gzipSync(JSON.stringify({ schema: 1, players: [{ owner: 1, handleKey: "k" }] }));
  assert.equal(scrubTimelineGzip(fine), fine);
});
