/**
 * Removes the metadata a screenshot can carry (camera/GPS EXIF, XMP, text chunks, timestamps) without decoding the pixels.
 * Pure byte handling, no dependencies; returns null for a file that is not a well-formed PNG, JPEG or WebP, so the caller can refuse it.
 * The feedback form also re-encodes redacted screenshots in the browser (which drops metadata too); this is the server's own guarantee.
 */
export type ImageExt = "png" | "jpg" | "webp";

const cat = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const ascii = (d: Uint8Array, at: number, n: number) => String.fromCharCode(...d.subarray(at, at + n));
const u32be = (d: Uint8Array, at: number) => ((d[at] << 24) | (d[at + 1] << 16) | (d[at + 2] << 8) | d[at + 3]) >>> 0;
const u32le = (d: Uint8Array, at: number) => (d[at] | (d[at + 1] << 8) | (d[at + 2] << 16) | (d[at + 3] << 24)) >>> 0;

const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);

function cleanPng(d: Uint8Array): Uint8Array | null {
  const out: Uint8Array[] = [d.subarray(0, 8)];
  let p = 8, sawEnd = false;
  while (p + 12 <= d.length) {
    const len = u32be(d, p), type = ascii(d, p + 4, 4), end = p + 12 + len;
    if (end > d.length) return null;
    if (!PNG_DROP.has(type)) out.push(d.subarray(p, end));
    p = end;
    if (type === "IEND") { sawEnd = true; break; }
  }
  return sawEnd ? cat(out) : null;
}

/** Kept: APP0 (JFIF), APP2 (ICC colour profile), APP14 (Adobe colour transform). Dropped: EXIF/XMP (APP1), APP3-13/15, comments. */
const JPEG_KEEP = new Set([0xe0, 0xe2, 0xee]);

function cleanJpeg(d: Uint8Array): Uint8Array | null {
  if (d[0] !== 0xff || d[1] !== 0xd8) return null;
  const out: Uint8Array[] = [d.subarray(0, 2)];
  let p = 2;
  while (p < d.length) {
    if (d[p] !== 0xff) return null;
    let m = d[p + 1];
    while (m === 0xff) { p++; m = d[p + 1]; }                   // fill bytes
    if (m === 0xd9) { out.push(d.subarray(p, p + 2)); return cat(out); }
    if (m === 0xda) { out.push(d.subarray(p)); return cat(out); } // entropy-coded data to the end, copied untouched
    if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) { out.push(d.subarray(p, p + 2)); p += 2; continue; }
    if (p + 4 > d.length) return null;
    const len = (d[p + 2] << 8) | d[p + 3], end = p + 2 + len;
    if (len < 2 || end > d.length) return null;
    const isApp = m >= 0xe0 && m <= 0xef;
    if ((isApp && !JPEG_KEEP.has(m)) || m === 0xfe) { p = end; continue; }
    out.push(d.subarray(p, end));
    p = end;
  }
  return null;
}

function cleanWebp(d: Uint8Array): Uint8Array | null {
  if (ascii(d, 0, 4) !== "RIFF" || ascii(d, 8, 4) !== "WEBP") return null;
  const chunks: Uint8Array[] = [];
  let p = 12;
  while (p + 8 <= d.length) {
    const type = ascii(d, p, 4), size = u32le(d, p + 4), padded = size + (size & 1), end = p + 8 + padded;
    if (end > d.length + 1) return null;
    if (type !== "EXIF" && type !== "XMP ") {
      const chunk = d.slice(p, Math.min(end, d.length));
      if (type === "VP8X" && chunk.length >= 9) chunk[8] &= ~0x0c;   // clear the "has EXIF / has XMP" flags
      chunks.push(chunk);
    }
    p = end;
  }
  const body = cat(chunks);
  const head = new Uint8Array(12);
  head.set(d.subarray(0, 4), 0);
  const total = body.length + 4;
  head[4] = total & 0xff; head[5] = (total >> 8) & 0xff; head[6] = (total >> 16) & 0xff; head[7] = (total >>> 24) & 0xff;
  head.set(d.subarray(8, 12), 8);
  return cat([head, body]);
}

export function stripMetadata(data: Uint8Array, ext: ImageExt): Uint8Array | null {
  try {
    return ext === "png" ? cleanPng(data) : ext === "jpg" ? cleanJpeg(data) : cleanWebp(data);
  } catch {
    return null;
  }
}
