import { confirmAge, cookieFromHeader, requireSameOrigin, SESSION_COOKIE, sessionUser } from "@/lib/server/auth";
import { errorResponse, HttpError } from "@/lib/server/http";

/** Existing accounts created before the age gate can record the same 14+ self-declaration here. */
export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await sessionUser(cookieFromHeader(req.headers.get("cookie"), SESSION_COOKIE));
    if (!user) throw new HttpError(401, "not signed in", "NO_SESSION");
    const body = (await req.json().catch(() => null)) as { age14?: unknown } | null;
    if (body?.age14 !== true) throw new HttpError(422, "age confirmation required", "AGE_REQUIRED");
    await confirmAge(user.id);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
