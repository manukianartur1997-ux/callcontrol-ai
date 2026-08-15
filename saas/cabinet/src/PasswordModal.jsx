// Self-service password change for the signed-in user. Lives in the sidebar
// user block so EVERY role has it — Settings is owner/admin-only, and a
// manager must not need an admin to rotate their own password.
//
// supabase.auth.updateUser runs under the user's own session, so no Worker
// endpoint and no service key are involved.
import { useState } from "react";
import { supabase } from "./supabase.js";
import { copy } from "./copy.js";
import { Modal, Spinner } from "./ui.jsx";

const MIN_LENGTH = 8;

export function PasswordModal({ onClose }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(copy.password.tooShort);
      return;
    }
    if (password !== repeat) {
      setError(copy.password.mismatch);
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      // Supabase returns its own English message; the common case worth a
      // human translation is "same password".
      setError(
        /different from the old/i.test(updateError.message)
          ? copy.password.samePassword
          : updateError.message
      );
      return;
    }
    setDone(true);
  };

  return (
    <Modal title={copy.password.title} onClose={busy ? () => {} : onClose}>
      {done ? (
        <div className="modal-body">
          <p className="form-ok">{copy.password.done}</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              {copy.common.close}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="modal-body">
          <label className="field">
            <span className="label">{copy.password.newLabel}</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              autoFocus
            />
          </label>
          <label className="field">
            <span className="label">{copy.password.repeatLabel}</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              disabled={busy}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
              {copy.common.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <Spinner small /> : copy.password.submit}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
