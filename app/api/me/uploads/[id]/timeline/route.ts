import { errorResponse, HttpError } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { getUploadTimeline } from "@/lib/server/userUploads";

/** Owner-only timeline download. Objects in storage are never public. */
export async function GET(req: Request, ctx: RouteContext<"/api/me/uploads/[id]/timeline">) {
  try {
    const user = await requireUser(req);
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "bad id");
    const object = await getUploadTimeline(user.id, id);
    if (!object) throw new HttpError(404, "timeline not found");
    return new Response(object.body, {
      headers: {
        "content-type": "application/gzip",
        "content-length": String(object.size),
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
