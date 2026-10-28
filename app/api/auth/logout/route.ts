import { errorResponse } from "@/lib/server/http";
import { cookieFromHeader, requireSameOrigin, revokeSessions, SESSION_COOKIE, sessionCookie, sessionUser } from "@/lib/server/auth";

/**
 * Ends the browser session. With `{ "everywhere": true }` it ends every browser session of the account (all of them carry
 * the old session version), for a lost or shared computer. Launchers keep their own tokens (revoke them from the account page).
 */
export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const body = (await req.json().catch(() => null)) as { everywhere?: unknown } | null;
    if (body?.everywhere === true) {
      const user = await sessionUser(cookieFromHeader(req.headers.get("cookie"), SESSION_COOKIE));
      if (user) await revokeSessions(user.id);
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json", "set-cookie": sessionCookie("", 0) },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
