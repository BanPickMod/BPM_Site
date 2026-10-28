import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

/**
 * Keys and short-lived identifiers derived from the one deployment secret (docs/Privacy_Compliance_Additional_Plan.md, A6 and
 * section 3.4). One secret used directly for everything means a leak of any use is a leak of all of them, so every purpose
 * gets its own key (HKDF), and anything we must compare without storing (an IP address) is hashed with a key that changes
 * every hour: a stored value cannot be linked to the next hour's, nor to anyone, once its hour is over.
 */
export type KeyPurpose = "session" | "reporter";

const SALT = Buffer.from("bpm-keys-v1");
const cache = new Map<string, Buffer>();

export function deriveKey(master: string, purpose: KeyPurpose): Buffer {
  const id = `${purpose}:${master}`;
  let k = cache.get(id);
  if (!k) {
    k = Buffer.from(hkdfSync("sha256", master, SALT, purpose, 32));
    cache.set(id, k);
  }
  return k;
}

const HOUR_MS = 3600_000;

export interface RateKey {
  /** What is stored next to a counter. Meaningless outside its hour. */
  key: string;
  /** When the counter can go: the end of the next hour (the one after the key's hour, so a boundary race never reads a stale row). */
  expiresAt: Date;
}

/**
 * A keyed hash of `label:value` for the hour that contains `nowMs`. The same value in the same hour gives the same key (that is
 * the rate limit); in another hour it gives an unrelated one. Between two hours the limit starts over, so a sender can use up
 * to twice the limit around the boundary: accepted, in exchange for nothing linking a sender across hours.
 */
export function hourlyRateKey(master: string, label: string, value: string, nowMs: number): RateKey {
  const hour = Math.floor(nowMs / HOUR_MS);
  const hourKey = createHmac("sha256", deriveKey(master, "reporter")).update(`hour:${hour}`).digest();
  const key = createHmac("sha256", hourKey).update(`${label}:${value}`).digest("hex").slice(0, 32);
  return { key, expiresAt: new Date((hour + 2) * HOUR_MS) };
}

const b64u = (b: Buffer) => b.toString("base64url");

/** Cookie value: base64url("userId.expiryMs.version").hmac. `version` is the account's session_version: raising it ends every session. */
export function signSessionValue(master: string, userId: number, expMs: number, version: number): string {
  const body = b64u(Buffer.from(`${userId}.${expMs}.${version}`));
  return `${body}.${b64u(createHmac("sha256", deriveKey(master, "session")).update(body).digest())}`;
}

export function readSessionValue(master: string, value: string | undefined | null, nowMs: number): { id: number; version: number } | null {
  if (!value) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", deriveKey(master, "session")).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const [id, exp, version] = Buffer.from(body, "base64url").toString().split(".").map(Number);
  return Number.isInteger(id) && Number.isInteger(version) && exp > nowMs ? { id, version } : null;
}
