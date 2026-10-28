// node --test lib/replay/imageClean.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { stripMetadata } from "./imageClean.ts";

const b = (...a: number[]) => Uint8Array.from(a);
const cat = (...p: Uint8Array[]) => Uint8Array.from(p.flatMap((x) => [...x]));
const txt = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
const be32 = (n: number) => b((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const has = (d: Uint8Array, s: string) => Buffer.from(d).includes(Buffer.from(s));

const pngChunk = (type: string, data: Uint8Array) => cat(be32(data.length), txt(type), data, be32(0)); // crc is not checked here
const PNG_SIG = b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

test("png: text, exif and time chunks are dropped, image chunks stay", () => {
  const png = cat(PNG_SIG, pngChunk("IHDR", new Uint8Array(13)), pngChunk("tEXt", txt("Author\0someone")), pngChunk("eXIf", txt("GPS")), pngChunk("IDAT", b(1, 2, 3)), pngChunk("IEND", new Uint8Array(0)));
  const out = stripMetadata(png, "png")!;
  assert.ok(out && has(out, "IHDR") && has(out, "IDAT") && has(out, "IEND"));
  assert.ok(!has(out, "tEXt") && !has(out, "eXIf") && !has(out, "someone"));
});

test("png: a truncated chunk is refused", () => {
  const png = cat(PNG_SIG, pngChunk("IHDR", new Uint8Array(13)), b(0, 0, 1, 0, 0x49, 0x44, 0x41, 0x54, 1, 2));
  assert.equal(stripMetadata(png, "png"), null);
});

const seg = (m: number, body: Uint8Array) => cat(b(0xff, m, (body.length + 2) >> 8, (body.length + 2) & 255), body);

test("jpeg: exif, xmp and comments are dropped; jfif and icc stay; scan data is untouched", () => {
  const scan = cat(b(0xff, 0xda, 0, 3, 1), b(0x12, 0xff, 0x00, 0x34), b(0xff, 0xd9));
  const jpg = cat(b(0xff, 0xd8), seg(0xe0, txt("JFIF\0")), seg(0xe1, txt("Exif\0\0GPSDATA")), seg(0xe2, txt("ICC_PROFILE\0")), seg(0xfe, txt("a comment")), seg(0xdb, b(0, 1, 2)), scan);
  const out = stripMetadata(jpg, "jpg")!;
  assert.ok(has(out, "JFIF") && has(out, "ICC_PROFILE"));
  assert.ok(!has(out, "GPSDATA") && !has(out, "a comment"));
  assert.deepEqual([...out.subarray(out.length - scan.length)], [...scan]);
});

test("jpeg: garbage between segments is refused", () => {
  assert.equal(stripMetadata(cat(b(0xff, 0xd8), b(0x12, 0x34)), "jpg"), null);
});

const wChunk = (type: string, data: Uint8Array) => {
  const len = data.length, c = cat(txt(type), b(len & 255, (len >> 8) & 255, 0, 0), data);
  return len & 1 ? cat(c, b(0)) : c;
};
const riff = (...chunks: Uint8Array[]) => {
  const body = cat(...chunks), n = body.length + 4;
  return cat(txt("RIFF"), b(n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255), txt("WEBP"), body);
};

test("webp: exif and xmp chunks are dropped, the riff size is rewritten and the vp8x flags cleared", () => {
  const vp8x = cat(b(0x1c, 0, 0, 0), new Uint8Array(6));          // flags: ICC | EXIF | XMP
  const webp = riff(wChunk("VP8X", vp8x), wChunk("EXIF", txt("GPSDATA")), wChunk("XMP ", txt("xmpdata")), wChunk("VP8 ", b(1, 2, 3, 4)));
  const out = stripMetadata(webp, "webp")!;
  assert.ok(!has(out, "GPSDATA") && !has(out, "xmpdata") && has(out, "VP8 "));
  const size = out[4] | (out[5] << 8) | (out[6] << 16);
  assert.equal(size, out.length - 8);
  assert.equal(out[20] & 0x0c, 0);                                 // first VP8X data byte: EXIF and XMP bits are off
  assert.equal(out[20] & 0x10, 0x10);                              // ICC bit kept
});

test("a file of the wrong type is refused", () => {
  assert.equal(stripMetadata(txt("not an image at all"), "png"), null);
  assert.equal(stripMetadata(txt("not an image at all"), "webp"), null);
});
