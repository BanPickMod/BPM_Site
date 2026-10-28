/**
 * Versions of what users were told and agreed to (docs/Privacy_Compliance_Additional_Plan.md, section 3.6).
 *
 * Two kinds of change, handled differently:
 *   - "notice": wording, contact, typo, a clearer explanation. Users are told with a banner they can dismiss. Nothing stops.
 *   - "consent": the purpose, the data items or the retention of C1, C2 or C3 changed in a way the earlier agreement did not cover.
 *     Only the consents named in `affects` are asked again, and until the user answers they are OFF (the same as a withdrawal:
 *     the changed processing never runs on an agreement that did not describe it).
 *
 * Add an entry at the END of POLICY_CHANGELOG whenever the privacy policy changes. POLICY_VERSION is the last entry; CONSENT_VERSION
 * is the last "consent" entry (or the first entry when there is none). A user's stored versions are compared with these.
 */
export type ConsentKey = "c1" | "c2" | "c3";

export interface PolicyChange {
  version: string;
  kind: "notice" | "consent";
  /** The consents that must be asked again (only for kind "consent"). */
  affects: ConsentKey[];
  ko: string;
  en: string;
}

export const POLICY_CHANGELOG: PolicyChange[] = [
  { version: "2026-10-28-draft", kind: "notice", affects: [], ko: "개인정보 처리방침 최초 초안", en: "First draft of the Privacy Policy" },
  { version: "2026-10-29", kind: "notice", affects: [], ko: "운영자 정보·문의처·처리 위탁 지역을 확정하고 초안 표시를 제거", en: "Operator, contact and processing region confirmed; draft label removed" },
  { version: "2026-10-29.2", kind: "notice", affects: [], ko: "운영자 접근에 2단계 인증을 적용", en: "Operator access now requires two-factor authentication" },
];

const KEYS: ConsentKey[] = ["c1", "c2", "c3"];

/**
 * The changelog in force. Outside production a JSON array in BPM_POLICY_CHANGELOG_JSON replaces it, so the re-consent flow can
 * be tested without editing the code. In production the compiled list is always used.
 */
export function activeChangelog(env: Record<string, string | undefined> = process.env): PolicyChange[] {
  const raw = env.BPM_POLICY_CHANGELOG_JSON;
  if (!raw || env.NODE_ENV === "production") return POLICY_CHANGELOG;
  try {
    const parsed = JSON.parse(raw) as PolicyChange[];
    return Array.isArray(parsed) && parsed.length ? parsed : POLICY_CHANGELOG;
  } catch {
    return POLICY_CHANGELOG;
  }
}

export const policyVersion = (log: PolicyChange[] = activeChangelog()) => log[log.length - 1].version;

export function consentVersion(log: PolicyChange[] = activeChangelog()): string {
  for (let i = log.length - 1; i >= 0; i--) if (log[i].kind === "consent") return log[i].version;
  return log[0].version;
}

/** The changes made after `version` (all of them when the version is unknown or empty: a user older than the list). */
export function changesSince(log: PolicyChange[], version: string | null | undefined): PolicyChange[] {
  const i = version ? log.findIndex((c) => c.version === version) : -1;
  return log.slice(i + 1);
}

/** The consents that a user agreed to at `version` and that a later "consent" change asks again. */
export function consentsAffectedSince(log: PolicyChange[], version: string | null | undefined): ConsentKey[] {
  const hit = new Set<ConsentKey>();
  for (const c of changesSince(log, version)) if (c.kind === "consent") for (const k of c.affects) hit.add(k);
  return KEYS.filter((k) => hit.has(k));
}

/** What the banner shows a user who last saw `seen`. */
export function noticesSince(log: PolicyChange[], seen: string | null | undefined): PolicyChange[] {
  return changesSince(log, seen);
}

export function parsePending(text: string | null | undefined): ConsentKey[] {
  const set = new Set((text ?? "").split(",").map((s) => s.trim()));
  return KEYS.filter((k) => set.has(k));
}

export const formatPending = (keys: ConsentKey[]) => KEYS.filter((k) => keys.includes(k)).join(",");
