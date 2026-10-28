import { errorResponse, HttpError } from "@/lib/server/http";
import { requireDeviceUser } from "@/lib/server/auth";
import { MAX_REPLAY_BYTES } from "@/lib/server/games";
import { acceptUpload } from "@/lib/server/userUploads";
import { getConsent } from "@/lib/server/consent";

/**
 * Launcher upload. multipart/form-data: `replay` (file), optional `sha256`, `clientVersion`, `visibility` ("private" keeps
 * this replay off the public pages and out of AI training whatever the account consent says).
 * 201 = stored and queued for analysis, 200 = this user already uploaded the same file.
 */
export async function POST(req: Request) {
  try {
    const user = await requireDeviceUser(req);
    // Same code as a missing consent: the launcher waits and retries, and the user finishes the first sign-in steps on the website.
    if (!user.onboarded) throw new HttpError(403, "finish the first sign-in steps on the website", "NO_CONSENT");
    // Refuse before reading the body, so a withdrawn account's data is not even received.
    if (!(await getConsent(user.id)).c1) throw new HttpError(403, "upload consent (C1) is not granted", "NO_CONSENT");
    const form = await req.formData().catch(() => {
      throw new HttpError(400, "multipart/form-data expected");
    });
    const file = form.get("replay");
    if (!(file instanceof File)) throw new HttpError(400, "field 'replay' (file) required");
    if (file.size > MAX_REPLAY_BYTES) throw new HttpError(413, "replay too large", "TOO_LARGE");
    const sha = form.get("sha256");
    const ver = form.get("clientVersion");
    const visibility = form.get("visibility") === "private" ? "private" : "default";
    const { row, created } = await acceptUpload(
      user.id,
      new Uint8Array(await file.arrayBuffer()),
      typeof sha === "string" ? sha : null,
      typeof ver === "string" ? ver.slice(0, 40) : null,
      visibility,
    );
    return Response.json({ id: row.id, status: row.status, rejectCode: row.reject_code, duplicate: !created }, { status: created ? 201 : 200 });
  } catch (e) {
    return errorResponse(e);
  }
}
