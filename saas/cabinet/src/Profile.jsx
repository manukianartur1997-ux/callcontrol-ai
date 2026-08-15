// Personal profile (#/profile), reachable by EVERY role from the sidebar
// user block. Everything here runs under the user's own Supabase session via
// supabase.auth.updateUser — no Worker endpoint and no service key involved.
//
// Layout: page header + a two-column card grid (identity: avatar + name;
// security: email + password) that collapses to one column under 900px.
// Field/label rhythm intentionally matches Settings (.field/.label/.input).
//
// Name and avatar live in auth user_metadata and affect only how the user
// sees themselves; memberships.full_name (what the team sees) is owner-managed
// and deliberately untouched here.
import { useState } from "react";
import { supabase } from "./supabase.js";
import { copy } from "./copy.js";
import { humanApiError } from "./format.js";
import { Card, Spinner, Avatar } from "./ui.jsx";
import { PasswordModal } from "./PasswordModal.jsx";

const AVATAR_SIDE = 128;
// user_metadata rides inside the JWT, so the stored data-URL must stay tiny.
// The cap is on the encoded string — that is exactly what gets stored.
const AVATAR_MAX_CHARS = 48 * 1024;

// File -> square 128px JPEG data-URL via canvas (cover-crop, center).
// Throws Error("bad_file") for unreadable input, Error("too_big") when even
// the downscaled JPEG exceeds the cap (e.g. extremely noisy images).
async function fileToAvatar(file) {
  if (!file.type || !file.type.startsWith("image/")) throw new Error("bad_file");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("bad_file"));
      image.src = url;
    });
    if (!img.width || !img.height) throw new Error("bad_file");
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIDE;
    canvas.height = AVATAR_SIDE;
    const ctx = canvas.getContext("2d");
    const scale = Math.max(AVATAR_SIDE / img.width, AVATAR_SIDE / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (AVATAR_SIDE - w) / 2, (AVATAR_SIDE - h) / 2, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    if (dataUrl.length > AVATAR_MAX_CHARS) throw new Error("too_big");
    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function Profile({ session }) {
  // session.user refreshes on USER_UPDATED (App listens to onAuthStateChange),
  // so every save below re-renders this page with fresh metadata.
  const meta = session.user.user_metadata || {};
  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{copy.profile.title}</h1>
      </div>
      <div className="profile-grid">
        <IdentityCard meta={meta} email={session.user.email} />
        <SecurityCard email={session.user.email} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Identity: avatar + display name in one card.
// ---------------------------------------------------------------------------
function IdentityCard({ meta, email }) {
  return (
    <Card title={copy.profile.identityTitle}>
      <div className="profile-stack">
        <PhotoBlock meta={meta} email={email} />
        <hr className="card-divider" />
        <NameBlock meta={meta} />
      </div>
    </Card>
  );
}

function PhotoBlock({ meta, email }) {
  const [busy, setBusy] = useState(false);
  const [okText, setOkText] = useState(null);
  const [error, setError] = useState(null);

  const current = meta.avatar || null;
  const displayName = meta.full_name || email;

  async function saveAvatar(value, doneText) {
    setBusy(true);
    setOkText(null);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ data: { avatar: value } });
    setBusy(false);
    if (err) setError(humanApiError(err));
    else setOkText(doneText);
  }

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-picking the same file after an error
    if (!file) return;
    setBusy(true);
    setOkText(null);
    setError(null);
    let dataUrl;
    try {
      dataUrl = await fileToAvatar(file);
    } catch (err) {
      setBusy(false);
      setError(err && err.message === "too_big" ? copy.profile.photoTooBig : copy.profile.photoBadFile);
      return;
    }
    await saveAvatar(dataUrl, copy.profile.photoSaved);
  }

  return (
    <div className="profile-block">
      <div className="profile-avatar-row">
        <Avatar name={displayName} src={current || meta.picture || meta.avatar_url || null} size={64} />
        <div className="profile-avatar-actions">
          <label className={busy ? "btn btn-ghost btn-disabled" : "btn btn-ghost"}>
            {copy.profile.photoUpload}
            <input type="file" accept="image/*" hidden onChange={onFile} disabled={busy} />
          </label>
          {current ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => saveAvatar(null, copy.profile.photoRemoved)}
            >
              {copy.profile.photoRemove}
            </button>
          ) : null}
          {busy ? <Spinner small /> : null}
        </div>
      </div>
      <p className="field-hint">{copy.profile.photoNote}</p>
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}
      {okText ? <p className="form-ok">{okText}</p> : null}
    </div>
  );
}

function NameBlock({ meta }) {
  const [name, setName] = useState(meta.full_name || "");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState(null);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setOk(false);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({
      data: { full_name: name.trim() || null }
    });
    setBusy(false);
    if (err) setError(humanApiError(err));
    else setOk(true);
  }

  return (
    <form className="profile-block" onSubmit={save}>
      <label className="field">
        <span className="label">{copy.profile.nameLabel}</span>
        <input
          className="input"
          type="text"
          autoComplete="name"
          placeholder={copy.login.fullNamePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
        />
        <span className="field-hint">{copy.profile.nameNote}</span>
      </label>
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}
      {ok ? <p className="form-ok">{copy.profile.saved}</p> : null}
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? <Spinner small /> : null}
          {busy ? copy.profile.saving : copy.profile.save}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Security: email change + password change in one card.
// ---------------------------------------------------------------------------
function SecurityCard({ email }) {
  return (
    <Card title={copy.profile.securityTitle}>
      <div className="profile-stack">
        <EmailBlock email={email} />
        <hr className="card-divider" />
        <PasswordBlock />
      </div>
    </Card>
  );
}

function EmailBlock({ email }) {
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setSent(false);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ email: next.trim() });
    setBusy(false);
    if (err) {
      setError(/already/i.test(err.message || "") ? copy.errors.email_exists : humanApiError(err));
      return;
    }
    setSent(true);
    setNext("");
  }

  return (
    <form className="profile-block" onSubmit={save}>
      <div className="field">
        <span className="label">{copy.profile.emailTitle}</span>
        <p className="profile-current">
          {copy.profile.emailCurrent} <strong>{email}</strong>
        </p>
      </div>
      <label className="field">
        <span className="label">{copy.profile.emailLabel}</span>
        <input
          className="input"
          type="email"
          required
          autoComplete="email"
          placeholder={copy.login.emailPlaceholder}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          disabled={busy}
        />
        <span className="field-hint">{copy.profile.emailNote}</span>
      </label>
      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}
      {sent ? <p className="form-ok">{copy.profile.emailSent}</p> : null}
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? <Spinner small /> : null}
          {busy ? copy.profile.saving : copy.profile.save}
        </button>
      </div>
    </form>
  );
}

function PasswordBlock() {
  const [open, setOpen] = useState(false);
  return (
    <div className="profile-block">
      <div className="field">
        <span className="label">{copy.profile.passwordTitle}</span>
        <p className="field-hint">{copy.profile.passwordNote}</p>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
          {copy.password.change}
        </button>
      </div>
      {open ? <PasswordModal onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
