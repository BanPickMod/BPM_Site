import { errorResponse } from "@/lib/server/http";
import { pollDeviceAuth } from "@/lib/server/auth";

/** Launcher step 2: poll until the user approves. Answers follow RFC 8628 (authorization_pending, slow_down, expired_token). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { device_code?: unknown; label?: unknown };
    if (typeof body.device_code !== "string" || body.device_code.length < 20) return Response.json({ error: "invalid_request" }, { status: 400 });
    const label = typeof body.label === "string" ? body.label.slice(0, 60) : null;
    const r = await pollDeviceAuth(body.device_code, label);
    switch (r.status) {
      case "ok":
        return Response.json({ access_token: r.token, token_type: "Bearer" });
      case "pending":
        return Response.json({ error: "authorization_pending" }, { status: 400 });
      case "slow_down":
        return Response.json({ error: "slow_down" }, { status: 400 });
      case "expired":
        return Response.json({ error: "expired_token" }, { status: 400 });
      default:
        return Response.json({ error: "access_denied" }, { status: 400 });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
