// Calls list with status filter chips. Rows navigate to the call detail.
import { useState } from "react";
import { supabase } from "./supabase.js";
import { copy } from "./copy.js";
import { useAsync } from "./hooks.js";
import { fmtDateTime, fmtDuration, latestAnalysis, managerName } from "./format.js";
import {
  Card,
  DirectionMark,
  EmptyState,
  ErrorBox,
  ScoreBadge,
  SkeletonRows,
  StatusBadge
} from "./ui.jsx";
import { navigate } from "./router.js";

// Filter chip -> which call statuses it shows. "Queued" covers the whole
// not-yet-analyzed pipeline, not only 'pending'.
const FILTERS = [
  { key: "all", statuses: null },
  { key: "queued", statuses: ["pending", "transcribed", "analyzing"] },
  { key: "analyzed", statuses: ["analyzed"] },
  { key: "failed", statuses: ["failed"] }
];

const FILTER_LABELS = {
  all: copy.calls.filterAll,
  queued: copy.calls.filterQueued,
  analyzed: copy.calls.filterAnalyzed,
  failed: copy.calls.filterFailed
};

// A field that could contain a comma, quote or newline is quoted with
// doubled-quote escaping — the one RFC 4180 rule that actually matters here
// (customer names/comments are the only free-text fields in a call row).
function csvField(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Exports exactly the rows on screen (respects the active status filter) —
// "what you see is what you get" beats a second, differently-scoped query.
// A UTF-8 BOM prefix is required for Excel to render Cyrillic correctly
// instead of mangling it as Windows-1252.
function callsToCsv(rows, membersByUserId) {
  const header = [
    copy.calls.thDate,
    copy.calls.thClient,
    copy.calls.thManager,
    copy.calls.thDuration,
    copy.calls.thScore,
    copy.calls.thStatus
  ];
  const lines = [header.map(csvField).join(",")];
  for (const call of rows) {
    const analysis = latestAnalysis(call.analyses);
    lines.push(
      [
        fmtDateTime(call.started_at || call.created_at),
        call.customer_phone || "",
        managerName(call, membersByUserId),
        call.duration_sec ?? "",
        analysis ? Math.round(Number(analysis.score)) : "",
        call.status
      ]
        .map(csvField)
        .join(",")
    );
  }
  return "\uFEFF" + lines.join("\r\n");
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function loadCalls(orgId) {
  const [calls, members] = await Promise.all([
    supabase
      .from("calls")
      .select(
        "id, direction, customer_phone, manager_id, manager_label, started_at, created_at, duration_sec, status, source, analyses(score, created_at)"
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("memberships").select("user_id, full_name").eq("org_id", orgId)
  ]);
  if (calls.error) throw calls.error;
  if (members.error) throw members.error;
  return {
    calls: calls.data || [],
    membersByUserId: Object.fromEntries((members.data || []).map((m) => [m.user_id, m]))
  };
}

export function Calls({ org, onNewCall }) {
  const [filter, setFilter] = useState("all");
  const { loading, data, error, reload } = useAsync(() => loadCalls(org.org_id), [org.org_id]);

  const canCreate = org.role !== "viewer";
  const active = FILTERS.find((f) => f.key === filter) || FILTERS[0];
  const rows = (data?.calls || []).filter(
    (c) => !active.statuses || active.statuses.includes(c.status)
  );

  function exportCsv() {
    const csv = callsToCsv(rows, data.membersByUserId);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`calls-${filter}-${stamp}.csv`, csv);
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{copy.calls.title}</h1>
        <div className="field-row">
          <button type="button" className="btn btn-ghost" onClick={exportCsv} disabled={rows.length === 0}>
            {copy.calls.exportCsv}
          </button>
          {canCreate ? (
            <button type="button" className="btn btn-primary" onClick={onNewCall}>
              {copy.calls.newCall}
            </button>
          ) : null}
        </div>
      </div>

      <div className="chip-row" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={filter === f.key ? "filter-chip active" : "filter-chip"}
            onClick={() => setFilter(f.key)}
          >
            {FILTER_LABELS[f.key]}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : (
        <Card className="card-flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{copy.calls.thDate}</th>
                  <th aria-label={copy.calls.thClient} />
                  <th>{copy.calls.thClient}</th>
                  <th>{copy.calls.thManager}</th>
                  <th>{copy.calls.thDuration}</th>
                  <th>{copy.calls.thScore}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={6} cols={6} />
                ) : (
                  rows.map((call) => {
                    const analysis = latestAnalysis(call.analyses);
                    return (
                      <tr
                        key={call.id}
                        className="row-link"
                        tabIndex={0}
                        onClick={() => navigate(`/calls/${call.id}`)}
                        onKeyDown={(e) => e.key === "Enter" && navigate(`/calls/${call.id}`)}
                      >
                        <td className="nowrap">{fmtDateTime(call.started_at || call.created_at)}</td>
                        <td className="dir-cell">
                          <DirectionMark direction={call.direction} />
                        </td>
                        <td>
                          {call.customer_phone || <span className="muted">{copy.calls.noPhone}</span>}
                        </td>
                        <td>{managerName(call, data.membersByUserId)}</td>
                        <td className="nowrap">{fmtDuration(call.duration_sec)}</td>
                        <td>
                          {call.status === "analyzed" && analysis ? (
                            <ScoreBadge score={analysis.score} />
                          ) : (
                            <StatusBadge status={call.status} source={call.source} />
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && rows.length === 0 ? (
            <EmptyState
              title={filter === "all" ? copy.calls.empty : copy.calls.emptyFiltered}
              action={
                filter === "all" && canCreate ? (
                  <button type="button" className="btn btn-primary" onClick={onNewCall}>
                    {copy.calls.newCall}
                  </button>
                ) : null
              }
            />
          ) : null}
        </Card>
      )}
    </div>
  );
}
