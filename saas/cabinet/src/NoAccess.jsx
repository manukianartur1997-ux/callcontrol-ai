// Zero-membership landing (the spot a fresh Google signup arrives at). Two
// self-serve exits plus sign-out:
//   - invite code  -> /join-authed  -> reload /me, workspace appears
//   - new company  -> /orgs (JWT + SIGNUP_CODE gate) -> reload /me
// Each card owns its busy/error state; after onReload() succeeds the parent
// refetches /me and this screen unmounts, so no success state is needed.
import { useState } from "react";
import { joinAuthed, createOrg } from "./api.js";
import { copy } from "./copy.js";
import { humanApiError } from "./format.js";
import { Spinner } from "./ui.jsx";
import { BrandMark } from "./Shell.jsx";

export function NoAccess({ onReload, onSignOut }) {
  const [inviteCode, setInviteCode] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState(null);

  const [orgName, setOrgName] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState(null);

  const busy = inviteBusy || createBusy;

  async function submitInvite(e) {
    e.preventDefault();
    setInviteBusy(true);
    setInviteError(null);
    try {
      await joinAuthed(inviteCode.trim());
    } catch (err) {
      setInviteBusy(false);
      // already_member with zero memberships should not happen, but the code
      // maps to human text via copy.errors just like invite_invalid.
      setInviteError(humanApiError(err));
      return;
    }
    onReload();
  }

  async function submitCreate(e) {
    e.preventDefault();
    setCreateBusy(true);
    setCreateError(null);
    try {
      await createOrg({ signup_code: signupCode.trim(), org_name: orgName.trim() });
    } catch (err) {
      setCreateBusy(false);
      setCreateError(humanApiError(err));
      return;
    }
    onReload();
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card auth-card-wide">
        <div className="auth-brand">
          <BrandMark />
          <span className="brand-name brand-name-dark">{copy.common.appName}</span>
        </div>
        <h1 className="auth-title">{copy.noAccess.title}</h1>
        <p className="auth-subtitle">{copy.noAccess.text}</p>

        <form className="access-card" onSubmit={submitInvite}>
          <h2 className="access-card-title">{copy.noAccess.inviteTitle}</h2>
          <label className="field">
            <span className="label">{copy.noAccess.inviteCode}</span>
            <input
              className="input"
              type="text"
              required
              placeholder={copy.noAccess.inviteCodePlaceholder}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              disabled={busy}
            />
          </label>
          {inviteError ? (
            <div className="form-error" role="alert">
              {inviteError}
            </div>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {inviteBusy ? <Spinner small /> : null}
            {inviteBusy ? copy.noAccess.inviteSubmitting : copy.noAccess.inviteSubmit}
          </button>
        </form>

        <form className="access-card" onSubmit={submitCreate}>
          <h2 className="access-card-title">{copy.noAccess.createTitle}</h2>
          <label className="field">
            <span className="label">{copy.noAccess.orgName}</span>
            <input
              className="input"
              type="text"
              required
              autoComplete="organization"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="field">
            <span className="label">{copy.noAccess.signupCode}</span>
            <input
              className="input"
              type="text"
              required
              value={signupCode}
              onChange={(e) => setSignupCode(e.target.value)}
              disabled={busy}
            />
            <span className="field-hint">{copy.noAccess.signupCodeHint}</span>
          </label>
          {createError ? (
            <div className="form-error" role="alert">
              {createError}
            </div>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {createBusy ? <Spinner small /> : null}
            {createBusy ? copy.noAccess.createSubmitting : copy.noAccess.createSubmit}
          </button>
        </form>

        <button type="button" className="btn btn-ghost btn-block" onClick={onSignOut} disabled={busy}>
          {copy.common.signOut}
        </button>
      </div>
    </div>
  );
}
