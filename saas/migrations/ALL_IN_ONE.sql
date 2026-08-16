-- CallControl pilot SaaS — все миграции одним файлом.
-- Выполнять в SQL Editor Supabase. Уже накатили 0001-0004? Вставляйте только 0005 ниже.

-- ======================================================================
-- 0001_core.sql
-- ======================================================================
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

-- ======================================================================
-- 0002_onboarding.sql
-- ======================================================================
-- CallControl pilot SaaS — onboarding RPCs and seed data.
--
-- Everything here exists because of one RLS fact: a user who is not yet a
-- member of any org can see nothing. Joining an org therefore cannot be a
-- plain INSERT — it has to go through SECURITY DEFINER functions that check
-- the invite themselves.

-- ---------------------------------------------------------------------------
-- Default checklist applied to a new org. Weights sum to 100.
-- ---------------------------------------------------------------------------
create or replace function app.default_checklist_items()
returns jsonb language sql immutable as $$
  select '[
    {"key":"greeting",     "weight":8,  "label":"Приветствие и представление",
     "hint":"Назвал компанию и себя, обозначил цель звонка"},
    {"key":"needs",        "weight":20, "label":"Выявление потребности",
     "hint":"Открытые вопросы, докопался до реальной задачи, а не до запроса"},
    {"key":"qualification","weight":14, "label":"Квалификация",
     "hint":"Бюджет, сроки, кто принимает решение"},
    {"key":"pitch",        "weight":14, "label":"Презентация под потребность",
     "hint":"Говорил о выгоде клиента, а не о свойствах продукта"},
    {"key":"objections",   "weight":16, "label":"Работа с возражениями",
     "hint":"Уточнил суть возражения, не спорил, привёл аргумент"},
    {"key":"next_step",    "weight":18, "label":"Фиксация следующего шага",
     "hint":"Конкретная дата и договорённость, а не «я перезвоню»"},
    {"key":"tone",         "weight":10, "label":"Тон и инициатива",
     "hint":"Вёл разговор, не перебивал, слушал"}
  ]'::jsonb;
$$;

-- Widgets the dashboard can show. The UI reads this so the catalogue lives in
-- one place; dashboard_prefs.visible_widgets stores a subset, in order.
create or replace function app.dashboard_widget_catalogue()
returns jsonb language sql immutable as $$
  select '[
    {"key":"revenue_at_risk", "label":"Выручка под риском",     "roles":["owner","admin"]},
    {"key":"calls_analyzed",  "label":"Звонков разобрано",      "roles":["owner","admin","lead","manager","viewer"]},
    {"key":"avg_score",       "label":"Средний балл",           "roles":["owner","admin","lead","manager","viewer"]},
    {"key":"score_trend",     "label":"Динамика балла",         "roles":["owner","admin","lead"]},
    {"key":"top_leaks",       "label":"Где чаще всего теряем",  "roles":["owner","admin","lead"]},
    {"key":"dept_ranking",    "label":"Отделы по баллу",        "roles":["owner","admin"]},
    {"key":"manager_ranking", "label":"Менеджеры по баллу",     "roles":["owner","admin","lead"]},
    {"key":"no_next_step",    "label":"Звонки без следующего шага","roles":["owner","admin","lead"]},
    {"key":"missed_followup", "label":"Просроченные обещания",  "roles":["owner","admin","lead","manager"]},
    {"key":"coaching_queue",  "label":"Кого коучить в первую очередь","roles":["owner","admin","lead"]},
    {"key":"usage",           "label":"Расход квоты",           "roles":["owner"]},
    {"key":"recent_calls",    "label":"Последние звонки",       "roles":["owner","admin","lead","manager","viewer"]}
  ]'::jsonb;
$$;

grant execute on function app.dashboard_widget_catalogue() to authenticated;

