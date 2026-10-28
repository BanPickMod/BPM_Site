// End-to-end check of C2 public viewing against a running dev server (docs/BPM_Backend_Plan.md section 2, 7, 10).
//   WORKER_TOKEN=... ADMIN_TOKEN=... node scripts/dev/public-flow-test.mjs http://localhost:3111 --python <python-with-s2protocol>
// The server needs BPM_DEV_LOGIN=1. A replay is public only while the uploader's C2 is on and no report hid it; this checks the
// three read paths (page, timeline API, list), withdrawal, reports, operator decisions, rate limit and that handles never leave.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import http from "node:http";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith("http")) ?? "http://localhost:3000").replace(/\/$/, "");
const python = args.includes("--python") ? args[args.indexOf("--python") + 1] : undefined;
const workerToken = process.env.WORKER_TOKEN ?? "";
const adminToken = process.env.ADMIN_TOKEN ?? "";
if (workerToken.length < 32 || adminToken.length < 16 || !python) {
  console.error("need WORKER_TOKEN (32+), ADMIN_TOKEN (16+) and --python <exe>");
  process.exit(2);
}
const hooks = [];
const hookPort = Number(process.env.WEBHOOK_PORT) || 0;      // the server under test must run with FEEDBACK_WEBHOOK_URL=http://127.0.0.1:<port>/hook
const hookServer = hookPort ? http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { hooks.push(b); res.end("ok"); }); }).listen(hookPort, "127.0.0.1") : null;
const replay = fs.readFileSync(path.resolve(here, "../../worker/tests/fixtures/bot_tvt_3picks.SC2Replay"));

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${String(detail).slice(0, 300)}`}`);
  if (!ok) failed++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(p, { method = "GET", json, form, token, cookie, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (cookie) h.cookie = cookie;
  let body;
  if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); } else if (form) body = form;
  const res = await fetch(base + p, { method, headers: h, body });
  const buf = Buffer.from(await res.arrayBuffer());
  let data;
  try { data = JSON.parse(buf.toString()); } catch { data = buf; }
  return { status: res.status, data, text: buf.toString("utf8"), setCookie: res.headers.get("set-cookie") };
}

async function newUser(label, c2) {
  const login = await api("/api/dev/login", { method: "POST", json: { name: `pub-${label}-${crypto.randomBytes(3).toString("hex")}`, age14: true } });
  const cookie = login.setCookie.split(";")[0];
  const dc = await api("/api/auth/device-code", { method: "POST" });
  await api("/api/auth/device-approve", { method: "POST", json: { user_code: dc.data.user_code, c1: true, c2, c3: false }, cookie });
  await wait(3200);
  const tok = await api("/api/auth/device-token", { method: "POST", json: { device_code: dc.data.device_code } });
  return { token: tok.data.access_token, cookie };
}
const setC2 = (u, c2) => api("/api/me/consent", { method: "PUT", cookie: u.cookie, json: { c1: true, c2, c3: false } });
const upload = (u) => {
  const form = new FormData();
  form.set("replay", new Blob([replay]), "replay.SC2Replay");
  return api("/api/uploads", { method: "POST", form, token: u.token });
};
const page = (p) => api(`/ko/replay-analysis/${p}`);
const report = (id, reason, headers) => api(`/api/shared/${id}/report`, { method: "POST", json: { reason, note: "test" }, headers });
const admin = (p, opt = {}) => api(`/api/admin/feedback${p}`, { ...opt, token: adminToken });
const replayItems = async (status = "OPEN") => (await admin(`?status=${status}&kind=replay`)).data.items;

const open = await newUser("open", true);      // allows public viewing
const closed = await newUser("closed", false); // does not
const a = await upload(open), b = await upload(closed);
check("both uploads are accepted", a.status === 201 && b.status === 201, JSON.stringify([a.data, b.data]));
const run = spawnSync(python, ["-X", "utf8", path.resolve(here, "../../worker/run_worker.py"), "--once"], {
  env: { BPM_HANDLE_KEY: "test-handle-key-0123456789abcdef0123456789", ...process.env, BPM_SERVER_URL: base, WORKER_TOKEN: workerToken }, encoding: "utf8", timeout: 300000,
});
check("the worker analysed them", run.status === 0 && (run.stdout.match(/READY/g) ?? []).length >= 2, run.stdout + run.stderr);
const A = a.data.id, B = b.data.id;

