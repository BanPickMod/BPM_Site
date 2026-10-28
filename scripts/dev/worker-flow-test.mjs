#!/usr/bin/env node
/**
 * Black-box test of the analysis queue: uploads real replays, checks the worker API rules, runs the real Python worker.
 *
 *   WORKER_TOKEN=<32+ chars> BPM_DEV_LOGIN=1 npm run dev            (server; use an empty/test database)
 *   WORKER_TOKEN=<same> node scripts/dev/worker-flow-test.mjs http://localhost:3000 \
 *       --python <python with s2protocol+mpyq> [--ladder <a non-BPM .SC2Replay>]
 *
 * Needs the queue to be empty when it starts (it claims jobs). Creates throwaway "workertest-*" users.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith("http")) ?? "http://localhost:3000").replace(/\/$/, "");
const flag = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const python = flag("python");
const ladderPath = flag("ladder");
const workerToken = process.env.WORKER_TOKEN ?? "";
const botReplay = path.resolve(here, "../../worker/tests/fixtures/bot_tvt_3picks.SC2Replay");

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${String(detail).slice(0, 300)}`}`);
  if (!ok) failed++;
};
if (workerToken.length < 32 || !python) {
  console.error("need WORKER_TOKEN (32+ chars, same as the server) and --python <exe>");
  process.exit(2);
}

async function api(p, { method = "GET", json, form, raw, token, cookie } = {}) {
  const h = {};
  if (token) h.authorization = `Bearer ${token}`;
  if (cookie) h.cookie = cookie;
  let body;
  if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); } else if (form) body = form;
  else if (raw) { h["content-type"] = "application/gzip"; body = raw; }
  const res = await fetch(base + p, { method, headers: h, body });
  const buf = Buffer.from(await res.arrayBuffer());
  let data;
  try { data = JSON.parse(buf.toString()); } catch { data = buf; }
  return { status: res.status, data, setCookie: res.headers.get("set-cookie") };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function newDeviceToken(label) {
  const login = await api("/api/dev/login", { method: "POST", json: { name: `workertest-${label}-${crypto.randomBytes(3).toString("hex")}`, age14: true } });
  const cookie = login.setCookie.split(";")[0];
  const dc = await api("/api/auth/device-code", { method: "POST" });
  await api("/api/auth/device-approve", { method: "POST", json: { user_code: dc.data.user_code, c1: true, c2: false, c3: false }, cookie });
  await wait(3200);
  const tok = await api("/api/auth/device-token", { method: "POST", json: { device_code: dc.data.device_code } });
  return { token: tok.data.access_token, cookie };
}
const upload = (token, buf) => {
  const form = new FormData();
  form.set("replay", new Blob([buf]), "replay.SC2Replay");
  return api("/api/uploads", { method: "POST", form, token });
};

// ---- worker API access rules ------------------------------------------------------------------
check("claim without a token is 401", (await api("/api/worker/claim", { method: "POST" })).status === 401);
check("claim with a wrong token is 401", (await api("/api/worker/claim", { method: "POST", token: "x".repeat(40) })).status === 401);
const user = await newDeviceToken("a");
check("a player's launcher token cannot use the worker API", (await api("/api/worker/claim", { method: "POST", token: user.token })).status === 401);
check("the queue starts empty (204)", (await api("/api/worker/claim", { method: "POST", token: workerToken })).status === 204);

// ---- lease rules, using two throwaway uploads ------------------------------------------------
const junk = () => Buffer.concat([Buffer.from([0x4d, 0x50, 0x51, 0x1b]), crypto.randomBytes(300)]); // right signature, not a real archive
const e1 = await upload(user.token, junk());
const e2 = await upload(user.token, junk());
check("uploads are queued", e1.status === 201 && e2.status === 201, JSON.stringify([e1.data, e2.data]));

const first = await api("/api/worker/claim", { method: "POST", token: workerToken });
check("the oldest job is claimed first", first.status === 200 && first.data.id === e1.data.id && first.data.attempt === 1, JSON.stringify(first.data));
const dl = await api(`/api/worker/replays/${first.data.id}`, { token: workerToken });
check("the leased replay downloads byte for byte", dl.status === 200 && Buffer.isBuffer(dl.data) && dl.data.length === first.data.size, `${dl.status} ${dl.data?.length}`);
check("a download needs the worker token", (await api(`/api/worker/replays/${first.data.id}`, { token: user.token })).status === 401);
const notLeased = await api(`/api/worker/replays/${e2.data.id}`, { token: workerToken });
check("a replay that is not leased cannot be downloaded", notLeased.status === 404 && notLeased.data.code === "NOT_LEASED", JSON.stringify(notLeased.data));
const res = (id, json) => api(`/api/worker/replays/${id}/result`, { method: "POST", token: workerToken, json });
check("an unknown status is refused (400)", (await res(first.data.id, { status: "DONE" })).status === 400);
check("a bad reject code is refused (400)", (await res(first.data.id, { status: "REJECTED", rejectCode: "WHATEVER" })).status === 400);
check("READY without analyzerVersion is refused (400)", (await res(first.data.id, { status: "READY", analysis: {} })).status === 400);
check("an oversize analysis is refused (413)", (await res(first.data.id, { status: "READY", analyzerVersion: "t", analysis: { blob: "x".repeat(70000) } })).status === 413);
check("a result for a job nobody leased is refused (409)", (await res(999999, { status: "FAILED", error: "x" })).status === 409);
const noTl = await res(first.data.id, { status: "READY", analyzerVersion: "t", analysis: {} });
check("READY without a timeline from this attempt is refused (409 TIMELINE_REQUIRED)", noTl.status === 409 && noTl.data.code === "TIMELINE_REQUIRED", JSON.stringify(noTl.data));
const putTl = (id, body, token = workerToken) => api(`/api/worker/replays/${id}/timeline`, { method: "PUT", token, raw: body });
check("a timeline that is not gzip is refused (422)", (await putTl(first.data.id, Buffer.from("not gzip at all"))).status === 422);
check("a timeline for a job nobody leased is refused (409)", (await putTl(999999, Buffer.from([0x1f, 0x8b, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).status === 409);
check("a timeline needs the worker token", (await putTl(first.data.id, Buffer.from([0x1f, 0x8b, 0, 0, 0, 0, 0, 0, 0, 0, 0]), user.token)).status === 401);

const fail1 = await res(first.data.id, { status: "FAILED", error: "simulated crash" });
check("a failed attempt is re-queued with a delay", fail1.status === 200 && fail1.data.status === "QUEUED", JSON.stringify(fail1.data));
const second = await api("/api/worker/claim", { method: "POST", token: workerToken });
check("the delayed job is skipped; the next one is handed out", second.status === 200 && second.data.id === e2.data.id, JSON.stringify(second.data));
check("a late result for a job that is no longer leased is refused (409)", (await res(first.data.id, { status: "FAILED", error: "late" })).status === 409);
check("giving the second job back works", (await res(second.data.id, { status: "FAILED", error: "give back" })).status === 200);
check("both are now waiting out their backoff (queue looks empty)", (await api("/api/worker/claim", { method: "POST", token: workerToken })).status === 204);

// ---- the real worker, on real files -----------------------------------------------------------
const bpm = await upload(user.token, fs.readFileSync(botReplay));
const bad = await upload(user.token, junk());
const ladder = ladderPath ? await upload(user.token, fs.readFileSync(ladderPath)) : null;
check("real replays are queued", bpm.status === 201 && bad.status === 201 && (!ladder || ladder.status === 201));

console.log("INFO  running the real Python worker (--once)");
const env = { ...process.env, BPM_SERVER_URL: base, WORKER_TOKEN: workerToken };
const ran = spawnSync(python, ["-X", "utf8", path.resolve(here, "../../worker/run_worker.py"), "--once"], { env, encoding: "utf8", timeout: 180000 });
console.log(ran.stdout.split("\n").filter(Boolean).map((l) => "      " + l).join("\n"));
check("the worker exits cleanly", ran.status === 0, ran.stderr);

const detail = async (r) => (await api(`/api/me/uploads/${r.data.id}`, { cookie: user.cookie })).data;
const dBpm = await detail(bpm);
check("the BPM replay is READY", dBpm.status === "READY", JSON.stringify(dBpm));
const a = dBpm.analysis ?? {};
const [p1, p2] = a.players ?? [];
check("its analysis has the draft", a.map === "BPM_Rorschach" && p1?.picks?.[0]?.unit === "ScienceVessel" && p2?.picks?.length === 3, JSON.stringify(a).slice(0, 300));
check("its analysis stores no nicknames", !JSON.stringify(a).includes("foo54309"));
check("the analyzer version is recorded", typeof dBpm.analyzer_version === "string" && dBpm.analyzer_version.length > 0);
const dBad = await detail(bad);
check("the corrupt file is REJECTED/CORRUPT", dBad.status === "REJECTED" && dBad.reject_code === "CORRUPT", JSON.stringify(dBad));
if (ladder) {
  const d = await detail(ladder);
  check("an ordinary (non-BPM) game is REJECTED/NOT_BPM", d.status === "REJECTED" && d.reject_code === "NOT_BPM", JSON.stringify(d));
}
const stillWaiting = [await detail(e1), await detail(e2)];
check("jobs in their retry delay were left alone", stillWaiting.every((d) => d.status === "QUEUED"), JSON.stringify(stillWaiting.map((d) => d.status)));
check("another user cannot read the analysis (404)", (await api(`/api/me/uploads/${bpm.data.id}`, { cookie: (await newDeviceToken("b")).cookie })).status === 404);

// timeline access: owner only, never public, removed together with the replay
const tlUrl = `/api/me/uploads/${bpm.data.id}/timeline`;
const tl = await api(tlUrl, { cookie: user.cookie });
check("the owner can read the timeline (gzip, schema 1)", tl.status === 200 && Buffer.isBuffer(tl.data) && tl.data[0] === 0x1f && tl.data[1] === 0x8b, `${tl.status}`);
const tlJson = tl.status === 200 ? JSON.parse(zlib.gunzipSync(tl.data).toString()) : {};
check("the timeline is schema 1 with units, series and a draft", tlJson.schema === 1 && tlJson.units?.length > 0 && tlJson.series?.length > 0 && tlJson.draft?.players?.length === 2);
check("the timeline stores no nicknames", !zlib.gunzipSync(tl.data).toString().includes("foo54309"));
check("another user cannot read the timeline (404)", (await api(tlUrl, { cookie: (await newDeviceToken("c")).cookie })).status === 404);
check("no session cannot read the timeline (401)", (await api(tlUrl)).status === 401);
check("the worker token is not a user (401)", (await api(tlUrl, { token: workerToken })).status === 401);
const delTl = await api(`/api/me/uploads/${bpm.data.id}`, { method: "DELETE", cookie: user.cookie });
check("deleting the replay works and its timeline is gone (404)", delTl.status < 300 && (await api(tlUrl, { cookie: user.cookie })).status === 404, `${delTl.status}`);

console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exitCode = failed ? 1 : 0;
