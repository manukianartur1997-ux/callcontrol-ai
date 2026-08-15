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
