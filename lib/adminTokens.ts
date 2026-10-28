import { createHash, timingSafeEqual } from "node:crypto";
import { base32Decode } from "./totp.ts";

/**
 * Operator access (docs/Privacy_Compliance_Additional_Plan.md, A5). One shared token cannot say who did what or be taken away from
 * one person. Each operator gets a named token with a role:
 *
 *   ADMIN_TOKENS="alice:owner:<token>,bob:moderator:<token>,carol:readonly:<token>"
 *
 *   readonly   sees the inbox list (no screenshots, no decisions)
 *   moderator  also opens screenshots and decides reports and messages
 *   owner      also uploads event games, runs the retention job, reads the audit log
 *
 * The older single ADMIN_TOKEN still works and means one operator called "admin" with the owner role. To take access away from a
 * person, remove their entry and redeploy.
 */
export type AdminRole = "readonly" | "moderator" | "owner";
export const RANK: Record<AdminRole, number> = { readonly: 1, moderator: 2, owner: 3 };

export interface OperatorEntry { name: string; role: AdminRole; token: string }
export interface Operator { name: string; role: AdminRole }

const NAME = /^[a-z0-9][a-z0-9_-]{0,23}$/;
const TOKEN = /^[A-Za-z0-9._~-]{16,}$/;

export function parseOperators(env: { ADMIN_TOKEN?: string; ADMIN_TOKENS?: string }): OperatorEntry[] {
  const out: OperatorEntry[] = [];
  for (const part of (env.ADMIN_TOKENS ?? "").split(",").map((p) => p.trim()).filter(Boolean)) {
    const [name, role, token, ...extra] = part.split(":");
    if (extra.length || !NAME.test(name ?? "") || !Object.hasOwn(RANK, role ?? "") || !TOKEN.test(token ?? "") || token.startsWith("adm.")) {
      throw new Error("ADMIN_TOKENS entries must look like name:role:token (role readonly, moderator or owner; token of 16+ letters, digits . _ ~ -, not starting with adm.)");
    }
    out.push({ name, role: role as AdminRole, token });
  }
  const legacy = env.ADMIN_TOKEN?.trim();
  if (legacy && legacy.length >= 16 && !legacy.startsWith("adm.")) out.push({ name: "admin", role: "owner", token: legacy });
  const names = new Set(out.map((o) => o.name));
  const tokens = new Set(out.map((o) => o.token));
  if (names.size !== out.length || tokens.size !== out.length) throw new Error("operator names and tokens must each be unique");
  return out;
}

const digest = (s: string) => createHash("sha256").update(s).digest();

/** The operator that owns this bearer token, or null. Every candidate is compared, so timing does not reveal which one was close. */
export function findOperator(entries: OperatorEntry[], given: string): Operator | null {
  const g = digest(given);
  let found: Operator | null = null;
  for (const e of entries) if (timingSafeEqual(g, digest(e.token)) && !found) found = { name: e.name, role: e.role };
  return found;
}

export const allows = (op: Operator, need: AdminRole) => RANK[op.role] >= RANK[need];

/**
 * Second factor (lib/totp.ts). ADMIN_TOTP="alice:<base32 secret>,bob:<base32 secret>" gives each operator an authenticator-app secret.
 * An operator with a secret signs in with token + 6-digit code (/api/admin/login); the token alone no longer opens anything.
 */
export function parseTotpSecrets(raw: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of (raw ?? "").split(",").map((p) => p.trim()).filter(Boolean)) {
    const [name, secret, ...extra] = part.split(":");
    const bytes = secret ? base32Decode(secret) : null;
    if (extra.length || !NAME.test(name ?? "") || !bytes || bytes.length < 10) {
      throw new Error("ADMIN_TOTP entries must look like name:BASE32SECRET (a secret from scripts/ops/admin-totp.mjs new)");
    }
    if (out.has(name)) throw new Error("ADMIN_TOTP names must be unique");
    out.set(name, secret.replace(/[\s-]/g, "").toUpperCase());
  }
  return out;
}
