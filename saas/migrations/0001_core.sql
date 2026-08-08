-- CallControl pilot SaaS — core multi-tenant schema.
--
-- Target: Supabase (Postgres 15+) on the SECOND free project. Auth is
-- Supabase Auth (auth.users); this migration owns everything else.
--
-- Authorization model: every table carries org_id and is protected by RLS.
-- Nothing here trusts the client — the browser talks to PostgREST with the
-- user's JWT and the policies below are the only thing standing between one
-- client company and another. Treat any change to them as a security change.
--
-- Role hierarchy (highest first):
--   owner    — director. Whole org + billing + AI keys. Widest reporting.
--   admin    — operations. Whole org, no billing/keys.
--   lead     — head of a department (РОП). Own department only.
--   manager  — a salesperson. Own calls only.
--   viewer   — read-only inside its scope (department if set, else org).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper schema. SECURITY DEFINER functions live here so RLS policies can ask
-- "what is this user allowed to see" WITHOUT re-entering RLS on memberships
-- (which would recurse infinitely). They are the single source of truth.
-- ---------------------------------------------------------------------------
create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to authenticated, service_role;

create type app.member_role as enum ('owner', 'admin', 'lead', 'manager', 'viewer');
create type app.member_status as enum ('active', 'suspended');
create type app.call_status as enum ('pending', 'transcribed', 'analyzing', 'analyzed', 'failed');
create type app.call_direction as enum ('inbound', 'outbound', 'unknown');
create type app.ai_provider as enum ('gemini', 'anthropic', 'openai');

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------
create table organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) between 2 and 120),
  slug          text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  plan          text not null default 'pilot',
  -- Pilot guard rails. Enforced in app.assert_within_quota(), not by RLS.
  monthly_call_quota integer not null default 500 check (monthly_call_quota >= 0),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table departments (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 120),
  created_at    timestamptz not null default now(),
  unique (org_id, name)
);

create table memberships (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          app.member_role not null default 'manager',
  department_id uuid references departments (id) on delete set null,
  full_name     text,
  status        app.member_status not null default 'active',
  invited_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, user_id)
);

create index on memberships (user_id);
create index on memberships (org_id, role);
create index on departments (org_id);

-- A department's head. Separate from memberships.department_id so a lead can
-- be recorded even before their membership row is finalised.
alter table departments
  add column lead_user_id uuid references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER — they bypass RLS by design)
-- ---------------------------------------------------------------------------

-- Orgs the caller belongs to. Used by nearly every policy.
create or replace function app.user_orgs()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select org_id from memberships
  where user_id = auth.uid() and status = 'active';
$$;

create or replace function app.user_role(target_org uuid)
returns app.member_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from memberships
  where user_id = auth.uid() and org_id = target_org and status = 'active';
$$;

create or replace function app.user_department(target_org uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select department_id from memberships
  where user_id = auth.uid() and org_id = target_org and status = 'active';
$$;

-- Whole-org visibility: director and operations admin.
create or replace function app.is_org_wide(target_org uuid)
returns boolean
language sql
stable
as $$
  select app.user_role(target_org) in ('owner', 'admin');
$$;

-- Only the director. Billing, AI keys, deleting the org.
create or replace function app.is_owner(target_org uuid)
returns boolean
language sql
stable
as $$
  select app.user_role(target_org) = 'owner';
$$;

-- Can this caller see this particular call row?
--   owner/admin -> any call in the org
--   lead        -> any call in their department
--   manager     -> only calls assigned to them
--   viewer      -> their department if they have one, else the whole org
create or replace function app.can_see_call(
  target_org uuid,
  call_department uuid,
  call_manager uuid
)
returns boolean
language sql
stable
as $$
  select case app.user_role(target_org)
    when 'owner'   then true
    when 'admin'   then true
    when 'lead'    then call_department is not distinct from app.user_department(target_org)
    when 'manager' then call_manager = auth.uid()
    when 'viewer'  then app.user_department(target_org) is null
                        or call_department is not distinct from app.user_department(target_org)
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Product data
-- ---------------------------------------------------------------------------
create table checklists (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  name          text not null,
  -- [{ "key": "greeting", "label": "...", "weight": 10, "hint": "..." }]
  items         jsonb not null default '[]'::jsonb,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index checklists_one_default_per_org
  on checklists (org_id) where is_default;

create table calls (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  department_id uuid references departments (id) on delete set null,
  manager_id    uuid references auth.users (id) on delete set null,
  manager_label text,                       -- name from telephony when unmapped
  source        text not null default 'manual',  -- manual | csv | ringostat | binotel
  external_id   text,                       -- id in the telephony system
  direction     app.call_direction not null default 'unknown',
  customer_phone text,
  started_at    timestamptz,
  duration_sec  integer check (duration_sec is null or duration_sec >= 0),
  recording_url text,
  status        app.call_status not null default 'pending',
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, source, external_id)
);
create index on calls (org_id, started_at desc);
create index on calls (org_id, department_id);
create index on calls (org_id, manager_id);
create index on calls (org_id, status);

create table transcripts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  call_id       uuid not null references calls (id) on delete cascade,
  text          text not null,
  lang          text,
  provider      text,                       -- who produced it
  created_at    timestamptz not null default now(),
  unique (call_id)
);

