#!/usr/bin/env node
/**
 * First sign-in steps and policy changes against a running dev server (docs/Privacy_Compliance_Additional_Plan.md, sections 3.5 and 3.6).
 *
 *   BPM_DEV_LOGIN=1 npm run dev                                   (an empty PGLITE_DIR, a fixed SESSION_SECRET)
 *   node scripts/dev/onboarding-flow-test.mjs http://localhost:3000 --phase onboarding
 *
 * Re-consent needs two server runs on the same database, the second with a longer policy changelog:
 *   node scripts/dev/onboarding-flow-test.mjs http://localhost:3000 --phase before --state <file>      (default changelog)
 *   ... restart the server with BPM_POLICY_CHANGELOG_JSON=<see CHANGELOG below> and the same PGLITE_DIR / SESSION_SECRET ...
 *   node scripts/dev/onboarding-flow-test.mjs http://localhost:3000 --phase after --state <file>
 */
import crypto from "node:crypto";
import fs from "node:fs";

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith("http")) ?? "http://localhost:3000").replace(/\/$/, "");
const flag = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const phase = flag("phase") ?? "onboarding";
const stateFile = flag("state");

export const CHANGELOG = [
  { version: "2026-10-28-draft", kind: "notice", affects: [], ko: "개인정보 처리방침 최초 초안", en: "First draft of the Privacy Policy" },
  { version: "2026-11-01-t", kind: "notice", affects: [], ko: "연락처가 바뀌었습니다", en: "The contact changed" },
  { version: "2026-11-02-t", kind: "consent", affects: ["c2", "c3"], ko: "공개와 학습의 범위가 바뀌었습니다", en: "The scope of public viewing and training changed" },
];

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${String(detail).slice(0, 300)}`}`);
  if (!ok) failed++;
};

async function api(p, { method = "GET", json, cookie, headers = {}, redirect = "follow" } = {}) {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  let body;
  if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); }
  const res = await fetch(base + p, { method, headers: h, body, redirect });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, text, setCookie: res.headers.get("set-cookie"), location: res.headers.get("location") };
}
const login = async (name, onboarding) => {
  const r = await api("/api/dev/login", { method: "POST", json: { name, age14: true, ...(onboarding ? { onboarding } : {}) } });
  return { id: r.data.id, cookie: r.setCookie.split(";")[0], onboarded: r.data.onboarded };
};
const me = async (u) => (await api("/api/me", { cookie: u.cookie })).data;
const exportOf = async (u) => (await api("/api/me/export", { cookie: u.cookie })).data;
const rnd = () => crypto.randomBytes(3).toString("hex");

if (phase === "onboarding") {
  const u = await login(`onb-${rnd()}`, "pending");
  check("a new account has not finished the first sign-in steps", u.onboarded === false && (await me(u)).onboarded === false);
  check("it has no policy notices yet (it sees the current text during onboarding)", (await me(u)).notices.length === 0);

  const dc = await api("/api/auth/device-code", { method: "POST" });
  const approve = await api("/api/auth/device-approve", { method: "POST", json: { user_code: dc.data.user_code, c1: true, c2: false, c3: false }, cookie: u.cookie });
  check("it cannot link a launcher before onboarding (409 ONBOARDING_REQUIRED)", approve.status === 409 && approve.data.code === "ONBOARDING_REQUIRED", JSON.stringify(approve.data));

  for (const p of ["/ko/account", "/ko/replay-analysis/mine", "/ko/device"]) {
    const r = await api(p, { cookie: u.cookie, redirect: "manual" });
    check(`${p} sends it to the onboarding page`, [301, 302, 303, 307, 308].includes(r.status) && /\/ko\/onboarding\?next=/.test(r.location ?? ""), `${r.status} ${r.location}`);
  }
  const page = await api("/ko/onboarding?next=%2Fko%2Faccount", { cookie: u.cookie });
  check("the onboarding page renders for it", page.status === 200 && page.text.includes("처음 시작하기"));
  check("the onboarding page asks for a sign-in when there is none", (await api("/ko/onboarding")).text.includes("처음 시작하기"));

  check("saving needs a session (401), the same origin (403) and a body (400)",
    (await api("/api/me/onboarding", { method: "POST", json: { c1: false, c2: false, c3: false } })).status === 401 &&
    (await api("/api/me/onboarding", { method: "POST", json: { c1: false, c2: false, c3: false }, cookie: u.cookie, headers: { origin: "http://evil.example" } })).status === 403 &&
    (await api("/api/me/onboarding", { method: "POST", json: { c1: true }, cookie: u.cookie })).status === 400);
  check("it is still not finished after those refusals", (await me(u)).onboarded === false);

  const done = await api("/api/me/onboarding", { method: "POST", json: { c1: false, c2: false, c3: false }, cookie: u.cookie });
  const m = await me(u);
  check("finishing with every optional consent off is accepted", done.status === 200 && m.onboarded === true && !m.consent.c1 && !m.consent.c2 && !m.consent.c3, JSON.stringify(m));
  const ex = await exportOf(u);
  check("the completion time, the policy version and the consent record with its source are kept",
    !!ex.account.onboardingCompletedAt && !!ex.account.onboardingPolicyVersion && ex.account.policySeenVersion === ex.account.onboardingPolicyVersion &&
    ex.consentHistory.some((h) => h.source === "onboarding" && h.c1 === false && h.c2 === false && h.c3 === false && !!h.consentVersion), JSON.stringify(ex.account) + JSON.stringify(ex.consentHistory));
  check("afterwards the account pages open without a redirect", (await api("/ko/account", { cookie: u.cookie, redirect: "manual" })).status === 200 && (await api("/ko/replay-analysis/mine", { cookie: u.cookie, redirect: "manual" })).status === 200);
  const again = await api("/api/me/onboarding", { method: "POST", json: { c1: false, c2: false, c3: false }, cookie: u.cookie });
  const ex2 = await exportOf(u);
  check("repeating it is harmless and keeps the first completion time", again.status === 200 && ex2.account.onboardingCompletedAt === ex.account.onboardingCompletedAt);
  const away = await api("/ko/onboarding?next=//evil.example/x", { cookie: u.cookie, redirect: "manual" });
  check("a finished account is sent on, and never to another site", [301, 302, 303, 307, 308].includes(away.status) && !/evil/.test(away.location ?? "") && /\/ko\/account/.test(away.location ?? ""), `${away.status} ${away.location}`);

  const v = await login(`onb-${rnd()}`, "pending");
  await api("/api/me/onboarding", { method: "POST", json: { c1: true, c2: false, c3: false }, cookie: v.cookie });
  const vm = await me(v);
  check("choosing one consent keeps exactly that one", vm.onboarded && vm.consent.c1 && !vm.consent.c2 && !vm.consent.c3);
  const dc2 = await api("/api/auth/device-code", { method: "POST" });
  const ok = await api("/api/auth/device-approve", { method: "POST", json: { user_code: dc2.data.user_code, c1: true, c2: false, c3: false }, cookie: v.cookie });
  check("after onboarding it can link a launcher", ok.status === 200, JSON.stringify(ok.data));
  const plain = await login(`onb-${rnd()}`);
  check("the development sign-in finishes the steps for you unless asked not to", plain.onboarded === true);
}

