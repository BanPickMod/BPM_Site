import { deleteRowsAndFiles } from "./storageQueue";
import { DELETE_FEEDBACK_SQL } from "@/lib/deleteSql";
import { logWarn } from "./log";
import "server-only";
import { getDb } from "./db";
import { HttpError } from "./http";
import { getObject, putObject } from "./storage";
import { stripMetadata } from "@/lib/replay/imageClean";
import { cleanPage, coarseUserAgent, operatorNotice } from "@/lib/feedbackClean";
import { dueAt, REQUEST_TYPES } from "@/lib/privacyRequest";
import { envDays } from "@/lib/envDays";
import type { RateKey } from "@/lib/keys";
import { REPORT_AND_HIDE_SQL } from "@/lib/reportSql";

/**
 * The feedback inbox: bug reports, ideas, and reports about a public replay (kind "replay") all land here, and the operator
 * works through one list (/[lang]/admin/feedback). Screenshots are accepted only from signed-in users (spam), checked by their
 * first bytes, stored privately and only ever read back by an operator.
 */
export const KINDS = ["bug", "idea", "replay", "privacy_request"] as const;
export type Kind = (typeof KINDS)[number];
export const STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const;

export const MAX_FILES = 3;
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const MAX_REQUEST_BYTES = MAX_FILES * MAX_FILE_BYTES + 256 * 1024;
const PER_HOUR: Record<Kind, number> = { bug: 10, idea: 10, replay: 5, privacy_request: 5 };

