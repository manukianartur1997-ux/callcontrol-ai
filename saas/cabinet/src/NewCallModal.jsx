// Manual call upload: transcript -> calls row -> transcripts row -> Worker
// analyze. The inserts run under RLS with the user's own token; only the AI
// step goes through the Worker (it needs the org's decrypted key).
import { useMemo, useState } from "react";
import { supabase } from "./supabase.js";
import { requestAnalyze } from "./api.js";
import { copy } from "./copy.js";
import { useAsync } from "./hooks.js";
import { humanApiError } from "./format.js";
import { Modal, Spinner } from "./ui.jsx";
import { navigate } from "./router.js";

const MIN_TRANSCRIPT_CHARS = 40;

export function NewCallModal({ org, user, onClose, onDone }) {
  const [text, setText] = useState("");
  const [direction, setDirection] = useState("outbound");
  const [managerId, setManagerId] = useState(""); // membership user_id or '' = unassigned
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [failedCallId, setFailedCallId] = useState(null);

  // Members are needed both for the manager <select> and to resolve the
  // creator's own full_name / department when role = manager.
  const members = useAsync(async () => {
    const { data, error: err } = await supabase
      .from("memberships")
      .select("user_id, full_name, role, status, department_id")
      .eq("org_id", org.org_id)
      .eq("status", "active");
    if (err) throw err;
    return data || [];
  }, [org.org_id]);

  const canPickManager = org.role === "owner" || org.role === "admin" || org.role === "lead";
  const selfMember = useMemo(
    () => (members.data || []).find((m) => m.user_id === user.id) || null,
    [members.data, user.id]
  );

  // A lead may only create calls inside their own department (RLS enforces
  // it; mirroring the rule here keeps the select honest instead of failing).
  const options = useMemo(() => {
    const list = (members.data || []).filter((m) => m.role !== "viewer");
    if (org.role === "lead") {
      const dept = selfMember?.department_id ?? null;
      return list.filter((m) => (m.department_id ?? null) === dept);
    }
    return list;
  }, [members.data, org.role, selfMember]);

  function buildCallRow() {
    const row = {
      org_id: org.org_id,
      source: "manual",
      external_id: crypto.randomUUID(),
      direction,
      started_at: new Date().toISOString(),
      manager_id: null,
      manager_label: null,
      department_id: null
    };
    if (org.role === "manager") {
      // Managers always upload for themselves — no select is rendered.
      row.manager_id = user.id;
      row.manager_label = selfMember?.full_name || null;
      row.department_id = selfMember?.department_id || null;
    } else if (managerId) {
      const member = options.find((m) => m.user_id === managerId);
      row.manager_id = member?.user_id || null;
      row.manager_label = member?.full_name || null;
      row.department_id = member?.department_id || null;
    }
    // Lead's calls must live in the lead's department even when unassigned.
    if (org.role === "lead") row.department_id = selfMember?.department_id || null;
    return row;
  }

  async function submit(e) {
    e.preventDefault();
    if (text.trim().length < MIN_TRANSCRIPT_CHARS) {
      setError({ error: "transcript_too_short_local" });
      return;
    }
    setBusy(true);
    setError(null);
    let callId = null;
    try {
      const ins = await supabase.from("calls").insert(buildCallRow()).select("id").single();
      if (ins.error) throw ins.error;
      callId = ins.data.id;

      const tr = await supabase
        .from("transcripts")
        .insert({ org_id: org.org_id, call_id: callId, text: text.trim(), provider: "manual" });
      if (tr.error) throw tr.error;

      await requestAnalyze(org.org_id, callId);
      onDone(callId);
    } catch (err) {
      // The call stays in the list (pending or failed) — surface the error
      // and give a direct path to the saved call.
      setBusy(false);
      setError(err);
      setFailedCallId(callId);
    }
  }

  const tooShortLocal = error && error.error === "transcript_too_short_local";

  return (
    <Modal title={copy.newCall.title} onClose={busy ? () => {} : onClose} wide>
      <form onSubmit={submit} className="modal-body">
        <label className="field">
          <span className="label">{copy.newCall.transcript}</span>
          <textarea
            className="input textarea"
            rows={9}
            placeholder={copy.newCall.transcriptPlaceholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            required
          />
          <span className="field-hint">{copy.newCall.transcriptHint}</span>
        </label>

        <div className="field-row">
          <label className="field">
            <span className="label">{copy.newCall.direction}</span>
            <select
              className="input"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              disabled={busy}
            >
              <option value="outbound">{copy.directions.outbound}</option>
              <option value="inbound">{copy.directions.inbound}</option>
            </select>
          </label>

          {canPickManager ? (
            <label className="field">
              <span className="label">{copy.newCall.manager}</span>
              <select
                className="input"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                disabled={busy || members.loading}
              >
                <option value="">{copy.newCall.unassigned}</option>
                {options.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name || copy.settings.team.noName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {error ? (
          <div className="form-error" role="alert">
            {tooShortLocal ? (
              copy.newCall.tooShort
            ) : (
              <>
                <strong>{copy.newCall.failedTitle}.</strong> {humanApiError(error)}
                {failedCallId ? (
                  <>
                    {" "}
                    <span className="muted">{copy.newCall.failedNote}</span>{" "}
                    <button
                      type="button"
                      className="link link-btn"
                      onClick={() => {
                        onClose();
                        navigate(`/calls/${failedCallId}`);
                      }}
                    >
                      {copy.newCall.openCall}
                    </button>
                  </>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        <div className="modal-actions">
          {busy ? <span className="field-hint">{copy.newCall.waitNote}</span> : null}
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {copy.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? (
              <>
                <Spinner small /> {copy.newCall.submitting}
              </>
            ) : (
              copy.newCall.submit
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
