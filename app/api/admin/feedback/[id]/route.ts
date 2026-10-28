import { errorResponse, requireAdmin } from "@/lib/server/admin";
import { HttpError } from "@/lib/server/http";
import { deleteFeedback, getFeedbackKind, setFeedbackStatus } from "@/lib/server/feedback";
import { resolveReports } from "@/lib/server/publicReplays";
import { auditAdmin } from "@/lib/server/audit";

/**
 * Operator decision on one item: { action: "resolve" | "dismiss" | "delete", note? }.
 * For a replay report also "restore" (put it back on the public pages) or "remove" (delete the replay for good); either closes every open report of that replay.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/feedback/[id]">) {
  try {
    const op = requireAdmin(req, "moderator");
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "bad id");
    const body = (await req.json().catch(() => null)) as { action?: unknown; note?: unknown } | null;
    const item = await getFeedbackKind(id);
    if (!item) throw new HttpError(404, "no such item");
    const action = body?.action;
    if (action === "resolve" || action === "dismiss") {
      await setFeedbackStatus(id, action === "resolve" ? "RESOLVED" : "DISMISSED", body?.note);
    } else if (action === "delete") {
      await deleteFeedback(id);
    } else if (action === "restore" || action === "remove") {
      if (item.kind !== "replay" || !item.replay_id) throw new HttpError(400, "only a report about an existing replay can be restored or removed");
      await resolveReports(item.replay_id, action);
    } else {
      throw new HttpError(400, "action must be resolve, dismiss, delete, restore or remove");
    }
    await auditAdmin(op, `feedback.${action}`, `feedback:${id}`, item.replay_id ? `replay ${item.replay_id}` : undefined);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
