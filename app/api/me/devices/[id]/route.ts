import { errorResponse, HttpError } from "@/lib/server/http";
import { requireSameOrigin, requireUser } from "@/lib/server/auth";
import { revokeDevice } from "@/lib/server/account";

export async function DELETE(req: Request, ctx: RouteContext<"/api/me/devices/[id]">) {
  try {
    requireSameOrigin(req);
    const user = await requireUser(req);
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "bad id");
    if (!(await revokeDevice(user.id, id))) throw new HttpError(404, "not found");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
