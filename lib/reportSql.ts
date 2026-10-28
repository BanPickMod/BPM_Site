import { PUBLIC_WHERE } from "./publicWhere.ts";

/**
 * A report that takes a replay off the public pages, as ONE statement (docs/Privacy_Compliance_Additional_Plan.md, section 3.2).
 * Postgres runs a single statement as a unit: the report row and the hiding both happen, or neither does. Doing them as two
 * statements left two bad endings, a report in the inbox while the replay stayed public, or a replay hidden with no report for
 * the operator to decide on. The report is written only if the replay is still public at that moment, so two reports arriving
 * together hide it once and the later one learns it is already gone (no row, `id` null): the report is written only when this
 * statement's own update really hid the replay, which Postgres decides after waiting for the other statement to commit.
 *
 * Parameters: $1 kind, $2 replay id, $3 reason (also the hidden_reason), $4 title, $5 body, $6 page, $7 user agent, $8 user id.
 * Returns one row: the new feedback id (null when the replay was not public) and how many replays were hidden.
 */
export const REPORT_AND_HIDE_SQL = `
  with hidden as (
    update user_replay set hidden_at = coalesce(hidden_at, now()), hidden_reason = $3::text
    where id = $2::int and ${PUBLIC_WHERE}
    returning id
  ), ins as (
    insert into feedback (kind, replay_id, reason, title, body, page, user_agent, user_id)
    select $1::text, $2::int, $3::text, $4::text, $5::text, $6::text, $7::text, $8::int
    where exists (select 1 from hidden)
    returning id
  )
  select (select id from ins) as id, (select count(*) from hidden)::int as hidden`;
