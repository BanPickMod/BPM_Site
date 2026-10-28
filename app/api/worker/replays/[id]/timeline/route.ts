import { errorResponse, HttpError } from "@/lib/server/http";
import { MAX_TIMELINE_BYTES, requireWorker, storeTimeline } from "@/lib/server/analysisJobs";

/** Worker: upload timeline.json.gz before reporting the leased replay READY. */
export async function PUT(req: Request, ctx: RouteContext<"/api/worker/replays/[id]/timeline">) {
  try {
    requireWorker(req);
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "bad id");
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_TIMELINE_BYTES) throw new HttpError(413, "timeline too large", "TIMELINE_SIZE");
    const data = new Uint8Array(await req.arrayBuffer());
    const a = new URL(req.url).searchParams.get("attempt");
    return Response.json(await storeTimeline(id, data, a !== null && /^\d+$/.test(a) ? Number(a) : undefined));
  } catch (e) {
    return errorResponse(e);
  }
}
