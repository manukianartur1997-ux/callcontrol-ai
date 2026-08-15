// Entry screen with three modes behind a tab switcher:
//   signin   — email+password or Google OAuth (both are pure Supabase auth);
//   invite   — anonymous invite acceptance: Worker /join creates account +
//              membership, then we sign in with the same credentials;
//   register — pilot signup gated by SIGNUP_CODE: Worker /register-org
//              creates account + organization, then the same sign-in.
//
// #/join/<token> lands here (via App) with mode "invite" and the code
// prefilled. Email/password/name state is shared across tabs on purpose:
// switching tabs must not eat what the user already typed.
import { useState } from "react";
import { supabase } from "./supabase.js";
import { copy } from "./copy.js";
import { navigate } from "./router.js";
import { joinWithInvite, registerOrg } from "./api.js";
import { humanApiError } from "./format.js";
import { BrandMark } from "./Shell.jsx";

const MIN_PASSWORD = 8;

export function Login({ initialMode = "signin", inviteToken = null }) {
  const [mode, setMode] = useState(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviteCode, setInviteCode] = useState(inviteToken || "");
  const [signupCode, setSignupCode] = useState("");
  const [orgName, setOrgName] = useState("");

  const tabs = [
    { id: "signin", label: copy.login.tabSignIn },
    { id: "invite", label: copy.login.tabInvite },
    { id: "register", label: copy.login.tabRegister }
  ];

  function switchMode(next) {
    if (busy) return;
    setMode(next);
    setError(null);
  }

  // The account now exists with exactly these credentials, so a failure here
  // is infrastructure, not bad input. On success onAuthStateChange in App.jsx
  // takes over; no local navigation.
  async function signInAfterCreate() {
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (err) {
      setBusy(false);
      setError(copy.login.errorGeneric);
    }
  }

  async function submitSignIn(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (err) {
      setBusy(false);
      // 400 from GoTrue = bad credentials; anything else is infrastructure.
      setError(err.status === 400 ? copy.login.errorInvalid : copy.login.errorGeneric);
    }
  }

  async function signInGoogle() {
    setBusy(true);
    setError(null);
    // On success the browser navigates to Google and never comes back here;
    // the redirect returns to /app/ where supabase-js picks the session up.
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/app/" }
    });
    if (err) {
      setBusy(false);
      const notEnabled = /provider|not.{0,8}enabled|disabled|unsupported/i.test(err.message || "");
      setError(notEnabled ? copy.login.googleNotEnabled : copy.login.errorGeneric);
    }
  }

  async function submitInvite(e) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(copy.password.tooShort);
      return;
    }
    setBusy(true);
    try {
      await joinWithInvite({
        token: inviteCode.trim(),
        email: email.trim(),
        password,
        full_name: fullName.trim()
      });
    } catch (err) {
      setBusy(false);
      const code = err && err.error;
      if (code === "invite_invalid") setError(copy.login.invite.invalid);
      else if (code === "email_exists") setError(copy.login.invite.emailExists);
      else if (code === "weak_password") setError(copy.errors.weak_password);
      else setError(humanApiError(err));
      return;
    }
    // Drop #/join/<token> BEFORE the session lands: otherwise Authed would
    // see the join route and fire a second (already_member) join-authed.
    navigate("/");
    await signInAfterCreate();
  }

  async function submitRegister(e) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(copy.password.tooShort);
      return;
    }
    setBusy(true);
    try {
      const result = await registerOrg({
        signup_code: signupCode.trim(),
        org_name: orgName.trim(),
        email: email.trim(),
        password,
        full_name: fullName.trim()
      });
      // Confirmations on: password sign-in will fail until the emailed link
      // is clicked, so don't even try — explain instead.
      if (result?.email_confirmation_required) {
        setBusy(false);
        setInfo(copy.login.register.confirmSent);
        return;
      }
    } catch (err) {
      setBusy(false);
      const code = err && err.error;
      if (code === "bad_signup_code") setError(copy.login.register.badCode);
      else if (code === "signup_closed") setError(copy.login.register.closed);
      else if (code === "email_exists") setError(copy.login.register.emailExists);
      else if (code === "weak_password") setError(copy.errors.weak_password);
      else setError(humanApiError(err));
      return;
    }
    await signInAfterCreate();
  }

  const emailField = (autoComplete) => (
    <label className="field">
      <span className="label">{copy.login.email}</span>
      <input
        className="input"
        type="email"
        required
        autoComplete={autoComplete}
        placeholder={copy.login.emailPlaceholder}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={busy}
      />
    </label>
  );

  const passwordField = (autoComplete, withHint) => (
    <label className="field">
      <span className="label">{copy.login.password}</span>
      <input
        className="input"
        type="password"
        required
        minLength={withHint ? MIN_PASSWORD : undefined}
        autoComplete={autoComplete}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={busy}
      />
      {withHint ? <span className="field-hint">{copy.login.passwordHint}</span> : null}
    </label>
  );

  const nameField = (
    <label className="field">
      <span className="label">{copy.login.fullName}</span>
      <input
        className="input"
        type="text"
        required
        autoComplete="name"
        placeholder={copy.login.fullNamePlaceholder}
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        disabled={busy}
      />
    </label>
  );

  const infoBlock = info ? (
    <div className="form-ok" role="status">
      {info}
    </div>
  ) : null;

  const errorBlock = error ? (
    <div className="form-error" role="alert">
      {error}
    </div>
  ) : null;

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <BrandMark />
          <span className="brand-name brand-name-dark">{copy.common.appName}</span>
        </div>
        <h1 className="auth-title">{copy.login.title}</h1>
        <p className="auth-subtitle">{copy.login.subtitle}</p>

        <div className="auth-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={mode === t.id}
              className={mode === t.id ? "auth-tab active" : "auth-tab"}
              onClick={() => switchMode(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mode === "signin" ? (
          <form className="auth-form" onSubmit={submitSignIn}>
            {emailField("email")}
            {passwordField("current-password", false)}
            {errorBlock}
        {infoBlock}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? copy.login.submitting : copy.login.submit}
            </button>
            <div className="auth-divider">{copy.login.orDivider}</div>
            <button
              className="btn btn-ghost btn-block"
              type="button"
              disabled={busy}
              onClick={signInGoogle}
            >
              {copy.login.google}
            </button>
          </form>
        ) : mode === "invite" ? (
          <form className="auth-form" onSubmit={submitInvite}>
            <label className="field">
              <span className="label">{copy.login.invite.code}</span>
              <input
                className="input"
                type="text"
                required
                placeholder={copy.login.invite.codePlaceholder}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                disabled={busy}
              />
            </label>
            {emailField("email")}
            {passwordField("new-password", true)}
            {nameField}
            {errorBlock}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? copy.login.invite.submitting : copy.login.invite.submit}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={submitRegister}>
            <label className="field">
              <span className="label">{copy.login.register.signupCode}</span>
              <input
                className="input"
                type="text"
                required
                value={signupCode}
                onChange={(e) => setSignupCode(e.target.value)}
                disabled={busy}
              />
              <span className="field-hint">{copy.login.register.signupCodeHint}</span>
            </label>
            <label className="field">
              <span className="label">{copy.login.register.orgName}</span>
              <input
                className="input"
                type="text"
                required
                autoComplete="organization"
                placeholder={copy.login.register.orgNamePlaceholder}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={busy}
              />
            </label>
            {emailField("email")}
            {passwordField("new-password", true)}
            {nameField}
            {errorBlock}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? copy.login.register.submitting : copy.login.register.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
