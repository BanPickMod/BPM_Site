import { errorResponse, requireAdmin } from "@/lib/server/admin";
import { HttpError } from "@/lib/server/http";
import { runRetention, type RetentionConfig } from "@/lib/server/retention";
import { auditAdmin } from "@/lib/server/audit";

const KEYS: (keyof RetentionConfig)[] = ["readyDays", "failedDays", "unsupportedDays", "stuckDays", "feedbackDays", "linkDays", "auditDays"];

/**
 * Daily retention run (original replays, closed messages, expired device links). `{ "dryRun": false }` deletes; the default only
 * counts. Ages come from the environment (SOURCE_READY_MAX_DAYS, SOURCE_FAILED_MAX_DAYS, SOURCE_UNSUPPORTED_MAX_DAYS,
 * SOURCE_STUCK_MAX_DAYS, FEEDBACK_RETENTION_DAYS, LINK_RETENTION_DAYS) and may be overridden in the body for a test.
 */
export async function POST(req: Request) {
  try {
    const op = requireAdmin(req, "owner");
    const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    if (b.dryRun !== undefined && typeof b.dryRun !== "boolean") throw new HttpError(400, "dryRun must be a boolean");
    const over: Partial<RetentionConfig> = {};
    for (const k of KEYS) {
      if (b[k] === undefined) continue;
      if (!Number.isInteger(b[k]) || (b[k] as number) < 0) throw new HttpError(400, `${k} must be a whole number, 0 or more`);
      over[k] = b[k] as number;
    }
    const report = await runRetention(b.dryRun !== false, over);
    if (b.dryRun === false) await auditAdmin(op, "retention.run", "maintenance", `sources ${report.sources.deleted}, feedback ${report.feedback.count}`);
    return Response.json(report);
  } catch (e) {
    return errorResponse(e);
  }
}
