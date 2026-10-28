import { errorResponse } from "@/lib/server/http";
import { claimJob, requireWorker } from "@/lib/server/analysisJobs";

/** Worker: take the next replay to analyze. 200 with the job, or 204 when the queue is empty. */
export async function POST(req: Request) {
  try {
    requireWorker(req);
    const job = await claimJob();
    return job ? Response.json(job) : new Response(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
