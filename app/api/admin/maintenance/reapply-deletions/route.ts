import { errorResponse, requireAdmin } from "@/lib/server/admin";
import { HttpError } from "@/lib/server/http";
import { reapplyDeletions } from "@/lib/server/restore";
import { auditAdmin } from "@/lib/server/audit";

/**
 * After restoring the database from a backup: `{ "since": "<time the backup was taken, ISO>", "dryRun": false }` repeats the
 * deletions and consent withdrawals recorded in the ledger after that time (docs/Backup_and_Restore.md). The default is a dry
 * run that only counts. Owner only; a real run is audited.
 */
export async function POST(req: Request) {
  try {
    const op = requireAdmin(req, "owner");
    const b = ((await req.json().catch(() => ({}))) ?? {}) as { since?: unknown; dryRun?: unknown };
    if (typeof b.since !== "string" || Number.isNaN(Date.parse(b.since))) throw new HttpError(400, "since (the time of the backup, ISO 8601) is required");
    if (b.dryRun !== undefined && typeof b.dryRun !== "boolean") throw new HttpError(400, "dryRun must be a boolean");
    const report = await reapplyDeletions(new Date(b.since), b.dryRun !== false);
    if (b.dryRun === false) await auditAdmin(op, "restore.reapply", "maintenance", `accounts ${report.done.accounts}, replays ${report.done.replays}, consents ${report.done.consents}`);
    return Response.json(report);
  } catch (e) {
    return errorResponse(e);
  }
}
