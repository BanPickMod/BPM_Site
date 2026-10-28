import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238, SHA-1, 6 digits, 30 seconds), the kind every authenticator app understands. Used as the
 * second factor for operators (lib/server/admin.ts). Kept free of server-only imports so the operator scripts can use it too.
 */
export const STEP_SECONDS = 30;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Spaces, dashes, lower case and `=` padding are accepted (apps show secrets in groups). Anything else gives null. */
export function base32Decode(text: string): Buffer | null {
  const s = text.replace(/[\s-]/g, "").replace(/=+$/, "").toUpperCase();
  if (!s) return null;
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of s) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) return null;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160 random bits, the size authenticator apps expect. */
export const newSecret = () => base32Encode(randomBytes(20));

/** The 6 digits for one 30-second counter (RFC 4226 dynamic truncation). */
export function codeAt(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", secret).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

export const counterAt = (nowMs: number) => Math.floor(nowMs / 1000 / STEP_SECONDS);

/** The code an operator would read from the app right now. */
export function currentCode(secretBase32: string, nowMs = Date.now()): string {
  const secret = base32Decode(secretBase32);
  if (!secret) throw new Error("not a base32 secret");
  return codeAt(secret, counterAt(nowMs));
}

/**
 * The counter that `code` matches, or null. One step either side is accepted for clock drift (about 30 s each way). The caller
 * remembers the returned counter and refuses it a second time, so a code that was seen once cannot be used again.
 */
export function verifyTotp(secretBase32: string, code: string, nowMs: number, window = 1): number | null {
  const secret = base32Decode(secretBase32);
  const given = code.replace(/\s/g, "");
  if (!secret || !/^\d{6}$/.test(given)) return null;
  const now = counterAt(nowMs);
  let hit: number | null = null;
  for (let c = now - window; c <= now + window; c++) {
    const want = Buffer.from(codeAt(secret, c));
    if (timingSafeEqual(want, Buffer.from(given)) && hit === null) hit = c;     // every step is compared: timing says nothing
  }
  return hit;
}

/** The link an authenticator app imports (shown as text or a QR code). */
export function otpauthUrl(account: string, secretBase32: string, issuer = "BPM Admin"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}
