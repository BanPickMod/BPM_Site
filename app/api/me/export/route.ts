import { errorResponse } from "@/lib/server/http";
import { requireUser } from "@/lib/server/auth";
import { exportAccount } from "@/lib/server/account";

/** Download of everything stored about the signed-in user (not the replay files). */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    return new Response(JSON.stringify(await exportAccount(user.id), null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": 'attachment; filename="bpm-my-data.json"',
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
