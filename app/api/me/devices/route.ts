import { errorResponse } from "@/lib/server/http";
import { requireSameOrigin, requireUser, revokeAllTokens } from "@/lib/server/auth";
import { listDevices } from "@/lib/server/account";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    return Response.json({ devices: await listDevices(user.id) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Sign every launcher out. They show "link again" the next time they try to upload. */
export async function DELETE(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireUser(req);
    await revokeAllTokens(user.id);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
