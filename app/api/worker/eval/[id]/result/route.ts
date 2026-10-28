import { errorResponse, HttpError } from "@/lib/server/http";
import { requireWorker } from "@/lib/server/analysisJobs";
import { parseEvalResult, submitEvalResult } from "@/lib/server/evalJobs";

/** Evaluation worker: report the curve (DONE), that the replay cannot be evaluated (SKIPPED), or a failure (FAILED, retried). */
export async function POST(req: Request, ctx: RouteContext<"/api/worker/eval/[id]/result">) {
  try {
    requireWorker(req);
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "bad id");
    const body = await req.json().catch(() => null);
    return Response.json(await submitEvalResult(id, parseEvalResult(body)));
  } catch (e) {
    return errorResponse(e);
  }
}
