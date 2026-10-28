import { scrubAnalysis } from "@/lib/replay/handles";
import { camel, EXPORT_COLUMNS, NOT_EXPORTED, NOT_INCLUDED_OBJECTS } from "@/lib/exportSpec";
import "server-only";
import { getDb } from "./db";
import { HttpError } from "./http";
import { deleteRowsAndFiles } from "./storageQueue";
import { DELETE_ACCOUNT_SQL, DELETE_ALL_UPLOADS_SQL } from "@/lib/deleteSql";
import { bumpStats } from "./statsVersion";

export interface DeviceRow {
  id: number;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
}

/** Launchers linked to the account (active tokens only; the token itself is stored as a hash and cannot be shown). */
export async function listDevices(userId: number): Promise<DeviceRow[]> {
  const db = await getDb();
  return db.query<DeviceRow>(
    "select id, label, created_at, last_used_at from device_token where user_id = $1 and revoked_at is null order by created_at desc",
    [userId],
  );
}

export async function revokeDevice(userId: number, id: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db.query("update device_token set revoked_at = now() where id = $1 and user_id = $2 and revoked_at is null returning id", [id, userId]);
  return rows.length > 0;
}

export async function consentHistory(userId: number, limit = 20) {
  const db = await getDb();
  return db.query<{ c1: boolean; c2: boolean; c3: boolean; source: string; policy_version: string; at: string }>(
    "select c1, c2, c3, source, policy_version, at from consent_log where user_id = $1 order by at desc, id desc limit $2",
    [userId, limit],
  );
}

/** Delete every replay of the user (files, timelines, analyses) but keep the account. Returns how many were removed. */
export async function deleteAllUploads(userId: number): Promise<number> {
  const { deleted } = await deleteRowsAndFiles(DELETE_ALL_UPLOADS_SQL, [userId]);
  bumpStats();
  return deleted;
}

/**
 * Withdrawal, as one database statement (lib/deleteSql.ts): the replays and their files' names, the messages and screenshots the
 * user sent, every launcher token, the consent records and the account row itself go together or not at all. Reports about someone
 * else's replay stay because the operator may still need them; they keep the reason and the outcome, but not the user's text,
 * page or browser, and no link to the account. The stored files are then deleted
 * from the queue and retried until the storage confirms. Returns how many files were still waiting after the first try.
 */
export async function deleteAccount(userId: number): Promise<{ filesPending: number }> {
  const { deleted } = await deleteRowsAndFiles(DELETE_ACCOUNT_SQL, [userId]);
  if (!deleted) throw new HttpError(404, "not found");
  bumpStats();
  const db = await getDb();
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from storage_delete_queue");
  return { filesPending: n };
}

/** Rows of one table for one account, with only the columns the export promises (lib/exportSpec.ts), in camelCase. */
async function exportRows(table: keyof typeof EXPORT_COLUMNS, where: string, params: unknown[], order: string): Promise<Record<string, unknown>[]> {
  const db = await getDb();
  const cols = EXPORT_COLUMNS[table];
  const rows = await db.query<Record<string, unknown>>(`select ${cols.join(", ")} from ${table} where ${where} order by ${order}`, params);
  return rows.map((r) => Object.fromEntries(cols.map((k) => [camel(k), k === "analysis" ? scrubAnalysis(r[k]) : r[k]])));
}

/**
 * Everything we hold about the user in one JSON document. The columns come from lib/exportSpec.ts, which an automatic check
 * keeps equal to the data inventory; what is left out is listed under `notIncluded` with the reason.
 */
export async function exportAccount(userId: number) {
  const [account] = await exportRows("app_user", "id = $1 and deleted_at is null", [userId], "id");
  if (!account) throw new HttpError(404, "not found");
  const [consent] = await exportRows("consent", "user_id = $1", [userId], "user_id");
  return {
    exportedAt: new Date().toISOString(),
    account,
    consent: consent ?? null,
    consentHistory: await exportRows("consent_log", "user_id = $1", [userId], "id desc"),
    policyAcknowledgements: await exportRows("policy_ack", "user_id = $1", [userId], "id"),
    launchers: await exportRows("device_token", "user_id = $1", [userId], "id"),
    replays: await exportRows("user_replay", "user_id = $1", [userId], "id"),
    messages: await exportRows("feedback", "user_id = $1", [userId], "id"),
    notIncluded: [...NOT_INCLUDED_OBJECTS, ...Object.entries(NOT_EXPORTED).map(([item, reason]) => ({ item, reason }))],
  };
}
