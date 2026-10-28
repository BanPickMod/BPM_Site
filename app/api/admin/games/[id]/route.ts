import { errorResponse, requireAdmin } from "@/lib/server/admin";
import { deleteGame, HttpError } from "@/lib/server/games";
import { auditAdmin } from "@/lib/server/audit";

export async function DELETE(req: Request, ctx: RouteContext<"/api/admin/games/[id]">) {
  try {
    const op = requireAdmin(req, "owner");
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "bad id");
    if (!(await deleteGame(id))) throw new HttpError(404, "no such game");
    await auditAdmin(op, "game.delete", `game:${id}`);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
