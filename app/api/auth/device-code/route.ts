import { errorResponse } from "@/lib/server/http";
import { startDeviceAuth } from "@/lib/server/auth";

/** Launcher step 1: get a code to show the user and a secret device code to poll with. */
export async function POST(req: Request) {
  try {
    const d = await startDeviceAuth();
    const origin = process.env.SITE_URL?.replace(/\/$/, "") ?? new URL(req.url).origin;
    return Response.json({
      device_code: d.deviceCode,
      user_code: d.userCode,
      verification_uri: `${origin}/device`,
      verification_uri_complete: `${origin}/device?code=${d.userCode}`,
      expires_in: d.expiresIn,
      interval: d.interval,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
