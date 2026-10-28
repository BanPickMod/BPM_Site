/**
 * Accounts nobody has used for a long time (docs/Privacy_Compliance_Additional_Plan.md, retention table). Activity is a sign-in, a
 * browser session in use, or an upload through a linked launcher; `app_user.last_active_at` records it at most once a day.
 *
 * Two steps, so a returning user is never caught by surprise:
 *   1. NOTICE: an account idle for INACTIVE_ACCOUNT_DAYS is marked (inactive_notice_at). We hold no e-mail address, so the notice
 *      cannot be sent to the person: it is the privacy policy plus this grace period, in which any activity clears the mark.
 *   2. DUE: an account still idle INACTIVE_GRACE_DAYS after being marked is deleted with the same statement as a withdrawal.
 * Plain SQL in its own file so a test can run it against an in-memory database.
 */

/** $1 idle days. Marks the accounts that just became idle and returns them. */
export const MARK_INACTIVE_SQL = `
  update app_user set inactive_notice_at = now()
  where deleted_at is null and inactive_notice_at is null and last_active_at < now() - ($1 || ' days')::interval
  returning id`;

/** $1 idle days, $2 grace days. Accounts that were marked, stayed idle and whose grace period is over. */
export const DUE_INACTIVE_SQL = `
  select id from app_user
  where deleted_at is null and inactive_notice_at is not null
    and inactive_notice_at < now() - ($2 || ' days')::interval
    and last_active_at < now() - ($1 || ' days')::interval
  order by id limit 200`;

/** $1 account. Counts as activity at most once a day, and lifts a deletion mark. */
export const TOUCH_ACTIVE_SQL = `
  update app_user set last_active_at = now(), inactive_notice_at = null
  where id = $1 and deleted_at is null and (last_active_at < now() - interval '1 day' or inactive_notice_at is not null)`;
