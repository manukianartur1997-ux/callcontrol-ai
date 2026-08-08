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
