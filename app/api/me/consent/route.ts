import { errorResponse, HttpError } from "@/lib/server/http";
import { requireSameOrigin, requireUser } from "@/lib/server/auth";
import { getConsent, parseConsentBody, setConsent } from "@/lib/server/consent";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    return Response.json(await getConsent(user.id));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireUser(req);
    if (!user.ageConfirmed) throw new HttpError(422, "age confirmation required", "AGE_REQUIRED");
    const next = parseConsentBody(await req.json().catch(() => null));
    if (!next) throw new HttpError(400, "c1, c2 and c3 booleans required");
    return Response.json(await setConsent(user.id, next, req.headers.get("authorization") ? "launcher" : "web"));
  } catch (e) {
    return errorResponse(e);
  }
}