/** Only raster images, decided by content, never by the name or type the browser claims. SVG is refused on purpose (it can carry script). */
export function sniffImage(d: Uint8Array): { mime: string; ext: string } | null {
  if (d.length > 8 && d[0] === 0x89 && d[1] === 0x50 && d[2] === 0x4e && d[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (d.length > 4 && d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (d.length > 12 && d[0] === 0x52 && d[1] === 0x49 && d[2] === 0x46 && d[3] === 0x46 && d[8] === 0x57 && d[9] === 0x45 && d[10] === 0x42 && d[11] === 0x50) return { mime: "image/webp", ext: "webp" };
  return null;
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export interface NewFeedback {
  kind: Kind;
  replayId?: number;
  reason?: string;
  title?: unknown;
  body?: unknown;
  page?: unknown;
  userAgent?: string | null;
  userId?: number | null;
  /** Hourly keyed hash of the sender (lib/keys.ts); counted in report_rate, never stored with the message. */
  /** The sender's hourly key for the abuse limit. Operators recording something on someone's behalf pass none. */
  rate?: RateKey;
  files?: File[];
  /** A replay report that also takes the replay off the public pages, in the same statement as the report (lib/reportSql.ts). */
  hideReplay?: boolean;
  /** privacy_request only: where it came from and where the answer may go (cleared when the request is closed). */
  channel?: "web" | "email";
  contact?: string | null;
}

export async function createFeedback(f: NewFeedback): Promise<number> {
  const title = clip(f.title, 120), body = clip(f.body, 4000);
  const isRequest = f.kind === "privacy_request";
  if (isRequest) {
    if (!f.reason || !(REQUEST_TYPES as readonly string[]).includes(f.reason)) throw new HttpError(400, "unknown request type", "BAD_TYPE");
    if (body.length < 5) throw new HttpError(400, "details (5+ characters) are required", "TOO_SHORT");
    if (f.files?.length) throw new HttpError(400, "attachments are not accepted for privacy requests (do not send identity documents here)", "NO_FILES");
  } else if (f.kind !== "replay" && (title.length < 3 || body.length < 5)) throw new HttpError(400, "title (3+ characters) and details (5+ characters) are required", "TOO_SHORT");
  const files = f.files ?? [];
  if (files.length > MAX_FILES) throw new HttpError(400, `at most ${MAX_FILES} screenshots`, "TOO_MANY_FILES");
  if (files.length && !f.userId) throw new HttpError(401, "sign in to attach screenshots", "NO_SESSION");
  const stored: { data: Uint8Array; mime: string; ext: string }[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) throw new HttpError(413, "screenshot too large (3 MB at most)", "FILE_TOO_LARGE");
    const data = new Uint8Array(await file.arrayBuffer());
    const kind = sniffImage(data);
    if (!kind) throw new HttpError(422, "screenshots must be PNG, JPEG or WebP images", "BAD_IMAGE");
    const clean = stripMetadata(data, kind.ext as "png" | "jpg" | "webp");   // no EXIF/GPS, text or timestamps survive on the server
    if (!clean) throw new HttpError(422, "the image file is damaged", "BAD_IMAGE");
    stored.push({ data: clean, ...kind });
  }

  const db = await getDb();
  if (f.rate) {
    await db.query("delete from report_rate where expires_at < now()");     // old hours' counters are gone as soon as they are useless
    const [{ n }] = await db.query<{ n: number }>(
      `insert into report_rate (key, kind, n, expires_at) values ($1, $2, 1, $3)
       on conflict (key, kind) do update set n = report_rate.n + 1 returning n`,
      [f.rate.key, f.kind, f.rate.expiresAt.toISOString()],
    );
    if (n > PER_HOUR[f.kind]) throw new HttpError(429, "too many submissions, try again later", "RATE_LIMIT");
  }

  const page = cleanPage(f.page);
  const userAgent = coarseUserAgent(f.userAgent);
  const values = [f.kind, f.replayId ?? null, f.reason ?? null, title || null, body || null, page || null, userAgent, f.userId ?? null];
  let row: { id: number };
  if (f.hideReplay && f.kind === "replay" && f.replayId && f.reason) {
    const [r] = await db.query<{ id: number | null }>(REPORT_AND_HIDE_SQL, values);
    if (!r?.id) throw new HttpError(404, "no such public replay");        // it stopped being public while the report was on its way
    row = { id: r.id };
  } else {
    [row] = await db.query<{ id: number }>(
      `insert into feedback (kind, replay_id, reason, title, body, page, user_agent, user_id, channel, contact)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [...values, isRequest ? (f.channel ?? "web") : "web", isRequest ? (f.contact ?? null) : null],
    );
  }
  for (const [i, s] of stored.entries()) {
    const key = `feedback/${row.id}/${i}.${s.ext}`;
    await putObject(key, s.data);
    await db.query("insert into feedback_file (feedback_id, n, storage_key, mime, size) values ($1,$2,$3,$4,$5)", [row.id, i, key, s.mime, s.data.length]);
  }
  void notifyOperator(row.id, f.kind);
  return row.id;
}

/**
 * Optional heads-up to the operator's chat (Discord or Slack incoming webhook) when something lands in the inbox.
 * Only the kind, the number and the inbox link are sent: nothing the sender wrote, no screenshot. A failure is logged and ignored.
 * Set FEEDBACK_WEBHOOK_URL to turn it on; without it nothing leaves the server.
 */
async function notifyOperator(id: number, kind: Kind): Promise<void> {
  const url = process.env.FEEDBACK_WEBHOOK_URL;
  if (!url) return;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(u.hostname)) return;
    const text = operatorNotice(kind, id, process.env.SITE_URL ?? "");
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: text, text }), signal: AbortSignal.timeout(5000) });
    if (!res.ok) logWarn("feedback webhook answered", res.status);
  } catch {
    logWarn("feedback webhook failed");
  }
}

// ---------- operator side ----------

export interface FeedbackItem {
  id: number;
  kind: Kind;
  replay_id: number | null;
  reason: string | null;
  title: string | null;
  body: string | null;
  page: string | null;
  user_agent: string | null;
  signed_in: boolean;
  status: string;
  admin_note: string | null;
  created_at: string;
  files: number;
  replay_hidden: boolean | null;
  /** privacy_request: where it came from, the optional reply address, the date an answer is due, and whether that date has passed. */
  channel: string;
  contact: string | null;
  due_at: string | null;
  overdue: boolean;
}

export async function listFeedback(status: string, kind: string | null): Promise<FeedbackItem[]> {
  if (!(STATUSES as readonly string[]).includes(status)) throw new HttpError(400, "bad status");
  if (kind && !(KINDS as readonly string[]).includes(kind)) throw new HttpError(400, "bad kind");
  const db = await getDb();
  return db.query<FeedbackItem>(
    `select f.id, f.kind, f.replay_id, f.reason, f.title, f.body, f.page, f.user_agent, (f.user_id is not null) as signed_in,
            f.status, f.admin_note, f.created_at, f.channel, f.contact,
            (select count(*)::int from feedback_file x where x.feedback_id = f.id) as files,
            (r.hidden_at is not null) as replay_hidden,
            case when f.kind = 'privacy_request' then f.created_at + ($3 || ' days')::interval end as due_at,
            (f.kind = 'privacy_request' and f.status = 'OPEN' and f.created_at + ($3 || ' days')::interval < now()) as overdue
     from feedback f left join user_replay r on r.id = f.replay_id
     where f.status = $1 and ($2::text is null or f.kind = $2) order by f.created_at desc, f.id desc limit 200`,
    [status, kind, String(privacyRequestDays())],
  );
}

export async function openCounts(): Promise<Record<Kind, number>> {
  const db = await getDb();
  const rows = await db.query<{ kind: Kind; n: number }>("select kind, count(*)::int as n from feedback where status = 'OPEN' group by kind");
  const out: Record<Kind, number> = { bug: 0, idea: 0, replay: 0, privacy_request: 0 };
  for (const r of rows) out[r.kind] = r.n;
  return out;
}

export async function getFeedbackFile(id: number, n: number): Promise<{ body: ReadableStream<Uint8Array>; size: number; mime: string } | null> {
  const db = await getDb();
  const [f] = await db.query<{ storage_key: string; mime: string }>("select storage_key, mime from feedback_file where feedback_id = $1 and n = $2", [id, n]);
  if (!f) return null;
  const obj = await getObject(f.storage_key);
  return obj ? { ...obj, mime: f.mime } : null;
}

export async function setFeedbackStatus(id: number, status: "RESOLVED" | "DISMISSED", note: unknown): Promise<void> {
  const db = await getDb();
  const done = await db.query(
    "update feedback set status = $2, admin_note = coalesce($3, admin_note), resolved_at = now(), contact = null where id = $1 returning id", [id, status, clip(note, 1000) || null],
  );
  if (!done.length) throw new HttpError(404, "no such item");
}

/** After an operator decision on a replay, every open report of that replay is closed with the same outcome. */
export async function closeReplayFeedback(replayId: number, status: "RESOLVED" | "DISMISSED", note: string): Promise<void> {
  const db = await getDb();
  await db.query("update feedback set status = $2, admin_note = $3, resolved_at = now() where replay_id = $1 and status = 'OPEN'", [replayId, status, note]);
}

export async function getFeedbackKind(id: number): Promise<{ kind: Kind; replay_id: number | null } | null> {
  const db = await getDb();
  const [r] = await db.query<{ kind: Kind; replay_id: number | null }>("select kind, replay_id from feedback where id = $1", [id]);
  return r ?? null;
}

export async function deleteFeedback(id: number): Promise<void> {
  await deleteRowsAndFiles(DELETE_FEEDBACK_SQL, [[id]]);      // the row and its screenshots' names go together; the files follow
}

/** Days a closed (RESOLVED or DISMISSED) message is kept after it was closed. FEEDBACK_RETENTION_DAYS overrides it. */
export function feedbackRetentionDays(): number {
  return envDays(process.env.FEEDBACK_RETENTION_DAYS, 365);
}

export interface PurgeResult { dryRun: boolean; days: number; count: number; screenshots: number; oldestClosedAt: string | null; expiredRateRows: number }

/**
 * Remove closed messages (text, screenshots and the row) whose closing was more than `days` days ago. Open messages are never
 * touched. A dry run only counts, so the operator can look before anything goes. Safe to run again: it only ever deletes
 * what is past the date, and a second run finds nothing.
 */
export async function purgeClosedFeedback(days: number, dryRun: boolean): Promise<PurgeResult> {
  const db = await getDb();
  const due = await db.query<{ id: number; resolved_at: string }>(
    `select id, resolved_at from feedback
     where status in ('RESOLVED','DISMISSED') and resolved_at is not null and resolved_at < now() - ($1 || ' days')::interval order by resolved_at`,
    [String(days)],
  );
  const ids = due.map((d) => d.id);
  const expired = await db.query<{ n: number }>("select count(*)::int as n from report_rate where expires_at < now()");
  const files = ids.length ? await db.query<{ storage_key: string }>("select storage_key from feedback_file where feedback_id = any($1::int[])", [ids]) : [];
  if (!dryRun) {
    if (ids.length) await deleteRowsAndFiles(DELETE_FEEDBACK_SQL, [ids]);
    await db.query("delete from report_rate where expires_at < now()");
  }
  return { dryRun, days, count: ids.length, screenshots: files.length, oldestClosedAt: due[0]?.resolved_at ? new Date(due[0].resolved_at).toISOString() : null, expiredRateRows: expired[0]?.n ?? 0 };
}

/** Days an answer to a privacy request may take. The legal period is for the operator to confirm; PRIVACY_REQUEST_DAYS sets it. */
export function privacyRequestDays(): number {
  return envDays(process.env.PRIVACY_REQUEST_DAYS, 10, 1);
}

export { dueAt };
