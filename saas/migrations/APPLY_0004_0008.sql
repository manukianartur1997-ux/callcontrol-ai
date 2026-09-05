-- ===========================================================================
-- CallControl — APPLY THIS in the Supabase SQL editor (one paste, Run once).
--
-- This is migrations 0004 (growth) + 0005 (billing/retention) + 0006 (role-cap) + 0007 (STT provider) + 0008 (ops hardening) concatenated,
-- for the LIVE project where 0001-0003 are ALREADY applied. Do NOT paste
-- ALL_IN_ONE.sql on the live project — it re-creates the 0001-0003 policies and
-- would error on "policy already exists". This file is safe to run and is
-- re-runnable: every policy is dropped-if-exists first, tables/columns use
-- IF NOT EXISTS. Until this runs, billing/retention/telegram features answer
-- 503 migration_required and org seeding falls back to 2 legacy telephony kinds.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0004 · 1. Telephony: extend the allowed integration kinds (top-5 UA).
--    KEEP THIS LIST IN SYNC with PROVIDERS in saas/worker/telephony.js.
-- ---------------------------------------------------------------------------
alter table integrations drop constraint if exists integrations_kind_check;
alter table integrations
  add constraint integrations_kind_check
  check (kind in ('ringostat', 'binotel', 'phonet', 'unitalk', 'streamtele'));

-- ---------------------------------------------------------------------------
-- 0004 · 2. Telegram delivery: per-call feedback and the daily digest.
-- ---------------------------------------------------------------------------
create table if not exists telegram_recipients (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  chat_id     text not null check (chat_id ~ '^-?[0-9]{5,20}$'),
  kind        text not null check (kind in ('per_call', 'daily')),
  label       text,
  created_at  timestamptz not null default now(),
  unique (org_id, chat_id, kind)
);

alter table telegram_recipients enable row level security;
alter table telegram_recipients force row level security;

drop policy if exists telegram_select on telegram_recipients;
create policy telegram_select on telegram_recipients for select to authenticated
  using (app.is_org_wide(org_id));
drop policy if exists telegram_write on telegram_recipients;
create policy telegram_write on telegram_recipients for all to authenticated
  using (app.is_org_wide(org_id)) with check (app.is_org_wide(org_id));

-- ---------------------------------------------------------------------------
-- 0004 · 3. Organization settings the dashboard needs.
-- ---------------------------------------------------------------------------
alter table organizations
  add column if not exists avg_deal_amount numeric check (avg_deal_amount is null or avg_deal_amount >= 0),
  add column if not exists ui_language text not null default 'uk'
    check (ui_language in ('uk', 'ru', 'en'));

-- ---------------------------------------------------------------------------
-- 0005 · 1. Billing settings on the organization.
-- ---------------------------------------------------------------------------
alter table organizations
  add column if not exists billing_plan text not null default 'payg'
    check (billing_plan in ('payg', 'trial', 'custom')),
  add column if not exists rate_per_minute numeric check (rate_per_minute is null or rate_per_minute >= 0),
  add column if not exists billing_currency text not null default 'UAH'
    check (billing_currency in ('UAH', 'USD', 'EUR')),
  add column if not exists retention_days integer not null default 90
    check (retention_days between 1 and 3650);

-- ---------------------------------------------------------------------------
-- 0005 · 2. Usage ledger: one billable line per analysed call (talk-minutes).
-- ---------------------------------------------------------------------------
create table if not exists usage_ledger (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  call_id     uuid not null references calls (id) on delete cascade,
  minutes     numeric not null check (minutes >= 0),
  rate        numeric not null check (rate >= 0),
  currency    text not null default 'UAH',
  cost        numeric not null check (cost >= 0),
  created_at  timestamptz not null default now(),
  unique (call_id)
);

create index if not exists usage_ledger_org_created on usage_ledger (org_id, created_at desc);

alter table usage_ledger enable row level security;
alter table usage_ledger force row level security;

