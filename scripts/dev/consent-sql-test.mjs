#!/usr/bin/env node
/**
 * The consent statements change the consent and every stored replay's flags together (lib/consentSql.ts).
 *   npm run test:consent-sql
 * Regression: two data-modifying CTEs on the same rows in one statement apply only one of them, so a withdrawal once cleared the
 * training flag and left the public flag on.
 */
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "../../lib/server/migrations.ts";
import { APPLY_CONSENT_VERSION_SQL, SET_CONSENT_SQL } from "../../lib/consentSql.ts";

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${String(detail).slice(0, 300)}`}`);
  if (!ok) failed++;
};
async function fresh() {
  const pg = new PGlite();
  await migrate((sql) => pg.exec(sql));
  await pg.exec("insert into app_user (provider, subject, display_name) values ('t','1','u')");
  await pg.exec("insert into user_replay (user_id, sha256, storage_key, size, c2_at_upload, c3_at_upload) values (1,'a','k',1,true,true), (1,'b','k2',1,true,false), (1,'c','k3',1,false,true)");
  return pg;
}
const flags = async (pg) => (await pg.query("select sha256, c2_at_upload c2, c3_at_upload c3 from user_replay order by sha256")).rows.map((r) => `${r.sha256}:${+r.c2}${+r.c3}`).join(" ");
const set = (pg, c1, c2, c3, pending = "", src = "web") => pg.query(SET_CONSENT_SQL, [1, c1, c2, c3, "pv", "cv", pending, src]);

{
  const pg = await fresh();
  await set(pg, true, false, false);
  check("withdrawing both C2 and C3 clears both flags on every replay", (await flags(pg)) === "a:00 b:00 c:00", await flags(pg));
}
{
  const pg = await fresh();
  await set(pg, true, false, true);
  check("withdrawing only C2 leaves the training flag alone", (await flags(pg)) === "a:01 b:00 c:01", await flags(pg));
}
{
  const pg = await fresh();
  await set(pg, true, true, false);
  check("withdrawing only C3 leaves the public flag alone", (await flags(pg)) === "a:10 b:10 c:00", await flags(pg));
}
{
  const pg = await fresh();
  await set(pg, true, true, true);
  check("granting changes no replay: nothing is opened by a grant", (await flags(pg)) === "a:11 b:10 c:01", await flags(pg));
  await set(pg, true, false, false);
  await set(pg, true, true, true);
  check("turning them on again does not bring back what a withdrawal cleared", (await flags(pg)) === "a:00 b:00 c:00", await flags(pg));
  const log = (await pg.query("select count(*)::int n, bool_and(consent_version = 'cv') ok from consent_log")).rows[0];
  check("every change is logged with its consent version", log.n === 3 && log.ok === true, JSON.stringify(log));
}
{
  const pg = await fresh();
  await set(pg, true, true, true);
  // a policy change that asks C2 and C3 again, applied to a consent that is still on the old version
  await pg.exec("update consent set consent_version = 'old'");
  const r = await pg.query(APPLY_CONSENT_VERSION_SQL, [1, false, true, true, "c2,c3", "new", "old", "pv2", true]);
  check("a policy change switches off the named consents on the row AND clears both replay flags", r.rows[0].c1 === true && r.rows[0].c2 === false && r.rows[0].c3 === false && (await flags(pg)) === "a:00 b:00 c:00", JSON.stringify(r.rows) + await flags(pg));
  const row = (await pg.query("select consent_version, reconsent_pending from consent")).rows[0];
  const log = (await pg.query("select source, c2, c3 from consent_log where source = 'policy-change'")).rows;
  check("it records the new version, what is pending and one log line", row.consent_version === "new" && row.reconsent_pending === "c2,c3" && log.length === 1 && log[0].c2 === false, JSON.stringify([row, log]));
  const again = await pg.query(APPLY_CONSENT_VERSION_SQL, [1, false, true, true, "c2,c3", "new", "old", "pv2", true]);
  check("a second reader with the old version changes nothing and logs nothing", again.rows.length === 0 && (await pg.query("select count(*)::int n from consent_log where source = 'policy-change'")).rows[0].n === 1);
}
{
  const pg = await fresh();
  await set(pg, true, true, true);
  await pg.exec("update consent set consent_version = 'old'");
  await pg.query(APPLY_CONSENT_VERSION_SQL, [1, false, true, false, "c2", "new", "old", "pv2", true]);
  check("a policy change that names only C2 leaves the training flag as it was", (await flags(pg)) === "a:01 b:00 c:01", await flags(pg));
}
console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
