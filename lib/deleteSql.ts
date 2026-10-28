/**
 * Deleting an account's data without losing a file (docs/Privacy_Compliance_Additional_Plan.md, section 3.7).
 *
 * Rows and the stored files they point to live in two systems that cannot share a transaction. Deleting the files first and the
 * rows after leaves rows without files (or, when a file delete fails half way, an error and a half-deleted account); deleting
 * the rows first loses the file names, so the files stay forever. So each statement below does both halves of the database work
 * at once: it writes every file name into `storage_delete_queue` and deletes the rows, in ONE statement (all or nothing). The
 * files are then deleted from the queue, retried with a growing delay until the storage confirms, and a failure is visible
 * (lib/server/storageQueue.ts, the retention report). A file name is never dropped before its file is gone.
 */

/** Delete one account: queue every file, remove the account row (which cascades to consents, devices and replays), clean what stays. $1 = user id. */
export const DELETE_ACCOUNT_SQL = `
  with keys as (
    select storage_key as k from user_replay where user_id = $1::int and source_deleted_at is null
    union all select timeline_key from user_replay where user_id = $1::int and timeline_key is not null
    union all select ff.storage_key from feedback_file ff join feedback f on f.id = ff.feedback_id where f.user_id = $1::int and f.kind <> 'replay'
  ), queued as (
    insert into storage_delete_queue (storage_key) select k from keys on conflict do nothing returning 1
  ), own_messages as (
    delete from feedback where user_id = $1::int and kind <> 'replay' returning 1
  ), kept_reports as (
    update feedback set title = null, body = null, page = null, user_agent = null where user_id = $1::int and kind = 'replay' returning 1
  ), gone as (
    delete from app_user where id = $1::int returning id
  )
  select (select count(*) from gone)::int as deleted, (select count(*) from queued)::int as files_queued`;

/** Delete every replay of an account and keep the account. $1 = user id. */
export const DELETE_ALL_UPLOADS_SQL = `
  with keys as (
    select storage_key as k from user_replay where user_id = $1::int and source_deleted_at is null
    union all select timeline_key from user_replay where user_id = $1::int and timeline_key is not null
  ), queued as (
    insert into storage_delete_queue (storage_key) select k from keys on conflict do nothing returning 1
  ), gone as (
    delete from user_replay where user_id = $1::int returning id
  )
  select (select count(*) from gone)::int as deleted, (select count(*) from queued)::int as files_queued`;

/** Delete one replay of an account. $1 = replay id, $2 = user id. */
export const DELETE_UPLOAD_SQL = `
  with keys as (
    select storage_key as k from user_replay where id = $1::int and user_id = $2::int and source_deleted_at is null
    union all select timeline_key from user_replay where id = $1::int and user_id = $2::int and timeline_key is not null
  ), queued as (
    insert into storage_delete_queue (storage_key) select k from keys on conflict do nothing returning 1
  ), gone as (
    delete from user_replay where id = $1::int and user_id = $2::int returning id
  )
  select (select count(*) from gone)::int as deleted, (select count(*) from queued)::int as files_queued`;

/** Operator removes a replay after a takedown decision. $1 = replay id. */
export const REMOVE_REPLAY_SQL = `
  with keys as (
    select storage_key as k from user_replay where id = $1::int and source_deleted_at is null
    union all select timeline_key from user_replay where id = $1::int and timeline_key is not null
  ), queued as (
    insert into storage_delete_queue (storage_key) select k from keys on conflict do nothing returning 1
  ), gone as (
    delete from user_replay where id = $1::int returning id
  )
  select (select count(*) from gone)::int as deleted, (select count(*) from queued)::int as files_queued`;

/** Delete messages (and queue their screenshots). $1 = array of feedback ids. */
export const DELETE_FEEDBACK_SQL = `
  with queued as (
    insert into storage_delete_queue (storage_key) select storage_key from feedback_file where feedback_id = any($1::int[]) on conflict do nothing returning 1
  ), gone as (
    delete from feedback where id = any($1::int[]) returning id
  )
  select (select count(*) from gone)::int as deleted, (select count(*) from queued)::int as files_queued`;
