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
