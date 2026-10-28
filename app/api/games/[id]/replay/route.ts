import { errorResponse } from "@/lib/server/admin";
import { HttpError } from "@/lib/server/games";
import { getReplayKey } from "@/lib/server/queries";
import { getObject } from "@/lib/server/storage";

/**
 * Public download, only for published AI event games (no human players, so no personal data).
 * User-uploaded replays (Phase 1) are never served by this route: their source is not AI_EVENT.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/games/[id]/replay">) {
  try {
    const id = Number((await ctx.params).id);
    if (!Number.isInteger(id)) throw new HttpError(400, "bad id");
    const found = await getReplayKey(id);
    if (!found) throw new HttpError(404, "not found");
    const obj = await getObject(found.key);
    if (!obj) throw new HttpError(404, "not found");

    const g = found.game;
    const name = `BPM-${g.event_slug}-${g.matchup}-R${g.round}-G${g.game_no}-${g.id}.SC2Replay`;
    return new Response(obj.body, {
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(found.size),
        "content-disposition": `attachment; filename="${name}"`,
        "cache-control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