// ----- consent filter on every read path -----
const listHtml = (await page("shared")).text;
check("list: the C2 replay is listed", listHtml.includes(`/ko/replay-analysis/shared/${A}"`));
check("list: the non-C2 replay is not", !listHtml.includes(`/ko/replay-analysis/shared/${B}"`));
check("page: C2 replay opens without signing in", (await page(`shared/${A}`)).status === 200);
check("page: non-C2 replay is 404", (await page(`shared/${B}`)).status === 404);
const tlA = await api(`/api/shared/${A}/timeline`);
check("timeline: C2 replay gives gzip", tlA.status === 200 && tlA.data[0] === 0x1f && tlA.data[1] === 0x8b, `${tlA.status}`);
const tlJson = tlA.status === 200 ? JSON.parse(zlib.gunzipSync(tlA.data).toString()) : {};
check("timeline: no player handle leaves", (tlJson.players ?? []).length > 0 && tlJson.players.every((p) => p.handleKey === null && !("handle" in p)), JSON.stringify(tlJson.players));
const mineA = await api(`/api/me/uploads/${A}`, { cookie: open.cookie });
check("stored analysis has handle keys and no Battle.net handle", mineA.status === 200 && !/\d-S2-\d-\d{3,}/.test(JSON.stringify(mineA.data)) && mineA.data.analysis.players.every((p) => !("handle" in p)), JSON.stringify(mineA.data.analysis?.players));
const ownTl = await api(`/api/me/uploads/${A}/timeline`, { cookie: open.cookie });
check("the owner's stored timeline has no Battle.net handle either", ownTl.status === 200 && !/\d-S2-\d-\d{3,}/.test(zlib.gunzipSync(ownTl.data).toString()));
check("timeline: non-C2 replay is 404", (await api(`/api/shared/${B}/timeline`)).status === 404);
check("timeline: a bad id is 400", (await api("/api/shared/abc/timeline")).status === 400);
const detailHtml = (await page(`shared/${A}`)).text;
check("page: nothing links to a replay file", !/\.SC2Replay/i.test(detailHtml));
check("stats: counts the public game once and not the private one", /집계된 경기 1판/.test((await page("stats")).text));

// ----- C2 can be granted and withdrawn at any time -----
const patch = (u, id, json) => api(`/api/me/uploads/${id}`, { method: "PATCH", cookie: u.cookie, json });
check("granting C2 later does NOT publish a replay that was already stored", (await setC2(closed, true)).status === 200 && (await page(`shared/${B}`)).status === 404);
check("PATCH needs a signed-in owner and a valid body", (await api(`/api/me/uploads/${B}`, { method: "PATCH", json: { public: true } })).status === 401 && (await patch(closed, B, {})).status === 400 && (await patch(closed, B, { public: "yes" })).status === 400 && (await patch(open, B, { public: true })).status === 404);
check("the owner can open one stored replay once C2 is on", (await patch(closed, B, { public: true })).status === 200 && (await page(`shared/${B}`)).status === 200);
check("stats: the same game uploaded by both players is still one game", /집계된 경기 1판/.test((await page("stats")).text) && (await page("shared")).text.includes(`/shared/${B}"`));
check("withdrawing C2 hides it at once (page)", (await setC2(closed, false)).status === 200 && (await page(`shared/${B}`)).status === 404);
check("withdrawing C2 hides it at once (timeline)", (await api(`/api/shared/${B}/timeline`)).status === 404);
check("withdrawing C2 hides it at once (list)", !(await page("shared")).text.includes(`/shared/${B}"`));

