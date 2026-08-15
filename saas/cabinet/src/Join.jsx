// #/join/<token> for an already-signed-in user (typical case: signed up via
// Google, then clicked an invite link). Fires /join-authed automatically on
// mount and shows the outcome:
//   ok             -> onJoined() (App reloads /me and navigates to dashboard)
//   already_member -> message + button into the cabinet
//   invite_invalid -> message + sign-out (maybe the invite is for another
//                     email — signing out lets them retry as the right user)
import { useEffect, useState } from "react";
import { joinAuthed } from "./api.js";
import { copy } from "./copy.js";
import { humanApiError } from "./format.js";
import { Spinner } from "./ui.jsx";
import { BrandMark } from "./Shell.jsx";

export function JoinToken({ token, onJoined, onSignOut }) {
  const [state, setState] = useState({ phase: "working", error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ phase: "working", error: null });
    joinAuthed(token)
      .then(() => {
        if (!cancelled) setState({ phase: "done", error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err && err.error === "already_member") setState({ phase: "already", error: null });
        else setState({ phase: "error", error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Success: leave this screen via the parent (reload /me + go to dashboard).
  useEffect(() => {
    if (state.phase === "done") onJoined();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <BrandMark />
          <span className="brand-name brand-name-dark">{copy.common.appName}</span>
        </div>
        <h1 className="auth-title">{copy.join.title}</h1>

        {state.phase === "working" || state.phase === "done" ? (
          <div className="join-progress">
            <Spinner />
            <span>{copy.join.checking}</span>
          </div>
        ) : state.phase === "already" ? (
          <>
            <p className="auth-subtitle">{copy.join.alreadyMember}</p>
            <button type="button" className="btn btn-primary btn-block" onClick={onJoined}>
              {copy.join.open}
            </button>
          </>
        ) : (
          <>
            <div className="form-error" role="alert">
              {humanApiError(state.error)}
            </div>
            <button type="button" className="btn btn-ghost btn-block" onClick={onSignOut}>
              {copy.common.signOut}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
