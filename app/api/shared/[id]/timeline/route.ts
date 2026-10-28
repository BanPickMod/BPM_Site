import { errorResponse, HttpError } from "@/lib/server/http";
import { getPublicTimeline } from "@/lib/server/publicReplays";

/** Timeline of a replay whose uploader allows public viewing, with player handles removed. Never cached: a takedown must act at once. */
export async function GET(_req: Request, ctx: RouteContext<"/api/shared/[id]/timeline">) {
  try {
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "bad id");
    const data = await getPublicTimeline(id);
    if (!data) throw new HttpError(404, "not found");
    return new Response(Buffer.from(data), {
      headers: { "content-type": "application/gzip", "content-length": String(data.byteLength), "cache-control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
