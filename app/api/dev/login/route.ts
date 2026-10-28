import { errorResponse, HttpError } from "@/lib/server/http";
import { requireSameOrigin, sessionCookie, signSession, upsertUser } from "@/lib/server/auth";
import { markOnboarded } from "@/lib/server/onboarding";

/**
 * Development-only sign-in so the upload flow can be built and tested before Battle.net OAuth exists.
 * Enabled only with BPM_DEV_LOGIN=1 and never in production. The real provider will create the same app_user rows.
 */
export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === "production" || process.env.BPM_DEV_LOGIN !== "1") throw new HttpError(404, "not found");
    requireSameOrigin(req);
    const body = (await req.json().catch(() => ({}))) as { name?: unknown; age14?: unknown; onboarding?: unknown };
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
    if (!name) throw new HttpError(400, "name required");
    if (body.age14 !== true) throw new HttpError(422, "age confirmation required", "AGE_REQUIRED");
    const user = await upsertUser("dev", name.toLowerCase(), name, true);
    // Development convenience: the first-sign-in steps are done for you unless a test asks to see them (`onboarding: "pending"`).
    if (body.onboarding !== "pending") await markOnboarded(user.id);
    const s = signSession(user.id, user.sessionVersion);
    return Response.json({ id: user.id, displayName: user.displayName, ageConfirmed: user.ageConfirmed, onboarded: body.onboarding !== "pending" || user.onboarded }, { headers: { "set-cookie": sessionCookie(s.value, s.maxAge) } });
  } catch (e) {
    return errorResponse(e);
  }
}