create table analyses (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  call_id       uuid not null references calls (id) on delete cascade,
  checklist_id  uuid references checklists (id) on delete set null,
  score         numeric(5,2) check (score is null or score between 0 and 100),
  -- { "items": [...], "leaks": [...], "coaching": [...], "summary": "..." }
  findings      jsonb not null default '{}'::jsonb,
  provider      app.ai_provider,
  model         text,
  tokens_in     integer,
  tokens_out    integer,
  created_at    timestamptz not null default now()
);
create index on analyses (org_id, created_at desc);
create index on analyses (call_id);

create table usage_counters (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  period        date not null,              -- first day of the month
  calls_analyzed integer not null default 0,
  tokens_in     bigint not null default 0,
  tokens_out    bigint not null default 0,
  updated_at    timestamptz not null default now(),
  unique (org_id, period)
);

-- Bring-your-own AI key. The ciphertext never leaves the Worker: PostgREST
-- access is denied to everyone (see policies), only service_role can read it.
create table org_ai_keys (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  provider      app.ai_provider not null,
  key_ciphertext text not null,
  key_hint      text,                       -- e.g. "…7f2a", safe to show
  added_by      uuid references auth.users (id) on delete set null,
  last_ok_at    timestamptz,
  last_error    text,
  created_at    timestamptz not null default now(),
  unique (org_id, provider)
);

create table integrations (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  kind          text not null check (kind in ('ringostat', 'binotel')),
  enabled       boolean not null default false,
  -- Non-secret settings only (account ids, mappings). Secrets go in
  -- integration_secrets, which is service_role-only like org_ai_keys.
  config        jsonb not null default '{}'::jsonb,
  webhook_token text not null default encode(gen_random_bytes(24), 'hex'),
  last_event_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, kind)
);
create unique index on integrations (webhook_token);

create table integration_secrets (
  id             uuid primary key default gen_random_uuid(),
  integration_id uuid not null references integrations (id) on delete cascade,
  org_id         uuid not null references organizations (id) on delete cascade,
  secret_ciphertext text not null,
  created_at     timestamptz not null default now(),
  unique (integration_id)
);

create table invites (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  email         text not null check (position('@' in email) > 1),
  role          app.member_role not null default 'manager',
  department_id uuid references departments (id) on delete set null,
  token         text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by    uuid references auth.users (id) on delete set null,
  expires_at    timestamptz not null default now() + interval '14 days',
  accepted_at   timestamptz,
  accepted_by   uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on invites (org_id) where accepted_at is null;
create index on invites (lower(email));

create table dashboard_prefs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  -- ["revenue_at_risk","calls_analyzed",...] — order IS the display order,
  -- absence means hidden. Level 1 of the dashboard plan: toggle + reorder,
  -- deliberately not a widget builder.
  visible_widgets jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now(),
  unique (org_id, user_id)
);

