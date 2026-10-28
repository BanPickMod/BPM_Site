import "server-only";
import { allows, findOperator, parseOperators, type AdminRole, type Operator } from "@/lib/adminTokens";
import { HttpError } from "./http";
import { auditAdmin } from "./audit";
import { logWarn } from "./log";

export type { Operator } from "@/lib/adminTokens";

/**
 * Who is calling an operator route, and may they. Operators are named tokens with a role (lib/adminTokens.ts); the routes say
 * the lowest role they accept, and the default is `owner` so a route that forgets to say stays closed to everyone else.
 * A signed-in operator who is refused is written to the audit log; an unknown token only to the server log (anyone can send one).
 */
export function requireAdmin(req: Request, need: AdminRole = "owner"): Operator {
  let entries;
  try {
    entries = parseOperators({ ADMIN_TOKEN: process.env.ADMIN_TOKEN, ADMIN_TOKENS: process.env.ADMIN_TOKENS });
  } catch {
    throw new HttpError(503, "operator tokens are misconfigured");
  }
  if (!entries.length) throw new HttpError(503, "ADMIN_TOKEN or ADMIN_TOKENS is not configured");
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const op = findOperator(entries, given);
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

export { errorResponse } from "./http";
