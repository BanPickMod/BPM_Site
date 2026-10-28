import { errorResponse } from "@/lib/server/http";
import { requireWorker } from "@/lib/server/analysisJobs";
import { claimEvalJob } from "@/lib/server/evalJobs";

/** Evaluation worker: take the next analysed replay to evaluate. 200 with the job, or 204 when nothing is waiting. */
export async function POST(req: Request) {
  try {
    requireWorker(req);
    const job = await claimEvalJob();
    return job ? Response.json(job) : new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
