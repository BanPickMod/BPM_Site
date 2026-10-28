import "server-only";
import { allows, findOperator, parseOperators, parseTotpSecrets, type AdminRole, type Operator, type OperatorEntry } from "@/lib/adminTokens";
import { readAdminSession, signAdminSession } from "@/lib/keys";
import { verifyTotp } from "@/lib/totp";
import { HttpError } from "./http";
import { auditAdmin } from "./audit";
import { masterSecret } from "./auth";
import { logWarn } from "./log";

export type { Operator } from "@/lib/adminTokens";

/**
 * Who is calling an operator route, and may they. Operators are named tokens with a role (lib/adminTokens.ts); the routes say
 * the lowest role they accept, and the default is `owner` so a route that forgets to say stays closed to everyone else.
 * A signed-in operator who is refused is written to the audit log; an unknown token only to the server log (anyone can send one).
 *
 * Second factor: an operator with an authenticator secret (ADMIN_TOTP) signs in once with token + 6-digit code
 * (POST /api/admin/login) and then sends the session it gets back as the bearer. In production every operator needs a secret, and the
 * raw token alone opens nothing. Outside production an operator without a secret still works with the token alone (local tests).
 */
export const ADMIN_SESSION_MINUTES = 120;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;

function operators(): OperatorEntry[] {
  let entries;
  try {
    entries = parseOperators({ ADMIN_TOKEN: process.env.ADMIN_TOKEN, ADMIN_TOKENS: process.env.ADMIN_TOKENS });
  } catch {
    throw new HttpError(503, "operator tokens are misconfigured");
  }
  if (!entries.length) throw new HttpError(503, "ADMIN_TOKEN or ADMIN_TOKENS is not configured");
  return entries;
}

function totpSecrets(): Map<string, string> {
  try {
    return parseTotpSecrets(process.env.ADMIN_TOTP);
  } catch {
    throw new HttpError(503, "ADMIN_TOTP is misconfigured");
  }
}

const secondFactorRequired = (name: string, secrets: Map<string, string>) => process.env.NODE_ENV === "production" || secrets.has(name);

const bearerOf = (req: Request) => (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");

export function requireAdmin(req: Request, need: AdminRole = "owner"): Operator {
  const entries = operators();
  const given = bearerOf(req);
  let op: Operator | null = null;
  if (given.startsWith("adm.")) {
    const session = readAdminSession(masterSecret(), given, Date.now());
    const entry = session ? entries.find((e) => e.name === session.name) : undefined;   // a removed operator's session dies with the entry
    if (entry) op = { name: entry.name, role: entry.role };
  } else {
    op = findOperator(entries, given);
    if (op && secondFactorRequired(op.name, totpSecrets())) {
      void auditAdmin(op, "denied", new URL(req.url).pathname, "token without session").catch(() => {});
      throw new HttpError(401, "sign in with the one-time code first (POST /api/admin/login)", "TWO_FACTOR_REQUIRED");
    }
  }
  if (!op) {
    logWarn("operator route called with an unknown token");
    throw new HttpError(401, "unauthorized");
  }
  if (!allows(op, need)) {
    void auditAdmin(op, "denied", new URL(req.url).pathname).catch(() => {});
    throw new HttpError(403, "this operator role may not do that", "ROLE");
  }
  return op;
}

interface Guard { failures: number; firstAt: number; lockedUntil: number; lastCounter: number }
const guards = ((globalThis as { __bpmAdminGuards?: Map<string, Guard> }).__bpmAdminGuards ??= new Map());

/**
 * Token + code in, session out. Wrong codes lock the operator for 15 minutes after 5 tries, and a code that was used once is never
 * accepted again. The counters live in this process: with more than one replica each keeps its own, so the limit is per replica.
 */
export function adminLogin(req: Request, otp: string, nowMs = Date.now()): { session: string; expiresAt: number; operator: Operator } {
  const entries = operators();
  const op = findOperator(entries, bearerOf(req));
  if (!op) {
    logWarn("operator login with an unknown token");
    throw new HttpError(401, "unauthorized");
  }
  const secrets = totpSecrets();
  const secret = secrets.get(op.name);
  if (!secret) {
    if (!secondFactorRequired(op.name, secrets)) throw new HttpError(400, "this operator has no one-time code configured; use the token directly", "NO_TOTP");
    throw new HttpError(403, "no authenticator is set up for this operator (ADMIN_TOTP)", "TWO_FACTOR_NOT_SET_UP");
  }
  const g = guards.get(op.name) ?? { failures: 0, firstAt: nowMs, lockedUntil: 0, lastCounter: -1 };
  guards.set(op.name, g);
  if (g.lockedUntil > nowMs) throw new HttpError(429, "too many wrong codes, try again later", "LOCKED");
  if (nowMs - g.firstAt > LOCK_MS) { g.failures = 0; g.firstAt = nowMs; }
  const counter = verifyTotp(secret, otp, nowMs);
  if (counter === null || counter <= g.lastCounter) {
    g.failures++;
    const locked = g.failures >= MAX_FAILURES;
    if (locked) g.lockedUntil = nowMs + LOCK_MS;
    void auditAdmin(op, locked ? "login_locked" : "login_failed", "/api/admin/login", counter === null ? "wrong code" : "code already used").catch(() => {});
    throw new HttpError(401, "wrong or already used code", "BAD_CODE");
  }
  g.lastCounter = counter;
  g.failures = 0;
  const expiresAt = nowMs + ADMIN_SESSION_MINUTES * 60_000;
  void auditAdmin(op, "login", "/api/admin/login").catch(() => {});
  return { session: signAdminSession(masterSecret(), op.name, expiresAt), expiresAt, operator: op };
}

export { errorResponse } from "./http";
