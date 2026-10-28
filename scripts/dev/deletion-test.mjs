#!/usr/bin/env node
/**
 * Deleting an account never loses a file name (docs/Privacy_Compliance_Additional_Plan.md, section 3.7).
 *
 *   npm run test:deletion
 *
 * Runs the statements of lib/deleteSql.ts on an in-memory Postgres (PGlite) with every migration applied, including a delete that is
 * made to fail: nothing may change then, and every file name must be in the queue exactly when its row is gone.
 */
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "../../lib/server/migrations.ts";
import { DELETE_ACCOUNT_SQL, DELETE_ALL_UPLOADS_SQL, DELETE_FEEDBACK_SQL, DELETE_UPLOAD_SQL, REMOVE_REPLAY_SQL } from "../../lib/deleteSql.ts";

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${String(detail).slice(0, 300)}`}`);
  if (!ok) failed++;
};

async function fresh() {
  const pg = new PGlite();
  await migrate((sql) => pg.exec(sql));
  await pg.exec("insert into app_user (provider, subject, display_name) values ('t','1','alice'), ('t','2','bob')");
  const replay = (uid, sha, over = {}) => pg.query(
    "insert into user_replay (user_id, sha256, storage_key, size, c2_at_upload, c3_at_upload, timeline_key, source_deleted_at) values ($1,$2,$3,1,false,false,$4,$5)",
    [uid, sha, `users/${uid}/${sha}.SC2Replay`, `analysis/${uid}/${sha}.timeline.json.gz`, over.sourceGone ? new Date().toISOString() : null]);
  await replay(1, "a1"); await replay(1, "a2", { sourceGone: true }); await replay(2, "b1");
  await pg.exec("insert into consent (user_id, policy_version) values (1,'v'), (2,'v')");
  await pg.exec("insert into device_token (user_id, token_hash) values (1,'t1')");
  await pg.exec("insert into feedback (kind, title, body, user_id) values ('bug','t','b',1), ('bug','t2','b2',2)");
  await pg.exec("insert into feedback (kind, reason, body, page, user_agent, user_id, replay_id) values ('replay','privacy','my note','/x','Chrome 1',1, (select id from user_replay where sha256='b1'))");
  await pg.exec("insert into feedback_file (feedback_id, n, storage_key, mime, size) values ((select id from feedback where title='t'), 0, 'feedback/1/0.png', 'image/png', 1), ((select id from feedback where title='t2'), 0, 'feedback/2/0.png', 'image/png', 1)");
  return pg;
}
const queue = async (pg) => (await pg.query("select storage_key from storage_delete_queue order by 1")).rows.map((r) => r.storage_key);
const count = async (pg, sql) => (await pg.query(sql)).rows[0].n;

{
  const pg = await fresh();
  const r = (await pg.query(DELETE_ACCOUNT_SQL, [1])).rows[0];
  const q = await queue(pg);
  check("account deletion: the account row and everything cascading from it are gone",
    r.deleted === 1 && (await count(pg, "select count(*)::int n from app_user where id = 1")) === 0 && (await count(pg, "select count(*)::int n from user_replay where user_id = 1")) === 0 &&
    (await count(pg, "select count(*)::int n from consent where user_id = 1")) === 0 && (await count(pg, "select count(*)::int n from device_token where user_id = 1")) === 0);
  check("every file of the account is queued: the original still kept, both timelines, the screenshot (not the original already deleted)",
    JSON.stringify(q) === JSON.stringify(["analysis/1/a1.timeline.json.gz", "analysis/1/a2.timeline.json.gz", "feedback/1/0.png", "users/1/a1.SC2Replay"]), JSON.stringify(q));
  check("another account is untouched and its files are not queued",
    (await count(pg, "select count(*)::int n from user_replay where user_id = 2")) === 1 && (await count(pg, "select count(*)::int n from feedback where title = 't2'")) === 1 && !q.some((k) => k.includes("/2/") || k.includes("b1")));
  const kept = (await pg.query("select reason, title, body, page, user_agent, user_id from feedback where kind = 'replay'")).rows[0];
  check("a report about someone's replay stays, without the user's text, page, browser or account link",
    kept.reason === "privacy" && kept.title === null && kept.body === null && kept.page === null && kept.user_agent === null && kept.user_id === null, JSON.stringify(kept));
  check("the user's own messages are deleted", (await count(pg, "select count(*)::int n from feedback where title = 't'")) === 0);
  check("a second run for the same account does nothing and queues nothing new", (await pg.query(DELETE_ACCOUNT_SQL, [1])).rows[0].deleted === 0 && (await queue(pg)).length === 4);
}
{
  const pg = await fresh();
  await pg.exec("create function boom() returns trigger language plpgsql as $$ begin raise exception 'database error injected'; end $$; create trigger boom before delete on app_user for each row execute function boom();");
  let threw = false;
  try { await pg.query(DELETE_ACCOUNT_SQL, [1]); } catch { threw = true; }
  check("when the delete fails half way nothing changes: rows stay, the report keeps its text, no file name is queued early",
    threw && (await count(pg, "select count(*)::int n from app_user where id = 1")) === 1 && (await count(pg, "select count(*)::int n from user_replay where user_id = 1")) === 2 &&
    (await queue(pg)).length === 0 && (await pg.query("select body from feedback where kind='replay'")).rows[0].body === "my note");
}
{
  const pg = await fresh();
  const r = (await pg.query(DELETE_ALL_UPLOADS_SQL, [1])).rows[0];
  check("delete all replays keeps the account and queues the files", r.deleted === 2 && (await count(pg, "select count(*)::int n from app_user where id = 1")) === 1 && (await queue(pg)).length === 3);
  const b1 = (await pg.query("select id from user_replay where sha256='b1'")).rows[0].id;
  const notOwner = (await pg.query(DELETE_UPLOAD_SQL, [b1, 1])).rows[0];
  check("one replay is deleted only by its owner", notOwner.deleted === 0 && (await count(pg, "select count(*)::int n from user_replay where sha256 = 'b1'")) === 1);
  const owner = (await pg.query(DELETE_UPLOAD_SQL, [b1, 2])).rows[0];
  check("the owner's delete removes the row and queues its two files", owner.deleted === 1 && owner.files_queued === 2);
}
{
  const pg = await fresh();
  const id = (await pg.query("select id from user_replay where sha256='a1'")).rows[0].id;
  const r = (await pg.query(REMOVE_REPLAY_SQL, [id])).rows[0];
  check("an operator takedown removes the replay and queues its files", r.deleted === 1 && r.files_queued === 2);
  const f = (await pg.query("select id from feedback where title = 't'")).rows[0].id;
  const d = (await pg.query(DELETE_FEEDBACK_SQL, [[f]])).rows[0];
  check("deleting a message queues its screenshot", d.deleted === 1 && (await queue(pg)).includes("feedback/1/0.png"));
}
console.log(failed ? `\n${failed} check(s) FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
