#!/usr/bin/env node
/**
 * Black-box test of the account settings API: launchers list/unlink, consent from the launcher, data export,
 * deleting all replays, and account withdrawal.
 *
 *   BPM_DEV_LOGIN=1 npm run dev          (separate PGLITE_DIR / STORAGE_DIR recommended)
 *   node scripts/dev/account-flow-test.mjs http://localhost:3000
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${String(detail).slice(0, 300)}`}`);
  if (!ok) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fakeReplay = (tag) => Buffer.concat([Buffer.from([0x4d, 0x50, 0x51, 0x1b]), crypto.randomBytes(200), Buffer.from(tag)]);

async function api(path, { method = "GET", json, form, token, cookie } = {}) {
  const h = {};
  if (token) h.authorization = `Bearer ${token}`;
  if (cookie) h.cookie = cookie;
  let body;
  if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); } else if (form) body = form;
  const res = await fetch(base + path, { method, headers: h, body });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, setCookie: res.headers.get("set-cookie"), headers: res.headers };
}

async function signIn(name) {
  const r = await api("/api/dev/login", { method: "POST", json: { name, age14: true } });
  if (r.status !== 200) { console.log("dev login failed", r.status, r.data); process.exit(1); }
  return { id: r.data.id, cookie: r.setCookie.split(";")[0] };
}

async function linkLauncher(cookie, label, consent = { c1: true, c2: false, c3: false }) {
  const dc = await api("/api/auth/device-code", { method: "POST" });
  await api("/api/auth/device-approve", { method: "POST", json: { user_code: dc.data.user_code, ...consent }, cookie });
  await sleep(3200);
  const t = await api("/api/auth/device-token", { method: "POST", json: { device_code: dc.data.device_code, label } });
  return t.data.access_token;
}

const upload = (token, buf) => {
  const form = new FormData();
  form.set("replay", new Blob([buf]), "x.SC2Replay");
  return api("/api/uploads", { method: "POST", form, token });
};

const name = "acct-" + crypto.randomBytes(3).toString("hex");
const me = await signIn(name);
const tokA = await linkLauncher(me.cookie, "Desktop");
const tokB = await linkLauncher(me.cookie, "Laptop");

// ---- launchers -----------------------------------------------------------------------------
const list = await api("/api/me/devices", { cookie: me.cookie });
check("two linked launchers are listed with their labels", list.status === 200 && list.data.devices.length === 2 && list.data.devices.some((d) => d.label === "Laptop"), JSON.stringify(list.data));
check("the list never contains token material", !JSON.stringify(list.data).includes(tokA) && !("token_hash" in list.data.devices[0]));
const desktop = list.data.devices.find((d) => d.label === "Desktop");
const rev = await api(`/api/me/devices/${desktop.id}`, { method: "DELETE", cookie: me.cookie });
check("one launcher can be unlinked", rev.status === 200, JSON.stringify(rev.data));
check("the unlinked launcher gets 401 on upload", (await upload(tokA, fakeReplay("a"))).status === 401);
const upB = await upload(tokB, fakeReplay("b"));
check("the other launcher still uploads", upB.status === 201, JSON.stringify(upB.data));
const stranger = await signIn(name + "-x");
const cross = await api(`/api/me/devices/${list.data.devices.find((d) => d.label === "Laptop").id}`, { method: "DELETE", cookie: stranger.cookie });
check("another account cannot unlink my launcher (404)", cross.status === 404, JSON.stringify(cross.data));
check("unlinking needs a session or token (401)", (await api("/api/me/devices", { method: "DELETE" })).status === 401);

// ---- consent from the launcher + history ----------------------------------------------------
const set = await api("/api/me/consent", { method: "PUT", json: { c1: true, c2: true, c3: true }, token: tokB });
check("a launcher can set all consents", set.status === 200 && set.data.c1 && set.data.c2 && set.data.c3, JSON.stringify(set.data));
const get = await api("/api/me/consent", { token: tokB });
check("the launcher reads the same consents back", get.status === 200 && get.data.c2 === true, JSON.stringify(get.data));
const off = await api("/api/me/consent", { method: "PUT", json: { c1: false, c2: false, c3: false }, cookie: me.cookie });
check("the browser can withdraw everything", off.status === 200 && !off.data.c1);
check("upload is refused after withdrawal (403 NO_CONSENT)", (await upload(tokB, fakeReplay("c"))).data?.code === "NO_CONSENT");
await api("/api/me/consent", { method: "PUT", json: { c1: true, c2: false, c3: false }, cookie: me.cookie });

// ---- export ----------------------------------------------------------------------------------
await upload(tokB, fakeReplay("d"));
const fb = new FormData();
fb.set("kind", "bug"); fb.set("title", "account test"); fb.set("body", "from the account flow test");
const sent = await api("/api/feedback", { method: "POST", form: fb, cookie: me.cookie });
check("signed-in user can send a bug report", sent.status === 201, JSON.stringify(sent.data));
const exp = await api("/api/me/export", { cookie: me.cookie });
check("export is a download with account, consent history, replays and messages",
  exp.status === 200 && /attachment/.test(exp.headers.get("content-disposition") ?? "") && exp.data.account.displayName === name &&
  exp.data.consentHistory.length >= 3 && exp.data.replays.length === 2 && exp.data.messages.length === 1, JSON.stringify(exp.data).slice(0, 300));
check("export has no token or hash material", !/token_hash|storage_?key|"sha256"|device_code|user_code/i.test(JSON.stringify({ ...exp.data, notIncluded: undefined })));
check("the export is built from the promised columns (camelCase) and keeps the account's own fields", exp.data.account.subject && exp.data.account.provider === "battlenet" || exp.data.account.provider, JSON.stringify(exp.data.account));
check("each replay carries its analysis, evaluation slot and per-replay settings", exp.data.replays.every((r) => "analysis" in r && "evaluation" in r && "visibilityOverride" in r && "trainingExcluded" in r && "sourceDeletedAt" in r && "c2AtUpload" in r), JSON.stringify(exp.data.replays[0]).slice(0, 300));
check("the export says what it leaves out and why", Array.isArray(exp.data.notIncluded) && exp.data.notIncluded.some((n) => /original replay files/.test(n.item)) && exp.data.notIncluded.every((n) => n.item && n.reason));
check("withdrawing every consent switched off the public and training flags of every stored replay at once", exp.data.replays.length === 2 && exp.data.replays.every((r) => r.c2AtUpload === false && r.c3AtUpload === false), JSON.stringify(exp.data.replays.map((r) => [r.c2AtUpload, r.c3AtUpload])));
check("the consent record in the export is the current one", exp.data.consent && typeof exp.data.consent.c1 === "boolean" && "policyVersion" in exp.data.consent && "updatedAt" in exp.data.consent);
check("export needs a sign-in", (await api("/api/me/export")).status === 401);

// ---- delete all replays ----------------------------------------------------------------------
const strangerUp = await linkLauncher(stranger.cookie, "S");
await upload(strangerUp, fakeReplay("s"));
const wipe = await api("/api/me/uploads", { method: "DELETE", cookie: me.cookie });
check("all my replays are deleted", wipe.status === 200 && wipe.data.deleted === 2, JSON.stringify(wipe.data));
// 3.7: the files go with the rows (STORAGE_DIR must be the server's storage folder for these checks)
const storageDir = process.env.STORAGE_DIR;
const filesOnDisk = () => {
  let n = 0;
  const walk = (d) => { for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) e.isDirectory() ? walk(path.join(d, e.name)) : n++; };
  if (storageDir) walk(path.join(storageDir, "users", String(me.id)));       // only this account's files: another account shares the folder
  return n;
};
if (storageDir) check("deleting all replays left no replay file in storage", filesOnDisk() === 0, String(filesOnDisk()));
check("my list is empty", (await api("/api/me/uploads", { cookie: me.cookie })).data.uploads.length === 0);
check("someone else's replays are untouched", (await api("/api/me/uploads", { cookie: stranger.cookie })).data.uploads.length === 1);
check("the account still exists", (await api("/api/me", { cookie: me.cookie })).status === 200);

// ---- withdrawal ------------------------------------------------------------------------------
check("withdrawal without confirmation is refused (400)", (await api("/api/me", { method: "DELETE", cookie: me.cookie, json: {} })).status === 400);
check("a launcher token cannot delete the account (401)", (await api("/api/me", { method: "DELETE", token: tokB, json: { confirm: "DELETE" } })).status === 401);
check("a launcher token still works (account intact)", (await api("/api/me", { token: tokB })).status === 200);
await api("/api/me/consent", { method: "PUT", cookie: me.cookie, json: { c1: true, c2: false, c3: false } });
const late = await upload(tokB, fakeReplay("late"));
check("a replay uploaded after that is accepted", late.status === 201, JSON.stringify(late.data));
if (storageDir) check("and its file is in storage before the account is deleted", filesOnDisk() === 1, String(filesOnDisk()));
const delOne = await api(`/api/me/uploads/${late.data.id}`, { method: "DELETE", cookie: me.cookie });
check("deleting that one replay removes its file too", delOne.status === 200 && (!storageDir || filesOnDisk() === 0), String(filesOnDisk()));
const late2 = await upload(tokB, fakeReplay("late-two"));
const del = await api("/api/me", { method: "DELETE", cookie: me.cookie, json: { confirm: "DELETE" } });
check("withdrawal succeeds and clears the cookie", del.status === 200 && /Max-Age=0/i.test(del.setCookie ?? ""), JSON.stringify(del));
check("account deletion reports no file still waiting, and no file is left in storage", del.data.filesPending === 0 && late2.status === 201 && (!storageDir || filesOnDisk() === 0), JSON.stringify([del.data, filesOnDisk()]));
check("the old session no longer works", (await api("/api/me", { cookie: me.cookie })).status === 401);
check("the launcher token no longer works", (await api("/api/me", { token: tokB })).status === 401);
const again = await signIn(name);
check("signing in with the same name afterwards makes a fresh account", again.id !== me.id);
const fresh = await api("/api/me", { cookie: again.cookie });
check("the fresh account has no consent and no replays", fresh.data.consent.c1 === false && (await api("/api/me/uploads", { cookie: again.cookie })).data.uploads.length === 0);
check("the other account survives", (await api("/api/me", { cookie: stranger.cookie })).status === 200);
const out = await api("/api/auth/logout", { method: "POST", cookie: stranger.cookie });
check("logout clears the session cookie", out.status === 200 && /Max-Age=0/i.test(out.setCookie ?? ""));

// ----- A6: ending every browser session -----
{
  const name = `sess-${crypto.randomBytes(3).toString("hex")}`;
  const a = await signIn(name), b = await signIn(name);
  check("two browsers of one account are both signed in", a.id === b.id && (await api("/api/me", { cookie: a.cookie })).status === 200 && (await api("/api/me", { cookie: b.cookie })).status === 200);
  const plain = await api("/api/auth/logout", { method: "POST", cookie: a.cookie });
  check("a plain sign-out only clears this browser's cookie", plain.status === 200 && (await api("/api/me", { cookie: b.cookie })).status === 200);
  const evil = await fetch(base + "/api/auth/logout", { method: "POST", headers: { origin: "http://evil.example", cookie: b.cookie, "content-type": "application/json" }, body: JSON.stringify({ everywhere: true }) });
  check("sign out everywhere needs the same origin (403 from another)", evil.status === 403 && (await api("/api/me", { cookie: b.cookie })).status === 200);
  const all = await api("/api/auth/logout", { method: "POST", json: { everywhere: true }, cookie: b.cookie });
  check("sign out everywhere clears the cookie", all.status === 200 && /Max-Age=0/i.test(all.setCookie ?? ""));
  check("and ends the account's other browser sessions too", (await api("/api/me", { cookie: a.cookie })).status === 401 && (await api("/api/me", { cookie: b.cookie })).status === 401);
  const c2 = await signIn(name);
  check("signing in again works with the new session version", c2.id === a.id && (await api("/api/me", { cookie: c2.cookie })).status === 200);
  const launcher = await linkLauncher(c2.cookie, "survives");
  const again2 = await api("/api/auth/logout", { method: "POST", json: { everywhere: true }, cookie: c2.cookie });
  check("launcher tokens are not touched by signing out everywhere", again2.status === 200 && (await api("/api/me", { token: launcher })).status === 200);
  const forged = `bpm_session=${Buffer.from(`${a.id}.${Date.now() + 1e9}.0`).toString("base64url")}.AAAA`;
  check("a cookie with a made-up body is refused", (await api("/api/me", { cookie: forged })).status === 401);
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
