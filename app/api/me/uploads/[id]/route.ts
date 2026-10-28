import { errorResponse, HttpError } from "@/lib/server/http";
import { requireSameOrigin, requireUser } from "@/lib/server/auth";
import { deleteUpload, getUploadDetail, setUploadSettings } from "@/lib/server/userUploads";

/** One of the signed-in user's uploads with its analysis (null until the worker has finished). Owner only. */
export async function GET(req: Request, ctx: RouteContext<"/api/me/uploads/[id]">) {
  try {
    const user = await requireUser(req);
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "bad id");
    const row = await getUploadDetail(user.id, id);
    if (!row) throw new HttpError(404, "not found");
    return Response.json(row);
  } catch (e) {
    return errorResponse(e);
  }
}

/** Delete the file and the analysis for good. Works at any stage; a worker still holding the job gets a 409 and drops it. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/me/uploads/[id]">) {
  try {
    requireSameOrigin(req);
    const user = await requireUser(req);
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "bad id");
    if (!(await deleteUpload(user.id, id))) throw new HttpError(404, "not found");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Per-replay sharing: `{ public?: boolean, trainingExcluded?: boolean }`. Takes effect on the public pages and statistics at once. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/me/uploads/[id]">) {
  try {
    requireSameOrigin(req);
    const user = await requireUser(req);
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "bad id");
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!b || typeof b !== "object") throw new HttpError(400, "json body expected");
    const patch: { public?: boolean; trainingExcluded?: boolean } = {};
    if ("public" in b) {
      if (typeof b.public !== "boolean") throw new HttpError(400, "public must be a boolean");
      patch.public = b.public;
    }
    if ("trainingExcluded" in b) {
      if (typeof b.trainingExcluded !== "boolean") throw new HttpError(400, "trainingExcluded must be a boolean");
      patch.trainingExcluded = b.trainingExcluded;
    }
    if (patch.public === undefined && patch.trainingExcluded === undefined) throw new HttpError(400, "nothing to change");
    if (!(await setUploadSettings(user.id, id, patch))) throw new HttpError(404, "not found");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
