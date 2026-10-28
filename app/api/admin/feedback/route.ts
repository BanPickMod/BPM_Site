import { errorResponse, requireAdmin } from "@/lib/server/admin";
import { createFeedback, listFeedback, openCounts } from "@/lib/server/feedback";
import { HttpError } from "@/lib/server/http";
import { auditAdmin } from "@/lib/server/audit";
import { parseRequest } from "@/lib/privacyRequest";

/** Operator inbox. ?status=OPEN|RESOLVED|DISMISSED (default OPEN) &kind=bug|idea|replay */
export async function GET(req: Request) {
  try {
    requireAdmin(req, "readonly");
    const q = new URL(req.url).searchParams;
    return Response.json({ items: await listFeedback(q.get("status") ?? "OPEN", q.get("kind")), open: await openCounts() });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * Record a privacy request that arrived by email: { type, details, contact? }. The operator types what was asked; the time of
 * receipt is now, so the answer date is counted from the day it is entered, which should be the day it arrived.
 */
export async function POST(req: Request) {
  try {
    const op = requireAdmin(req, "moderator");
    const parsed = parseRequest(await req.json().catch(() => null));
    if (!parsed.ok) throw new HttpError(400, parsed.code);
    const id = await createFeedback({
      kind: "privacy_request", reason: parsed.value.type, body: parsed.value.details, page: null, channel: "email", contact: parsed.value.contact,
    });                                                 // no abuse limit: an authenticated operator, and the request has a deadline
    await auditAdmin(op, "privacy_request.record", `feedback:${id}`, `email, ${parsed.value.type}`);
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
