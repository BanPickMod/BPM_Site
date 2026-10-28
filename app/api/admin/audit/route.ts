import { errorResponse, requireAdmin } from "@/lib/server/admin";
import { listAudit } from "@/lib/server/audit";

/** The operator audit log, newest first (owner only). ?limit=100 (max 500) &actor=<operator name> */
export async function GET(req: Request) {
  try {
    requireAdmin(req, "owner");
    const q = new URL(req.url).searchParams;
    return Response.json({ items: await listAudit(Number(q.get("limit") ?? 100) || 100, q.get("actor") ?? undefined) });
  } catch (e) {
    return errorResponse(e);
  }
}
