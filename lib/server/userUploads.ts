import { scrubAnalysis } from "@/lib/replay/handles";
import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "./db";
import { HttpError } from "./http";
import { getConsent } from "./consent";
import { getObject, putObject } from "./storage";
import { deleteRowsAndFiles, enqueueDelete } from "./storageQueue";
import { DELETE_UPLOAD_SQL } from "@/lib/deleteSql";
import { looksLikeReplay, MAX_REPLAY_BYTES } from "./games";
import { bumpStats } from "./statsVersion";

export const DAILY_UPLOAD_LIMIT = 200;

export interface UploadRow {
  id: number;
  status: string;
  reject_code: string | null;
  size: number;
  uploaded_at: string;
}

/**
 * Store one player-uploaded replay. Idempotent per (user, sha256): re-sending the same file returns the existing row.
 * The server does not decide "is this a BPM game" here; the analysis worker does and sets status REJECTED/NOT_BPM.
 */
export async function acceptUpload(userId: number, data: Uint8Array, claimedSha: string | null, clientVersion: string | null, visibility: "default" | "private" = "default") {
  if (data.length > MAX_REPLAY_BYTES) throw new HttpError(413, "replay too large", "TOO_LARGE");
  if (!looksLikeReplay(data)) throw new HttpError(422, "not an SC2 replay", "NOT_REPLAY");

  const consent = await getConsent(userId);
  if (!consent.c1) throw new HttpError(403, "upload consent (C1) is not granted", "NO_CONSENT");

  const sha = createHash("sha256").update(data).digest("hex");
  if (claimedSha && claimedSha.toLowerCase() !== sha) throw new HttpError(422, "sha256 mismatch", "HASH_MISMATCH");

  const db = await getDb();
  const [existing] = await db.query<UploadRow>(
    "select id, status, reject_code, size, uploaded_at from user_replay where user_id = $1 and sha256 = $2",
    [userId, sha],
  );
  if (existing) return { row: existing, created: false };

  const [{ n }] = await db.query<{ n: number }>(
    "select count(*)::int as n from user_replay where user_id = $1 and uploaded_at > now() - interval '1 day'",
    [userId],
  );
  if (n >= DAILY_UPLOAD_LIMIT) throw new HttpError(429, "daily upload limit reached", "QUOTA");

  const key = `users/${userId}/${sha}.SC2Replay`;
  await putObject(key, data);
  let row: UploadRow;
  try {
    [row] = await db.query<UploadRow>(
      `insert into user_replay (user_id, sha256, storage_key, size, client_version, c2_at_upload, c3_at_upload, visibility_override, training_excluded)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id, status, reject_code, size, uploaded_at`,
      [userId, sha, key, data.length, clientVersion, consent.c2, consent.c3, visibility, visibility === "private"],
    );
  } catch (e) {
    // The row could not be stored (for example the account was deleted a moment ago): the file must not stay behind unnoticed.
    // But the same file uploaded twice at once shares one name, and the other request's row may point to it: then it stays
    // (the queue also skips any name a live row points to).
    const [live] = await db.query<{ id: number }>("select id from user_replay where storage_key = $1", [key]).catch(() => []);
    if (!live) await enqueueDelete([key]).catch(() => undefined);
    throw e;
  }
  // This name may still be queued from an earlier delete of the same file: it is in use again, so cancel that delete.
  await db.query("delete from storage_delete_queue where storage_key = $1", [key]).catch(() => undefined);
  return { row, created: true };
}

export async function getUpload(userId: number, id: number): Promise<UploadRow | null> {
  const db = await getDb();
  const [row] = await db.query<UploadRow>(
    "select id, status, reject_code, size, uploaded_at from user_replay where id = $1 and user_id = $2",
    [id, userId],
  );
  return row ?? null;
}

export async function listUploads(userId: number, limit = 50): Promise<UploadRow[]> {
  const db = await getDb();
  return db.query<UploadRow>(
    "select id, status, reject_code, size, uploaded_at from user_replay where user_id = $1 order by uploaded_at desc, id desc limit $2",
    [userId, limit],
  );
}

export interface UploadDetail extends UploadRow {
  analysis: Record<string, unknown> | null;
  analyzer_version: string | null;
  analyzed_at: string | null;
  timeline_size: number | null;
  timeline_schema: number | null;
  hidden_at: string | null;
  eval_status: string | null;
  evaluation: unknown;
  c2_at_upload: boolean;
  c3_at_upload: boolean;
  visibility_override: "default" | "private";
  training_excluded: boolean;
  /** When the original replay file was deleted from the server (null while it is still kept for analysis/evaluation). */
  source_deleted_at: string | null;
}