if (phase === "before") {
  const a = await login(`pol-a-${rnd()}`, "pending");
  await api("/api/me/onboarding", { method: "POST", json: { c1: true, c2: true, c3: true }, cookie: a.cookie });
  const b = await login(`pol-b-${rnd()}`, "pending");
  await api("/api/me/onboarding", { method: "POST", json: { c1: true, c2: false, c3: false }, cookie: b.cookie });
  const ma = await me(a);
  check("with the first policy text, nothing is pending and there are no notices", ma.notices.length === 0 && ma.consent.reconsentPending.length === 0 && ma.consent.c2 && ma.consent.c3);
  if (stateFile) fs.writeFileSync(stateFile, JSON.stringify({ a, b }));
}

if (phase === "after") {
  const { a, b } = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  const before = await exportOf(a);
  const ma = await me(a);
  check("the banner lists both changes made since the user last looked", ma.notices.map((n) => n.version).join() === "2026-11-01-t,2026-11-02-t", JSON.stringify(ma.notices.map((n) => n.version)));
  check("the consent-level change switched off exactly the consents it names", ma.consent.c1 === true && ma.consent.c2 === false && ma.consent.c3 === false, JSON.stringify(ma.consent));
  check("and remembers them as waiting for an answer", ma.consent.reconsentPending.join() === "c2,c3", JSON.stringify(ma.consent.reconsentPending));
  const ex = await exportOf(a);
  const row = ex.consentHistory.find((h) => h.source === "policy-change");
  check("the switch-off is logged like a withdrawal, on the new consent version", !!row && row.c1 === true && row.c2 === false && row.c3 === false && row.consentVersion === "2026-11-02-t" && ex.consent.consentVersion === "2026-11-02-t", JSON.stringify(row));
  check("reading it again does not log it twice", ex.consentHistory.filter((h) => h.source === "policy-change").length === 1 && (await exportOf(a)).consentHistory.filter((h) => h.source === "policy-change").length === 1);

  const mb = await me(b);
  check("a user who had those consents off has nothing pending, but still sees the notices", mb.consent.reconsentPending.length === 0 && mb.notices.length === 2 && mb.consent.c1 === true);

  const next = { c1: ma.consent.c1, c2: true, c3: false };
  await api("/api/me/consent", { method: "PUT", json: next, cookie: a.cookie });
  check("turning one consent on again answers just that one", (await me(a)).consent.reconsentPending.join() === "c3" && (await me(a)).consent.c2 === true);

  const ack = await api("/api/me/policy", { method: "POST", cookie: a.cookie });
  const after = await me(a);
  check("reading the changes clears the banner and keeps the other consent off", ack.status === 200 && after.notices.length === 0 && after.consent.reconsentPending.length === 0 && after.consent.c3 === false && after.consent.c2 === true, JSON.stringify(after));
  const ex2 = await exportOf(a);
  check("the acknowledgement is recorded with the versions it moved between",
    ex2.policyAcknowledgements.length === 1 && ex2.policyAcknowledgements[0].fromVersion === "2026-10-28-draft" && ex2.policyAcknowledgements[0].toVersion === "2026-11-02-t" && ex2.account.policySeenVersion === "2026-11-02-t", JSON.stringify(ex2.policyAcknowledgements));
  check("acknowledging needs a session", (await api("/api/me/policy", { method: "POST" })).status === 401);

  const c = await login(`pol-c-${rnd()}`, "pending");
  check("a notice for an account that has not finished onboarding is not shown", (await me(c)).notices.length === 0);
  await api("/api/me/onboarding", { method: "POST", json: { c1: true, c2: true, c3: true }, cookie: c.cookie });
  const mc = await me(c);
  check("an account that onboards after the change sees the current text and nothing is pending", mc.notices.length === 0 && mc.consent.c2 && mc.consent.c3 && mc.consent.reconsentPending.length === 0);
  void before;
}

console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
