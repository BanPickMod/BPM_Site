import { errorResponse, HttpError } from "@/lib/server/http";
import { parseJobResult, requireWorker, submitResult } from "@/lib/server/analysisJobs";

/**
 * Worker: report the outcome of a leased job.
 *   { status: "READY", analyzerVersion, analysis }
 *   { status: "REJECTED", rejectCode: "NOT_BPM" | "CORRUPT" | "UNSUPPORTED" }
 *   { status: "FAILED", error }        (retried with backoff, then marked FAILED)
 */
export async function POST(req: Request, ctx: RouteContext<"/api/worker/replays/[id]/result">) {
  try {
    requireWorker(req);
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "bad id");
    const result = parseJobResult(await req.json().catch(() => null));
    return Response.json(await submitResult(id, result));
  } catch (e) {
    return errorResponse(e);
  }
}
