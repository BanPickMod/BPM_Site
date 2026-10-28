/**
 * Bearer value for scripts that call operator routes. With ADMIN_TOTP_SECRET set it signs in (token + current one-time code) and
 * returns the short session; without it the token is used as it is, which only works where two-factor is off (local tests).
 */
import { currentCode } from "../../lib/totp.ts";

export async function adminBearer(base, token, totpSecret = process.env.ADMIN_TOTP_SECRET ?? "") {
  if (!totpSecret) return token;
  const res = await fetch(`${base}/api/admin/login`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ otp: currentCode(totpSecret) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.session) throw new Error(`operator sign-in failed: ${res.status} ${body.code ?? body.error ?? ""}`);
  return body.session;
}