// ----- per-replay privacy (A13) -----
check("re-granting C2 does not bring back a replay that was withdrawn", (await setC2(closed, true)).status === 200 && (await page(`shared/${B}`)).status === 404);
check("making a replay public needs C2 to be on (409 when it is off)", (await setC2(closed, false)).status === 200 && (await patch(closed, B, { public: true })).status === 409 && (await page(`shared/${B}`)).status === 404);
check("with C2 on again the owner opens it", (await setC2(closed, true)).status === 200 && (await patch(closed, B, { public: true })).status === 200 && (await page(`shared/${B}`)).status === 200);
check("marking it private removes it everywhere at once", (await patch(closed, B, { public: false })).status === 200 && (await page(`shared/${B}`)).status === 404 && (await api(`/api/shared/${B}/timeline`)).status === 404 && !(await page("shared")).text.includes(`/shared/${B}"`));
check("a private replay stays private when C2 is switched off and on", (await setC2(closed, false)).status === 200 && (await setC2(closed, true)).status === 200 && (await page(`shared/${B}`)).status === 404);
const mineB = await api(`/api/me/uploads/${B}`, { cookie: closed.cookie });
check("the owner still sees the private replay and its flags", mineB.status === 200 && mineB.data.visibility_override === "private", JSON.stringify(mineB.data).slice(0, 200));
check("training exclusion is stored per replay", (await patch(closed, B, { trainingExcluded: true })).status === 200 && (await api(`/api/me/uploads/${B}`, { cookie: closed.cookie })).data.training_excluded === true);
check("the data export lists the per-replay flags", (await api("/api/me/export", { cookie: closed.cookie })).text.includes("visibilityOverride"));
check("bulk publish needs C2 (409) and skips replays marked private", (await setC2(closed, false)).status === 200 && (await api("/api/me/uploads", { method: "PATCH", cookie: closed.cookie, json: { public: true } })).status === 409 && (await setC2(closed, true)).status === 200 && (await api("/api/me/uploads", { method: "PATCH", cookie: closed.cookie, json: { public: true } })).data.published === 0 && (await page(`shared/${B}`)).status === 404);
check("bulk publish rejects other bodies (400)", (await api("/api/me/uploads", { method: "PATCH", cookie: closed.cookie, json: { public: false } })).status === 400);
check("the list page marks the private replay", (await api(`/ko/replay-analysis/mine`, { cookie: closed.cookie })).text.includes("비공개로 지정"));
await patch(closed, B, { public: true });
check("after a withdraw and re-grant the list page offers the bulk publish and it opens the replay", (await setC2(closed, false)).status === 200 && (await setC2(closed, true)).status === 200 && (await api(`/ko/replay-analysis/mine`, { cookie: closed.cookie })).text.includes("한 번에 공개") && (await api("/api/me/uploads", { method: "PATCH", cookie: closed.cookie, json: { public: true } })).data.published === 1 && (await page(`shared/${B}`)).status === 200);
await setC2(closed, false);

// ----- reports -----
check("a cross-origin report is refused (403)", (await report(A, "other", { origin: "http://evil.example" })).status === 403);
check("an unknown reason is refused (400)", (await report(A, "spam")).status === 400);
check("a report for a non-public replay is 404", (await report(B, "other")).status === 404);
const other = await report(A, "other");
check("a general report is recorded and the replay stays public", other.status === 201 && other.data.hidden === false && (await page(`shared/${A}`)).status === 200, JSON.stringify(other.data));
const opp = await report(A, "opponent");
check("an opponent report takes it down at once", opp.status === 201 && opp.data.hidden === true && (await page(`shared/${A}`)).status === 404 && (await api(`/api/shared/${A}/timeline`)).status === 404);
check("stats drop a taken-down replay at once (cache is invalidated)", /집계된 경기 0판/.test((await page("stats")).text));
const mine = await api(`/ko/replay-analysis/mine/${A}`, { cookie: open.cookie });
check("the uploader still sees it and is told it was taken down", mine.status === 200 && mine.text.includes("신고가 접수"));
check("the admin inbox needs the admin token", (await api("/api/admin/feedback")).status === 401);
const open1 = await replayItems();
const mineItems = open1.filter((r) => r.replay_id === A);
check("the inbox shows both replay reports, the replay hidden", mineItems.length === 2 && mineItems.every((r) => r.replay_hidden && r.kind === "replay"), JSON.stringify(open1).slice(0, 200));
const target = mineItems[0].id;
check("an unknown action is refused (400)", (await admin(`/${target}`, { method: "POST", json: { action: "nope" } })).status === 400);
check("restore puts it back and closes the reports", (await admin(`/${target}`, { method: "POST", json: { action: "restore" } })).status === 200 && (await page(`shared/${A}`)).status === 200 && (await replayItems()).length === 0 && (await replayItems("DISMISSED")).length === 2);
check("stats count it again after the restore", /집계된 경기 1판/.test((await page("stats")).text));
// five reports an hour per reporter: two are used, three more pass, the next is refused
let limited = 0;
for (let i = 0; i < 4; i++) if ((await report(A, "other")).status === 429) limited++;
check("reports are rate limited (429 after five an hour)", limited === 1, `limited ${limited}`);
const again = (await replayItems("DISMISSED")).find((r) => r.replay_id === A);
check("remove deletes the replay for good", (await admin(`/${again.id}`, { method: "POST", json: { action: "remove" } })).status === 200 && (await page(`shared/${A}`)).status === 404 && (await api(`/ko/replay-analysis/mine/${A}`, { cookie: open.cookie })).status === 404);

