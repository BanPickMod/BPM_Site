import { errorResponse, HttpError } from "@/lib/server/http";
import { approveDeviceAuth, cookieFromHeader, requireSameOrigin, SESSION_COOKIE, sessionUser } from "@/lib/server/auth";
import { parseConsentBody, setConsent } from "@/lib/server/consent";

/** Browser step: a signed-in user approves a launcher's code and sets consent in the same step. C1 is required to approve. */
export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await sessionUser(cookieFromHeader(req.headers.get("cookie"), SESSION_COOKIE));
    if (!user) throw new HttpError(401, "not signed in", "NO_SESSION");
    if (!user.ageConfirmed) throw new HttpError(422, "age confirmation required", "AGE_REQUIRED");
    if (!user.onboarded) throw new HttpError(409, "finish the first sign-in steps on the website before linking a launcher", "ONBOARDING_REQUIRED");
    const body = (await req.json().catch(() => null)) as { user_code?: unknown } | null;
    const consent = parseConsentBody(body);
    if (!body || typeof body.user_code !== "string" || !consent) throw new HttpError(400, "user_code and c1/c2/c3 required");
    if (!consent.c1) throw new HttpError(422, "upload consent (C1) is required to link the launcher", "NO_CONSENT");
    if (!(await approveDeviceAuth(body.user_code, user.id))) throw new HttpError(404, "code not found or expired", "BAD_CODE");
    await setConsent(user.id, consent, "device-approve");
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
