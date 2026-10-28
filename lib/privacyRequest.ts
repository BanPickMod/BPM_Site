/**
 * Requests about a person's own data (docs/Privacy_Compliance_Additional_Plan.md, A10): to see it, correct it, delete it, stop its
 * processing, or object to the transfer abroad. They arrive on the site or by email and are kept as messages of kind
 * "privacy_request", so the time of receipt and the time of the answer are on record and an overdue one is visible.
 */
export const REQUEST_TYPES = ["access", "correction", "deletion", "restriction", "transfer_objection", "other"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_LABEL: Record<RequestType, [string, string]> = {
  access: ["열람", "See my data"],
  correction: ["정정", "Correct my data"],
  deletion: ["삭제", "Delete my data"],
  restriction: ["처리정지", "Stop processing"],
  transfer_objection: ["국외 이전 거부", "Object to transfer abroad"],
  other: ["기타", "Something else"],
};

export const MAX_DETAILS = 4000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface ParsedRequest { type: RequestType; details: string; contact: string | null }

/** Returns the cleaned request, or the reason it is refused. The contact is optional: without it the answer stays on the site. */
export function parseRequest(raw: unknown): { ok: true; value: ParsedRequest } | { ok: false; code: "BAD_TYPE" | "TOO_SHORT" | "BAD_CONTACT" } {
  const b = (raw ?? {}) as Record<string, unknown>;
  if (typeof b.type !== "string" || !(REQUEST_TYPES as readonly string[]).includes(b.type)) return { ok: false, code: "BAD_TYPE" };
  const details = typeof b.details === "string" ? b.details.trim().slice(0, MAX_DETAILS) : "";
  if (details.length < 5) return { ok: false, code: "TOO_SHORT" };
  let contact: string | null = null;
  if (typeof b.contact === "string" && b.contact.trim()) {
    contact = b.contact.trim();
    if (contact.length > 120 || !EMAIL.test(contact)) return { ok: false, code: "BAD_CONTACT" };
  }
  return { ok: true, value: { type: b.type as RequestType, details, contact } };
}

/** The date by which an answer is due. The number of days is an operator decision (PRIVACY_REQUEST_DAYS). */
export function dueAt(createdAt: Date | string, days: number): Date {
  return new Date(new Date(createdAt).getTime() + days * 86400_000);
}

export const isOverdue = (createdAt: Date | string, days: number, status: string, now: Date = new Date()) => status === "OPEN" && dueAt(createdAt, days) < now;