create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations (id) on delete cascade,
  actor_id      uuid references auth.users (id) on delete set null,
  action        text not null,
  target        text,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index on audit_log (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','memberships','checklists','calls',
    'usage_counters','integrations','dashboard_prefs'
  ] loop
    execute format(
      'create trigger %I_touch before update on %I
       for each row execute function app.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Every table: enable + force. `force` matters — without it the table owner
-- bypasses policies, and that is exactly the footgun that leaks tenants.
-- service_role still bypasses RLS (that is its job); the Worker uses it only
-- for AI keys, webhooks and quota accounting.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','departments','memberships','checklists','calls',
    'transcripts','analyses','usage_counters','org_ai_keys','integrations',
    'integration_secrets','invites','dashboard_prefs','audit_log'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- organizations -------------------------------------------------------------
create policy org_select on organizations for select to authenticated
  using (id in (select app.user_orgs()));

create policy org_update on organizations for update to authenticated
  using (app.is_org_wide(id)) with check (app.is_org_wide(id));

-- Creating an org is done by the Worker (service_role) during onboarding, so
-- no INSERT policy for authenticated: self-serve signup is intentionally off
-- for the pilot (invite-only).

-- departments ---------------------------------------------------------------
create policy dept_select on departments for select to authenticated
  using (org_id in (select app.user_orgs()));

create policy dept_write on departments for all to authenticated
  using (app.is_org_wide(org_id)) with check (app.is_org_wide(org_id));

-- memberships ---------------------------------------------------------------
-- Readable by anyone in the org (you need to see who your colleagues are),
-- writable only org-wide. Uses app.user_orgs() (SECURITY DEFINER) rather than
-- a subquery on memberships itself — otherwise the policy recurses.
create policy membership_select on memberships for select to authenticated
  using (org_id in (select app.user_orgs()));

create policy membership_write on memberships for all to authenticated
  using (app.is_org_wide(org_id)) with check (app.is_org_wide(org_id));

-- checklists ----------------------------------------------------------------
create policy checklist_select on checklists for select to authenticated
  using (org_id in (select app.user_orgs()));

create policy checklist_write on checklists for all to authenticated
  using (app.is_org_wide(org_id)) with check (app.is_org_wide(org_id));

-- calls ---------------------------------------------------------------------
create policy call_select on calls for select to authenticated
  using (
    org_id in (select app.user_orgs())
    and app.can_see_call(org_id, department_id, manager_id)
  );

-- Managers may upload their own calls; leads/admins/owners may upload for
-- anyone in their scope. Viewers never write.
create policy call_insert on calls for insert to authenticated
  with check (
    org_id in (select app.user_orgs())
    and app.user_role(org_id) <> 'viewer'
    and app.can_see_call(org_id, department_id, manager_id)
  );

create policy call_update on calls for update to authenticated
  using (
    org_id in (select app.user_orgs())
    and app.user_role(org_id) <> 'viewer'
    and app.can_see_call(org_id, department_id, manager_id)
  )
  with check (
    org_id in (select app.user_orgs())
    and app.can_see_call(org_id, department_id, manager_id)
  );

create policy call_delete on calls for delete to authenticated
  using (app.is_org_wide(org_id));

-- transcripts / analyses: visibility follows the parent call exactly --------
create policy transcript_select on transcripts for select to authenticated
  using (exists (select 1 from calls c where c.id = call_id));

create policy transcript_write on transcripts for all to authenticated
  using (
    exists (
      select 1 from calls c
      where c.id = call_id and app.user_role(c.org_id) <> 'viewer'
    )
  )
  with check (
    exists (
      select 1 from calls c
      where c.id = call_id and app.user_role(c.org_id) <> 'viewer'
    )
  );

create policy analysis_select on analyses for select to authenticated
  using (exists (select 1 from calls c where c.id = call_id));

-- Analyses are written by the Worker (service_role) after an AI run. No
-- authenticated INSERT policy: a client must not be able to forge a score.

-- usage_counters ------------------------------------------------------------
create policy usage_select on usage_counters for select to authenticated
  using (app.is_org_wide(org_id));

-- org_ai_keys / integration_secrets ----------------------------------------
-- No policies at all => no row is ever visible through PostgREST, for anyone.
-- Only service_role (which bypasses RLS) can touch them. Owners manage keys
-- through the Worker, which returns key_hint only.

-- integrations (non-secret part) -------------------------------------------
create policy integration_select on integrations for select to authenticated
  using (app.is_org_wide(org_id));

create policy integration_write on integrations for all to authenticated
  using (app.is_owner(org_id)) with check (app.is_owner(org_id));

-- invites -------------------------------------------------------------------
create policy invite_select on invites for select to authenticated
  using (app.is_org_wide(org_id));

create policy invite_write on invites for all to authenticated
  using (app.is_org_wide(org_id)) with check (app.is_org_wide(org_id));

-- dashboard_prefs -----------------------------------------------------------
create policy prefs_own on dashboard_prefs for all to authenticated
  using (user_id = auth.uid() and org_id in (select app.user_orgs()))
  with check (user_id = auth.uid() and org_id in (select app.user_orgs()));

-- audit_log -----------------------------------------------------------------
create policy audit_select on audit_log for select to authenticated
  using (app.is_org_wide(org_id));

-- Written by the Worker only.

-- ---------------------------------------------------------------------------
-- Quota guard, called by the Worker before each paid AI run.
-- ---------------------------------------------------------------------------
create or replace function app.assert_within_quota(target_org uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  used  integer;
  quota integer;
begin
  select monthly_call_quota into quota from organizations where id = target_org;
  if quota is null then
    raise exception 'unknown_org';
  end if;

  select coalesce(calls_analyzed, 0) into used
  from usage_counters
  where org_id = target_org and period = date_trunc('month', now())::date;

  if coalesce(used, 0) >= quota then
    raise exception 'quota_exceeded' using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function app.record_usage(
  target_org uuid, in_tokens integer, out_tokens integer
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into usage_counters (org_id, period, calls_analyzed, tokens_in, tokens_out)
  values (target_org, date_trunc('month', now())::date, 1,
          coalesce(in_tokens, 0), coalesce(out_tokens, 0))
  on conflict (org_id, period) do update
    set calls_analyzed = usage_counters.calls_analyzed + 1,
        tokens_in      = usage_counters.tokens_in + coalesce(excluded.tokens_in, 0),
        tokens_out     = usage_counters.tokens_out + coalesce(excluded.tokens_out, 0),
        updated_at     = now();
$$;

revoke all on function app.assert_within_quota(uuid) from public, anon, authenticated;
revoke all on function app.record_usage(uuid, integer, integer) from public, anon, authenticated;
grant execute on function app.assert_within_quota(uuid) to service_role;
grant execute on function app.record_usage(uuid, integer, integer) to service_role;
