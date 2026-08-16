-- Tenant isolation + role hierarchy tests.
--
-- These are the tests that matter most in the whole project: if any of them
-- fails, one client company can read another's sales calls. Every assertion
-- raises an exception on failure, so `psql -v ON_ERROR_STOP=1` turns the file
-- into a pass/fail gate.

\set ON_ERROR_STOP on

create or replace function test_assert(cond boolean, label text)
returns void language plpgsql as $$
begin
  if cond then
    raise notice 'PASS  %', label;
  else
    raise exception 'FAIL  %', label;
  end if;
end;
$$;

-- Acting as a given user: PostgREST sets the role and the JWT claim; we do the
-- same by hand.
create or replace function act_as(u uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, false);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures (as superuser, RLS not in play yet)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'owner@alpha.test'),
  ('22222222-2222-2222-2222-222222222222', 'lead@alpha.test'),
  ('33333333-3333-3333-3333-333333333333', 'manager@alpha.test'),
  ('44444444-4444-4444-4444-444444444444', 'other@alpha.test'),
  ('55555555-5555-5555-5555-555555555555', 'owner@beta.test'),
  ('66666666-6666-6666-6666-666666666666', 'newbie@alpha.test');

select app.create_organization('Alpha Sales', 'alpha', '11111111-1111-1111-1111-111111111111') as alpha \gset
select app.create_organization('Beta Sales',  'beta',  '55555555-5555-5555-5555-555555555555') as beta  \gset

select set_config('test.alpha', :'alpha', false);
select set_config('test.beta',  :'beta',  false);

