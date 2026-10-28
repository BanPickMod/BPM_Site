#!/usr/bin/env node
/**
 * Black-box test of "the same game uploaded by both players counts once" (docs/BPM_Backend_Plan.md section 4.3).
 * Plays the analysis worker itself, so it can hand out analyses with chosen handles and start times.
 *
 *   BPM_DEV_LOGIN=1 WORKER_TOKEN=<32+ chars> STATS_MIN_GAMES=1 STATS_MIN_USERS=1 npm run dev     (separate PGLITE_DIR / STORAGE_DIR)
 *   WORKER_TOKEN=<same> node scripts/dev/match-flow-test.mjs http://localhost:3000
 */
import crypto from "node:crypto";
import zlib from "node:zlib";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const workerToken = process.env.WORKER_TOKEN ?? "";
if (workerToken.length < 32) { console.log("set WORKER_TOKEN (32+ chars, same as the server)"); process.exit(2); }
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${String(detail).slice(0, 300)}`}`);
  if (!ok) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { method = "GET", json, form, body, token, cookie, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (cookie) h.cookie = cookie;
  let payload = body;
  if (json !== undefined) { h["content-type"] = "application/json"; payload = JSON.stringify(json); } else if (form) payload = form;
  const res = await fetch(base + path, { method, headers: h, body: payload });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, text, setCookie: res.headers.get("set-cookie") };
}

const run = crypto.randomBytes(3).toString("hex");

async function newUser(label) {
  const login = await api("/api/dev/login", { method: "POST", json: { name: `match-${run}-${label}`, age14: true } });
  const cookie = login.setCookie.split(";")[0];
  const dc = await api("/api/auth/device-code", { method: "POST" });
  await api("/api/auth/device-approve", { method: "POST", json: { user_code: dc.data.user_code, c1: true, c2: true, c3: false }, cookie });
  await sleep(3200);
  const tok = await api("/api/auth/device-token", { method: "POST", json: { device_code: dc.data.device_code, label } });
  return { cookie, token: tok.data.access_token };
}

const fakeReplay = (tag) => Buffer.concat([Buffer.from([0x4d, 0x50, 0x51, 0x1b]), crypto.randomBytes(200), Buffer.from(tag)]);
async function upload(user, tag) {
  const form = new FormData();
  form.set("replay", new Blob([fakeReplay(tag)]), "x.SC2Replay");
  const r = await api("/api/uploads", { method: "POST", form, token: user.token });
  if (r.status !== 201) { console.log("upload failed", r.status, r.data); process.exit(1); }
  return r.data.id;
}

const player = (id, handle, race, result, picks = ["Cyclone"]) => ({
  playerId: id, handleKey: handle, race, result, isAi: false, bans: [], picks: picks.map((unit) => ({ unit, replaces: null })), displaced: [],
});
const analysis = ({ handles, startedAt, loops, duration, results = ["win", "loss"], picks }) => ({
  schema: 1, map: "BPM_Rorschach", baseBuild: 1, durationSec: duration, gameLoops: loops ?? null, startedAt: startedAt ?? null, convenienceMode: false, warnings: [],
  players: [player(1, handles?.[0] ?? null, "terran", results[0], picks), player(2, handles?.[1] ?? null, "zerg", results[1], [])],
});

/** Acts as the worker for the given uploads: claim, store a timeline, report the analysis. */
async function analyse(specs) {
  const wt = workerToken;
  for (let i = 0; i < 40 && specs.size; i++) {
    const claim = await api("/api/worker/claim", { method: "POST", token: wt });
    if (claim.status === 204) break;
    const spec = specs.get(claim.data.id);
    if (!spec) { console.log("unexpected job", claim.data); process.exit(1); }
    const tl = zlib.gzipSync(JSON.stringify({ schema: 1, players: [{ handleKey: "x" }] }) + " ".repeat(20));
    const put = await api(`/api/worker/replays/${claim.data.id}/timeline`, { method: "PUT", token: wt, body: tl, headers: { "content-type": "application/gzip" } });
    if (put.status !== 200) { console.log("timeline failed", put.status, put.data); process.exit(1); }
    const res = await api(`/api/worker/replays/${claim.data.id}/result`, { method: "POST", token: wt, json: { status: "READY", analyzerVersion: "timeline-2", analysis: spec } });
    if (res.status !== 200) { console.log("result failed", res.status, res.data); process.exit(1); }
    specs.delete(claim.data.id);
  }
}

const T = Date.parse("2026-10-27T09:46:57Z");
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
const [H1, H2, H3, H4] = ["2-S2-1-1000001", "2-S2-1-1000002", "2-S2-1-1000003", "2-S2-1-1000004"];