-- ---------------------------------------------------------------------------
-- create_organization — bootstrap. The caller becomes owner.
--
-- Invite-only pilot: this is granted to service_role only, so an org can be
-- created solely by the Worker during onboarding. Flip the grant to
-- `authenticated` on the day self-serve signup opens.
-- ---------------------------------------------------------------------------
create or replace function app.create_organization(
  org_name text,
  org_slug text,
  owner_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_org uuid;
begin
  insert into organizations (name, slug, created_by)
  values (org_name, lower(org_slug), owner_id)
  returning id into new_org;

  insert into memberships (org_id, user_id, role)
  values (new_org, owner_id, 'owner');

  insert into checklists (org_id, name, items, is_default)
  values (new_org, 'Базовый чек-лист', app.default_checklist_items(), true);

  insert into audit_log (org_id, actor_id, action, target)
  values (new_org, owner_id, 'org.created', new_org::text);

  return new_org;
end;
$$;

revoke all on function app.create_organization(text, text, uuid) from public, anon, authenticated;
grant execute on function app.create_organization(text, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- accept_invite — the only way an authenticated user joins an org.
--
-- Runs as definer because the caller can see neither the invite nor the org
-- until this succeeds. Every check is inside: token validity, expiry, single
-- use, and that the signed-in email matches the invited one (otherwise a
-- leaked link would let anyone in).
-- ---------------------------------------------------------------------------
create or replace function app.accept_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inv        invites%rowtype;
  caller     uuid := auth.uid();
  caller_mail text;
begin
  if caller is null then
    raise exception 'not_authenticated';
  end if;

  select email into caller_mail from auth.users where id = caller;

  select * into inv from invites
  where token = invite_token
  for update;

  if not found then
    raise exception 'invite_not_found';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invite_already_used';
  end if;
  if inv.expires_at < now() then
    raise exception 'invite_expired';
  end if;
  if lower(inv.email) <> lower(caller_mail) then
    raise exception 'invite_email_mismatch';
  end if;

  insert into memberships (org_id, user_id, role, department_id, invited_by)
  values (inv.org_id, caller, inv.role, inv.department_id, inv.invited_by)
  on conflict (org_id, user_id) do update
    set role = excluded.role,
        department_id = excluded.department_id,
        status = 'active',
        updated_at = now();

  update invites
    set accepted_at = now(), accepted_by = caller
    where id = inv.id;

  insert into audit_log (org_id, actor_id, action, target, meta)
  values (inv.org_id, caller, 'invite.accepted', inv.id::text,
          jsonb_build_object('role', inv.role));

  return inv.org_id;
end;
$$;

grant execute on function app.accept_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- my_context — one round trip for "who am I and what may I see".
-- The cabinet calls this immediately after sign-in.
-- ---------------------------------------------------------------------------
create or replace function app.my_context()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'org_id',      o.id,
        'org_name',    o.name,
        'org_slug',    o.slug,
        'plan',        o.plan,
        'role',        m.role,
        'department_id', m.department_id,
        'department',  d.name,
        'quota',       o.monthly_call_quota
      )
      order by o.name
    ),
    '[]'::jsonb
  )
  from memberships m
  join organizations o on o.id = m.org_id
  left join departments d on d.id = m.department_id
  where m.user_id = auth.uid() and m.status = 'active';
$$;

grant execute on function app.my_context() to authenticated;

-- ---------------------------------------------------------------------------
-- Owner safety net: an org must never lose its last owner.
-- ---------------------------------------------------------------------------
create or replace function app.guard_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  remaining integer;
begin
  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner') then
    select count(*) into remaining
    from memberships
    where org_id = old.org_id and role = 'owner' and status = 'active'
      and id <> old.id;

    if remaining = 0 then
      raise exception 'last_owner_protected';
    end if;
  end if;

  return case tg_op when 'DELETE' then old else new end;
end;
$$;

create trigger memberships_guard_last_owner
  before update or delete on memberships
  for each row execute function app.guard_last_owner();

-- ======================================================================
-- 0003_telephony_mapping.sql
-- ======================================================================
-- Map PBX employees onto memberships.
--
-- The telephony connectors identify a manager by their internal extension
-- (see saas/worker/telephony.js → resolveManager). Display names come from the
-- PBX and are hand-typed, so they drift; the extension is the stable key.

alter table memberships
  add column extension text;

-- One extension per organization, but many members may have none.
create unique index memberships_extension_per_org
  on memberships (org_id, extension)
  where extension is not null and extension <> '';

comment on column memberships.extension is
  'Internal PBX number (Ringostat staffid / Binotel internalNumber). Primary key for matching an incoming call to a person.';

