-- CallControl: pilot-ops hardening — self-healing retries, per-call feedback,
-- webhook rate-limit.
--
-- Apply AFTER 0001-0007. Idempotent (add column/table if not exists). Worker
-- degrades gracefully until this lands: the retry sweep and the rate limiter
-- both catch a missing column/table and no-op (fail OPEN — never block real
-- webhook traffic on a migration that hasn't landed yet).

-- ---------------------------------------------------------------------------
-- 1. Self-healing retry counter on calls.
--    A stuck call (ai_key_missing / no_recording / no default checklist yet)
--    is retried automatically by the cron sweep, capped so a permanently
--    broken org (e.g. a revoked PBX credential) does not retry forever.
-- ---------------------------------------------------------------------------
alter table calls
  add column if not exists retry_count integer not null default 0;

create index if not exists calls_retry_worklist
  on calls (status, updated_at)
  where status in ('pending', 'transcribed');

-- ---------------------------------------------------------------------------
-- 2. Per-call feedback: a team member marks an analysis 👍/👎 with an optional
--    comment. One vote per (call, person); voting again replaces it (upsert).
--    This is the loop that tells us whether the scoring is actually useful.
-- ---------------------------------------------------------------------------
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

-- Visibility follows the parent call EXACTLY, the same idiom as
-- transcript_select/analysis_select (0001): the subquery re-applies calls'
-- OWN select policy, so this never needs to duplicate app.can_see_call.
drop policy if exists feedback_select on analysis_feedback;
create policy feedback_select on analysis_feedback for select to authenticated
  using (exists (select 1 from calls c where c.id = call_id));

-- Writable by whoever can see the call and is not a viewer, but ONLY as
-- themselves — a lead cannot post feedback under a teammate's name.
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

create trigger analysis_feedback_touch before update on analysis_feedback
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Webhook rate limiting: a courtesy backstop (NOT the hard boundary — that
--    remains monthly_call_quota via reserveQuotaSlot) against a leaked or
--    misbehaving webhook token flooding the endpoint and bloating audit_log.
--    One row per (integration, UTC minute); the Worker increments best-effort
--    and fails OPEN on any error. Locked to service_role, same as
--    org_ai_keys/integration_secrets: no policies at all, so no row is ever
--    visible through PostgREST for anyone.
-- ---------------------------------------------------------------------------
create table if not exists webhook_rate_limits (
  integration_id uuid not null references integrations (id) on delete cascade,
  minute_bucket  bigint not null,
  count          integer not null default 0,
  primary key (integration_id, minute_bucket)
);

alter table webhook_rate_limits enable row level security;
alter table webhook_rate_limits force row level security;
