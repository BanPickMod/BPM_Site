import { errorResponse, HttpError } from "@/lib/server/http";
import { clientIp, rateKey, requireSameOrigin, requireUser } from "@/lib/server/auth";
import { createFeedback, MAX_REQUEST_BYTES } from "@/lib/server/feedback";

/**
 * Bug reports and ideas. multipart/form-data: kind (bug|idea), title, body, page (optional), screenshot (0-3 images, signed-in only).
 * Reports about a public replay go through /api/shared/{id}/report and end up in the same inbox.
 */
export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    if (Number(req.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) throw new HttpError(413, "request too large", "FILE_TOO_LARGE");
    const form = await req.formData().catch(() => {
      throw new HttpError(400, "multipart/form-data expected");
    });
    const kind = form.get("kind");
    if (kind !== "bug" && kind !== "idea") throw new HttpError(400, "kind must be bug or idea");
    const user = await requireUser(req).catch(() => null);
    const ip = clientIp(req);
    const files = form.getAll("screenshot").filter((f): f is File => f instanceof File && f.size > 0);
    const id = await createFeedback({
      kind, title: form.get("title"), body: form.get("body"), page: form.get("page"),
      userAgent: req.headers.get("user-agent"), userId: user?.id ?? null,
      rate: user ? rateKey("user", String(user.id)) : rateKey("report", ip), files,
    });
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
