import { errorResponse, HttpError } from "@/lib/server/http";
import { requireDeviceUser } from "@/lib/server/auth";
import { getUpload } from "@/lib/server/userUploads";

export async function GET(req: Request, ctx: RouteContext<"/api/uploads/[id]">) {
  try {
    const user = await requireDeviceUser(req);
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "bad id");
    const row = await getUpload(user.id, id);
    if (!row) throw new HttpError(404, "not found");
    return Response.json({ id: row.id, status: row.status, rejectCode: row.reject_code, size: row.size, uploadedAt: row.uploaded_at });
  } catch (e) {
    return errorResponse(e);
  }
}
