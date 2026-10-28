import { errorResponse, requireAdmin } from "@/lib/server/admin";
import { HttpError, ingestGame, looksLikeReplay, MAX_REPLAY_BYTES } from "@/lib/server/games";
import { parseManifest } from "@/lib/server/manifest";
import { auditAdmin } from "@/lib/server/audit";

/**
 * Admin-only. multipart/form-data with:
 *   replay   - the .SC2Replay file
 *   manifest - JSON text (see docs/Colosseum_Ingest.md)
 * Idempotent per (event, seriesKey, gameNo): re-sending corrects an earlier upload.
 */
export async function POST(req: Request) {
  try {
    const op = requireAdmin(req, "owner");
    const form = await req.formData().catch(() => {
      throw new HttpError(400, "multipart/form-data expected");
    });
    const file = form.get("replay");
    const raw = form.get("manifest");
    if (!(file instanceof File) || typeof raw !== "string") throw new HttpError(400, "fields 'replay' (file) and 'manifest' (json) required");
    if (file.size > MAX_REPLAY_BYTES) throw new HttpError(413, "replay too large");

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "manifest is not valid JSON");
    }
    const parsed = parseManifest(json);
    if (!parsed.ok) return Response.json({ error: "invalid manifest", details: parsed.errors }, { status: 422 });

    const data = new Uint8Array(await file.arrayBuffer());
    if (!looksLikeReplay(data)) throw new HttpError(422, "file is not an SC2 replay");

    const result = await ingestGame(parsed.value, data);
    await auditAdmin(op, result.created ? "game.upload" : "game.replace", `game:${(result as { id?: number }).id ?? "?"}`, `event ${parsed.value.event}`);
    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (e) {
    return errorResponse(e);
  }
}
