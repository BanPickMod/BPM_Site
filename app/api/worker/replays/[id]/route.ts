import { errorResponse, HttpError } from "@/lib/server/http";
import { leasedReplayKey, requireWorker } from "@/lib/server/analysisJobs";
import { getObject } from "@/lib/server/storage";

/** Worker: download the replay it has leased. Nothing else is readable through this route. */
export async function GET(req: Request, ctx: RouteContext<"/api/worker/replays/[id]">) {
  try {
    requireWorker(req);
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "bad id");
    const obj = await getObject(await leasedReplayKey(id));
    if (!obj) throw new HttpError(404, "replay file missing", "FILE_MISSING");
    return new Response(obj.body, { headers: { "content-type": "application/octet-stream", "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