// ----- bug reports and screenshots -----
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
const fb = (fields, files = [], cookie) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  for (const f of files) form.append("screenshot", new Blob([f.data]), f.name ?? "shot.png");
  return api("/api/feedback", { method: "POST", form, cookie });
};
const good = { kind: "bug", title: "Viewer freezes", body: "It freezes when I press play on a long game" };
check("an anonymous bug report without screenshots is accepted", (await fb(good)).status === 201);
check("a too-short report is refused (400)", (await fb({ kind: "bug", title: "x", body: "y" })).data.code === "TOO_SHORT");
check("an unknown kind is refused (400)", (await fb({ ...good, kind: "replay" })).status === 400);
check("screenshots need a signed-in user (401)", (await fb(good, [{ data: PNG }])).status === 401);
const withShot = await fb({ ...good, title: "With screenshot", page: "/ko/replay-analysis/mine/1" }, [{ data: PNG }], open.cookie);
check("a signed-in user can attach a screenshot", withShot.status === 201, JSON.stringify(withShot.data));
check("a file that is not an image is refused even if named .png (422)", (await fb(good, [{ data: Buffer.from("<svg onload=alert(1)>"), name: "a.png" }], open.cookie)).status === 422);
check("an SVG is refused (422)", (await fb(good, [{ data: Buffer.from("<?xml version='1.0'?><svg xmlns='http://www.w3.org/2000/svg'/>"), name: "a.svg" }], open.cookie)).status === 422);
check("a screenshot over 3 MB is refused (413)", (await fb(good, [{ data: Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]) }], open.cookie)).status === 413);
check("more than three screenshots are refused (400)", (await fb(good, [1, 2, 3, 4].map(() => ({ data: PNG })), open.cookie)).status === 400);
const bugs = (await admin("?kind=bug")).data.items;
const shot = bugs.find((b) => b.title === "With screenshot");
check("the inbox lists bugs with their screenshot count and page", shot && shot.files === 1 && shot.signed_in === true && shot.page === "/ko/replay-analysis/mine/1", JSON.stringify(shot));
const fileUrl = `${base}/api/admin/feedback/${shot?.id}/files/0`;
check("a screenshot needs the admin token (401)", (await fetch(fileUrl)).status === 401);
const img = await fetch(fileUrl, { headers: { authorization: `Bearer ${adminToken}` } });
check("the screenshot comes back as a sandboxed PNG that cannot be sniffed", img.status === 200 && img.headers.get("content-type") === "image/png" && img.headers.get("x-content-type-options") === "nosniff" && /sandbox/.test(img.headers.get("content-security-policy") ?? ""));
check("resolving moves it to the resolved list", (await admin(`/${shot.id}`, { method: "POST", json: { action: "resolve", note: "fixed" } })).status === 200 && (await admin("?status=RESOLVED&kind=bug")).data.items.some((b) => b.id === shot.id && b.admin_note === "fixed"));
check("a restore on a bug is refused (400)", (await admin(`/${shot.id}`, { method: "POST", json: { action: "restore" } })).status === 400);
check("deleting a record removes it and its screenshot", (await admin(`/${shot.id}`, { method: "POST", json: { action: "delete" } })).status === 200 && (await fetch(fileUrl, { headers: { authorization: `Bearer ${adminToken}` } })).status === 404);
const be32 = (n) => Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const pngWithText = Buffer.concat([PNG.subarray(0, 8), be32(13), Buffer.from("IHDR"), PNG.subarray(16, 29), PNG.subarray(29, 33), be32(17), Buffer.from("tEXt"), Buffer.from("Author secretname"), be32(0), PNG.subarray(33)]);
const seg = (m, body) => Buffer.concat([Buffer.from([0xff, m, (body.length + 2) >> 8, (body.length + 2) & 255]), body]);
const jpegWithGps = Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe0, Buffer.from("JFIF ")), seg(0xe1, Buffer.from("Exif  GPSLATLON")), Buffer.from([0xff, 0xda, 0, 3, 1, 0x11, 0x22, 0xff, 0xd9])]);
const meta = await fb({ ...good, title: "Metadata check" }, [{ data: pngWithText, name: "a.png" }, { data: jpegWithGps, name: "b.jpg" }], open.cookie);
check("screenshots with metadata are accepted", meta.status === 201, JSON.stringify(meta.data));
if (meta.status === 201) {
  const f0 = Buffer.from(await (await fetch(`${base}/api/admin/feedback/${meta.data.id}/files/0`, { headers: { authorization: `Bearer ${adminToken}` } })).arrayBuffer());
  const f1 = Buffer.from(await (await fetch(`${base}/api/admin/feedback/${meta.data.id}/files/1`, { headers: { authorization: `Bearer ${adminToken}` } })).arrayBuffer());
  check("the stored PNG has lost its text chunk", f0.length > 0 && !f0.includes("secretname") && f0.includes("IHDR"));
  check("the stored JPEG has lost its EXIF/GPS segment", f1.length > 0 && !f1.includes("GPSLATLON") && f1.includes("JFIF"));
}
check("the privacy notice page renders and names the opponent rule", (await page("../privacy")).text.includes("상대방의 익명화된 경기 내용"));
if (hookServer) {
  await wait(1500);
  const got = hooks.join(" ");
  check("the operator webhook was called for a bug and a replay report, without the details", /New Bug/.test(got) && /New Replay report/.test(got) && !got.includes("freezes when I press play"), got.slice(0, 200));
  hookServer.close();
}
let bugLimited = 0;
for (let i = 0; i < 11; i++) if ((await fb(good)).status === 429) bugLimited++;
check("anonymous bug reports are rate limited (429 after ten an hour)", bugLimited >= 1, `limited ${bugLimited}`);
// ----- 3.1 / 3.3: the original replay file does not outlive its use -----
{
  const storageDir = process.env.STORAGE_DIR;
  const sources = () => {
    if (!storageDir) return null;
    const out = [];
    const walk = (d) => { for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) e.isDirectory() ? walk(path.join(d, e.name)) : /\.SC2Replay$/.test(e.name) && out.push(e.name); };
    walk(path.join(storageDir, "users"));
    return out.length;
  };
  const detail = async (u, id) => (await api(`/api/me/uploads/${id}`, { cookie: u.cookie })).data;
  const dA = await detail(closed, B);
  check("analysis + evaluation finished: the original is already gone (owner sees when)", dA.source_deleted_at !== null && ["DONE", "SKIPPED"].includes(dA.eval_status), JSON.stringify([dA.source_deleted_at, dA.eval_status]));
  if (storageDir) check("and no original replay file is left in storage", sources() === 0, String(sources()));
  const page1 = await api(`/ko/replay-analysis/mine/${B}`, { cookie: closed.cookie });
  check("the page tells the owner the original was deleted", page1.text.includes("서버에서 삭제되었습니다"));
  check("a worker cannot be handed a deleted original", (await api(`/api/worker/replays/${B}`, { token: workerToken })).status !== 200);

  // a replay whose evaluation never runs: it is kept for at most the READY limit, then deleted by the retention run
  const slow = await newUser("slow", false);
  const up = await upload(slow);
  const noEval = spawnSync(python, ["-X", "utf8", path.resolve(here, "../../worker/run_worker.py"), "--once"], {
    env: { BPM_HANDLE_KEY: "test-handle-key-0123456789abcdef0123456789", ...process.env, BPM_EVAL: "0", BPM_SERVER_URL: base, WORKER_TOKEN: workerToken }, encoding: "utf8", timeout: 300000,
  });
  const dS = await detail(slow, up.data.id);
  check("without an evaluation the original is kept for now", noEval.status === 0 && dS.status === "READY" && dS.source_deleted_at === null && dS.eval_status === "PENDING", JSON.stringify([noEval.status, dS.status, dS.source_deleted_at, dS.eval_status]));
  if (storageDir) check("(one original file in storage)", sources() === 1, String(sources()));
  const retention = (json, token = adminToken) => api("/api/admin/maintenance/retention", { method: "POST", json, token });
  check("the retention run needs the admin token (401) and a sane body (400)", (await retention({}, "")).status === 401 && (await retention({ readyDays: -1 })).status === 400 && (await retention({ dryRun: 1 })).status === 400);
  const early = await retention({ dryRun: false });
  check("an original younger than the limit is left alone", early.status === 200 && early.data.sources.deleted === 0 && (await detail(slow, up.data.id)).source_deleted_at === null, JSON.stringify(early.data.sources));
  const dry = await retention({ readyDays: 0 });
  check("a dry run counts the due original and deletes nothing", dry.data.dryRun === true && dry.data.sources.due === 1 && dry.data.sources.deleted === 0 && (await detail(slow, up.data.id)).source_deleted_at === null, JSON.stringify(dry.data.sources));
  const real = await retention({ readyDays: 0, dryRun: false });
  const dS2 = await detail(slow, up.data.id);
  check("the real run deletes it, records when, and ends the evaluation that can no longer run", real.data.sources.deleted === 1 && dS2.source_deleted_at !== null && dS2.eval_status === "SKIPPED", JSON.stringify([real.data.sources, dS2.source_deleted_at, dS2.eval_status]));
  if (storageDir) check("(no original file in storage again)", sources() === 0, String(sources()));
  check("the analysis survives the deletion", dS2.status === "READY" && Array.isArray(dS2.analysis?.players) && (await api(`/api/me/uploads/${up.data.id}/timeline`, { cookie: slow.cookie })).status === 200);
  check("running it again finds nothing to do", (await retention({ readyDays: 0, dryRun: false })).data.sources.due === 0);
  check("the report shows oldest kept original and given-up deletes", "oldestKeptDays" in real.data.sources && real.data.sources.gaveUp === 0 && real.data.storageQueue && real.data.storageQueue.gaveUp === 0 && real.data.storageQueue.failed === 0);
}

