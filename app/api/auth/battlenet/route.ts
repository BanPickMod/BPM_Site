import { battleNetAuthorizeUrl, newBattleNetState, stateCookie } from "@/lib/server/battlenet";
import { errorResponse } from "@/lib/server/http";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lang = url.searchParams.get("lang") === "en" ? "en" : "ko";
    if (url.searchParams.get("age") !== "14") return Response.json({ error: "age confirmation required", code: "AGE_REQUIRED" }, { status: 422 });
    const state = newBattleNetState();
    const response = new Response(null, { status: 302, headers: { location: battleNetAuthorizeUrl(state, lang).toString() } });
    response.headers.append("set-cookie", stateCookie(`${state}.${lang}.14`));
    return response;
  } catch (e) {
    return errorResponse(e);
  }
}
