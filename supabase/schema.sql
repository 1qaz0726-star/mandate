-- Mandate — optional Supabase persistence for audit log / approvals / AI conversation history.
-- Run once in the Supabase SQL editor. Safe to re-run (idempotent via IF NOT EXISTS / OR REPLACE).
--
-- Design notes:
-- - `boot_id` groups rows by one running instance of the app (a process start / Worker cold
--   start). The in-memory demo state resets on /api/reset or a restart, which resets local
--   sequence numbers back to 1 — boot_id keeps those resets from colliding across runs.
-- - audit_log is append-only and hash-chained per boot_id (see trigger below) so any row
--   tampered with after the fact breaks the chain — this is the tamper-evidence story for
--   judges. approvals/ai_messages are plain snapshot tables (upserted), not chained.
-- - Server writes with the service_role key only (never exposed to the browser), so RLS can
--   stay default-deny; no policies are defined here on purpose.

create extension if not exists pgcrypto;

create table if not exists audit_log (
  id              bigserial primary key,
  boot_id         uuid not null,
  audit_event_id  text,
  ts              timestamptz,
  org_id          text,
  principal_id    text,
  actor_id        text,
  actor_type      text,
  agent_id        text,
  mandate_id      text,
  tool_id         text,
  tool_name       text,
  decision        text,
  policy_id       text,
  reason          text,
  reasoning_summary text,
  event_kind      text not null default 'TOOL_DECISION',
  correlation_id  text,
  approval_id     text,
  args_digest     text,
  input_hash      text,
  input_redacted  jsonb,
  prev_hash       text,
  entry_hash      text,
  created_at      timestamptz not null default now()
);

create index if not exists audit_log_boot_id_idx on audit_log (boot_id, id);
create index if not exists audit_log_approval_id_idx on audit_log (approval_id);

-- RLS on, zero policies defined: default-deny for anon/authenticated (the publishable key).
-- Only the service_role key (used server-side in supabaseSync.js) bypasses RLS and can
-- read/write. Without this, Supabase's default grants let anon SELECT any table with RLS off,
-- which would make the whole audit trail publicly readable via the publishable key.
alter table audit_log enable row level security;

-- Hash chain: each new row's entry_hash = sha256(prev_hash || this row's key fields),
-- scoped per boot_id so separate demo runs don't chain into each other.
create or replace function mandate_audit_hash_chain() returns trigger as $$
declare
  prev text;
begin
  select entry_hash into prev
    from audit_log
    where boot_id = new.boot_id
    order by id desc
    limit 1;

  if prev is null then
    prev := repeat('0', 64);
  end if;

  new.prev_hash := prev;
  new.entry_hash := encode(
    digest(
      prev
        || coalesce(new.audit_event_id, '')
        || coalesce(new.ts::text, '')
        || coalesce(new.decision, '')
        || coalesce(new.policy_id, '')
        || coalesce(new.reason, ''),
      'sha256'
    ),
    'hex'
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_audit_hash_chain on audit_log;
create trigger trg_audit_hash_chain
  before insert on audit_log
  for each row execute function mandate_audit_hash_chain();

create table if not exists approvals (
  id            bigserial primary key,
  boot_id       uuid not null,
  approval_id   text not null,
  mandate_id    text,
  type          text,
  status        text,
  requested_by  text,
  approver_id   text,
  created_at    timestamptz,
  decided_at    timestamptz,
  consumed_at   timestamptz,
  policy_id     text,
  payload       jsonb,
  synced_at     timestamptz not null default now(),
  unique (boot_id, approval_id)
);

alter table approvals enable row level security;

create table if not exists ai_messages (
  id          bigserial primary key,
  boot_id     uuid not null,
  session_id  text not null,
  role        text not null,
  content     text,
  ts          timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists ai_messages_session_idx on ai_messages (boot_id, session_id, ts);

alter table ai_messages enable row level security;

-- Verify the audit_log hash chain for a given boot_id (returns any row whose stored
-- entry_hash doesn't match a fresh recomputation — empty result = chain intact).
create or replace function mandate_verify_audit_chain(p_boot_id uuid)
returns table (id bigint, audit_event_id text, expected_hash text, stored_hash text) as $$
  with ordered as (
    select *, lag(entry_hash) over (order by id) as prior_hash
    from audit_log
    where boot_id = p_boot_id
    order by id
  )
  select
    o.id,
    o.audit_event_id,
    encode(
      digest(
        coalesce(o.prior_hash, repeat('0', 64))
          || coalesce(o.audit_event_id, '')
          || coalesce(o.ts::text, '')
          || coalesce(o.decision, '')
          || coalesce(o.policy_id, '')
          || coalesce(o.reason, ''),
        'sha256'
      ),
      'hex'
    ) as expected_hash,
    o.entry_hash as stored_hash
  from ordered o
  where o.entry_hash <> encode(
    digest(
      coalesce(o.prior_hash, repeat('0', 64))
        || coalesce(o.audit_event_id, '')
        || coalesce(o.ts::text, '')
        || coalesce(o.decision, '')
        || coalesce(o.policy_id, '')
        || coalesce(o.reason, ''),
      'sha256'
    ),
    'hex'
  );
$$ language sql stable;