// ----- A4: less context kept, and retention -----
{
  const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.92 Safari/537.36";
  const form = new FormData();
  for (const [k, v] of Object.entries({ kind: "bug", title: "Context check", body: "Checking what the inbox keeps", page: "https://example.com/ko/guide?token=secret#x" })) form.set(k, v);
  const sent = await api("/api/feedback", { method: "POST", form, headers: { "user-agent": CHROME, "x-forwarded-for": "203.0.113.77" } });
  const stored = (await admin("?status=OPEN&kind=bug")).data.items.find((i) => i.id === sent.data.id);
  check("the inbox keeps a coarse browser string, not the raw user agent", stored?.user_agent === "Chrome 130 · Windows", JSON.stringify(stored?.user_agent));
  check("the inbox keeps the page path only (no host, query or fragment)", stored?.page === "/ko/guide", JSON.stringify(stored?.page));
  check("no raw IP or user agent string is anywhere in the stored item", !JSON.stringify(stored).includes("203.0.113.77") && !JSON.stringify(stored).includes("AppleWebKit"));
}
const purge = (json, token = adminToken) => api("/api/admin/maintenance/purge-feedback", { method: "POST", json, token });
check("the purge needs the admin token (401)", (await purge({}, "")).status === 401);
check("the purge rejects a bad body (400)", (await purge({ days: -1 })).status === 400 && (await purge({ dryRun: "no" })).status === 400);
const closedBefore = (await admin("?status=RESOLVED")).data.items.length + (await admin("?status=DISMISSED")).data.items.length;
const openBefore = (await admin("?status=OPEN")).data.items.length;
check("there are closed and open messages to test with", closedBefore > 0 && openBefore > 0, `${closedBefore}/${openBefore}`);
const young = await purge({ days: 365, dryRun: false });
check("closed messages younger than the retention are kept", young.status === 200 && young.data.count === 0, JSON.stringify(young.data));
const dry = await purge({ days: 0 });
check("the purge also reports expired rate-limit rows", typeof (await purge({ days: 365 })).data.expiredRateRows === "number");
check("a dry run counts what is due and deletes nothing", dry.status === 200 && dry.data.dryRun === true && dry.data.count === closedBefore && (await admin("?status=RESOLVED")).data.items.length + (await admin("?status=DISMISSED")).data.items.length === closedBefore, JSON.stringify(dry.data));
const real = await purge({ days: 0, dryRun: false });
check("the real purge deletes closed messages and their screenshots", real.status === 200 && real.data.count === closedBefore && (await admin("?status=RESOLVED")).data.items.length + (await admin("?status=DISMISSED")).data.items.length === 0, JSON.stringify(real.data));
check("open messages are never purged", (await admin("?status=OPEN")).data.items.length === openBefore);
check("running it again finds nothing", (await purge({ days: 0, dryRun: false })).data.count === 0);

