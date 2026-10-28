import { adminLogin, errorResponse } from "@/lib/server/admin";

/** Operator sign-in: the operator token as the bearer and the 6-digit authenticator code in the body; answers with a short session. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { otp?: unknown };
    const otp = typeof body.otp === "string" ? body.otp.slice(0, 12) : "";
    const { session, expiresAt, operator } = adminLogin(req, otp);
    return Response.json({ session, expiresAt, operator });
  } catch (e) {
    return errorResponse(e);
  }
}