/** One upload with its analysis, for its owner only. */
export async function getUploadDetail(userId: number, id: number): Promise<UploadDetail | null> {
  const db = await getDb();
  const [row] = await db.query<UploadDetail>(
    `select id, status, reject_code, size, uploaded_at, analysis, analyzer_version, analyzed_at, timeline_size, timeline_schema, hidden_at, eval_status, evaluation,
            c2_at_upload, c3_at_upload, visibility_override, training_excluded, source_deleted_at
     from user_replay where id = $1 and user_id = $2`,
    [id, userId],
  );
  return row ? { ...row, analysis: scrubAnalysis(row.analysis) } : null;      // rows stored before A3 may still hold a raw handle
}

/** Owner-only timeline object. The key itself is never exposed. */
export async function getUploadTimeline(userId: number, id: number) {
  const db = await getDb();
  const [row] = await db.query<{ timeline_key: string | null }>(
    "select timeline_key from user_replay where id = $1 and user_id = $2 and status = 'READY'",
    [id, userId],
  );
  return row?.timeline_key ? getObject(row.timeline_key) : null;
}

export interface UploadListItem extends UploadRow {
  analysis: Record<string, unknown> | null;
  c2_at_upload: boolean;
  visibility_override: "default" | "private";
}

/** The signed-in user's uploads, newest first, with the stored analysis so the list can show a summary. */
export async function listUploadsWithAnalysis(userId: number, limit = 100): Promise<UploadListItem[]> {
  const db = await getDb();
  const rows = await db.query<UploadListItem>(
    `select id, status, reject_code, size, uploaded_at, analysis, c2_at_upload, visibility_override
     from user_replay where user_id = $1 order by uploaded_at desc, id desc limit $2`,
    [userId, limit],
  );
  return rows.map((r) => ({ ...r, analysis: scrubAnalysis(r.analysis) }));
}

/** Delete one of the user's replays: the row and its files' names in one statement, then the files. Returns false if it is not theirs. */
export async function deleteUpload(userId: number, id: number): Promise<boolean> {
  const { deleted } = await deleteRowsAndFiles(DELETE_UPLOAD_SQL, [id, userId]);
  if (deleted) bumpStats();
  return deleted > 0;
}

export interface UploadSettings {
  /** true = show on the public pages and count in statistics (needs C2 on); false = keep private. */
  public?: boolean;
  /** true = never use this replay for AI training. */
  trainingExcluded?: boolean;
}

/**
 * Per-replay sharing choices. The stricter side always wins: private beats the account's C2, and an exclusion beats C3.
 * Making a replay public is the only way an older replay is opened after C2 was withdrawn and granted again, and it
 * needs C2 to be on now. Returns false if the replay is not the user's.
 */
export async function setUploadSettings(userId: number, id: number, s: UploadSettings): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.query<{ id: number }>("select id from user_replay where id = $1 and user_id = $2", [id, userId]);
  if (!row) return false;
  if (s.public === true) {
    if (!(await getConsent(userId)).c2) throw new HttpError(409, "public sharing (C2) is off", "NO_CONSENT");
    await db.query("update user_replay set c2_at_upload = true, visibility_override = 'default' where id = $1 and user_id = $2", [id, userId]);
  } else if (s.public === false) {
    await db.query("update user_replay set visibility_override = 'private' where id = $1 and user_id = $2", [id, userId]);
  }
  if (typeof s.trainingExcluded === "boolean") {
    await db.query("update user_replay set training_excluded = $3 where id = $1 and user_id = $2", [id, userId, s.trainingExcluded]);
  }
  bumpStats();
  return true;
}

/**
 * "Publish my earlier replays": after C2 was withdrawn and granted again, opens every stored replay that is not public and
 * was not marked private. Replays the owner marked private stay private. Returns how many were opened.
 */
export async function publishStoredUploads(userId: number): Promise<number> {
  if (!(await getConsent(userId)).c2) throw new HttpError(409, "public sharing (C2) is off", "NO_CONSENT");
  const db = await getDb();
  const rows = await db.query<{ id: number }>(
    "update user_replay set c2_at_upload = true where user_id = $1 and not c2_at_upload and visibility_override = 'default' returning id",
    [userId],
  );
  if (rows.length) bumpStats();
  return rows.length;
}
