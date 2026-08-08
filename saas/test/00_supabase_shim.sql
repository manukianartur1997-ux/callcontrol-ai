-- Minimal stand-in for the parts of Supabase the migrations depend on, so the
-- schema can be applied and tested against a plain Postgres container.
-- NOT part of the real deployment — Supabase provides all of this already.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema if not exists auth;

create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique not null
);

-- Supabase derives auth.uid() from the request JWT. PostgREST exposes the
-- claims as the `request.jwt.claims` GUC; the tests below set it directly.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claim.sub', true),
    ''
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- PostgREST grants table privileges separately from RLS; mirror the defaults
-- so a policy failure surfaces as "0 rows", not "permission denied".
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
