import { logWarn } from "./log";
import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { HttpError } from "./http";

const AUTHORIZE_URL = "https://oauth.battle.net/authorize";
const TOKEN_URL = "https://oauth.battle.net/token";
const USERINFO_URL = "https://oauth.battle.net/userinfo";

export const BATTLE_NET_STATE_COOKIE = "bpm_bnet_state";
export const BATTLE_NET_STATE_MAX_AGE = 10 * 60;

interface BattleNetConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface BattleNetTokenResponse {
  access_token?: unknown;
}

interface BattleNetUserInfo {
  sub?: unknown;
  id?: unknown;
  battletag?: unknown;
}

function requiredEnv(name: "BATTLENET_CLIENT_ID" | "BATTLENET_CLIENT_SECRET" | "BATTLENET_REDIRECT_URI"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new HttpError(503, `${name} is not configured`);
  return value;
}

function config(): BattleNetConfig {
  return {
    clientId: requiredEnv("BATTLENET_CLIENT_ID"),
    clientSecret: requiredEnv("BATTLENET_CLIENT_SECRET"),
    redirectUri: requiredEnv("BATTLENET_REDIRECT_URI"),
  };
}

export function newBattleNetState(): string {
  return randomBytes(32).toString("base64url");
}

export function stateCookie(value: string, maxAge = BATTLE_NET_STATE_MAX_AGE): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${BATTLE_NET_STATE_COOKIE}=${value}; Path=/api/auth/battlenet; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function stateMatches(expected: string | undefined, actual: string | null): boolean {
  if (!expected || !actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function battleNetAuthorizeUrl(state: string, lang: "ko" | "en"): URL {
  const { clientId, redirectUri } = config();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid");
  url.searchParams.set("state", state);
  url.searchParams.set("locale", lang === "ko" ? "ko_KR" : "en_US");
  return url;
}

export async function exchangeBattleNetCode(code: string): Promise<string> {
  const { clientId, clientSecret, redirectUri } = config();
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  const authorization = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${authorization}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as BattleNetTokenResponse | null;
  if (!response.ok || typeof data?.access_token !== "string") {
    logWarn("Battle.net token exchange failed", response.status);
    throw new HttpError(502, "Battle.net token exchange failed", "BATTLENET_TOKEN_FAILED");
  }
  return data.access_token;
}

export async function fetchBattleNetUser(accessToken: string): Promise<{ subject: string; battleTag: string }> {
  const response = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as BattleNetUserInfo | null;
  const subject = typeof data?.sub === "string" ? data.sub : typeof data?.id === "number" || typeof data?.id === "string" ? String(data.id) : "";
  const battleTag = typeof data?.battletag === "string" ? data.battletag.trim() : "";
  if (!response.ok || !subject || !battleTag) {
    logWarn("Battle.net userinfo request failed", response.status);
    throw new HttpError(502, "Battle.net profile request failed", "BATTLENET_PROFILE_FAILED");
  }
  return { subject, battleTag: battleTag.slice(0, 40) };
}
