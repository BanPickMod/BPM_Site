import { logError } from "@/lib/server/log";
import { BATTLE_NET_STATE_COOKIE, exchangeBattleNetCode, fetchBattleNetUser, stateCookie, stateMatches } from "@/lib/server/battlenet";
import { cookieFromHeader, sessionCookie, signSession, upsertUser } from "@/lib/server/auth";

/** Behind the platform proxy req.url is the internal address (localhost:PORT), so redirects are built on SITE_URL. */
function siteBase(req: Request): string {
  return process.env.SITE_URL?.replace(/\/$/, "") ?? req.url;
}

function destination(req: Request, lang: "ko" | "en", error?: string): URL {
  const url = new URL(`/${lang}/replay-analysis/mine`, siteBase(req));
  if (error) url.searchParams.set("login_error", error);
  return url;
}

function redirect(url: URL): Response {
  return new Response(null, { status: 302, headers: { location: url.toString() } });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const saved = cookieFromHeader(req.headers.get("cookie"), BATTLE_NET_STATE_COOKIE);
  const [expectedState, savedLang, savedAge] = saved?.split(".") ?? [];
  const lang = savedLang === "en" ? "en" : "ko";

  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    const response = redirect(destination(req, lang, "access_denied"));
    response.headers.append("set-cookie", stateCookie("", 0));
    return response;
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || savedAge !== "14" || !stateMatches(expectedState, state)) {
    const response = redirect(destination(req, lang, "invalid_state"));
    response.headers.append("set-cookie", stateCookie("", 0));
    return response;
  }

  try {
    const accessToken = await exchangeBattleNetCode(code);
    const profile = await fetchBattleNetUser(accessToken);
    const user = await upsertUser("battlenet", profile.subject, profile.battleTag, true);
    const session = signSession(user.id, user.sessionVersion);
    const dest = user.onboarded ? destination(req, lang) : new URL(`/${lang}/onboarding?next=${encodeURIComponent(`/${lang}/replay-analysis/mine`)}`, siteBase(req));
    const response = redirect(dest);
    response.headers.append("set-cookie", stateCookie("", 0));
    response.headers.append("set-cookie", sessionCookie(session.value, session.maxAge));
    return response;
  } catch (e) {
    logError("Battle.net OAuth callback failed", e);
    const response = redirect(destination(req, lang, "callback_failed"));
    response.headers.append("set-cookie", stateCookie("", 0));
    return response;
  }
}
