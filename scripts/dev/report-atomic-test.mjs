#!/usr/bin/env node
/**
 * The report-and-hide statement is all or nothing (docs/Privacy_Compliance_Additional_Plan.md, section 3.2).
 *
 *   npm run test:report-atomic
 *
 * Runs lib/reportSql.ts against an in-memory Postgres (PGlite) with every migration applied, including a statement that is made
 * to fail half way: the replay must still be public afterwards, and no report row may exist.
 */
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "../../lib/server/migrations.ts";
import { REPORT_AND_HIDE_SQL } from "../../lib/reportSql.ts";

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${String(detail).slice(0, 300)}`}`);
  if (!ok) failed++;
};

const pg = new PGlite();
await migrate((sql) => pg.exec(sql));
await pg.exec("insert into app_user (provider, subject, display_name) values ('t','1','u')");
const add = async (sha, extra = {}) => {
  const { rows } = await pg.query(
    "insert into user_replay (user_id, sha256, storage_key, size, c2_at_upload, c3_at_upload, status, timeline_key, visibility_override) values (1,$1,'k',1,$2,false,'READY','t',$3) returning id",
    [sha, extra.c2 ?? true, extra.vis ?? "default"],
  );
  return rows[0].id;
};
const state = async (id) => (await pg.query("select hidden_at is not null as hidden, hidden_reason from user_replay where id = $1", [id])).rows[0];
const reports = async (id) => (await pg.query("select count(*)::int as n from feedback where replay_id = $1", [id])).rows[0].n;
const report = (id, over = {}) => pg.query(REPORT_AND_HIDE_SQL, ["kind" in over ? over.kind : "replay", id, over.reason ?? "privacy", null, "a note", "/replay-analysis/shared/" + id, null, null]);

const a = await add("a");
const r1 = (await report(a)).rows[0];
check("a public replay is hidden and the report is stored, together", r1.id && r1.hidden === 1 && (await state(a)).hidden === true && (await state(a)).hidden_reason === "privacy" && (await reports(a)) === 1, JSON.stringify(r1));

const r2 = (await report(a)).rows[0];
check("a second report of the same replay finds it already hidden: no row, nothing stored", r2.id === null && r2.hidden === 0 && (await reports(a)) === 1, JSON.stringify(r2));

const b = await add("b");
let threw = false;
try { await report(b, { kind: null }); } catch { threw = true; }       // feedback.kind is NOT NULL: the insert fails after the update was planned
check("when the report cannot be stored, the replay is not hidden (it stays public)", threw && (await state(b)).hidden === false && (await reports(b)) === 0);

const c = await add("c", { c2: false });
const r3 = (await report(c)).rows[0];
check("a replay that is not public is neither hidden nor reported", r3.id === null && r3.hidden === 0 && (await state(c)).hidden === false && (await reports(c)) === 0);

const d = await add("d", { vis: "private" });
const r4 = (await report(d)).rows[0];
check("a replay the owner made private is left alone too", r4.id === null && (await reports(d)) === 0);

const e = await add("e");
const [x, y] = await Promise.all([report(e), report(e)]);
const ids = [x.rows[0].id, y.rows[0].id].filter(Boolean);
check("two reports at the same moment: the replay is hidden once and exactly one report is stored", (await state(e)).hidden === true && (await reports(e)) === 1 && ids.length === 1, JSON.stringify([x.rows[0], y.rows[0]]));

console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
