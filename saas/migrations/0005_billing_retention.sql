-- CallControl: per-minute billing + data retention.
--
-- Apply AFTER 0001-0004. Worker code degrades gracefully until this lands
-- (billing/retention endpoints answer 503 migration_required).
--
-- WHY per-minute: the competitive wedge (2026 market research). DialogAI
-- prices per call (penalises long calls), Ringostat/SalesAuditor per seat /
-- subscription. A transparent per-minute meter with no setup fee is the
-- lowest-friction entry for a 3-30-rep team, so every analysed call records
-- its billable minutes here.

-- ---------------------------------------------------------------------------
-- 1. Billing settings on the organization.
-- ---------------------------------------------------------------------------
alter table organizations
  add column if not exists billing_plan text not null default 'payg'
    check (billing_plan in ('payg', 'trial', 'custom')),
  -- Price per analysed MINUTE, in the org's currency (UAH by default). Null
  -- means "use the platform default rate" resolved in the worker.
  add column if not exists rate_per_minute numeric check (rate_per_minute is null or rate_per_minute >= 0),
  add column if not exists billing_currency text not null default 'UAH'
    check (billing_currency in ('UAH', 'USD', 'EUR')),
  -- Data retention: raw conversation text (transcripts) and recording links are
  -- deleted after this many days; the score/analysis metadata is kept. Short
  -- retention is both a cost and a legal (UA data-protection / DPA) posture.
  add column if not exists retention_days integer not null default 90
    check (retention_days between 1 and 3650);

-- ---------------------------------------------------------------------------
-- 2. Usage ledger: one billable line per analysed call.
--    Minutes are billed on TALK time (calls.duration_sec), rounded up to the
--    next whole minute — the industry norm and easy for a customer to audit.
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
  -- One ledger line per call: re-analysing a call must not double-bill it.
  unique (call_id)
);

create index if not exists usage_ledger_org_created on usage_ledger (org_id, created_at desc);

alter table usage_ledger enable row level security;
alter table usage_ledger force row level security;

-- Owner/admin see the money; the ledger is written by the worker (service key).
create policy usage_ledger_select on usage_ledger for select to authenticated
  using (app.is_org_wide(org_id));

-- ---------------------------------------------------------------------------
-- 3. Retention marker on transcripts, so the cleanup job is idempotent and an
--    already-scrubbed row is never re-processed.
-- ---------------------------------------------------------------------------
alter table transcripts
  add column if not exists redacted_at timestamptz;
