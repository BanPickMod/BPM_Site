#!/usr/bin/env node
/**
 * Black-box test of the launcher-facing API: device login, consent, upload, access control.
 *
 *   BPM_DEV_LOGIN=1 npm run dev          (another terminal; dev login only exists in non-production)
 *   node scripts/dev/upload-flow-test.mjs http://localhost:3000
 *
 * Creates throwaway users named "flowtest-<random>" in whatever database the server uses. Never run against production
 * (it cannot: dev login is disabled there).
 */
import crypto from "node:crypto";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${String(detail).slice(0, 300)}`}`);
  if (!ok) failed++;
};

/** A minimal fake replay: MPQ user-data signature + padding. The API only checks the signature and size here. */
const fakeReplay = (tag) => Buffer.concat([Buffer.from([0x4d, 0x50, 0x51, 0x1b]), crypto.randomBytes(200), Buffer.from(tag)]);
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

async function api(path, { method = "GET", json, form, token, cookie, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (cookie) h.cookie = cookie;
  let body;
  if (json !== undefined) {
    h["content-type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) body = form;
  const res = await fetch(base + path, { method, headers: h, body });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, setCookie: res.headers.get("set-cookie") };
}

const upload = (token, buf, extra = {}) => {
  const form = new FormData();
  form.set("replay", new Blob([buf]), "x.SC2Replay");
  if (extra.sha256 !== undefined) form.set("sha256", extra.sha256);
  return api("/api/uploads", { method: "POST", form, token });
};

// ---- sign in (dev) and link a "launcher" ------------------------------------------------------
const name = "flowtest-" + crypto.randomBytes(3).toString("hex");
const login = await api("/api/dev/login", { method: "POST", json: { name, age14: true } });
check("dev login works (server started with BPM_DEV_LOGIN=1)", login.status === 200, JSON.stringify(login.data));
if (login.status !== 200) process.exit(1);
const cookie = login.setCookie.split(";")[0];

const dc = await api("/api/auth/device-code", { method: "POST" });
check("device code issued", dc.status === 200 && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(dc.data.user_code), JSON.stringify(dc.data));

const pending = await api("/api/auth/device-token", { method: "POST", json: { device_code: dc.data.device_code } });
check("polling before approval says authorization_pending", pending.status === 400 && pending.data.error === "authorization_pending", JSON.stringify(pending.data));
const fast = await api("/api/auth/device-token", { method: "POST", json: { device_code: dc.data.device_code } });
check("polling again immediately says slow_down", fast.data.error === "slow_down", JSON.stringify(fast.data));

const noC1 = await api("/api/auth/device-approve", { method: "POST", json: { user_code: dc.data.user_code, c1: false, c2: true, c3: true }, cookie });
check("approval without upload consent (C1) is refused", noC1.status === 422 && noC1.data.code === "NO_CONSENT", JSON.stringify(noC1.data));
const noSession = await api("/api/auth/device-approve", { method: "POST", json: { user_code: dc.data.user_code, c1: true, c2: false, c3: false } });
check("approval without a browser session is refused", noSession.status === 401, JSON.stringify(noSession.data));
const wrongOrigin = await api("/api/auth/device-approve", { method: "POST", json: { user_code: dc.data.user_code, c1: true, c2: false, c3: false }, cookie, headers: { origin: "https://evil.example" } });
check("approval from another origin is refused (CSRF)", wrongOrigin.status === 403, JSON.stringify(wrongOrigin.data));
const badCode = await api("/api/auth/device-approve", { method: "POST", json: { user_code: "ZZZZ-ZZZZ", c1: true, c2: false, c3: false }, cookie });
check("approving an unknown code is refused", badCode.status === 404 && badCode.data.code === "BAD_CODE", JSON.stringify(badCode.data));

const ok = await api("/api/auth/device-approve", { method: "POST", json: { user_code: dc.data.user_code, c1: true, c2: false, c3: false }, cookie });
check("approval with C1 succeeds", ok.status === 200, JSON.stringify(ok.data));

await new Promise((r) => setTimeout(r, 3200)); // respect the poll interval
const tok = await api("/api/auth/device-token", { method: "POST", json: { device_code: dc.data.device_code, label: "flow test" } });
check("approved code is exchanged for a token", tok.status === 200 && typeof tok.data.access_token === "string", JSON.stringify(tok.data));
const token = tok.data.access_token;
await new Promise((r) => setTimeout(r, 3200));
const again = await api("/api/auth/device-token", { method: "POST", json: { device_code: dc.data.device_code } });
check("the same code cannot be exchanged twice", again.status === 400 && again.data.error !== undefined, JSON.stringify(again.data));

// ---- uploads ----------------------------------------------------------------------------------
const noTok = await upload(undefined, fakeReplay("a"));
check("upload without a token is 401", noTok.status === 401, JSON.stringify(noTok.data));
const badTok = await upload("not-a-real-token", fakeReplay("a"));
check("upload with a bad token is 401", badTok.status === 401, JSON.stringify(badTok.data));

const r1 = fakeReplay("one");
const up1 = await upload(token, r1, { sha256: sha(r1) });
check("upload is stored and queued (201)", up1.status === 201 && up1.data.status === "QUEUED" && up1.data.duplicate === false, JSON.stringify(up1.data));
const dup = await upload(token, r1);
check("same file again is a duplicate (200, same id)", dup.status === 200 && dup.data.duplicate === true && dup.data.id === up1.data.id, JSON.stringify(dup.data));
const mism = await upload(token, fakeReplay("two"), { sha256: "0".repeat(64) });
check("hash mismatch is refused (422)", mism.status === 422 && mism.data.code === "HASH_MISMATCH", JSON.stringify(mism.data));
const junk = await upload(token, Buffer.from("this is not a replay ".repeat(20)));
check("non-replay is refused (422)", junk.status === 422 && junk.data.code === "NOT_REPLAY", JSON.stringify(junk.data));
const big = await upload(token, Buffer.concat([Buffer.from([0x4d, 0x50, 0x51, 0x1b]), Buffer.alloc(11 * 1024 * 1024)]));
check("oversize file is refused (413)", big.status === 413, JSON.stringify(big.data));

const status = await api(`/api/uploads/${up1.data.id}`, { token });
check("upload status is readable by its owner", status.status === 200 && status.data.status === "QUEUED", JSON.stringify(status.data));

// another user cannot see it
const other = await api("/api/dev/login", { method: "POST", json: { name: name + "-other", age14: true } });
const otherCookie = other.setCookie.split(";")[0];
const dc2 = await api("/api/auth/device-code", { method: "POST" });
await api("/api/auth/device-approve", { method: "POST", json: { user_code: dc2.data.user_code, c1: true, c2: false, c3: false }, cookie: otherCookie });
await new Promise((r) => setTimeout(r, 3200));
const tok2 = await api("/api/auth/device-token", { method: "POST", json: { device_code: dc2.data.device_code } });
const peek = await api(`/api/uploads/${up1.data.id}`, { token: tok2.data.access_token });
check("another user cannot read it (404)", peek.status === 404, JSON.stringify(peek.data));
const sameFileOther = await upload(tok2.data.access_token, r1);
check("another user uploading the same bytes gets their own record", sameFileOther.status === 201 && sameFileOther.data.id !== up1.data.id, JSON.stringify(sameFileOther.data));

// ---- consent ----------------------------------------------------------------------------------
const mine = await api("/api/me/uploads", { cookie });
check("owner lists exactly their uploads in the browser", mine.status === 200 && mine.data.uploads.length === 1, JSON.stringify(mine.data));
const withdraw = await api("/api/me/consent", { method: "PUT", json: { c1: false, c2: false, c3: false }, token });
check("consent can be withdrawn from the launcher token", withdraw.status === 200 && withdraw.data.c1 === false, JSON.stringify(withdraw.data));
const blocked = await upload(token, fakeReplay("three"));
check("after withdrawing C1, uploads are refused (403 NO_CONSENT)", blocked.status === 403 && blocked.data.code === "NO_CONSENT", JSON.stringify(blocked.data));
const regrant = await api("/api/me/consent", { method: "PUT", json: { c1: true, c2: true, c3: false }, cookie });
check("consent can be granted again from the browser", regrant.status === 200 && regrant.data.c2 === true, JSON.stringify(regrant.data));
const back = await upload(token, fakeReplay("four"));
check("uploads work again after re-granting", back.status === 201, JSON.stringify(back.data));
const badBody = await api("/api/me/consent", { method: "PUT", json: { c1: "yes" }, cookie });
check("malformed consent body is refused (400)", badBody.status === 400, JSON.stringify(badBody.data));

console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exitCode = failed ? 1 : 0;
