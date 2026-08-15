// Manual call upload, two self-explanatory tabs:
//   "Call recording" (default) — audio file -> base64 -> Worker /recordings,
//     which stores + transcribes (Gemini STT) + analyzes in ONE request. The
//     progress copy (upload -> transcribe -> analyze) is an honest time-based
//     text switch over that single await, not real stage telemetry.
//   "Transcript text" — the original paste-a-transcript flow: transcript ->
//     calls row -> transcripts row -> Worker analyze.
// The inserts run under RLS with the user's own token; only STT/AI go through
// the Worker (they need the org's decrypted key).
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { requestAnalyze, uploadRecording } from "./api.js";
import { copy } from "./copy.js";
import { useAsync } from "./hooks.js";
import { humanApiError } from "./format.js";
import { Modal, Spinner } from "./ui.jsx";
import { navigate } from "./router.js";

const MIN_TRANSCRIPT_CHARS = 40;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
// Extension -> MIME the Worker whitelists (RECORDING_MIMES in api.js).
// Extension wins over file.type on purpose: browsers report m4a as
// audio/x-m4a and wav as audio/x-wav, which the Worker would reject.
const AUDIO_TYPES = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg"
};
const ACCEPTED_MIMES = new Set([...Object.values(AUDIO_TYPES), "audio/webm"]);
// Honest-ish stage timing over the single request: upload finishes within a
// few seconds on office uplinks; STT dominates the rest.
const STAGE_TRANSCRIBE_AT_MS = 6_000;
const STAGE_ANALYZE_AT_MS = 45_000;

function fileExtension(name) {
  const m = /\.([a-z0-9]+)$/i.exec(String(name || ""));
  return m ? m[1].toLowerCase() : "";
}

