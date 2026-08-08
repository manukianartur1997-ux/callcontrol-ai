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