// ----- A10: requests about one's own data -----
{
  const post = (json, headers = {}, cookie) => api("/api/privacy-request", { method: "POST", json, headers, cookie });
  const ok = { type: "access", details: "Please tell me what you hold about my account." };
  check("the request page renders", (await page("../privacy-request")).status === 200);
  check("an unknown type is refused (BAD_TYPE), a short text (TOO_SHORT) and a bad address (BAD_CONTACT)",
    (await post({ ...ok, type: "spam" })).data.code === "BAD_TYPE" && (await post({ ...ok, details: "hey" })).data.code === "TOO_SHORT" && (await post({ ...ok, contact: "nope" })).data.code === "BAD_CONTACT");
  check("a request from another site is refused (403)", (await post(ok, { origin: "http://evil.example" })).status === 403);
  const form = new FormData();
  for (const [k, v] of Object.entries({ kind: "privacy_request", title: "abc", body: "some details here" })) form.set(k, v);
  check("the bug form cannot be used to file one (400)", (await api("/api/feedback", { method: "POST", form })).status === 400);

  const anon = await post({ ...ok, type: "deletion", contact: "someone@example.com" }, { "x-forwarded-for": "198.51.100.21" });
  const days = Math.round((Date.parse(anon.data.dueAt) - Date.now()) / 86400_000);
  check("an anonymous request is stored with an answer date about ten days away", anon.status === 201 && days >= 9 && days <= 10, JSON.stringify(anon.data));
  const mine = await post({ type: "restriction", details: "Please stop the public use of my replays.", contact: "me@example.com" }, { "x-forwarded-for": "198.51.100.22" }, open.cookie);
  check("a signed-in request is stored too", mine.status === 201);

  const list = (await admin("?status=OPEN&kind=privacy_request")).data.items;
  const a = list.find((i) => i.id === anon.data.id), m = list.find((i) => i.id === mine.data.id);
  check("the inbox lists both as privacy requests with type, time, channel and due date",
    a && m && a.reason === "deletion" && m.reason === "restriction" && a.channel === "web" && a.due_at && a.overdue === false && m.kind === "privacy_request", JSON.stringify(list.slice(0, 2)));
  check("it shows whether the sender was signed in (identity can be confirmed) and the reply address", a.signed_in === false && m.signed_in === true && a.contact === "someone@example.com");
  check("no browser string or page is kept for a request", a.user_agent === null);

  const ex = (await api("/api/me/export", { cookie: open.cookie })).data;
  const exMsg = ex.messages.find((x) => x.kind === "privacy_request");
  check("a signed-in sender's export contains their request, with its channel and time", exMsg && exMsg.reason === "restriction" && exMsg.channel === "web" && !!exMsg.createdAt, JSON.stringify(exMsg));

  const byMail = await admin("", { method: "POST", json: { type: "correction", details: "Email: please fix the spelling of my display name.", contact: "mail@example.com" } });
  const mailed = (await admin("?status=OPEN&kind=privacy_request")).data.items.find((i) => i.id === byMail.data.id);
  check("the operator can record a request that came by email", byMail.status === 201 && mailed && mailed.channel === "email" && mailed.contact === "mail@example.com", JSON.stringify(byMail.data));
  check("recording one needs a valid body (400)", (await admin("", { method: "POST", json: { type: "x", details: "long enough text" } })).status === 400);

  const closed = await admin(`/${anon.data.id}`, { method: "POST", json: { action: "resolve", note: "answered by email" } });
  const afterClose = (await admin("?status=RESOLVED&kind=privacy_request")).data.items.find((i) => i.id === anon.data.id);
  check("closing a request clears the reply address and keeps the note and the closing time", closed.status === 200 && afterClose && afterClose.contact === null && afterClose.admin_note === "answered by email", JSON.stringify(afterClose));

  let limited = 0;
  for (let i = 0; i < 7; i++) if ((await post(ok, { "x-forwarded-for": "198.51.100.77" })).status === 429) limited++;
  check("requests are rate limited per sender (429 after five an hour)", limited === 2, `limited ${limited}`);
  let spoofLimited = 0;
  for (let i = 0; i < 7; i++) if ((await post(ok, { "x-forwarded-for": `spoof-${i}-${Math.random()}, 198.51.100.78` })).status === 429) spoofLimited++;
  check("a changing left end of X-Forwarded-For does not give a fresh rate-limit bucket", spoofLimited === 2, `limited ${spoofLimited}`);
  check("an Origin of \"null\" is refused with 403, not a server error", (await post(ok, { origin: "null" })).status === 403);
  let recorded = 0;
  for (let i = 0; i < 7; i++) if ((await admin("", { method: "POST", json: { type: "access", details: `Emailed request number ${i} please` } })).status === 201) recorded++;
  check("an operator can record any number of emailed requests (no abuse limit)", recorded === 7, `recorded ${recorded}`);
}

