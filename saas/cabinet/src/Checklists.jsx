// Checklist editor (owner/admin) at #/checklists. A checklist is the set of
// weighted stages the AI grades a call against; weights sum to 100. The Worker
// endpoints (GET/POST/PUT/DELETE .../checklists, .../make-default) are built in
// parallel, so every call degrades on 404/501 to an "unavailable yet" note
// rather than an error wall.
import { useEffect, useMemo, useState } from "react";
import {
  fetchChecklists,
  fetchChecklist,
  createChecklist,
  updateChecklist,
  makeChecklistDefault,
  deleteChecklist
} from "./api.js";
import { copy } from "./copy.js";
import { useAsync } from "./hooks.js";
import { pluralRu, humanApiError } from "./format.js";
import { Card, EmptyState, ErrorBox, Modal, SkeletonBlock, Spinner } from "./ui.jsx";

// 404/501 both mean "endpoint not shipped yet" — surface the same soft note.
function isUnavailable(err) {
  return err && (err.status === 404 || err.status === 501);
}

// Slug a human label into a stable machine key: latin/digits, hyphen-joined.
// Cyrillic labels collapse to empty, so we keep a positional fallback.
function slugify(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

let rowSeq = 0;
function blankRow() {
  return { rowId: ++rowSeq, key: "", label: "", weight: "", hint: "", keyEdited: false };
}

function normalizeList(raw) {
  const list = Array.isArray(raw) ? raw : raw?.checklists || [];
  return list.map((c) => ({
    id: c.id,
    name: c.name || "",
    items: Array.isArray(c.items) ? c.items : [],
    is_default: Boolean(c.is_default)
  }));
}

export function Checklists({ org }) {
  const t = copy.checklists;
  const { loading, data, error, reload } = useAsync(async () => {
    try {
      return { list: normalizeList(await fetchChecklists(org.org_id)) };
    } catch (err) {
      if (isUnavailable(err)) return { unavailable: true, list: [] };
      throw err;
    }
  }, [org.org_id]);

  // null = closed; { id?, name?, items? } = editing (id present) or new.
  const [editing, setEditing] = useState(null);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{t.title}</h1>
        {!data?.unavailable ? (
          <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
            {t.create}
          </button>
        ) : null}
      </div>
      <p className="muted page-explainer">{t.explainer}</p>

      {error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : loading ? (
        <Card>
          <SkeletonBlock lines={4} />
        </Card>
      ) : data.unavailable ? (
        <Card>
          <p className="warning">{t.unavailable}</p>
        </Card>
      ) : data.list.length === 0 ? (
        <Card>
          <EmptyState
            title={t.empty}
            text={t.emptyHint}
            action={
              <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>
                {t.create}
              </button>
            }
          />
        </Card>
      ) : (
        <Card className="card-flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t.thName}</th>
                  <th>{t.thItems}</th>
                  <th>{t.thDefault}</th>
                  <th aria-label={t.edit} />
                </tr>
              </thead>
              <tbody>
                {data.list.map((c) => (
                  <ChecklistRow
                    key={c.id}
                    org={org}
                    checklist={c}
                    onEdit={() => setEditing({ id: c.id, name: c.name, items: c.items })}
                    onChanged={reload}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing ? (
        <ChecklistEditor
          org={org}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function ChecklistRow({ org, checklist, onEdit, onChanged }) {
  const t = copy.checklists;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const count = checklist.items.length;
  const unit = pluralRu(count, t.itemsUnit);

  async function makeDefault() {
    setBusy(true);
    setErr(null);
    try {
      await makeChecklistDefault(org.org_id, checklist.id);
      onChanged();
    } catch (e) {
      setErr(e);
    }
    setBusy(false);
  }

  async function remove() {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t.deleteConfirm)) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteChecklist(org.org_id, checklist.id);
      onChanged();
    } catch (e) {
      setErr(e);
    }
    setBusy(false);
  }

  return (
    <tr>
      <td>{checklist.name}</td>
      <td className="nowrap">
        {count} {unit}
      </td>
      <td>
        {checklist.is_default ? <span className="chip chip-green">{t.defaultBadge}</span> : null}
      </td>
      <td className="row-actions">
        {busy ? <Spinner small /> : null}
        {!checklist.is_default ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={makeDefault} disabled={busy}>
            {t.makeDefault}
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit} disabled={busy}>
          {t.edit}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-danger"
          onClick={remove}
          disabled={busy || checklist.is_default}
          title={checklist.is_default ? t.defaultLockHint : undefined}
        >
          {t.remove}
        </button>
        {err ? <div className="form-error-inline">{humanApiError(err)}</div> : null}
      </td>
    </tr>
  );
}

function ChecklistEditor({ org, initial, onClose, onSaved }) {
  const t = copy.checklists;
  const editingId = initial.id || null;

  const [name, setName] = useState(initial.name || "");
  const [rows, setRows] = useState(() =>
    Array.isArray(initial.items) && initial.items.length
      ? initial.items.map((it) => ({
          rowId: ++rowSeq,
          key: it.key || "",
          label: it.label || "",
          weight: it.weight != null ? String(it.weight) : "",
          hint: it.hint || "",
          keyEdited: Boolean(it.key)
        }))
      : [blankRow()]
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);
  // Editing an existing list: if the list payload carried no items, pull the
  // full record so the editor opens populated rather than blank.
  const [hydrating, setHydrating] = useState(
    Boolean(editingId) && !(Array.isArray(initial.items) && initial.items.length)
  );

  useEffect(() => {
    if (!hydrating) return;
    let cancelled = false;
    fetchChecklist(org.org_id, editingId)
      .then((raw) => {
        if (cancelled) return;
        const full = normalizeList([raw?.checklist || raw])[0];
        if (full && full.items.length) {
          setRows(
            full.items.map((it) => ({
              rowId: ++rowSeq,
              key: it.key || "",
              label: it.label || "",
              weight: it.weight != null ? String(it.weight) : "",
              hint: it.hint || "",
              keyEdited: Boolean(it.key)
            }))
          );
        }
      })
      .catch(() => {
        // Best effort — a failed hydrate just leaves the single blank row.
      })
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrating, editingId, org.org_id]);

  const weightSum = useMemo(
    () => rows.reduce((acc, r) => acc + (Number(r.weight) || 0), 0),
    [rows]
  );
  const sumOk = weightSum === 100;

  function setRow(rowId, patch) {
    setRows((list) => list.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  }

  function onLabel(rowId, value) {
    setRows((list) =>
      list.map((r) => {
        if (r.rowId !== rowId) return r;
        // Auto-suggest the key from the label slug until the user edits key.
        const next = { ...r, label: value };
        if (!r.keyEdited) next.key = slugify(value);
        return next;
      })
    );
  }

  function addRow() {
    setRows((list) => [...list, blankRow()]);
  }

  function removeRow(rowId) {
    setRows((list) => (list.length <= 1 ? list : list.filter((r) => r.rowId !== rowId)));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setOk(false);

    if (!name.trim()) {
      setError(t.needName);
      return;
    }
    const kept = rows.filter((r) => r.label.trim() || r.key.trim());
    if (kept.length === 0) {
      setError(t.needItems);
      return;
    }
    if (weightSum !== 100) {
      setError(t.needWeight);
      return;
    }

    const items = kept.map((r, i) => ({
      key: r.key.trim() || slugify(r.label) || `item_${i + 1}`,
      label: r.label.trim(),
      weight: Number(r.weight) || 0,
      hint: r.hint.trim()
    }));

    setBusy(true);
    try {
      if (editingId) await updateChecklist(org.org_id, editingId, { name: name.trim(), items });
      else await createChecklist(org.org_id, { name: name.trim(), items });
      setOk(true);
      onSaved();
    } catch (err) {
      setError(humanApiError(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={editingId ? t.editorEdit : t.editorNew} onClose={onClose} wide>
      <form className="checklist-editor" onSubmit={submit}>
        <label className="field">
          <span className="label">{t.nameLabel}</span>
          <input
            className="input"
            type="text"
            value={name}
            placeholder={t.namePlaceholder}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </label>

        <h3 className="sub-title">{t.itemsTitle}</h3>
        {hydrating ? (
          <SkeletonBlock lines={3} />
        ) : (
          <div className="cl-rows">
            <div className="cl-row cl-row-head">
              <span className="cl-col-label">{t.colLabel}</span>
              <span className="cl-col-key">{t.colKey}</span>
              <span className="cl-col-weight">{t.colWeight}</span>
              <span className="cl-col-hint">{t.colHint}</span>
              <span className="cl-col-x" />
            </div>
            {rows.map((r) => (
              <div key={r.rowId} className="cl-row">
                <input
                  className="input cl-col-label"
                  type="text"
                  value={r.label}
                  placeholder={t.labelPlaceholder}
                  onChange={(e) => onLabel(r.rowId, e.target.value)}
                  disabled={busy}
                />
                <input
                  className="input mono cl-col-key"
                  type="text"
                  value={r.key}
                  placeholder={t.keyPlaceholder}
                  onChange={(e) => setRow(r.rowId, { key: e.target.value, keyEdited: true })}
                  disabled={busy}
                />
                <input
                  className="input cl-col-weight"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  inputMode="numeric"
                  value={r.weight}
                  onChange={(e) => setRow(r.rowId, { weight: e.target.value })}
                  disabled={busy}
                />
                <input
                  className="input cl-col-hint"
                  type="text"
                  value={r.hint}
                  placeholder={t.hintPlaceholder}
                  onChange={(e) => setRow(r.rowId, { hint: e.target.value })}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm cl-col-x"
                  onClick={() => removeRow(r.rowId)}
                  disabled={busy || rows.length <= 1}
                  aria-label={t.remove}
                >
                  {"×"}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="cl-foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={addRow} disabled={busy}>
            {t.addRow}
          </button>
          <span className={sumOk ? "cl-sum cl-sum-ok" : "cl-sum cl-sum-bad"}>
            {t.weightSum.replace("{sum}", String(weightSum))}
          </span>
        </div>
        {!sumOk ? <p className="field-hint">{t.weightHelper}</p> : null}

        {error ? <div className="form-error">{error}</div> : null}
        {ok && !error ? <div className="form-success">{t.saved}</div> : null}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {t.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || hydrating}>
            {busy ? (
              <>
                <Spinner small /> {t.saving}
              </>
            ) : (
              t.save
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
