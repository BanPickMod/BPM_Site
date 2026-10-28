/**
 * What the inbox keeps about where a message came from (docs/Privacy_Compliance_Additional_Plan.md, A4). A raw user-agent
 * string (hundreds of characters of build numbers and plug-ins) and a full page address with its query are fingerprints, and
 * support does not need them. The browser family with its major version, the system family and the page path are enough to
 * reproduce a bug.
 */

const BROWSERS: [RegExp, string][] = [
  [/\bEdg(?:e|A|iOS)?\/(\d+)/, "Edge"],
  [/\bOPR\/(\d+)/, "Opera"],
  [/\bSamsungBrowser\/(\d+)/, "Samsung Internet"],
  [/\b(?:Chrome|CriOS)\/(\d+)/, "Chrome"],
  [/\b(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
  [/\bVersion\/(\d+)[^]*\bSafari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/Windows NT/, "Windows"],
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux|X11/, "Linux"],
];

/** "Chrome 130 · Windows", "Safari 17 · iOS · mobile", or "other". Never more than that. */
export function coarseUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  let browser = "";
  for (const [re, name] of BROWSERS) {
    const m = ua.match(re);
    if (m) { browser = `${name} ${m[1]}`; break; }
  }
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1] ?? "";
  const mobile = /Mobile|Android|iPhone|iPad/.test(ua) ? "mobile" : "";
  const parts = [browser, system, mobile].filter(Boolean);
  return parts.length ? parts.join(" \u00b7 ") : "other";
}

/** The path of the page a message was sent from: no host, query or fragment. Anything that is not a site path is dropped. */
export function cleanPage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    try { s = new URL(s).pathname; } catch { return null; }
  }
  s = s.replace(/[?#].*$/, "");
  return s.startsWith("/") && !s.startsWith("//") ? s.slice(0, 120) : null;
}

/** The text sent to the operator's chat webhook: a kind and a number, nothing the sender wrote. */
export function operatorNotice(kind: "bug" | "idea" | "replay" | "privacy_request", id: number, site: string): string {
  const label = kind === "bug" ? "Bug" : kind === "idea" ? "Idea" : kind === "privacy_request" ? "Privacy request" : "Replay report";
  return `[BPM] New ${label} #${id}${site ? ` ${site.replace(/\/$/, "")}/ko/admin/feedback` : ""}`;
}
