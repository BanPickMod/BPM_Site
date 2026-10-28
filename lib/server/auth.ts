import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { hourlyRateKey, readSessionValue, signSessionValue, type RateKey } from "@/lib/keys";
import { policyVersion } from "@/lib/policyVersions";
import { pickClientIp } from "@/lib/clientIp";
import { envDays } from "@/lib/envDays";
import { TOUCH_ACTIVE_SQL } from "@/lib/inactiveSql";
import { getDb } from "./db";
import { HttpError } from "./http";

/** Shown to users at consent time and logged with every consent change. Still a draft until operator details are filled. */
export const POLICY_VERSION = policyVersion();

export const SESSION_COOKIE = "bpm_session";
const SESSION_DAYS = 14;

export interface SessionUser {
  id: number;
  displayName: string;
  ageConfirmed: boolean;
  /** Raised to end every browser session of the account. */
  sessionVersion: number;
  /** The first-sign-in steps are done (docs/Privacy_Compliance_Additional_Plan.md, section 3.5). */
  onboarded: boolean;
  /** The policy version whose changes the user has already seen (3.6). */
  policySeenVersion: string | null;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const b64u = (b: Buffer) => b.toString("base64url");

/** The deployment secret, for keys that must stay the same across restarts and restores (the deletion ledger). */
export function masterSecret(): string {
  return secret();
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new HttpError(503, "SESSION_SECRET is not configured");
  return "dev-only-session-secret-not-for-production";
}

/**
 * A keyed hash of a value we must not store raw (an IP address) but still need to count, to rate-limit reports. The key changes
 * every hour, so a stored value cannot be linked across hours (lib/keys.ts).
 */
export function rateKey(label: string, value: string): RateKey {
  return hourlyRateKey(secret(), label, value, Date.now());
}

/** Signed, HttpOnly cookie value. Stateless except for the account's session_version, which is checked on every request. */
export function signSession(userId: number, version: number): { value: string; maxAge: number } {
  return { value: signSessionValue(secret(), userId, Date.now() + SESSION_DAYS * 86400_000, version), maxAge: SESSION_DAYS * 86400 };
}

/** Ends every browser session of the account at once (they all carry the old version). Launcher tokens are separate. */
export async function revokeSessions(userId: number): Promise<void> {
  const db = await getDb();
  await db.query("update app_user set session_version = session_version + 1 where id = $1", [userId]);
}

export function sessionCookie(value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function cookieFromHeader(header: string | null, name: string): string | undefined {
  return header
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

const USER_COLS = "id, display_name, age_confirmed_at, session_version, onboarding_completed_at, policy_seen_version";
interface UserRow {
  id: number;
  display_name: string;
  age_confirmed_at: string | null;
  session_version: number;
  onboarding_completed_at: string | null;
  policy_seen_version: string | null;
}
const toSessionUser = (u: UserRow): SessionUser => ({
  id: u.id, displayName: u.display_name, ageConfirmed: !!u.age_confirmed_at, sessionVersion: u.session_version,
  onboarded: !!u.onboarding_completed_at, policySeenVersion: u.policy_seen_version,
});

async function loadUser(id: number): Promise<SessionUser | null> {
  const db = await getDb();
  const [u] = await db.query<UserRow>(`select ${USER_COLS} from app_user where id = $1 and deleted_at is null`, [id]);
  return u ? toSessionUser(u) : null;
}

/** Use of the account counts against the long-idle deletion (lib/inactiveSql.ts); written at most once a day. */
async function markActive(userId: number): Promise<void> {
  const db = await getDb();
  await db.query(TOUCH_ACTIVE_SQL, [userId]);
}

/** Browser session (cookie). Returns null when not signed in. */
export async function sessionUser(cookieValue: string | undefined | null): Promise<SessionUser | null> {
  const s = readSessionValue(secret(), cookieValue, Date.now());
  if (!s) return null;
  const user = await loadUser(s.id);
  if (!user || user.sessionVersion !== s.version) return null;          // an older version means the sessions were ended
  await markActive(user.id);
  return user;
}

/** Launcher auth: `Authorization: Bearer <device token>`. Throws 401 when missing, unknown or revoked. */
export async function requireDeviceUser(req: Request): Promise<SessionUser & { tokenId: number }> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "missing token", "NO_TOKEN");
  const db = await getDb();
  const [t] = await db.query<{ id: number; user_id: number }>(
    "select id, user_id from device_token where token_hash = $1 and revoked_at is null",
    [sha256(token)],
  );
  if (!t) throw new HttpError(401, "invalid or revoked token", "BAD_TOKEN");
  const user = await loadUser(t.user_id);
  if (!user) throw new HttpError(401, "account removed", "BAD_TOKEN");
  await db.query("update device_token set last_used_at = now() where id = $1", [t.id]);
  await markActive(user.id);
  return { ...user, tokenId: t.id };
}

export async function upsertUser(provider: string, subject: string, displayName: string, ageConfirmed = false): Promise<SessionUser> {
  const db = await getDb();
  const [u] = await db.query<UserRow>(
    `insert into app_user (provider, subject, display_name, age_confirmed_at)
     values ($1,$2,$3, case when $4 then now() else null end)
     on conflict (provider, subject) do update set display_name = excluded.display_name, deleted_at = null,
       last_active_at = now(), inactive_notice_at = null,
       age_confirmed_at = case when $4 then coalesce(app_user.age_confirmed_at, now()) else app_user.age_confirmed_at end
     returning ${USER_COLS}`,
    [provider, subject, displayName, ageConfirmed],
  );
  return toSessionUser(u);
}

/** Records the user's self-declaration that they are at least 14. No birth date is collected. */
export async function confirmAge(userId: number): Promise<void> {
  const db = await getDb();
  await db.query("update app_user set age_confirmed_at = coalesce(age_confirmed_at, now()) where id = $1 and deleted_at is null", [userId]);
}

// ---- device authorization (RFC 8628 style) ----------------------------------------------------

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const DEVICE_TTL_SEC = 600;
export const POLL_INTERVAL_SEC = 3;

function newUserCode(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export async function startDeviceAuth() {
  const db = await getDb();
  const deviceCode = b64u(randomBytes(32));
  for (let attempt = 0; attempt < 5; attempt++) {
    const userCode = newUserCode();
    try {
      await db.query(
        "insert into device_auth (device_code_hash, user_code, expires_at) values ($1,$2, now() + ($3 || ' seconds')::interval)",
        [sha256(deviceCode), userCode, String(DEVICE_TTL_SEC)],
      );
      return { deviceCode, userCode, expiresIn: DEVICE_TTL_SEC, interval: POLL_INTERVAL_SEC };
    } catch (e) {
      if (attempt === 4) throw e; // user_code collision is the only expected failure; retry with a new code
    }
  }
  throw new Error("unreachable");
}

export async function approveDeviceAuth(userCode: string, userId: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db.query(
    `update device_auth set user_id = $1, status = 'approved'
     where user_code = $2 and status = 'pending' and expires_at > now() returning id`,
    [userId, userCode.trim().toUpperCase()],
  );
  return rows.length > 0;
}

export type DevicePoll = { status: "pending" | "slow_down" | "expired" | "denied" } | { status: "ok"; token: string };

/** Exchange an approved device code for a long-lived token. A code can be exchanged exactly once. */
export async function pollDeviceAuth(deviceCode: string, label: string | null): Promise<DevicePoll> {
  const db = await getDb();
  const hash = sha256(deviceCode);
  const [row] = await db.query<{ id: number; user_id: number | null; status: string; expired: boolean; too_fast: boolean }>(
    `select id, user_id, status, expires_at <= now() as expired,
            (last_poll is not null and last_poll > now() - ($2 || ' seconds')::interval) as too_fast
     from device_auth where device_code_hash = $1`,
    [hash, String(POLL_INTERVAL_SEC - 1)],
  );
  if (!row || row.expired) return { status: "expired" };
  await db.query("update device_auth set last_poll = now() where id = $1", [row.id]);
  if (row.too_fast && row.status === "pending") return { status: "slow_down" };
  if (row.status === "pending") return { status: "pending" };
  if (row.status !== "approved" || !row.user_id) return { status: "denied" };

  const claimed = await db.query("update device_auth set status = 'used' where id = $1 and status = 'approved' returning id", [row.id]);
  if (!claimed.length) return { status: "denied" };
  const token = b64u(randomBytes(32));
  await db.query("insert into device_token (user_id, token_hash, label) values ($1,$2,$3)", [row.user_id, sha256(token), label]);
  return { status: "ok", token };
}

/** Bearer device token when sent (launcher), otherwise the browser session cookie. */
export async function requireUser(req: Request): Promise<SessionUser> {
  if (req.headers.get("authorization")) return requireDeviceUser(req);
  const user = await sessionUser(cookieFromHeader(req.headers.get("cookie"), SESSION_COOKIE));
  if (!user) throw new HttpError(401, "not signed in", "NO_SESSION");
  return user;
}

/** The sender's address for rate limits: the entry of X-Forwarded-For a trusted proxy wrote (TRUSTED_PROXY_HOPS, default 1). */
export function clientIp(req: Request): string {
  return pickClientIp(req.headers.get("x-forwarded-for"), envDays(process.env.TRUSTED_PROXY_HOPS, 1));
}

/** CSRF guard for cookie-authenticated writes: the Origin header, when present, must match this host. */
export function requireSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (launcher, curl) do not send Origin and use bearer tokens
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = null;                                  // "null" (sandboxed frame, file page) or garbage
  }
  if (!host || !originHost || originHost !== host) throw new HttpError(403, "cross-origin request refused", "BAD_ORIGIN");
}

export async function revokeAllTokens(userId: number): Promise<void> {
  const db = await getDb();
  await db.query("update device_token set revoked_at = now() where user_id = $1 and revoked_at is null", [userId]);
}
