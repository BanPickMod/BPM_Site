import "server-only";
import { getDb } from "./db";
import { getObject, putObject } from "./storage";
import { masterSecret } from "./auth";
import { ledgerObjectKey, encodeLedger, toLedgerEntries, type LedgerKind, type OutboxRow } from "@/lib/ledger";

/**
 * Copies recorded deletions and withdrawals from the database to the ledger outside it (lib/ledger.ts explains why). The rows
 * are written by the deletion statements themselves; this runs right after them and again in the retention run, so a failed
 * copy is retried. A row leaves ledger_outbox only after the ledger file is stored.
 */
export async function flushLedgerOutbox(): Promise<number> {
  const db = await getDb();
  const rows = await db.query<OutboxRow & { id: number }>("select id, kind, provider, subject, sha256, detail, created_at from ledger_outbox order by id limit 500");
  if (!rows.length) return 0;
  const key = ledgerObjectKey(new Date());
  await putObject(key, new TextEncoder().encode(encodeLedger(toLedgerEntries(masterSecret(), rows))));
  const stored = await getObject(key);                       // read it back: the rows go only once the file is really there
  if (!stored) throw new Error("ledger file was not stored");
  await stored.body.cancel().catch(() => undefined);
  await db.query("delete from ledger_outbox where id = any($1::int[])", [rows.map((r) => r.id)]);
  return rows.length;
}

export async function outboxPending(): Promise<{ pending: number; oldestMinutes: number | null }> {
  const db = await getDb();
  const [r] = await db.query<{ n: number; oldest: number | null }>("select count(*)::int as n, (extract(epoch from now() - min(created_at)) / 60)::float as oldest from ledger_outbox");
  return { pending: r?.n ?? 0, oldestMinutes: r?.oldest == null ? null : Math.round(r.oldest) };
}

export type { LedgerKind };
