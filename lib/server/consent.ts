import "server-only";
import { getDb } from "./db";
import { POLICY_VERSION } from "./auth";
import { APPLY_CONSENT_VERSION_SQL, SET_CONSENT_SQL } from "@/lib/consentSql";
import { flushLedgerOutbox } from "./ledger";
import { activeChangelog, consentsAffectedSince, consentVersion, formatPending, parsePending, policyVersion, type ConsentKey } from "@/lib/policyVersions";

const KEYS: ConsentKey[] = ["c1", "c2", "c3"];
import { bumpStats } from "./statsVersion";

/**
 * C1 analysis upload, C2 public viewing + aggregate stats, C3 AI training (docs/BPM_Backend_Plan.md section 2).
 * Independent switches. Nothing is on by default: a user with no row has consented to nothing.
 *
 * Each consent is tied to the consent text it was given on (`consent_version`). When the policy changes in a way that asks a
 * consent again (lib/policyVersions.ts), the next read of the user's consent switches the named consents off, remembers them in
 * `reconsentPending` and logs it like a withdrawal; the user turns them on again, or leaves them off, and either answer clears the
 * pending mark. Reading the consent is how every code path (uploads, pages, the launcher) learns the current state, so none of
 * them can act on a consent the changed text no longer covers.
 */
export interface Consent {
  c1: boolean;
  c2: boolean;
  c3: boolean;
  policyVersion: string | null;
  consentVersion: string | null;
  /** Consents that were switched off because their text changed and have not been answered yet. */
  reconsentPending: ConsentKey[];
}

type Row = { c1: boolean; c2: boolean; c3: boolean; policy_version: string; consent_version: string | null; reconsent_pending: string };
const NONE: Consent = { c1: false, c2: false, c3: false, policyVersion: null, consentVersion: null, reconsentPending: [] };
const toConsent = (r: Row): Consent => ({ c1: r.c1, c2: r.c2, c3: r.c3, policyVersion: r.policy_version, consentVersion: r.consent_version, reconsentPending: parsePending(r.reconsent_pending) });

async function readRow(userId: number): Promise<Row | undefined> {
  const db = await getDb();
  const [r] = await db.query<Row>("select c1, c2, c3, policy_version, consent_version, reconsent_pending from consent where user_id = $1", [userId]);
  return r;
}

/**
 * Switch off the consents the changelog asks again since this row's consent version. It is ONE statement: the consent row, the
 * log line and the replays' public/training flags change together or not at all. (Two statements left a gap in which the
 * consent said off while the replays stayed public, and the version already looked current so nothing came back to fix it.)
 * Only one of two simultaneous readers wins the update.
 */
async function applyConsentVersion(userId: number, r: Row): Promise<Row> {
  const log = activeChangelog();
  const affected = consentsAffectedSince(log, r.consent_version);
  const suspend = affected.filter((k) => r[k]);
  const pending = [...new Set([...parsePending(r.reconsent_pending), ...suspend])];
  const db = await getDb();
  const [won] = await db.query<{ c1: boolean; c2: boolean; c3: boolean }>(
    APPLY_CONSENT_VERSION_SQL,
    [userId, suspend.includes("c1"), suspend.includes("c2"), suspend.includes("c3"), formatPending(pending), consentVersion(log), r.consent_version, policyVersion(log), suspend.length > 0],
  );
  if (!won) return (await readRow(userId)) ?? r;                      // another request applied it first
  if (suspend.length) bumpStats();
  return { ...r, ...won, reconsent_pending: formatPending(pending), consent_version: consentVersion(log) };
}

export async function getConsent(userId: number): Promise<Consent> {
  let r = await readRow(userId);
  if (!r) return NONE;
  if (r.consent_version !== consentVersion()) r = await applyConsentVersion(userId, r);
  return toConsent(r);
}

export async function setConsent(userId: number, next: { c1: boolean; c2: boolean; c3: boolean }, source: string): Promise<Consent> {
  const db = await getDb();
  const prev = await getConsent(userId);                              // also applies a pending policy change first
  const answered = KEYS.filter((k) => prev[k] !== next[k]);           // acting on a pending consent (on or off) answers it
  const pending = prev.reconsentPending.filter((k) => !answered.includes(k));
  const cv = consentVersion();
  // One statement: the consent, its log line and the withdrawal's effect on every stored replay happen together. A withdrawal
  // reaches every stored replay at once; a grant is NOT applied to replays that already exist (turning C2 back on must not publish
  // a replay the owner kept private; the owner opens older replays one by one, see setUploadSettings).
  await db.query(
    SET_CONSENT_SQL,
    [userId, next.c1, next.c2, next.c3, POLICY_VERSION, cv, formatPending(pending), source, KEYS.filter((k) => prev[k] && !next[k]).join(",")],
  );
  void flushLedgerOutbox().catch(() => undefined);      // copy a withdrawal to the ledger outside the database (retried by the retention run)
  bumpStats();
  return { ...next, policyVersion: POLICY_VERSION, consentVersion: cv, reconsentPending: pending };
}

/** The user keeps a suspended consent off on purpose: the pending mark goes, the choice is recorded. */
export async function keepPendingOff(userId: number): Promise<void> {
  const db = await getDb();
  await db.query("update consent set reconsent_pending = '' where user_id = $1", [userId]);
}

export function parseConsentBody(body: unknown): { c1: boolean; c2: boolean; c3: boolean } | null {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.c1 !== "boolean" || typeof b.c2 !== "boolean" || typeof b.c3 !== "boolean") return null;
  return { c1: b.c1, c2: b.c2, c3: b.c3 };
}
