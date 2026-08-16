// Single call: score, checklist breakdown, revenue leaks, coaching plan,
// next step, transcript. Reads are one embedded select; the checklist is
// fetched to translate item keys into human labels.
import { useState } from "react";
import { supabase } from "./supabase.js";
import { requestAnalyze } from "./api.js";
import { copy } from "./copy.js";
import { useAsync } from "./hooks.js";
import {
  fmtDateTime,
  fmtDuration,
  humanApiError,
  latestAnalysis,
  managerName,
  scoreTone
} from "./format.js";
import {
  Card,
  CenterSpinner,
  DirectionMark,
  EmptyState,
  ErrorBox,
  SeverityChip,
  Spinner,
  StatusBadge
} from "./ui.jsx";

async function loadCall(orgId, callId) {
  const [call, checklists, members] = await Promise.all([
    supabase
      .from("calls")
      .select(
        "*, transcripts(text, lang), analyses(id, score, findings, provider, model, checklist_id, created_at)"
      )
      .eq("org_id", orgId)
      .eq("id", callId)
      .maybeSingle(),
    supabase.from("checklists").select("id, name, items, is_default").eq("org_id", orgId),
    supabase.from("memberships").select("user_id, full_name").eq("org_id", orgId)
  ]);
  if (call.error) throw call.error;
  if (checklists.error) throw checklists.error;
  if (members.error) throw members.error;
  return {
    call: call.data,
    checklists: checklists.data || [],
    membersByUserId: Object.fromEntries((members.data || []).map((m) => [m.user_id, m]))
  };
}

// key -> { label, weight } from the checklist the analysis ran against,
// falling back to the org default checklist.
function checklistIndex(checklists, analysis) {
  const list =
    (analysis?.checklist_id && checklists.find((c) => c.id === analysis.checklist_id)) ||
    checklists.find((c) => c.is_default) ||
    checklists[0];
  const map = {};
  for (const item of list?.items || []) map[item.key] = item;
  return map;
}

