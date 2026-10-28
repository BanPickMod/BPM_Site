import { errorResponse, HttpError } from "@/lib/server/http";
import { cookieFromHeader, requireSameOrigin, SESSION_COOKIE, sessionUser } from "@/lib/server/auth";
import { parseConsentBody } from "@/lib/server/consent";
import { completeOnboarding } from "@/lib/server/onboarding";

/**
 * Finish the first sign-in steps (browser session only). Body: { c1, c2, c3 } as chosen on the page; all false is a valid answer.
 * Safe to repeat: a finished account keeps its first completion time and just records the consent again.
 */
export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await sessionUser(cookieFromHeader(req.headers.get("cookie"), SESSION_COOKIE));
    if (!user) throw new HttpError(401, "not signed in", "NO_SESSION");
    const consent = parseConsentBody(await req.json().catch(() => null));
    if (!consent) throw new HttpError(400, "c1, c2 and c3 booleans required");
    await completeOnboarding(user, consent);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
