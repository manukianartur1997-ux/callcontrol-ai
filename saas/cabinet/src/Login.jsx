// Sign-in screen. Auth itself is entirely Supabase's job; this form only
// collects credentials and translates the error into human text. There is no
// self-serve signup on the pilot (invite-only), so no registration link.
import { useState } from "react";
import { supabase } from "./supabase.js";
import { copy } from "./copy.js";
import { BrandMark } from "./Shell.jsx";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setBusy(false);
      // 400 from GoTrue = bad credentials; anything else is infrastructure.
      setError(err.status === 400 ? copy.login.errorInvalid : copy.login.errorGeneric);
    }
    // On success onAuthStateChange in App.jsx takes over; no local navigation.
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <BrandMark />
          <span className="brand-name brand-name-dark">{copy.common.appName}</span>
        </div>
        <h1 className="auth-title">{copy.login.title}</h1>
        <p className="auth-subtitle">{copy.login.subtitle}</p>

        <label className="field">
          <span className="label">{copy.login.email}</span>
          <input
            className="input"
            type="email"
            required
            autoComplete="email"
            placeholder={copy.login.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="label">{copy.login.password}</span>
          <input
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error ? (
          <div className="form-error" role="alert">
            {error}
          </div>
        ) : null}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? copy.login.submitting : copy.login.submit}
        </button>
      </form>
    </div>
  );
}
