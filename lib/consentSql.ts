/**
 * The statements that change a consent (docs/Privacy_Compliance_Additional_Plan.md, sections 3.6 and 3.7 follow-ups). Each is ONE
 * statement, so the consent row, its log line and the effect on the user's stored replays happen together or not at all. In one
 * statement two data-modifying CTEs that touch the same row apply only ONE of them, so the replay flags (c2_at_upload and
 * c3_at_upload) are changed by a single update, never by one CTE per flag.
 */

/** Apply a policy change that asks consents again. $1 user, $2..$4 which of c1..c3 to switch off, $5 pending text, $6 new consent version,
 *  $7 the version the row must still have (only one reader wins), $8 policy version, $9 whether anything is switched off (then log it). */
export const APPLY_CONSENT_VERSION_SQL = `with c as (
       update consent set c1 = c1 and not $2::boolean, c2 = c2 and not $3::boolean, c3 = c3 and not $4::boolean,
              reconsent_pending = $5, consent_version = $6, updated_at = now()
       where user_id = $1 and consent_version is not distinct from $7 returning user_id, c1, c2, c3
     ), lg as (
       insert into consent_log (user_id, c1, c2, c3, policy_version, consent_version, source)
       select user_id, c1, c2, c3, $8, $6, 'policy-change' from c where $9::boolean returning 1
     ), flags as (
       -- ONE update for both flags: two data-modifying CTEs that touch the same row in one statement apply only one of them
       update user_replay set c2_at_upload = c2_at_upload and not $3::boolean, c3_at_upload = c3_at_upload and not $4::boolean
       where user_id = $1 and ($3::boolean or $4::boolean) and exists (select 1 from c) returning 1
     )
     select c1, c2, c3 from c`;

/** Set a consent. $1 user, $2..$4 c1..c3, $5 policy version, $6 consent version, $7 pending text, $8 source. A withdrawal clears the
 *  flag on every stored replay; a grant never opens one. */
export const SET_CONSENT_SQL = `with up as (
       insert into consent (user_id, c1, c2, c3, policy_version, consent_version, reconsent_pending) values ($1,$2::boolean,$3::boolean,$4::boolean,$5,$6,$7)
       on conflict (user_id) do update set c1=excluded.c1, c2=excluded.c2, c3=excluded.c3,
         policy_version=excluded.policy_version, consent_version=excluded.consent_version, reconsent_pending=excluded.reconsent_pending, updated_at=now()
       returning 1
     ), lg as (
       insert into consent_log (user_id, c1, c2, c3, policy_version, consent_version, source) values ($1,$2::boolean,$3::boolean,$4::boolean,$5,$6,$8) returning 1
     ), withdrawn as (
       -- ONE update for both flags: two data-modifying CTEs that touch the same row in one statement apply only one of them
       update user_replay set c2_at_upload = c2_at_upload and $3::boolean, c3_at_upload = c3_at_upload and $4::boolean
       where user_id = $1 and (not $3::boolean or not $4::boolean) returning 1
     )
     select (select count(*) from up)::int as n`;
