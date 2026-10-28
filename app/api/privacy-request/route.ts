import { errorResponse, HttpError } from "@/lib/server/http";
import { clientIp, rateKey, requireSameOrigin, requireUser } from "@/lib/server/auth";
import { createFeedback, privacyRequestDays } from "@/lib/server/feedback";
import { dueAt, parseRequest } from "@/lib/privacyRequest";

/**
 * A request about one's own data: { type, details, contact? }. Anyone may send one; a signed-in sender is tied to the account, which
 * is how the operator can verify who is asking (an anonymous request about "my account" cannot be verified and is answered
 * accordingly). The optional contact is kept only until the request is closed. No attachments: do not send identity documents here.
 */
export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const parsed = parseRequest(await req.json().catch(() => null));
    if (!parsed.ok) throw new HttpError(400, parsed.code === "BAD_TYPE" ? "unknown request type" : parsed.code === "TOO_SHORT" ? "details (5+ characters) are required" : "contact must be a valid email address", parsed.code);
    const user = await requireUser(req).catch(() => null);
    const ip = clientIp(req);
    const id = await createFeedback({
      kind: "privacy_request", reason: parsed.value.type, body: parsed.value.details, page: "/privacy-request",
      userId: user?.id ?? null, rate: user ? rateKey("user", String(user.id)) : rateKey("report", ip),
      channel: "web", contact: parsed.value.contact,
    });
    return Response.json({ id, dueAt: dueAt(new Date(), privacyRequestDays()).toISOString() }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
