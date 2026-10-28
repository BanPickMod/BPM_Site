import { errorResponse, requireAdmin } from "@/lib/server/admin";
import { HttpError } from "@/lib/server/http";
import { getFeedbackFile } from "@/lib/server/feedback";
import { auditAdmin } from "@/lib/server/audit";

/** A screenshot, for the operator only. Served with a fixed image type and no sniffing, and sandboxed, so an attachment can never run as a page. */
export async function GET(req: Request, ctx: RouteContext<"/api/admin/feedback/[id]/files/[n]">) {
  try {
    const op = requireAdmin(req, "moderator");
    const { id, n } = await ctx.params;
    if (!/^\d+$/.test(id) || !/^\d+$/.test(n)) throw new HttpError(400, "bad id");
    const f = await getFeedbackFile(Number(id), Number(n));
    if (!f) throw new HttpError(404, "not found");
    await auditAdmin(op, "screenshot.view", `feedback:${id}`, `file ${n}`);
    return new Response(f.body, {
      headers: {
        "content-type": f.mime, "content-length": String(f.size), "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'", "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
