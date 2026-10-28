import "server-only";

/**
 * Versioned schema migrations. Each entry runs once, in order, and is recorded in schema_migration.
 * Rules: never edit an applied entry (add a new version instead), and write each one so that running it again is harmless
 * (`if not exists`), because two server instances can start at the same time. Version 1 is the schema as it was before
 * versioning existed; databases created back then already match it, so applying it again changes nothing.
 * Privacy-relevant columns belong here and in docs/Privacy_Data_Inventory.md together.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "baseline",
    sql: `
create table if not exists event (
  id serial primary key,
  slug text unique not null,
  kind text not null,
  name_ko text not null,
  name_en text not null,
  starts_at timestamptz,
  ends_at timestamptz
);

insert into event (slug, kind, name_ko, name_en, starts_at, ends_at)
values ('colosseum-1', 'AI_COLOSSEUM', 'BPM AI 콜로세움 1', 'BPM AI Colosseum 1',
        '2026-10-31T15:00:00Z', '2026-11-02T15:00:00Z')
on conflict (slug) do nothing;

create table if not exists game (
  id serial primary key,
  event_id int not null references event(id),
  source text not null default 'AI_EVENT',
  matchup text not null,
  round int not null,
  series_key text not null,
  game_no int not null,
  map text not null,
  ban_mode text not null,
  ban_count int not null,
  mod_version text,
  balance_version text,
  played_at timestamptz,
  duration_sec int,
  winner_slot int,
  publish_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (event_id, series_key, game_no)
);
create index if not exists game_event_idx on game (event_id, publish_at);

create table if not exists replay (
  id serial primary key,
  game_id int not null references game(id) on delete cascade,
  sha256 text unique not null,
  storage_key text not null,
  size int not null,
  uploaded_at timestamptz not null default now()
);

create table if not exists game_player (
  game_id int not null references game(id) on delete cascade,
  slot int not null,
  name text not null,
  race text not null,
  persona text,
  model_version text,
  result text not null,
  primary key (game_id, slot)
);

create table if not exists app_user (
  id serial primary key,
  provider text not null,
  subject text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (provider, subject)
);
alter table app_user add column if not exists age_confirmed_at timestamptz;

create table if not exists consent (
  user_id int primary key references app_user(id) on delete cascade,
  c1 boolean not null default false,
  c2 boolean not null default false,
  c3 boolean not null default false,
  policy_version text not null,
  updated_at timestamptz not null default now()
);

create table if not exists consent_log (
  id serial primary key,
  user_id int not null references app_user(id) on delete cascade,
  c1 boolean not null,
  c2 boolean not null,
  c3 boolean not null,
  policy_version text not null,
  source text not null,
  at timestamptz not null default now()
);

create table if not exists device_auth (
  id serial primary key,
  device_code_hash text unique not null,
  user_code text unique not null,
  user_id int references app_user(id) on delete cascade,
  status text not null default 'pending',
  expires_at timestamptz not null,
  last_poll timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists device_token (
  id serial primary key,
  user_id int not null references app_user(id) on delete cascade,
  token_hash text unique not null,
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- Replays uploaded by players. Never served back to anyone (no download route); source of truth for Phase 1 analysis.
create table if not exists user_replay (
  id serial primary key,
  user_id int not null references app_user(id) on delete cascade,
  sha256 text not null,
  storage_key text not null,
  size int not null,
  status text not null default 'QUEUED',
  reject_code text,
  client_version text,
  c2_at_upload boolean not null,
  c3_at_upload boolean not null,
  uploaded_at timestamptz not null default now(),
  analyzed_at timestamptz,
  analysis jsonb,
  unique (user_id, sha256)
);
-- Analysis job bookkeeping (a pull queue: the worker claims rows; see lib/server/analysisJobs.ts).
alter table user_replay add column if not exists attempts int not null default 0;
alter table user_replay add column if not exists available_at timestamptz not null default now();
alter table user_replay add column if not exists claimed_at timestamptz;
alter table user_replay add column if not exists analyzer_version text;
alter table user_replay add column if not exists last_error text;
alter table user_replay add column if not exists timeline_key text;
alter table user_replay add column if not exists timeline_size int;
alter table user_replay add column if not exists timeline_schema int;
alter table user_replay add column if not exists timeline_attempt int;
create index if not exists user_replay_status_idx on user_replay (status, uploaded_at);
-- C2 public viewing: a replay taken down after a report stays hidden until an operator restores it.
alter table user_replay add column if not exists hidden_at timestamptz;
alter table user_replay add column if not exists hidden_reason text;
-- AI evaluation (the "form" curve): a second pull queue next to analysis. A READY replay waits as PENDING until an evaluation worker
-- leases it (LEASED) and reports DONE (evaluation holds the curve), SKIPPED (cannot be evaluated by design) or FAILED. See lib/server/evalJobs.ts.
alter table user_replay add column if not exists eval_status text;
alter table user_replay add column if not exists eval_attempts int not null default 0;
alter table user_replay add column if not exists eval_available_at timestamptz not null default now();
alter table user_replay add column if not exists eval_claimed_at timestamptz;
alter table user_replay add column if not exists eval_version text;
alter table user_replay add column if not exists eval_error text;
alter table user_replay add column if not exists evaluation jsonb;
update user_replay set eval_status = 'PENDING' where status = 'READY' and eval_status is null;
-- One inbox for everything people send us: bug reports, ideas, and reports about a public replay (kind 'replay').
create table if not exists feedback (
  id serial primary key,
  kind text not null,
  replay_id int references user_replay(id) on delete set null,
  reason text,
  title text,
  body text,
  page text,
  user_agent text,
  user_id int references app_user(id) on delete set null,
  reporter_hash text not null,
  status text not null default 'OPEN',
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists feedback_status_idx on feedback (status, created_at);
create table if not exists feedback_file (
  feedback_id int not null references feedback(id) on delete cascade,
  n int not null,
  storage_key text not null,
  mime text not null,
  size int not null,
  primary key (feedback_id, n)
);

create table if not exists draft_event (
  game_id int not null references game(id) on delete cascade,
  seq int not null,
  slot int not null,
  action text not null,
  unit_id text not null,
  replaces_unit_id text,
  primary key (game_id, seq)
);
`,
  },
  {
    version: 2,
    name: "replay_privacy_controls",
    sql: `
      -- Per-replay controls (A13). visibility_override 'private' keeps a replay off the public pages and out of statistics
      -- whatever the account consent says; training_excluded keeps it out of any AI training set.
      alter table user_replay add column if not exists visibility_override text not null default 'default';
      alter table user_replay add column if not exists training_excluded boolean not null default false;
    `,
  },
  {
    version: 3,
    name: "requeue_analyses_with_raw_handles",
    sql: `
      -- A3: analyses written before the worker pseudonymised handles still hold Battle.net handles of both players. Run them
      -- through the worker again (the originals are still stored) so they are replaced by handle keys. The old timeline stays
      -- until the new one overwrites it; timeline_attempt = null makes the new attempt prove it stored a fresh timeline.
      update user_replay
         set status = 'QUEUED', attempts = 0, available_at = now(), claimed_at = null, last_error = null, timeline_attempt = null,
             eval_status = null
       where status = 'READY' and analysis::text like '%"handle":%';
    `,
  },
  {
    version: 4,
    name: "feedback_less_context",
    sql: `
      -- A4: the inbox keeps a coarse browser string and a page path only. Older rows held the raw user agent (up to 300
      -- characters) and the full page address; the raw string is dropped and the address reduced to its path.
      update feedback set user_agent = null where user_agent is not null;
      update feedback set page = nullif(left(regexp_replace(page, '[?#].*$', ''), 120), '') where page is not null;
    `,
  },
  {
    version: 5,
    name: "session_version_and_short_lived_rate_limits",
    sql: `
      -- A6: raising session_version ends every browser session of the account.
      alter table app_user add column if not exists session_version int not null default 0;
      -- 3.4: report rate limits no longer live in the message rows. A counter is keyed by an hourly keyed hash and goes
      -- away when its hour is over; the long-lived reporter_hash column is dropped.
      create table if not exists report_rate (
        key text not null,
        kind text not null,
        n int not null,
        expires_at timestamptz not null,
        primary key (key, kind)
      );
      create index if not exists report_rate_expires_idx on report_rate (expires_at);
      alter table feedback drop column if exists reporter_hash;
    `,
  },
  {
    version: 6,
    name: "original_file_lifecycle",
    sql: `
      -- 3.1: the original replay is deleted once nothing needs it. source_deleted_at is set only after the storage confirmed
      -- the delete; a failed delete is retried (attempts, next try, last error).
      alter table user_replay add column if not exists source_deleted_at timestamptz;
      alter table user_replay add column if not exists source_delete_attempts int not null default 0;
      alter table user_replay add column if not exists source_delete_next timestamptz;
      alter table user_replay add column if not exists source_delete_error text;
      create index if not exists user_replay_source_idx on user_replay (uploaded_at) where source_deleted_at is null;
    `,
  },
  {
    version: 7,
    name: "operator_audit_log",
    sql: `
      -- A5: who did what in the operator routes. No content, only actor, action and target.
      create table if not exists admin_audit (
        id serial primary key,
        at timestamptz not null default now(),
        actor text not null,
        role text not null,
        action text not null,
        target text not null,
        detail text
      );
      create index if not exists admin_audit_at_idx on admin_audit (at);
    `,
  },
  {
    version: 8,
    name: "storage_delete_queue",
    sql: `
      -- 3.7: the files of deleted rows. A name is written in the same statement that deletes the rows and removed only after
      -- the storage confirmed the file is gone, so a failed or interrupted delete is retried instead of forgotten.
      create table if not exists storage_delete_queue (
        storage_key text primary key,
        attempts int not null default 0,
        next_try timestamptz not null default now(),
        error text,
        created_at timestamptz not null default now()
      );
    `,
  },
  {
    version: 9,
    name: "onboarding_and_policy_versions",
    sql: `
      -- 3.5 / 3.6: the first-sign-in steps, which policy text the user last saw, and which consent text each consent was given on.
      alter table app_user add column if not exists onboarding_completed_at timestamptz;
      alter table app_user add column if not exists onboarding_policy_version text;
      alter table app_user add column if not exists policy_seen_version text;
      alter table consent add column if not exists consent_version text;
      alter table consent add column if not exists reconsent_pending text not null default '';
      alter table consent_log add column if not exists consent_version text;
      update consent set consent_version = policy_version where consent_version is null;
      update consent_log set consent_version = policy_version where consent_version is null;
      create table if not exists policy_ack (
        id serial primary key,
        user_id int not null references app_user(id) on delete cascade,
        from_version text,
        to_version text not null,
        kind text not null,
        at timestamptz not null default now()
      );
      -- Accounts that already confirmed their age and set consents before this step existed have seen the consent screen.
      update app_user set onboarding_completed_at = created_at, onboarding_policy_version = (select policy_version from consent c where c.user_id = app_user.id),
             policy_seen_version = (select policy_version from consent c where c.user_id = app_user.id)
       where onboarding_completed_at is null and age_confirmed_at is not null and exists (select 1 from consent c where c.user_id = app_user.id);
    `,
  },
  {
    version: 10,
    name: "privacy_requests",
    sql: `
      -- A10: requests about a person's own data are messages of kind 'privacy_request'. The optional contact address is kept only
      -- until the request is closed (it is cleared then); channel says whether it came from the site or by email.
      alter table feedback add column if not exists contact text;
      alter table feedback add column if not exists channel text not null default 'web';
    `,
  },
];

const LOCK_KEY = 7314201;

/** One script per migration: the lock, the already-applied check and the record all sit in the same transaction. */
export function migrationScript(m: Migration): string {
  return `
    select pg_advisory_xact_lock(${LOCK_KEY});
    do $mig$ begin
      if not exists (select 1 from schema_migration where version = ${m.version}) then
        execute $body$${m.sql}$body$;
        insert into schema_migration (version, name) values (${m.version}, '${m.name}');
      end if;
    end $mig$;
  `;
}

/** Applies every pending migration. `exec` must accept multi-statement SQL without parameters. */
export async function migrate(exec: (sql: string) => Promise<unknown>): Promise<void> {
  await exec("create table if not exists schema_migration (version int primary key, name text not null, applied_at timestamptz not null default now())");
  for (const m of MIGRATIONS) await exec(migrationScript(m));
}
