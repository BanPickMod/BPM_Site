import test from "node:test";
import assert from "node:assert/strict";
import { cleanPage, coarseUserAgent, operatorNotice } from "./feedbackClean.ts";

const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.92 Safari/537.36";
const EDGE = CHROME_WIN + " Edg/130.0.2849.56";
const FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0";
const SAFARI_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

test("the user agent shrinks to browser, major version, system and mobile", () => {
  assert.equal(coarseUserAgent(CHROME_WIN), "Chrome 130 \u00b7 Windows");
  assert.equal(coarseUserAgent(EDGE), "Edge 130 \u00b7 Windows");
  assert.equal(coarseUserAgent(FIREFOX), "Firefox 132 \u00b7 Windows");
  assert.equal(coarseUserAgent(SAFARI_IOS), "Safari 17 \u00b7 iOS \u00b7 mobile");
  assert.equal(coarseUserAgent(ANDROID), "Chrome 130 \u00b7 Android \u00b7 mobile");
});

test("nothing that fingerprints a browser survives: no minor version, build or device model", () => {
  for (const ua of [CHROME_WIN, SAFARI_IOS, ANDROID, FIREFOX]) {
    const out = coarseUserAgent(ua)!;
    assert.ok(out.length < 40, out);
    assert.doesNotMatch(out, /\d+\.\d+|Pixel|Build|rv:|605\.1|537\.36/);
  }
});

test("an empty or unknown user agent gives null or 'other'", () => {
  assert.equal(coarseUserAgent(null), null);
  assert.equal(coarseUserAgent(""), null);
  assert.equal(coarseUserAgent("curl/8.5.0"), "other");
});

test("cleanPage keeps the path only", () => {
  assert.equal(cleanPage("/ko/replay-analysis/mine/12"), "/ko/replay-analysis/mine/12");
  assert.equal(cleanPage("/ko/replay-analysis/shared?token=abc&x=1#frag"), "/ko/replay-analysis/shared");
  assert.equal(cleanPage("https://example.com/ko/guide?utm=1"), "/ko/guide");
  assert.equal(cleanPage("//evil.example/x"), null);
  assert.equal(cleanPage("javascript:alert(1)"), null);
  assert.equal(cleanPage("not a path"), null);
  assert.equal(cleanPage(42), null);
  assert.equal(cleanPage("/" + "a".repeat(500))!.length, 120);
});

test("the operator notice carries a kind and a number and nothing the sender wrote", () => {
  const text = operatorNotice("bug", 7, "https://bpm.example/");
  assert.equal(text, "[BPM] New Bug #7 https://bpm.example/ko/admin/feedback");
  assert.equal(operatorNotice("replay", 3, ""), "[BPM] New Replay report #3");
});