// ----- A5: named operators, roles and the audit log (server started with ADMIN_TOKENS, see READONLY_TOKEN / MOD_TOKEN) -----
{
  const ro = process.env.READONLY_TOKEN, mod = process.env.MOD_TOKEN;
  if (!ro || !mod) console.log("SKIP  operator roles (set READONLY_TOKEN and MOD_TOKEN and start the server with ADMIN_TOKENS)");
  else {
    const as = (token, p, opt = {}) => api(p, { ...opt, token });
    // one fresh message with a screenshot to work on
    const form = new FormData();
    for (const [k, v] of Object.entries({ kind: "bug", title: "Role check", body: "Checking operator roles here" })) form.set(k, v);
    form.append("screenshot", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64")]), "s.png");
    const made = await api("/api/feedback", { method: "POST", form, cookie: open.cookie, headers: { "x-forwarded-for": "198.51.100.9" } });
    const id = made.data.id;
    check("a read-only operator lists the inbox", (await as(ro, "/api/admin/feedback")).status === 200);
    check("a read-only operator cannot open a screenshot (403)", (await as(ro, `/api/admin/feedback/${id}/files/0`)).status === 403);
    check("a read-only operator cannot decide (403) and the item is unchanged", (await as(ro, `/api/admin/feedback/${id}`, { method: "POST", json: { action: "resolve" } })).status === 403 && (await as(ro, "/api/admin/feedback?status=OPEN")).data.items.some((i) => i.id === id));
    check("a moderator opens the screenshot", (await as(mod, `/api/admin/feedback/${id}/files/0`)).status === 200);
    check("a moderator cannot run the retention job or read the audit log (403)", (await as(mod, "/api/admin/maintenance/retention", { method: "POST", json: {} })).status === 403 && (await as(mod, "/api/admin/audit")).status === 403);
    check("a moderator decides", (await as(mod, `/api/admin/feedback/${id}`, { method: "POST", json: { action: "resolve", note: "ok" } })).status === 200);
    check("an unknown token is 401, not 403", (await as("not-a-real-token-0123456789", "/api/admin/feedback")).status === 401);
    const log = await as(adminToken, "/api/admin/audit?limit=100");
    const mine = (log.data.items ?? []).filter((r) => r.target === `feedback:${id}`);
    check("the owner reads the audit log", log.status === 200 && Array.isArray(log.data.items));
    check("the log names who opened the screenshot and who decided", mine.some((r) => r.actor === "mod" && r.action === "screenshot.view") && mine.some((r) => r.actor === "mod" && r.action === "feedback.resolve"), JSON.stringify(mine));
    check("refused attempts are logged with the refused operator", (log.data.items ?? []).some((r) => r.actor === "rev" && r.action === "denied"), JSON.stringify(log.data.items?.slice(0, 5)));
    const text = JSON.stringify(log.data);
    check("the log holds no message content, only actors, actions and targets", !text.includes("Checking operator roles") && !text.includes("Role check") && !text.includes("198.51.100.9"));
    check("the owner can filter the log by operator", (await as(adminToken, "/api/admin/audit?actor=mod")).data.items.every((r) => r.actor === "mod"));
  }
}

check("the feedback page and the operator page render", (await page("../feedback")).status === 200 && (await api("/ko/admin/feedback")).status === 200);

console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