const u1 = await newUser("one"), u2 = await newUser("two"), u3 = await newUser("three");

// Game G is uploaded by u1 and u2 (their own start clocks and last frames differ a little, seats are swapped).
const gU1 = await upload(u1, "g-u1");
const gU2 = await upload(u2, "g-u2");
// The same two players' rematch two hours later, with an identical draft and result: a different game.
const rematch = await upload(u1, "rematch");
// An unrelated game by u3.
const other = await upload(u3, "other");
// Two analyses from before the worker recorded start times and handles: same draft, result and length.
const oldA = await upload(u3, "old-a");
const oldB = await upload(u2, "old-b");

await analyse(new Map([
  [gU1, analysis({ handles: [H1, H2], startedAt: iso(T), loops: 13440, duration: 600 })],
  [gU2, analysis({ handles: [H2, H1], startedAt: iso(T + 6000), loops: 13462, duration: 601, results: ["loss", "win"] })],
  [rematch, analysis({ handles: [H1, H2], startedAt: iso(T + 2 * 3600_000), loops: 13440, duration: 600 })],
  [other, analysis({ handles: [H3, H4], startedAt: iso(T + 1000), loops: 20000, duration: 893, picks: ["Cyclone", "Goliath"] })],
  [oldA, analysis({ duration: 450, picks: ["Thor"] })],
  [oldB, analysis({ duration: 450, picks: ["Thor"] })],
]));

const shared = async () => (await api("/ko/replay-analysis/shared")).text;
const listed = (html) => new Set([...html.matchAll(/\/ko\/replay-analysis\/shared\/(\d+)"/g)].map((m) => Number(m[1])));
const counted = async () => Number(/집계된 경기 (\d+)판/.exec((await api("/ko/replay-analysis/stats")).text)?.[1] ?? -1);

// ---- the list -------------------------------------------------------------------------------
let html = await shared();
let ids = listed(html);
check("the shared list shows 4 games out of 6 uploads", ids.size === 4, [...ids].join(","));
check("a game both players uploaded is listed once", Number(ids.has(gU1)) + Number(ids.has(gU2)) === 1, [...ids].join(","));
check("the rematch is its own game", ids.has(rematch));
check("the unrelated game is listed", ids.has(other));
check("two old analyses with the same draft are one game", Number(ids.has(oldA)) + Number(ids.has(oldB)) === 1);
check("the list never shows a Battle.net handle", ![H1, H2, H3, H4].some((h) => html.includes(h)));

// ---- statistics ------------------------------------------------------------------------------
check("the statistics count the same 4 games", (await counted()) === 4, String(await counted()));

// ---- withdrawing C2 leaves the other uploader's copy -----------------------------------------
await api("/api/me/consent", { method: "PUT", json: { c1: true, c2: false, c3: false }, token: u1.token });
html = await shared();
ids = listed(html);
check("u1 withdraws C2: u2's copy of the game stays", ids.has(gU2) && !ids.has(gU1) && !ids.has(rematch), [...ids].join(","));
check("u1's games leave the statistics, the shared game stays", (await counted()) === 3, String(await counted()));

await api("/api/me/consent", { method: "PUT", json: { c1: true, c2: false, c3: false }, token: u2.token });
ids = listed(await shared());
check("when neither uploader shares it, the game is gone", !ids.has(gU1) && !ids.has(gU2) && ids.has(other), [...ids].join(","));
check("and the statistics follow: u3's two games are what is left", (await counted()) === 2, String(await counted()));
check("u3's copy of the old-style game is still listed", listed(await shared()).has(oldA));

await api("/api/me/consent", { method: "PUT", json: { c1: true, c2: true, c3: false }, token: u2.token });
ids = listed(await shared());
check("u2 shares again: the stored replay is NOT opened by itself", !ids.has(gU2) && !ids.has(gU1), [...ids].join(","));
check("u2 opens the earlier replays in one step", (await api("/api/me/uploads", { method: "PATCH", json: { public: true }, cookie: u2.cookie })).data.published >= 1);
ids = listed(await shared());
check("u2 shares again: it is back, once", ids.has(gU2) && !ids.has(gU1), [...ids].join(","));

// ---- the uploader is not told about the other copy --------------------------------------------
const mine = await api(`/ko/replay-analysis/mine/${gU2}`, { cookie: u2.cookie });
check("the uploader's own page does not mention another uploader or group", mine.status === 200 && !/다른 업로더|same game|같은 경기/.test(mine.text));
check("the mine list is unaffected by grouping", (await api("/api/me/uploads", { cookie: u2.cookie })).data.uploads.length === 2);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