drop policy if exists usage_ledger_select on usage_ledger;
create policy usage_ledger_select on usage_ledger for select to authenticated
  using (app.is_org_wide(org_id));

-- ---------------------------------------------------------------------------
-- 0005 · 3. Retention marker on transcripts (idempotent cleanup).
-- ---------------------------------------------------------------------------
alter table transcripts
  add column if not exists redacted_at timestamptz;

-- ---------------------------------------------------------------------------
-- 0006 · RLS role-cap: an admin can no longer mint or become an 'owner'.
--    membership_write/invite_write previously gated only on is_org_wide (owner
--    OR admin) with no cap on the role value — an admin could self-promote to
--    owner via a direct PostgREST write. Only an owner may write an owner row.
-- ---------------------------------------------------------------------------
drop policy if exists membership_write on memberships;
create policy membership_write on memberships for all to authenticated
  using (
    app.is_org_wide(org_id)
    and (role <> 'owner' or app.is_owner(org_id))
  )
  with check (
    app.is_org_wide(org_id)
    and (role <> 'owner' or app.is_owner(org_id))
  );

drop policy if exists invite_write on invites;
create policy invite_write on invites for all to authenticated
  using (
    app.is_org_wide(org_id)
    and (role <> 'owner' or app.is_owner(org_id))
  )
  with check (
    app.is_org_wide(org_id)
    and (role <> 'owner' or app.is_owner(org_id))
  );

-- ---------------------------------------------------------------------------
-- 0007 · Per-org STT provider choice + encrypted Deepgram key.
--    Default 'gemini' so nothing changes until an owner opts into Deepgram.
-- ---------------------------------------------------------------------------
alter table organizations
  add column if not exists stt_provider text not null default 'gemini'
    check (stt_provider in ('gemini', 'deepgram')),
  add column if not exists stt_deepgram_key_ciphertext text,
  add column if not exists stt_deepgram_key_hint text;

-- ---------------------------------------------------------------------------
-- 0008 · Pilot-ops hardening: self-healing retries, per-call feedback,
--    webhook rate-limit. See saas/migrations/0008_ops_hardening.sql for the
--    full commentary; this section carries the identical statements.
-- ---------------------------------------------------------------------------
alter table calls
  add column if not exists retry_count integer not null default 0;

create index if not exists calls_retry_worklist
  on calls (status, updated_at)
  where status in ('pending', 'transcribed');

create table if not exists analysis_feedback (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  call_id     uuid not null references calls (id) on delete cascade,
  analysis_id uuid references analyses (id) on delete set null,
  actor_id    uuid not null references auth.users (id) on delete cascade,
  rating      text not null check (rating in ('up', 'down')),
  comment     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (call_id, actor_id)
);

create index if not exists analysis_feedback_org on analysis_feedback (org_id, created_at desc);

alter table analysis_feedback enable row level security;
alter table analysis_feedback force row level security;

drop policy if exists feedback_select on analysis_feedback;
create policy feedback_select on analysis_feedback for select to authenticated
  using (exists (select 1 from calls c where c.id = call_id));

drop policy if exists feedback_write on analysis_feedback;
create policy feedback_write on analysis_feedback for all to authenticated
  using (
    actor_id = auth.uid()
    and exists (select 1 from calls c where c.id = call_id and app.user_role(c.org_id) <> 'viewer')
  )
  with check (
    actor_id = auth.uid()
    and exists (select 1 from calls c where c.id = call_id and app.user_role(c.org_id) <> 'viewer')
  );

drop trigger if exists analysis_feedback_touch on analysis_feedback;
create trigger analysis_feedback_touch before update on analysis_feedback
  for each row execute function app.touch_updated_at();

create table if not exists webhook_rate_limits (
  integration_id uuid not null references integrations (id) on delete cascade,
  minute_bucket  bigint not null,
  count          integer not null default 0,
  primary key (integration_id, minute_bucket)
);

alter table webhook_rate_limits enable row level security;
alter table webhook_rate_limits force row level security;
