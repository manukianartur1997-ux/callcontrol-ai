// Director's landing screen: 4 stat cards, revenue-leak ranking, manager
// ranking, latest calls. All reads go straight through supabase-js; RLS
// scopes them (a manager automatically sees only their own calls, so their
// "dashboard" is a personal one — same code, narrower data).
import { supabase } from "./supabase.js";
import { copy } from "./copy.js";
import { useAsync } from "./hooks.js";
import {
  fmtDateTime,
  fmtDuration,
  latestAnalysis,
  managerName,
  pluralRu,
  scoreTone
} from "./format.js";
import {
  Card,
  CenterSpinner,
  DirectionMark,
  EmptyState,
  ErrorBox,
  ScoreBadge,
  SeverityChip,
  StatusBadge
} from "./ui.jsx";
import { navigate } from "./router.js";

const SEVERITY_RANK = { low: 0, medium: 1, high: 2 };

// Pilot-scale limits: hundreds of calls per month per org, so pulling the
// recent window and aggregating in the browser is simpler and fast enough.
async function loadDashboard(orgId) {
  const [calls, analyses, members] = await Promise.all([
    supabase
      .from("calls")
      .select(
        "id, direction, customer_phone, manager_id, manager_label, started_at, created_at, duration_sec, status, analyses(score, created_at)"
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("analyses")
      .select("call_id, score, findings, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(800),
    supabase
      .from("memberships")
      .select("user_id, full_name, role, status")
      .eq("org_id", orgId)
  ]);
  for (const r of [calls, analyses, members]) {
    if (r.error) throw r.error;
  }
  return { calls: calls.data || [], analyses: analyses.data || [], members: members.data || [] };
}

function aggregate({ calls, analyses, members }) {
  const membersByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));

  // Freshest analysis per call — the list arrives newest-first.
  const latestByCall = new Map();
  for (const a of analyses) {
    if (!latestByCall.has(a.call_id)) latestByCall.set(a.call_id, a);
  }
  const latest = [...latestByCall.values()];

  const scores = latest.map((a) => Number(a.score)).filter((s) => !Number.isNaN(s));
  const avgScore = scores.length
    ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
    : null;

  const withNext = latest.filter((a) => a.findings && a.findings.next_step);
  const noNextPct = withNext.length
    ? Math.round(
        (withNext.filter((a) => a.findings.next_step.present === false).length / withNext.length) * 100
      )
    : null;

  // Leaks by title: how often + worst severity seen.
  const leakMap = new Map();
  for (const a of latest) {
    for (const leak of a.findings?.leaks || []) {
      const title = (leak.title || "").trim();
      if (!title) continue;
      const prev = leakMap.get(title) || { title, count: 0, severity: "low" };
      prev.count += 1;
      if ((SEVERITY_RANK[leak.severity] ?? 0) > (SEVERITY_RANK[prev.severity] ?? 0)) {
        prev.severity = leak.severity;
      }
      leakMap.set(title, prev);
    }
  }
  const topLeaks = [...leakMap.values()]
    .sort(
      (a, b) =>
        b.count - a.count || (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
    )
    .slice(0, 5);

  // Manager ranking by average latest score of their calls.
  const callById = new Map(calls.map((c) => [c.id, c]));
  const perManager = new Map();
  for (const a of latest) {
    const call = callById.get(a.call_id);
    if (!call) continue;
    const key = call.manager_id || (call.manager_label ? `label:${call.manager_label}` : null);
    if (!key) continue;
    const name = managerName(call, membersByUserId);
    const row = perManager.get(key) || { name, sum: 0, count: 0 };
    const s = Number(a.score);
    if (!Number.isNaN(s)) {
      row.sum += s;
      row.count += 1;
    }
    perManager.set(key, row);
  }
  const managerRank = [...perManager.values()]
    .filter((r) => r.count > 0)
    .map((r) => ({ name: r.name, avg: Math.round(r.sum / r.count), count: r.count }))
    .sort((a, b) => b.avg - a.avg);

  return {
    membersByUserId,
    analyzedCount: calls.filter((c) => c.status === "analyzed").length,
    avgScore,
    noNextPct,
    queuedCount: calls.filter((c) => c.status === "pending").length,
    topLeaks,
    managerRank,
    recent: calls.slice(0, 10),
    hasAnalyses: latest.length > 0
  };
}

export function Dashboard({ org, onNewCall }) {
  const { loading, data, error, reload } = useAsync(() => loadDashboard(org.org_id), [org.org_id]);

  const canCreate = org.role !== "viewer";
  const showManagers = org.role === "owner" || org.role === "admin" || org.role === "lead";

  if (loading) return <CenterSpinner />;
  if (error) {
    return (
      <div className="page">
        <h1 className="page-title">{copy.dashboard.title}</h1>
        <ErrorBox error={error} onRetry={reload} />
      </div>
    );
  }

  const agg = aggregate(data);
  const d = copy.dashboard;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{d.title}</h1>
        {canCreate ? (
          <button type="button" className="btn btn-primary" onClick={onNewCall}>
            {copy.calls.newCall}
          </button>
        ) : null}
      </div>

      {!agg.hasAnalyses ? (
        <Card>
          <EmptyState
            title={d.emptyTitle}
            text={d.emptyText}
            action={
              canCreate ? (
                <button type="button" className="btn btn-primary" onClick={onNewCall}>
                  {d.emptyCta}
                </button>
              ) : null
            }
          />
        </Card>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label={d.statAnalyzed} value={agg.analyzedCount} />
            <StatCard
              label={d.statAvgScore}
              value={agg.avgScore == null ? copy.common.dash : agg.avgScore}
              tone={scoreTone(agg.avgScore)}
            />
            <StatCard
              label={d.statNoNext}
              value={agg.noNextPct == null ? copy.common.dash : `${agg.noNextPct}%`}
              tone={agg.noNextPct == null ? "none" : agg.noNextPct > 30 ? "bad" : "good"}
            />
            <StatCard label={d.statQueued} value={agg.queuedCount} />
          </div>

          <div className={showManagers ? "grid-2" : ""}>
            <Card title={d.leaksTitle}>
              {agg.topLeaks.length === 0 ? (
                <p className="muted">{d.leaksEmpty}</p>
              ) : (
                <ul className="leak-list">
                  {agg.topLeaks.map((leak) => (
                    <li key={leak.title} className="leak-row">
                      <span className="leak-row-title">{leak.title}</span>
                      <span className="leak-row-meta">
                        <SeverityChip severity={leak.severity} />
                        <span className="leak-count">
                          {leak.count} {pluralRu(leak.count, copy.plurals.calls)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {showManagers ? (
              <Card title={d.managersTitle}>
                {agg.managerRank.length === 0 ? (
                  <p className="muted">{d.managersEmpty}</p>
                ) : (
                  <ul className="rank-list">
                    {agg.managerRank.map((m) => (
                      <li key={m.name} className="rank-row">
                        <span className="rank-name">{m.name}</span>
                        <span className="rank-bar">
                          <span
                            className={`bar-fill bar-${scoreTone(m.avg)}`}
                            style={{ width: `${Math.max(4, m.avg)}%` }}
                          />
                        </span>
                        <span className="rank-meta">
                          <ScoreBadge score={m.avg} />
                          <span className="muted rank-count">
                            {m.count} {pluralRu(m.count, copy.plurals.calls)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ) : null}
          </div>
        </>
      )}

      {agg.recent.length > 0 ? (
        <Card
          title={d.recentTitle}
          action={
            <a className="link" href="#/calls">
              {d.recentAll}
            </a>
          }
        >
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
                {agg.recent.map((call) => (
                  <CallRow key={call.id} call={call} membersByUserId={agg.membersByUserId} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, tone }) {
  return (
    <div className="card stat-card">
      <div className={tone && tone !== "none" ? `stat-value stat-${tone}` : "stat-value"}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// Shared row shape with the calls screen (kept local per screen — the two
// tables show slightly different columns and diverge further later).
function CallRow({ call, membersByUserId }) {
  const analysis = latestAnalysis(call.analyses);
  return (
    <tr className="row-link" onClick={() => navigate(`/calls/${call.id}`)} tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/calls/${call.id}`)}>
      <td className="nowrap">{fmtDateTime(call.started_at || call.created_at)}</td>
      <td className="dir-cell">
        <DirectionMark direction={call.direction} />
      </td>
      <td>{call.customer_phone || <span className="muted">{copy.calls.noPhone}</span>}</td>
      <td>{managerName(call, membersByUserId)}</td>
      <td className="nowrap">{fmtDuration(call.duration_sec)}</td>
      <td>
        {call.status === "analyzed" && analysis ? (
          <ScoreBadge score={analysis.score} />
        ) : (
          <StatusBadge status={call.status} />
        )}
      </td>
    </tr>
  );
}
