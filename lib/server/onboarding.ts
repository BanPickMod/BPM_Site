import "server-only";
import { getDb } from "./db";
import { HttpError } from "./http";
import { POLICY_VERSION, type SessionUser } from "./auth";
import { keepPendingOff, setConsent } from "./consent";
import { activeChangelog, noticesSince, type PolicyChange } from "@/lib/policyVersions";

/**
 * First sign-in and policy changes (docs/Privacy_Compliance_Additional_Plan.md, sections 3.5 and 3.6).
 *
 * Onboarding: after the first Battle.net sign-in the user lands on a page that shows the basic processing notice and the three
 * optional consents, all off. Finishing with everything off is allowed: the steps are about being told and choosing, not about
 * agreeing. Completion is recorded with the policy and consent versions it was done on and the time (the consent itself goes to
 * consent_log with source "onboarding"). Until it is done the account cannot link a launcher or upload.
 */
export async function completeOnboarding(user: SessionUser, consent: { c1: boolean; c2: boolean; c3: boolean }): Promise<void> {
  if (!user.ageConfirmed) throw new HttpError(422, "age confirmation required", "AGE_REQUIRED");
  await setConsent(user.id, consent, "onboarding");
  const db = await getDb();
  await db.query(
    `update app_user set onboarding_completed_at = coalesce(onboarding_completed_at, now()),
            onboarding_policy_version = coalesce(onboarding_policy_version, $2), policy_seen_version = $2 where id = $1`,
    [user.id, POLICY_VERSION],
  );
}

/** Dev sign-in and tests: mark the steps done without a consent change. */
export async function markOnboarded(userId: number): Promise<void> {
  const db = await getDb();
  await db.query(
    `update app_user set onboarding_completed_at = coalesce(onboarding_completed_at, now()),
            onboarding_policy_version = coalesce(onboarding_policy_version, $2), policy_seen_version = coalesce(policy_seen_version, $2) where id = $1`,
    [userId, POLICY_VERSION],
  );
}

export interface AccountNotice { version: string; kind: PolicyChange["kind"]; affects: PolicyChange["affects"]; ko: string; en: string }

/** Changes to the policy since the version this user last saw. Empty for a user who has not finished onboarding (they see the current text there). */
export function accountNotices(user: SessionUser): AccountNotice[] {
  if (!user.onboarded) return [];
  return noticesSince(activeChangelog(), user.policySeenVersion).map(({ version, kind, affects, ko, en }) => ({ version, kind, affects, ko, en }));
}

/**
 * The user has read the changes. Notice-level changes are done with this. A consent that was switched off for a changed text stays
 * off: reading is not agreeing. Each acknowledgement is recorded with the versions it moved between.
 */
export async function acknowledgePolicy(user: SessionUser): Promise<void> {
  const db = await getDb();
  await keepPendingOff(user.id);
  await db.query("insert into policy_ack (user_id, from_version, to_version, kind) values ($1,$2,$3,'seen')", [user.id, user.policySeenVersion, POLICY_VERSION]);
  await db.query("update app_user set policy_seen_version = $2 where id = $1", [user.id, POLICY_VERSION]);
}
