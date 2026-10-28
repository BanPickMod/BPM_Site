import "server-only";
import { getDb } from "./db";
import { getObject, listObjects } from "./storage";
import { masterSecret } from "./auth";
import { getConsent, setConsent } from "./consent";
import { deleteRowsAndFiles } from "./storageQueue";
import { DELETE_ACCOUNT_SQL, DELETE_UPLOAD_SQL } from "@/lib/deleteSql";
import { entriesSince, ledgerObjectTime, parseLedger, whoKey, type LedgerEntry } from "@/lib/ledger";

/**
 * After the database was restored from a backup: do again what happened after the backup was taken (docs/Backup_and_Restore.md).
 * Reads the deletion ledger from object storage, matches each entry to an account of the restored database by its keyed hash, and
 * repeats the deletion or withdrawal. An entry whose account is not in the restored database is already done (or the account
 * was created after the backup) and is counted as "not found". Safe to run twice: a second run finds nothing left to do.
 */
export interface RestoreReport {
  dryRun: boolean;
  since: string;
  ledgerFiles: number;
  entries: number;
  accountsToDelete: number;
  replaysToDelete: number;
  consentsToWithdraw: number;
  notFound: number;
  done: { accounts: number; replays: number; consents: number };
}

export async function reapplyDeletions(since: Date, dryRun: boolean): Promise<RestoreReport> {
  // A ledger file is named by the time it was written, a little after the act it holds: look a day further back.
  const margin = since.getTime() - 86400_000;
  const keys = (await listObjects("ledger/")).filter((k) => {
    const t = ledgerObjectTime(k);
    return t !== null && t.getTime() >= margin;
  });
  let all: LedgerEntry[] = [];
  for (const k of keys) {
    const obj = await getObject(k);
    if (!obj) continue;
    all = all.concat(parseLedger(await new Response(obj.body).text()));
  }
  const entries = entriesSince(all, since);

  const db = await getDb();
  const secret = masterSecret();
  const users = await db.query<{ id: number; provider: string; subject: string }>("select id, provider, subject from app_user");
  const byWho = new Map(users.map((u) => [whoKey(secret, u.provider, u.subject), u.id]));

  const rep: RestoreReport = {
    dryRun, since: since.toISOString(), ledgerFiles: keys.length, entries: entries.length,
    accountsToDelete: 0, replaysToDelete: 0, consentsToWithdraw: 0, notFound: 0, done: { accounts: 0, replays: 0, consents: 0 },
  };
  for (const e of entries) {
    const uid = byWho.get(e.who);
    if (uid === undefined) { rep.notFound++; continue; }
    if (e.kind === "account") {
      rep.accountsToDelete++;
      if (!dryRun && (await deleteRowsAndFiles(DELETE_ACCOUNT_SQL, [uid])).deleted) { rep.done.accounts++; byWho.delete(e.who); }
    } else if (e.kind === "replay") {
      const [r] = await db.query<{ id: number }>("select id from user_replay where user_id = $1 and sha256 = $2", [uid, e.sha256]);
      if (!r) { rep.notFound++; continue; }
      rep.replaysToDelete++;
      if (!dryRun && (await deleteRowsAndFiles(DELETE_UPLOAD_SQL, [r.id, uid])).deleted) rep.done.replays++;
    } else {
      const off = new Set((e.withdrawn ?? "").split(","));
      const c = await getConsent(uid);
      if (!(off.has("c1") && c.c1) && !(off.has("c2") && c.c2) && !(off.has("c3") && c.c3)) { rep.notFound++; continue; }
      rep.consentsToWithdraw++;
      if (!dryRun) {
        await setConsent(uid, { c1: c.c1 && !off.has("c1"), c2: c.c2 && !off.has("c2"), c3: c.c3 && !off.has("c3") }, "restore-reapply");
        rep.done.consents++;
      }
    }
  }
  return rep;
}
