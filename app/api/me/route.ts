import { errorResponse, HttpError } from "@/lib/server/http";
import { cookieFromHeader, requireSameOrigin, requireUser, SESSION_COOKIE, sessionCookie, sessionUser } from "@/lib/server/auth";
import { getConsent } from "@/lib/server/consent";
import { accountNotices } from "@/lib/server/onboarding";
import { deleteAccount } from "@/lib/server/account";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    return Response.json({ id: user.id, displayName: user.displayName, onboarded: user.onboarded, notices: accountNotices(user), consent: await getConsent(user.id) });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * Withdrawal. Browser session only: a stolen or forgotten launcher token must not be able to remove the account.
 * The body must say {"confirm":"DELETE"} so a stray request cannot do it.
 */
export async function DELETE(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await sessionUser(cookieFromHeader(req.headers.get("cookie"), SESSION_COOKIE));
    if (!user) throw new HttpError(401, "not signed in", "NO_SESSION");
    const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
    if (body?.confirm !== "DELETE") throw new HttpError(400, 'send {"confirm":"DELETE"}', "NOT_CONFIRMED");
    const { filesPending } = await deleteAccount(user.id);
    return new Response(JSON.stringify({ ok: true, filesPending }), {
      headers: { "content-type": "application/json", "set-cookie": sessionCookie("", 0) },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
