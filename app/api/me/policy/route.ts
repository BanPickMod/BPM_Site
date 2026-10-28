import { errorResponse, HttpError } from "@/lib/server/http";
import { cookieFromHeader, requireSameOrigin, SESSION_COOKIE, sessionUser } from "@/lib/server/auth";
import { acknowledgePolicy } from "@/lib/server/onboarding";

/** "I have read the changes" for a signed-in browser. Clears the banner; a consent switched off for a changed text stays off. */
export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await sessionUser(cookieFromHeader(req.headers.get("cookie"), SESSION_COOKIE));
    if (!user) throw new HttpError(401, "not signed in", "NO_SESSION");
    if (!user.onboarded) throw new HttpError(409, "finish the first sign-in steps first", "ONBOARDING_REQUIRED");
    await acknowledgePolicy(user);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