-- Organization timezone: both vendors send local wall-clock timestamps with no
-- zone, so without this every call would be stored at the wrong hour and the
-- dashboard''s "calls per day" would split across the wrong days.
alter table organizations
  add column timezone text not null default 'Europe/Kyiv';

-- Which AI provider this organization uses, and whose key pays for it.
-- 'own' = the org's key in org_ai_keys; 'platform' = ours, billed to the plan.
alter table organizations
  add column ai_provider app.ai_provider not null default 'gemini',
  add column ai_model text,
  add column ai_key_source text not null default 'own'
    check (ai_key_source in ('own', 'platform'));

comment on column organizations.ai_key_source is
  'own = client supplies the API key and pays the model vendor directly (pilot default); platform = our key, usage counted against the plan quota.';

-- ======================================================================
-- 0004_growth.sql
-- ======================================================================
-- CallControl growth: more telephony kinds, Telegram delivery, org settings.
--
-- Apply AFTER 0001-0003. Worker code degrades gracefully until this lands
-- (features answer 503 migration_required), so deploy order does not matter.

-- ---------------------------------------------------------------------------
-- 1. Telephony: extend the allowed integration kinds.
--    KEEP THIS LIST IN SYNC with PROVIDERS in saas/worker/telephony.js.
-- ---------------------------------------------------------------------------
alter table integrations drop constraint if exists integrations_kind_check;
alter table integrations
  add constraint integrations_kind_check
  check (kind in ('ringostat', 'binotel', 'phonet', 'unitalk', 'streamtele'));

-- ---------------------------------------------------------------------------
-- 2. Telegram delivery: per-call feedback and the daily digest.
--    chat_id is a Telegram chat identifier (user, group or channel).
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

-- Same visibility rule as integrations: whole-org roles manage delivery.
create policy telegram_select on telegram_recipients for select to authenticated
  using (app.is_org_wide(org_id));
create policy telegram_write on telegram_recipients for all to authenticated
  using (app.is_org_wide(org_id)) with check (app.is_org_wide(org_id));

-- ---------------------------------------------------------------------------
-- 3. Organization settings the dashboard needs.
--    avg_deal_amount powers the "money at risk" estimate (open formula in the
--    UI); ui_language is the org default for new members' interface.
-- ---------------------------------------------------------------------------
alter table organizations
  add column if not exists avg_deal_amount numeric check (avg_deal_amount is null or avg_deal_amount >= 0),
  add column if not exists ui_language text not null default 'uk'
    check (ui_language in ('uk', 'ru', 'en'));

-- ======================================================================
-- 0005_billing_retention.sql
-- ======================================================================
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

-- CallControl: cap the granted role in RLS (privilege-escalation fix).
--
-- Apply AFTER 0001-0005. Idempotent (drop policy if exists).
--
-- WHY: membership_write / invite_write gated only on app.is_org_wide(), which
-- is TRUE for both 'owner' AND 'admin', with no restriction on the ROLE value
-- being written. The cabinet ships the Supabase publishable key and performs
-- RLS-gated writes under the user's own JWT, so an *admin* could run
--     supabase.from('memberships').update({ role: 'owner' })...
--     supabase.from('invites').insert({ role: 'owner', ... })
-- directly against PostgREST and self-promote to owner — gaining billing,
-- AI-key, PBX-credential and org-delete power. app.guard_last_owner only blocks
-- removing the LAST owner; it does not stop MINTING a new one.
--
-- FIX: only an owner may write, modify, or delete an 'owner'-level row. Admins
-- keep full control over every non-owner role (admin/lead/manager/viewer/etc).
-- The rule is applied to BOTH:
--   USING      (the EXISTING row) — an admin cannot touch an existing owner row
--   WITH CHECK (the NEW row)      — an admin cannot create/raise a row to owner
--
-- Legitimate flows are unaffected: onboarding/accept-invite run through
-- SECURITY DEFINER RPCs, and worker-mediated member management uses the service
-- key — both bypass these policies. Only the direct user-JWT PostgREST path
-- (the actual escalation vector) is constrained.

-- memberships --------------------------------------------------------------
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

-- invites -------------------------------------------------------------------
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
