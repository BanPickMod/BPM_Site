import { errorResponse, requireAdmin } from "@/lib/server/admin";
import { HttpError } from "@/lib/server/http";
import { feedbackRetentionDays, purgeClosedFeedback } from "@/lib/server/feedback";
import { auditAdmin } from "@/lib/server/audit";

/**
 * Retention for the message inbox (docs/Privacy_Data_Inventory.md). `{ "dryRun": false }` deletes closed messages older than
 * FEEDBACK_RETENTION_DAYS (default 365) together with their screenshots; the default is a dry run that only counts.
 * `{ "days": n }` overrides the age. Call it from a daily scheduled job.
 */
export async function POST(req: Request) {
  try {
    const op = requireAdmin(req, "owner");
    const b = ((await req.json().catch(() => ({}))) ?? {}) as { dryRun?: unknown; days?: unknown };
    if (b.dryRun !== undefined && typeof b.dryRun !== "boolean") throw new HttpError(400, "dryRun must be a boolean");
    if (b.days !== undefined && !(Number.isInteger(b.days) && (b.days as number) >= 0)) throw new HttpError(400, "days must be a whole number, 0 or more");
    const report = await purgeClosedFeedback((b.days as number | undefined) ?? feedbackRetentionDays(), b.dryRun !== false);
    if (b.dryRun === false) await auditAdmin(op, "feedback.purge", "maintenance", `${report.count} closed messages`);
    return Response.json(report);
  } catch (e) {
    return errorResponse(e);
  }
}
