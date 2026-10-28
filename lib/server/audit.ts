import "server-only";
import { getDb } from "./db";
import type { Operator } from "@/lib/adminTokens";
import { envDays } from "@/lib/envDays";

/**
 * What operators did, not what they saw (docs/Privacy_Data_Inventory.md). A row says who, when, which action and on what
 * ("feedback:12"), never the content of a message, a screenshot or a replay. It is what lets the operator answer "who opened this
 * and when" after an incident. Kept AUDIT_RETENTION_DAYS (default 365).
 */
export async function auditAdmin(op: Operator, action: string, target: string, detail?: string): Promise<void> {
  const db = await getDb();
  await db.query("insert into admin_audit (actor, role, action, target, detail) values ($1,$2,$3,$4,$5)", [op.name, op.role, action.slice(0, 40), target.slice(0, 80), detail ? detail.slice(0, 120) : null]);
}

export interface AuditRow { id: number; at: string; actor: string; role: string; action: string; target: string; detail: string | null }

export async function listAudit(limit: number, actor?: string): Promise<AuditRow[]> {
  const db = await getDb();
  return db.query<AuditRow>(
    "select id, at, actor, role, action, target, detail from admin_audit where ($2::text is null or actor = $2) order by id desc limit $1",
    [Math.min(Math.max(limit, 1), 500), actor ?? null],
  );
}

export function auditRetentionDays(): number {
  return envDays(process.env.AUDIT_RETENTION_DAYS, 365);
}

export async function purgeAudit(days: number, dryRun: boolean): Promise<number> {
  const db = await getDb();
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from admin_audit where at < now() - ($1 || ' days')::interval", [String(days)]);
  if (!dryRun && n) await db.query("delete from admin_audit where at < now() - ($1 || ' days')::interval", [String(days)]);
  return n;
}
