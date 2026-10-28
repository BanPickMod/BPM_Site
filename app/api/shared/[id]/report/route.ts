import { errorResponse, HttpError } from "@/lib/server/http";
import { clientIp, rateKey, requireSameOrigin } from "@/lib/server/auth";
import { reportReplay } from "@/lib/server/publicReplays";

/** Anyone can report a public replay (for example the opponent in it). The sender is counted only as an hourly keyed hash, to rate-limit, and is not stored with the report. */
export async function POST(req: Request, ctx: RouteContext<"/api/shared/[id]/report">) {
  try {
    requireSameOrigin(req);
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "bad id");
    const body = (await req.json().catch(() => null)) as { reason?: unknown; note?: unknown } | null;
    const ip = clientIp(req);
    const out = await reportReplay(id, body?.reason, body?.note, rateKey("report", ip));
    return Response.json(out, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
