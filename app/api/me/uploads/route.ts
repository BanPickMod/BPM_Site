import { errorResponse, HttpError } from "@/lib/server/http";
import { requireSameOrigin, requireUser } from "@/lib/server/auth";
import { listUploads, publishStoredUploads } from "@/lib/server/userUploads";
import { deleteAllUploads } from "@/lib/server/account";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    return Response.json({ uploads: await listUploads(user.id) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Delete every replay (files and analyses) and keep the account. */
export async function DELETE(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireUser(req);
    return Response.json({ ok: true, deleted: await deleteAllUploads(user.id) });
  } catch (e) {
    return errorResponse(e);
  }
}

/** `{ public: true }`: open every earlier replay that is not public and not marked private (needs C2 on). */
export async function PATCH(req: Request) {
  try {
    requireSameOrigin(req);
    const user = await requireUser(req);
    const b = (await req.json().catch(() => null)) as { public?: unknown } | null;
    if (b?.public !== true) throw new HttpError(400, "only { public: true } is supported");
    return Response.json({ ok: true, published: await publishStoredUploads(user.id) });
  } catch (e) {
    return errorResponse(e);
  }
}