insert into departments (id, org_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', :'alpha', 'Отдел А'),
  ('aaaaaaaa-0000-0000-0000-000000000002', :'alpha', 'Отдел Б');

insert into memberships (org_id, user_id, role, department_id) values
  (:'alpha', '22222222-2222-2222-2222-222222222222', 'lead',    'aaaaaaaa-0000-0000-0000-000000000001'),
  (:'alpha', '33333333-3333-3333-3333-333333333333', 'manager', 'aaaaaaaa-0000-0000-0000-000000000001'),
  (:'alpha', '44444444-4444-4444-4444-444444444444', 'manager', 'aaaaaaaa-0000-0000-0000-000000000002');

insert into calls (id, org_id, department_id, manager_id, source, external_id) values
  ('cccccccc-0000-0000-0000-000000000001', :'alpha', 'aaaaaaaa-0000-0000-0000-000000000001',
   '33333333-3333-3333-3333-333333333333', 'manual', 'a-1'),
  ('cccccccc-0000-0000-0000-000000000002', :'alpha', 'aaaaaaaa-0000-0000-0000-000000000002',
   '44444444-4444-4444-4444-444444444444', 'manual', 'a-2'),
  ('cccccccc-0000-0000-0000-000000000003', :'beta', null, null, 'manual', 'b-1');

insert into org_ai_keys (org_id, provider, key_ciphertext, key_hint)
values (:'alpha', 'gemini', 'ciphertext-here', '…7f2a');

-- ---------------------------------------------------------------------------
-- 1. Cross-tenant isolation — the one that must never regress
-- ---------------------------------------------------------------------------
set role authenticated;

select act_as('11111111-1111-1111-1111-111111111111');
select test_assert(
  (select count(*) from calls where org_id = :'beta') = 0,
  'Alpha owner sees zero Beta calls');
select test_assert(
  (select count(*) from organizations) = 1,
  'Alpha owner sees exactly one organization');

select act_as('55555555-5555-5555-5555-555555555555');
select test_assert(
  (select count(*) from calls where org_id = :'alpha') = 0,
  'Beta owner sees zero Alpha calls');

-- ---------------------------------------------------------------------------
-- 2. Role hierarchy inside one tenant
-- ---------------------------------------------------------------------------
select act_as('11111111-1111-1111-1111-111111111111');
select test_assert((select count(*) from calls) = 2, 'owner sees both Alpha calls');

select act_as('22222222-2222-2222-2222-222222222222');
select test_assert((select count(*) from calls) = 1, 'lead sees only their department');
select test_assert(
  (select count(*) from calls where id = 'cccccccc-0000-0000-0000-000000000002') = 0,
  'lead cannot see the other department');

select act_as('33333333-3333-3333-3333-333333333333');
select test_assert((select count(*) from calls) = 1, 'manager sees only their own call');

select act_as('66666666-6666-6666-6666-666666666666');
select test_assert((select count(*) from calls) = 0, 'user with no membership sees nothing');
select test_assert((select count(*) from organizations) = 0, 'non-member sees no orgs');

-- ---------------------------------------------------------------------------
-- 3. Secrets are unreachable through the data API for everyone
-- ---------------------------------------------------------------------------
select act_as('11111111-1111-1111-1111-111111111111');
select test_assert(
  (select count(*) from org_ai_keys) = 0,
  'even the owner cannot read AI keys via the data API');

-- ---------------------------------------------------------------------------
-- 4. Writes respect scope
-- ---------------------------------------------------------------------------
select act_as('33333333-3333-3333-3333-333333333333');
do $$
begin
  begin
    insert into calls (org_id, department_id, manager_id, source, external_id)
    values (current_setting('test.alpha')::uuid,
            'aaaaaaaa-0000-0000-0000-000000000002',
            '44444444-4444-4444-4444-444444444444', 'manual', 'forged');
    raise exception 'FAIL  manager forged a call for another manager';
  exception
    when insufficient_privilege then
      raise notice 'PASS  manager cannot insert a call for someone else';
    when others then
      if sqlstate = 'P0001' and sqlerrm like 'FAIL%' then raise; end if;
      raise notice 'PASS  manager insert blocked (%).', sqlstate;
  end;
end $$;

select act_as('33333333-3333-3333-3333-333333333333');
insert into calls (org_id, department_id, manager_id, source, external_id)
values (:'alpha', 'aaaaaaaa-0000-0000-0000-000000000001',
        '33333333-3333-3333-3333-333333333333', 'manual', 'a-own');
select test_assert((select count(*) from calls) = 2, 'manager can insert their own call');

-- ---------------------------------------------------------------------------
-- 5. Invite flow
-- ---------------------------------------------------------------------------
reset role;
insert into invites (org_id, email, role, department_id, token)
values (:'alpha', 'newbie@alpha.test', 'manager',
        'aaaaaaaa-0000-0000-0000-000000000001', 'tok-good'),
       (:'alpha', 'someone-else@alpha.test', 'admin', null, 'tok-wrong-mail'),
       (:'alpha', 'newbie@alpha.test', 'admin', null, 'tok-expired');
update invites set expires_at = now() - interval '1 day' where token = 'tok-expired';

set role authenticated;
select act_as('66666666-6666-6666-6666-666666666666');

do $$
begin
  begin
    perform app.accept_invite('tok-wrong-mail');
    raise exception 'FAIL  invite accepted with mismatched email';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'PASS  invite rejected for a different email (%)', sqlerrm;
  end;

  begin
    perform app.accept_invite('tok-expired');
    raise exception 'FAIL  expired invite accepted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'PASS  expired invite rejected (%)', sqlerrm;
  end;
end $$;

select test_assert(
  app.accept_invite('tok-good') is not null,
  'valid invite accepted');
select test_assert(
  (select count(*) from calls) = 0,
  'newly joined manager sees no calls of their own yet');

do $$
begin
  begin
    perform app.accept_invite('tok-good');
    raise exception 'FAIL  invite reused';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'PASS  invite cannot be reused (%)', sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 6. my_context
-- ---------------------------------------------------------------------------
select act_as('22222222-2222-2222-2222-222222222222');
select test_assert(
  jsonb_array_length(app.my_context()) = 1
  and app.my_context() -> 0 ->> 'role' = 'lead'
  and app.my_context() -> 0 ->> 'department' = 'Отдел А',
  'my_context returns org, role and department');

-- ---------------------------------------------------------------------------
-- 7. Last owner cannot be removed
-- ---------------------------------------------------------------------------
reset role;
do $$
declare a uuid := current_setting('test.alpha')::uuid;
begin
  begin
    delete from memberships where org_id = a and role = 'owner';
    raise exception 'FAIL  last owner was deleted';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'PASS  last owner is protected (%)', sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Quota guard
-- ---------------------------------------------------------------------------
do $$
declare a uuid := current_setting('test.alpha')::uuid;
begin
  update organizations set monthly_call_quota = 1 where id = a;
  perform app.assert_within_quota(a);          -- 0 used, quota 1 -> ok
  perform app.record_usage(a, 100, 50);        -- now 1 used
  begin
    perform app.assert_within_quota(a);
    raise exception 'FAIL  quota not enforced';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'PASS  quota enforced (%)', sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Role-cap: an admin cannot mint or become an owner (migration 0006)
--    This is the admin->owner privilege-escalation guard. Without 0006 an admin
--    could self-promote via a direct PostgREST write under their own JWT.
-- ---------------------------------------------------------------------------
reset role;
insert into auth.users (id, email) values
  ('77777777-7777-7777-7777-777777777777', 'admin@alpha.test');
insert into memberships (org_id, user_id, role, department_id) values
  (:'alpha', '77777777-7777-7777-7777-777777777777', 'admin', null);

set role authenticated;
select act_as('77777777-7777-7777-7777-777777777777');

-- (a) admin cannot RAISE an existing membership to owner
do $$
begin
  begin
    update memberships set role = 'owner'
      where org_id = current_setting('test.alpha')::uuid
        and user_id = '33333333-3333-3333-3333-333333333333';
    if found then raise exception 'FAIL  admin promoted a member to owner'; end if;
    raise notice 'PASS  admin update to owner affected no rows (USING blocks it)';
  exception when insufficient_privilege then
    raise notice 'PASS  admin cannot promote a member to owner';
  when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'PASS  admin promote-to-owner blocked (%).', sqlstate;
  end;
end $$;

-- (b) admin cannot INVITE at owner level (the indirect mint path)
do $$
begin
  begin
    insert into invites (org_id, email, role, token)
    values (current_setting('test.alpha')::uuid, 'plant@alpha.test', 'owner', 'tok-owner');
    raise exception 'FAIL  admin created an owner-level invite';
  exception when insufficient_privilege then
    raise notice 'PASS  admin cannot create an owner-level invite';
  when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'PASS  admin owner-invite blocked (%).', sqlstate;
  end;
end $$;

-- (c) positive control: admin CAN still manage non-owner roles
update memberships set role = 'lead'
  where org_id = current_setting('test.alpha')::uuid
    and user_id = '33333333-3333-3333-3333-333333333333';
select test_assert(
  (select role from memberships
     where org_id = current_setting('test.alpha')::uuid
       and user_id = '33333333-3333-3333-3333-333333333333') = 'lead',
  'admin can still set a non-owner role (manager -> lead)');
-- restore the fixture role so later reasoning about it is unsurprising
update memberships set role = 'manager'
  where org_id = current_setting('test.alpha')::uuid
    and user_id = '33333333-3333-3333-3333-333333333333';

-- ---------------------------------------------------------------------------
-- 10. New tables (0004/0005) are tenant-isolated: only org-wide roles read them
-- ---------------------------------------------------------------------------
reset role;
insert into usage_ledger (org_id, call_id, minutes, rate, currency, cost) values
  (:'alpha', 'cccccccc-0000-0000-0000-000000000001', 3, 4, 'UAH', 12);
insert into telegram_recipients (org_id, chat_id, kind, label) values
  (:'alpha', '123456789', 'per_call', 'Alpha ops');

set role authenticated;

-- Beta owner sees NONE of Alpha's billing or delivery rows
select act_as('55555555-5555-5555-5555-555555555555');
select test_assert((select count(*) from usage_ledger) = 0, 'Beta owner sees no Alpha ledger rows');
select test_assert((select count(*) from telegram_recipients) = 0, 'Beta owner sees no Alpha telegram rows');

-- An Alpha manager (not org-wide) sees neither (RLS select = app.is_org_wide)
select act_as('33333333-3333-3333-3333-333333333333');
select test_assert((select count(*) from usage_ledger) = 0, 'Alpha manager cannot see the money ledger');
select test_assert((select count(*) from telegram_recipients) = 0, 'Alpha manager cannot see telegram routing');

-- The Alpha owner does see their own org's rows
select act_as('11111111-1111-1111-1111-111111111111');
select test_assert((select count(*) from usage_ledger) = 1, 'Alpha owner sees their ledger');
select test_assert((select count(*) from telegram_recipients) = 1, 'Alpha owner sees their telegram routing');

select 'ALL TESTS PASSED' as result;
