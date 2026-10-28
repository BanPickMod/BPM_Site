#!/usr/bin/env node
/**
 * Black-box test of the AI evaluation queue: server API rules, the real Python worker and what the pages receive.
 *
 *   BPM_DEV_LOGIN=1 WORKER_TOKEN=<32+ chars> npm run dev          (an empty/test database and storage folder)
 *   WORKER_TOKEN=<same> node scripts/dev/eval-flow-test.mjs http://localhost:3000 --python <python with s2protocol+mpyq+numpy> \
 *       --replay <a decided 1v1 BPM replay> --replay <another one>
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith("http")) ?? "http://localhost:3000").replace(/\/$/, "");
const python = args.includes("--python") ? args[args.indexOf("--python") + 1] : undefined;
const replays = args.flatMap((a, i) => (a === "--replay" ? [args[i + 1]] : []));
const workerToken = process.env.WORKER_TOKEN ?? "";
if (workerToken.length < 32 || !python || replays.length < 2) {
  console.error("need WORKER_TOKEN (32+), --python <exe> and two --replay <file> (decided 1v1 BPM games)");
  process.exit(2);
}
const fixture = fs.readFileSync(path.resolve(here, "../../worker/tests/fixtures/bot_tvt_3picks.SC2Replay"));
const real = replays.map((p) => fs.readFileSync(p));

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${String(detail).slice(0, 300)}`}`);
  if (!ok) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(p, { method = "GET", json, form, token, cookie } = {}) {
  const h = {};
  if (token) h.authorization = `Bearer ${token}`;
  if (cookie) h.cookie = cookie;
  let body;
  if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); } else if (form) body = form;
  const res = await fetch(base + p, { method, headers: h, body });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, text, setCookie: res.headers.get("set-cookie") };
}

async function newUser(c2) {
  const login = await api("/api/dev/login", { method: "POST", json: { name: `eval-${crypto.randomBytes(3).toString("hex")}`, age14: true } });
  const cookie = login.setCookie.split(";")[0];
  const dc = await api("/api/auth/device-code", { method: "POST" });
  await api("/api/auth/device-approve", { method: "POST", json: { user_code: dc.data.user_code, c1: true, c2, c3: false }, cookie });
  await sleep(3200);
  const tok = await api("/api/auth/device-token", { method: "POST", json: { device_code: dc.data.device_code, label: "t" } });
  return { cookie, token: tok.data.access_token };
}

async function upload(user, buf) {
  const form = new FormData();
  form.set("replay", new Blob([buf]), "x.SC2Replay");
  const r = await api("/api/uploads", { method: "POST", form, token: user.token });
  if (r.status !== 201) { console.log("upload failed", r.status, r.data); process.exit(1); }
  return r.data.id;
}

const runWorker = (env = {}) => spawnSync(python, ["-X", "utf8", path.resolve(here, "../../worker/run_worker.py"), "--once"], {
  env: { ...process.env, BPM_SERVER_URL: base, WORKER_TOKEN: workerToken, ...env }, encoding: "utf8", timeout: 400000,
});
const mine = (u, id) => api(`/api/me/uploads/${id}`, { cookie: u.cookie });
const wk = (p, o = {}) => api(p, { token: workerToken, ...o });

const user = await newUser(false);
// oldest first: the queue hands out in upload order
const idShort = await upload(user, fixture);
const idB = await upload(user, real[1]);
const idA = await upload(user, real[0]);

// ---- 1. analysis only (evaluation off): every replay becomes READY and waits for evaluation -----------------------
const first = runWorker({ BPM_EVAL: "0" });
check("the worker analyses all three with evaluation off", first.status === 0 && (first.stdout.match(/READY/g) ?? []).length === 3, first.stdout + first.stderr);
check("a READY replay waits for evaluation (PENDING), with no curve yet", (await mine(user, idA)).data.eval_status === "PENDING" && (await mine(user, idA)).data.evaluation === null);
check("the worker did not touch the evaluation queue", !/eval \d+/.test(first.stdout));

// ---- 2. the queue's rules, played by hand ---------------------------------------------------------------------------
check("claiming needs the worker token", (await api("/api/worker/eval/claim", { method: "POST" })).status === 401);
check("a launcher token is not a worker token", (await api("/api/worker/eval/claim", { method: "POST", token: user.token })).status === 401);

const c1 = await wk("/api/worker/eval/claim", { method: "POST" });
check("the oldest analysed replay is handed out first", c1.status === 200 && c1.data.id === idShort && c1.data.attempt === 1, JSON.stringify(c1.data));
check("the leased replay can be downloaded by the evaluation worker", (await wk(`/api/worker/replays/${idShort}`)).status === 200);
check("one that is not leased cannot", (await wk(`/api/worker/replays/${idA}`)).status === 404);
const bad = (evaluation) => wk(`/api/worker/eval/${idShort}/result`, { method: "POST", json: { status: "DONE", evalVersion: "eval-1", evaluation } });
const good = { schema: 1, model: "M1", evalVersion: "eval-1", validated: false, t: [10, 20, 30], a: [0.1, -0.2, 0.3], lengthSec: 30 };
check("a malformed curve is refused (422)", (await bad({ ...good, a: [0.1, 5, 0.3] })).status === 422 && (await bad({ ...good, t: [10, 10, 30] })).status === 422);
check("a result without a status is refused (400)", (await wk(`/api/worker/eval/${idShort}/result`, { method: "POST", json: {} })).status === 400);
const failed1 = await wk(`/api/worker/eval/${idShort}/result`, { method: "POST", json: { status: "FAILED", error: "boom" } });
check("a failure puts it back to PENDING with a backoff", failed1.status === 200 && failed1.data.status === "PENDING" && (await mine(user, idShort)).data.eval_status === "PENDING");
check("a result for a replay that is not leased is refused (409)", (await bad(good)).status === 409);

const c2 = await wk("/api/worker/eval/claim", { method: "POST" });
check("the backed-off replay is skipped over; the next one is handed out", c2.status === 200 && c2.data.id === idB, JSON.stringify(c2.data));
const skipped = await wk(`/api/worker/eval/${idB}/result`, { method: "POST", json: { status: "SKIPPED", reason: "not a 1v1 game" } });
check("SKIPPED is final", skipped.data.status === "SKIPPED" && (await mine(user, idB)).data.eval_status === "SKIPPED");

// ---- 3. the real worker evaluates what is left ------------------------------------------------------------------------
const second = runWorker();
check("the real worker evaluates the replay (DONE)", second.status === 0 && new RegExp(`eval ${idA} \\(attempt 1\\): DONE`).test(second.stdout), second.stdout + second.stderr);
const a = (await mine(user, idA)).data;
const ev = a.evaluation;
check("the curve is stored with its model and version", a.eval_status === "DONE" && ev?.model === "M1_v_priv_v0_r16" && ev?.evalVersion === "eval-1" && ev?.validated === false, JSON.stringify(ev)?.slice(0, 200));
check("one point every 10 s, strictly increasing, within -1..1", ev.t.length >= 30 && ev.t.length === ev.a.length && ev.t.every((t, i) => i === 0 || t > ev.t[i - 1]) && ev.a.every((v) => v >= -1 && v <= 1) && ev.t[1] - ev.t[0] === 10);
const winner = a.analysis.players.findIndex((p) => p.result === "win") + 1;
check("late in the game the curve leans toward the player who won", winner > 0 && Math.sign(ev.a.at(-1)) === (winner === 1 ? 1 : -1), `winner ${winner}, last ${ev.a.at(-1)}`);
check("the replay still pending its backoff was left alone", (await mine(user, idShort)).data.eval_status === "PENDING");
check("a second run finds nothing to do (no double work)", !/eval \d+/.test(runWorker().stdout));

// ---- 4. what the pages receive ----------------------------------------------------------------------------------------
const ownerPage = await api(`/ko/replay-analysis/mine/${idA}`, { cookie: user.cookie });
check("the owner's page carries the curve", ownerPage.status === 200 && ownerPage.text.includes("M1_v_priv_v0_r16"));
check("it carries no pending notice once the curve exists", /evaluationPending(\\)?":false/.test(ownerPage.text));
const pendingPage = await api(`/ko/replay-analysis/mine/${idShort}`, { cookie: user.cookie });
check("a replay still waiting gets the pending notice and no curve", pendingPage.status === 200 && !pendingPage.text.includes("M1_v_priv_v0_r16") && /evaluationPending(\\)?":true/.test(pendingPage.text));
check("a private replay is not public even with a curve", (await api(`/ko/replay-analysis/shared/${idA}`)).status === 404);
await api("/api/me/consent", { method: "PUT", json: { c1: true, c2: true, c3: false }, token: user.token });
const pub = await api(`/ko/replay-analysis/shared/${idA}`);
check("once shared, the public page carries the curve", pub.status === 200 && pub.text.includes("M1_v_priv_v0_r16"));
check("and still no Battle.net handle", !/\d-S2-\d-\d{4,}/.test(pub.text));
await api("/api/me/consent", { method: "PUT", json: { c1: true, c2: false, c3: false }, token: user.token });
check("withdrawing sharing hides it again", (await api(`/ko/replay-analysis/shared/${idA}`)).status === 404);

// ---- 5. a new analysis starts the evaluation over --------------------------------------------------------------------
check("deleting the replay removes the curve with it", (await api(`/api/me/uploads/${idA}`, { method: "DELETE", cookie: user.cookie })).status === 200 && (await mine(user, idA)).status === 404);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