// File -> bare base64 (no data: prefix) via FileReader.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("bad_audio"));
    reader.onload = () => {
      const text = String(reader.result || "");
      const comma = text.indexOf(",");
      if (comma < 0) return reject(new Error("bad_audio"));
      resolve(text.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function NewCallModal({ org, user, onClose, onDone }) {
  const [tab, setTab] = useState("audio");
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [direction, setDirection] = useState("outbound");
  const [managerId, setManagerId] = useState(""); // membership user_id or '' = unassigned
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(null); // null | 'upload' | 'transcribe' | 'analyze'
  const [error, setError] = useState(null);
  const [failedCallId, setFailedCallId] = useState(null);
  const stageTimers = useRef([]);

  useEffect(() => () => stageTimers.current.forEach(clearTimeout), []);

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

  function switchTab(next) {
    if (busy) return;
    setTab(next);
    setError(null);
    setFailedCallId(null);
  }

  function onFilePicked(e) {
    const picked = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-picking the same file after an error
    setError(null);
    setFailedCallId(null);
    if (!picked) return;
    const ext = fileExtension(picked.name);
    const isAudio =
      Object.prototype.hasOwnProperty.call(AUDIO_TYPES, ext) ||
      String(picked.type || "").startsWith("audio/");
    if (!isAudio) {
      setError({ error: "file_bad_type_local" });
      return;
    }
    if (picked.size > MAX_AUDIO_BYTES) {
      setError({ error: "file_too_big_local" });
      return;
    }
    setFile(picked);
  }

  async function submitAudio() {
    if (!file) {
      setError({ error: "file_none_local" });
      return;
    }
    setBusy(true);
    setError(null);
    setStage("upload");
    stageTimers.current = [
      setTimeout(() => setStage("transcribe"), STAGE_TRANSCRIBE_AT_MS),
      setTimeout(() => setStage("analyze"), STAGE_ANALYZE_AT_MS)
    ];
    let callId = null;
    try {
      const audioB64 = await fileToBase64(file);
      const ins = await supabase.from("calls").insert(buildCallRow()).select("id").single();
      if (ins.error) throw ins.error;
      callId = ins.data.id;

      const mime =
        AUDIO_TYPES[fileExtension(file.name)] ||
        (ACCEPTED_MIMES.has(file.type) ? file.type : "audio/mpeg");
      await uploadRecording(org.org_id, { call_id: callId, audio_b64: audioB64, mime });
      onDone(callId);
      return;
    } catch (err) {
      // The call stays in the list (pending/failed) — surface the error and
      // give a direct path to the saved call.
      setError(err instanceof Error && err.message === "bad_audio" ? { error: "bad_audio" } : err);
      setFailedCallId(callId);
    } finally {
      stageTimers.current.forEach(clearTimeout);
      stageTimers.current = [];
      setStage(null);
      setBusy(false);
    }
  }

  async function submitText() {
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
      setBusy(false);
      setError(err);
      setFailedCallId(callId);
    }
  }

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (tab === "audio") submitAudio();
    else submitText();
  }

  const t = copy.newCall;
  const localErrors = {
    transcript_too_short_local: t.tooShort,
    file_none_local: t.fileNone,
    file_too_big_local: t.fileTooBig,
    file_bad_type_local: t.fileBadType
  };
  const localErrorText = error ? localErrors[error.error] : null;
  const stageText =
    stage === "upload" ? t.stageUpload : stage === "transcribe" ? t.stageTranscribe : t.stageAnalyze;

  return (
    <Modal title={t.title} onClose={busy ? () => {} : onClose} wide>
      <form onSubmit={submit} className="modal-body">
        <p className="modal-explainer">{t.explainer}</p>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "audio"}
            className={tab === "audio" ? "auth-tab active" : "auth-tab"}
            onClick={() => switchTab("audio")}
            disabled={busy}
          >
            {t.tabAudio}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "text"}
            className={tab === "text" ? "auth-tab active" : "auth-tab"}
            onClick={() => switchTab("text")}
            disabled={busy}
          >
            {t.tabText}
          </button>
        </div>

        {tab === "audio" ? (
          <div className="field">
            <span className="label">{t.fileLabel}</span>
            <div className="file-row">
              <label className={busy ? "btn btn-ghost btn-disabled" : "btn btn-ghost"}>
                {t.filePick}
                <input
                  type="file"
                  accept=".mp3,.wav,.m4a,.ogg,audio/*"
                  hidden
                  onChange={onFilePicked}
                  disabled={busy}
                />
              </label>
              {file ? (
                <span className="file-name">
                  {file.name}{" "}
                  <span className="muted">({(file.size / (1024 * 1024)).toFixed(1)} {t.mbUnit})</span>
                </span>
              ) : (
                <span className="muted">{copy.common.dash}</span>
              )}
            </div>
            <span className="field-hint">{t.fileHint}</span>
          </div>
        ) : (
          <label className="field">
            <span className="label">{t.transcript}</span>
            <textarea
              className="input textarea"
              rows={9}
              placeholder={t.transcriptPlaceholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
              required
            />
            <span className="field-hint">{t.transcriptHint}</span>
          </label>
        )}

        <div className="field-row">
          <label className="field">
            <span className="label">{t.direction}</span>
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
              <span className="label">{t.manager}</span>
              <select
                className="input"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
                disabled={busy || members.loading}
              >
                <option value="">{t.unassigned}</option>
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
            {localErrorText ? (
              localErrorText
            ) : (
              <>
                <strong>{t.failedTitle}.</strong> {humanApiError(error)}
                {failedCallId ? (
                  <>
                    {" "}
                    <span className="muted">{t.failedNote}</span>{" "}
                    <button
                      type="button"
                      className="link link-btn"
                      onClick={() => {
                        onClose();
                        navigate(`/calls/${failedCallId}`);
                      }}
                    >
                      {t.openCall}
                    </button>
                  </>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {busy && tab === "audio" ? (
          <div className="upload-progress" role="status">
            <Spinner small />
            <span className="upload-stage">{stageText}</span>
            <span className="field-hint">{t.audioWaitNote}</span>
          </div>
        ) : null}

        <div className="modal-actions">
          {busy && tab === "text" ? <span className="field-hint">{t.waitNote}</span> : null}
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {copy.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? (
              <>
                <Spinner small /> {tab === "audio" ? stageText : t.submitting}
              </>
            ) : tab === "audio" ? (
              t.audioSubmit
            ) : (
              t.submit
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
