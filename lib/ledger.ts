/**
 * The deletion ledger (docs/Privacy_Compliance_Additional_Plan.md, A9).
 *
 * A database backup is a copy of the data as it was. If the database is restored from one, everything deleted or withdrawn since
 * comes back: a deleted account, a replay a user removed, a consent turned off. So each such act is also written, as it happens,
 * to a small file OUTSIDE the database (in object storage, which a database restore does not touch). After a restore the operator
 * replays those files against the restored database (lib/server/restore.ts) and the acts are done again.
 *
 * A ledger file holds no names and no handles: a person is identified by a keyed hash of their Battle.net account identifier
 * (purpose "ledger", lib/keys.ts), a replay by its file hash. The restored database still has the accounts, so the hash of each
 * account is computed again and matched. Ledger files are kept longer than the backups they have to cover (LEDGER_RETENTION_DAYS).
 */
import { createHmac, randomBytes } from "node:crypto";
import { deriveKey } from "./keys.ts";

export type LedgerKind = "account" | "replay" | "consent-withdrawal";

export interface LedgerEntry {
  v: 1;
  kind: LedgerKind;
  /** ISO time of the act. */
  at: string;
  /** Keyed hash of provider and subject of the account concerned. */
  who: string;
  /** replay: the file hash of the replay. */
  sha256?: string;
  /** consent-withdrawal: the consents that were switched off, e.g. "c2,c3". */
  withdrawn?: string;
}

export interface OutboxRow {
  kind: LedgerKind;
  provider: string;
  subject: string;
  sha256: string | null;
  detail: string | null;
  created_at: string | Date;
}

/** The account's stable pseudonym in the ledger. Changing SESSION_SECRET changes it, which is why restore needs the same secret. */
export function whoKey(master: string, provider: string, subject: string): string {
  return createHmac("sha256", deriveKey(master, "ledger")).update(`account:${provider}:${subject}`).digest("hex").slice(0, 40);
}

export function toLedgerEntries(master: string, rows: OutboxRow[]): LedgerEntry[] {
  return rows.map((r) => {
    const e: LedgerEntry = { v: 1, kind: r.kind, at: new Date(r.created_at).toISOString(), who: whoKey(master, r.provider, r.subject) };
    if (r.kind === "replay" && r.sha256) e.sha256 = r.sha256;
    if (r.kind === "consent-withdrawal" && r.detail) e.withdrawn = r.detail;
    return e;
  });
}

/** One object per flush: `ledger/<UTC time>-<random>.json`. The time is in the name so old files can be found without opening them. */
export function ledgerObjectKey(now: Date, rand: string = randomBytes(4).toString("hex")): string {
  return `ledger/${now.toISOString().replace(/[:.]/g, "-")}-${rand}.json`;
}

export function ledgerObjectTime(key: string): Date | null {
  const m = key.match(/^ledger\/(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z-[0-9a-f]+\.json$/);
  return m ? new Date(`${m[1]}:${m[2]}:${m[3]}.${m[4]}Z`) : null;
}

export function encodeLedger(entries: LedgerEntry[]): string {
  return JSON.stringify({ v: 1, entries });
}

/** Entries from one ledger file; anything malformed is skipped, never trusted. */
export function parseLedger(text: string): LedgerEntry[] {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    return [];
  }
  const list = (j as { entries?: unknown })?.entries;
  if (!Array.isArray(list)) return [];
  const out: LedgerEntry[] = [];
  for (const e of list as Record<string, unknown>[]) {
    if (!e || e.v !== 1 || typeof e.who !== "string" || !/^[0-9a-f]{40}$/.test(e.who) || typeof e.at !== "string" || Number.isNaN(Date.parse(e.at))) continue;
    if (e.kind === "account") out.push({ v: 1, kind: "account", at: e.at, who: e.who });
    else if (e.kind === "replay" && typeof e.sha256 === "string" && /^[0-9a-f]{64}$/.test(e.sha256)) out.push({ v: 1, kind: "replay", at: e.at, who: e.who, sha256: e.sha256 });
    else if (e.kind === "consent-withdrawal" && typeof e.withdrawn === "string" && /^(c[123])(,c[123])*$/.test(e.withdrawn)) out.push({ v: 1, kind: "consent-withdrawal", at: e.at, who: e.who, withdrawn: e.withdrawn });
  }
  return out;
}

/** What happened after the backup's time, oldest first. A restore replays exactly these. */
export function entriesSince(entries: LedgerEntry[], since: Date): LedgerEntry[] {
  return entries.filter((e) => Date.parse(e.at) >= since.getTime()).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