export function CallDetail({ org, callId }) {
  const { loading, data, error, reload } = useAsync(
    () => loadCall(org.org_id, callId),
    [org.org_id, callId]
  );
  const [reanalyzing, setReanalyzing] = useState(false);
  const [actionError, setActionError] = useState(null);

  async function reanalyze() {
    if (!window.confirm(copy.call.reanalyzeConfirm)) return;
    setReanalyzing(true);
    setActionError(null);
    try {
      await requestAnalyze(org.org_id, callId);
    } catch (err) {
      setActionError(err);
    }
    setReanalyzing(false);
    reload(); // success or failure — the call row reflects the outcome
  }

  if (loading) return <CenterSpinner />;
  if (error) {
    return (
      <div className="page">
        <BackLink />
        <ErrorBox error={error} onRetry={reload} />
      </div>
    );
  }

  const call = data.call;
  if (!call) {
    return (
      <div className="page">
        <BackLink />
        <Card>
          <EmptyState title={copy.call.notFound} />
        </Card>
      </div>
    );
  }

  const analysis = latestAnalysis(call.analyses);
  const findings = analysis?.findings || {};
  const items = checklistIndex(data.checklists, analysis);
  const transcript = Array.isArray(call.transcripts) ? call.transcripts[0] : call.transcripts;
  const canReanalyze = org.role !== "viewer" && transcript;
  const score = analysis?.score != null ? Math.round(Number(analysis.score)) : null;

  return (
    <div className="page">
      <BackLink />

      <div className="detail-head card">
        <div className="detail-score">
          {score != null ? (
            <span className={`score-big score-${scoreTone(score)}`}>{score}</span>
          ) : (
            <StatusBadge status={call.status} source={call.source} />
          )}
          {score != null ? <span className="muted">{copy.call.scoreLabel}</span> : null}
        </div>
        <div className="detail-meta">
          <div className="detail-meta-row">
            <DirectionMark direction={call.direction} />
            <span>{call.customer_phone || copy.calls.noPhone}</span>
            <span className="muted">·</span>
            <span>{fmtDateTime(call.started_at || call.created_at)}</span>
            <span className="muted">·</span>
            <span>{fmtDuration(call.duration_sec)}</span>
          </div>
          <div className="detail-meta-row muted">
            {copy.calls.thManager}: {managerName(call, data.membersByUserId)}
            {analysis?.provider ? ` · ${analysis.provider}${analysis.model ? ` / ${analysis.model}` : ""}` : ""}
          </div>
        </div>
        {canReanalyze ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={reanalyze}
            disabled={reanalyzing}
          >
            {reanalyzing ? (
              <>
                <Spinner small /> {copy.call.reanalyzing}
              </>
            ) : (
              copy.call.reanalyze
            )}
          </button>
        ) : null}
      </div>

      {actionError ? <ErrorBox error={actionError} /> : null}

      {call.status === "failed" && !analysis ? (
        <Card title={copy.call.failedTitle}>
          <p className="form-error">{humanApiError(call.error || "generic")}</p>
        </Card>
      ) : null}

      {!analysis && call.status !== "failed" ? (
        <Card>
          <EmptyState title={copy.call.pendingTitle} text={copy.call.pendingText} />
        </Card>
      ) : null}

      {analysis ? (
        <>
          {findings.summary ? (
            <Card title={copy.call.summary}>
              <p className="summary-text">{findings.summary}</p>
            </Card>
          ) : null}

          {Array.isArray(findings.items) && findings.items.length > 0 ? (
            <Card title={copy.call.checklist}>
              <div className="item-grid">
                {findings.items.map((item) => {
                  const meta = items[item.key];
                  return (
                    <div key={item.key} className="item-card">
                      <div className="item-head">
                        <span className="item-label">{meta?.label || item.key}</span>
                        <span className={`item-score score-${scoreTone(item.score)}`}>
                          {Math.round(item.score)}
                        </span>
                      </div>
                      <div className="bar">
                        <span
                          className={`bar-fill bar-${scoreTone(item.score)}`}
                          style={{ width: `${Math.min(100, Math.max(0, item.score))}%` }}
                        />
                      </div>
                      {item.evidence ? <blockquote className="quote">{item.evidence}</blockquote> : null}
                      {item.comment ? <p className="item-comment">{item.comment}</p> : null}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}

          {Array.isArray(findings.leaks) && findings.leaks.length > 0 ? (
            <Card title={copy.call.leaks}>
              <div className="leak-cards">
                {findings.leaks.map((leak, i) => (
                  <div key={i} className="leak-card">
                    <div className="leak-card-head">
                      <span className="leak-title">{leak.title}</span>
                      <SeverityChip severity={leak.severity} />
                    </div>
                    <p className="leak-detail">{leak.detail}</p>
                    {leak.money_impact ? <p className="leak-money">{leak.money_impact}</p> : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {Array.isArray(findings.coaching) && findings.coaching.length > 0 ? (
            <Card title={copy.call.coaching}>
              <ol className="coach-list">
                {findings.coaching.map((c, i) => (
                  <li key={i}>
                    <strong>{c.title}</strong>
                    {c.detail ? <span className="coach-detail"> — {c.detail}</span> : null}
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}

          {findings.next_step ? (
            <Card title={copy.call.nextStep}>
              <div className="next-step">
                <span className={findings.next_step.present ? "chip chip-green" : "chip chip-red"}>
                  {findings.next_step.present ? copy.call.nextYes : copy.call.nextNo}
                </span>
                {findings.next_step.detail ? <span>{findings.next_step.detail}</span> : null}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      {transcript?.text ? (
        <Card className="card-flush">
          <details className="transcript">
            <summary>{copy.call.transcript}</summary>
            <pre className="transcript-text">{transcript.text}</pre>
          </details>
        </Card>
      ) : null}
    </div>
  );
}

function BackLink() {
  return (
    <a className="back-link" href="#/calls">
      {"← "}
      {copy.call.back}
    </a>
  );
}
