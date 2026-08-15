// Small presentational building blocks shared by every screen.
import { useEffect } from "react";
import { copy } from "./copy.js";
import { humanApiError, scoreTone } from "./format.js";

export function Spinner({ small }) {
  return <span className={small ? "spinner spinner-sm" : "spinner"} aria-label={copy.common.loading} />;
}

// Full-area centered spinner: app boot and screen-level loading.
export function CenterSpinner() {
  return (
    <div className="center-fill">
      <Spinner />
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="error-box" role="alert">
      <span>{humanApiError(error)}</span>
      {onRetry ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          {copy.common.retry}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {text ? <p className="empty-text">{text}</p> : null}
      {action || null}
    </div>
  );
}

export function Card({ title, action, children, className }) {
  return (
    <section className={className ? `card ${className}` : "card"}>
      {title ? (
        <div className="card-head">
          <h2 className="card-title">{title}</h2>
          {action || null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

// Colored score chip; thresholds live in scoreTone().
export function ScoreBadge({ score }) {
  if (score == null) return <span className="muted">{copy.common.dash}</span>;
  return <span className={`score score-${scoreTone(score)}`}>{Math.round(score)}</span>;
}

export function StatusBadge({ status }) {
  const label = copy.statuses[status] || status;
  return <span className={`chip chip-status-${status}`}>{label}</span>;
}

export function SeverityChip({ severity }) {
  const label = copy.severity[severity] || severity;
  return <span className={`chip chip-sev-${severity}`}>{label}</span>;
}

// Direction as an arrow glyph with an accessible title. Pure text, no icon
// packs allowed in this project.
export function DirectionMark({ direction }) {
  const known = direction === "inbound" || direction === "outbound";
  const title = copy.directions[known ? direction : "unknown"];
  const glyph = direction === "inbound" ? "↙" : direction === "outbound" ? "↗" : "·";
  return (
    <span className={`dir dir-${known ? direction : "unknown"}`} title={title} aria-label={title}>
      {glyph}
    </span>
  );
}

// Modal with overlay; closes on Escape and overlay click. Kept deliberately
// dumb — the caller owns all state.
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={wide ? "modal modal-wide" : "modal"} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label={copy.common.close}>
            {"×"}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Table body skeleton while a list loads: shimmering placeholder rows.
export function SkeletonRows({ rows = 5, cols = 5 }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="skeleton-row">
          {Array.from({ length: cols }, (_, c) => (
            <td key={c}>
              <span className="skeleton" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonBlock({ lines = 3 }) {
  return (
    <div className="skeleton-stack">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton" />
      ))}
    </div>
  );
}
