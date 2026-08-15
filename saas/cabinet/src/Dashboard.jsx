// Director's landing screen, modeled on the platform demo (platform/js/
// screens.js): period switcher, extended stat row, money-at-risk estimate,
// gold calls, marketing-vs-sales split, leak and manager rankings, latest
// calls. All reads go straight through supabase-js; RLS scopes them (a
// manager automatically sees only their own calls, so their "dashboard" is a
// personal one — same code, narrower data).
import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import { copy } from "./copy.js";
import { useAsync } from "./hooks.js";
import {
  fmtDateTime,
  fmtDuration,
  fmtMoney,
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

// Client-side period filter over started_at/created_at; the selection
// survives reloads via localStorage.
const PERIODS = [
  { key: "7d", days: 7 },
  { key: "30d", days: 30 },
  { key: "all", days: null }
];
const PERIOD_STORE_KEY = "cc.dashboard.period";
const GOLD_MIN_SCORE = 85;
const LOW_SCORE = 70; // below "good" in scoreTone()

function loadStoredPeriod() {
  try {
    const v = window.localStorage.getItem(PERIOD_STORE_KEY);
    return PERIODS.some((p) => p.key === v) ? v : "30d";
  } catch {
    return "30d"; // storage blocked (private mode) — default silently
  }
}

function storePeriod(key) {
  try {
    window.localStorage.setItem(PERIOD_STORE_KEY, key);
  } catch {
    // best effort only
  }
}

// Pilot-scale limits: hundreds of calls per month per org, so pulling the
// recent window and aggregating in the browser is simpler and fast enough.
async function loadDashboard(org) {
  const [calls, analyses, members] = await Promise.all([
    supabase
      .from("calls")
      .select(
        "id, direction, customer_phone, manager_id, manager_label, started_at, created_at, duration_sec, status, analyses(score, created_at)"
      )
      .eq("org_id", org.org_id)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("analyses")
      .select("call_id, score, findings, created_at")
      .eq("org_id", org.org_id)
      .order("created_at", { ascending: false })
      .limit(800),
    supabase
      .from("memberships")
      .select("user_id, full_name, role, status")
      .eq("org_id", org.org_id)
  ]);
  for (const r of [calls, analyses, members]) {
    if (r.error) throw r.error;
  }

  // organizations.avg_deal_amount arrives with migration 0004. Reading it
  // directly gives a fresh value right after the owner sets it; before the
  // migration the column does not exist and the select errors — swallow that
  // and fall back to whatever /me reported (usually null). Never crash here.
  let avgDeal = org.avg_deal_amount ?? null;
  try {
    const orgRow = await supabase
      .from("organizations")
      .select("avg_deal_amount")
      .eq("id", org.org_id)
      .maybeSingle();
    if (!orgRow.error && orgRow.data && orgRow.data.avg_deal_amount != null) {
      avgDeal = Number(orgRow.data.avg_deal_amount);
    }
  } catch {
    // pre-0004 database — feature degrades to the "set your deal size" CTA
  }

  return {
    calls: calls.data || [],
    analyses: analyses.data || [],
    members: members.data || [],
    avgDeal: avgDeal != null && Number(avgDeal) > 0 ? Number(avgDeal) : null
  };
}

function callDate(call) {
  return new Date(call.started_at || call.created_at || 0).getTime();
}

// Worst leak severity of one analysis: "high" | "medium" | null.
function worstLeakSeverity(findings) {
  let worst = null;
  for (const leak of findings?.leaks || []) {
    const rank = SEVERITY_RANK[leak.severity] ?? 0;
    if (rank >= 2) return "high";
    if (rank === 1) worst = "medium";
  }
  return worst;
}

function avgScoreOf(list) {
  const scores = list.map((a) => Number(a.score)).filter((s) => !Number.isNaN(s));
  if (!scores.length) return null;
  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

function aggregate({ calls, analyses, members, avgDeal }, periodDays) {
  const membersByUserId = Object.fromEntries(members.map((m) => [m.user_id, m]));
  const callById = new Map(calls.map((c) => [c.id, c]));

  const now = Date.now();
  const windowStart = periodDays == null ? -Infinity : now - periodDays * 86_400_000;
  const priorStart = periodDays == null ? null : windowStart - periodDays * 86_400_000;

  const inWindow = calls.filter((c) => callDate(c) >= windowStart);

  // Freshest analysis per call — the list arrives newest-first.
  const latestByCall = new Map();
  for (const a of analyses) {
    if (!latestByCall.has(a.call_id)) latestByCall.set(a.call_id, a);
  }
  const latestAll = [...latestByCall.values()].filter((a) => callById.has(a.call_id));
  const latest = latestAll.filter((a) => callDate(callById.get(a.call_id)) >= windowStart);
  const prior =
    priorStart == null
      ? []
      : latestAll.filter((a) => {
          const t = callDate(callById.get(a.call_id));
          return t >= priorStart && t < windowStart;
        });

  const avgScore = avgScoreOf(latest);
  const priorAvgScore = avgScoreOf(prior);
  const scoreDelta =
    avgScore != null && priorAvgScore != null ? avgScore - priorAvgScore : null;

  const withNext = latest.filter((a) => a.findings && a.findings.next_step);
  const noNextPct = withNext.length
    ? Math.round(
        (withNext.filter((a) => a.findings.next_step.present === false).length / withNext.length) * 100
      )
    : null;

  const durations = inWindow
    .map((c) => Number(c.duration_sec))
    .filter((s) => !Number.isNaN(s) && s > 0);
  const avgDurationSec = durations.length
    ? Math.round(durations.reduce((sum, s) => sum + s, 0) / durations.length)
    : null;

  // Money at risk: open formula, one call counted once by its worst leak.
  let highLeakCalls = 0;
  let mediumLeakCalls = 0;
  for (const a of latest) {
    const worst = worstLeakSeverity(a.findings);
    if (worst === "high") highLeakCalls += 1;
    else if (worst === "medium") mediumLeakCalls += 1;
  }
  const moneyAtRisk =
    avgDeal != null ? Math.round(avgDeal * (highLeakCalls * 0.5 + mediumLeakCalls * 0.25)) : null;

  // Gold calls: score >= 85, else top-3 as examples anyway.
  const scored = latest
    .filter((a) => !Number.isNaN(Number(a.score)))
    .sort((a, b) => Number(b.score) - Number(a.score));
  const goldReal = scored.filter((a) => Number(a.score) >= GOLD_MIN_SCORE).slice(0, 3);
  const goldCalls = (goldReal.length ? goldReal : scored.slice(0, 3)).map((a) => ({
    analysis: a,
    call: callById.get(a.call_id)
  }));
  const goldIsFallback = goldReal.length === 0 && goldCalls.length > 0;

  // Marketing vs sales: findings.lead_quality is good|bad|unclear (added by
  // the Worker for new analyses; absent counts as unclear).
  let badLeads = 0;
  let goodLeadLowScore = 0;
  for (const a of latest) {
    const quality = a.findings?.lead_quality;
    if (quality === "bad") badLeads += 1;
    else if (quality === "good" && Number(a.score) < LOW_SCORE) goodLeadLowScore += 1;
  }
  const mvs = latest.length
    ? {
        total: latest.length,
        badLeads,
        goodLeadLowScore,
        badPct: Math.round((badLeads / latest.length) * 100),
        salesPct: Math.round((goodLeadLowScore / latest.length) * 100)
      }
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
    analyzedCount: inWindow.filter((c) => c.status === "analyzed").length,
    avgScore,
    scoreDelta,
    hasPrior: prior.length > 0,
    noNextPct,
    queuedCount: inWindow.filter((c) => c.status === "pending").length,
    avgDurationSec,
    avgDeal,
    moneyAtRisk,
    highLeakCalls,
    mediumLeakCalls,
    goldCalls,
    goldIsFallback,
    mvs,
    topLeaks,
    managerRank,
    recent: inWindow.slice(0, 10),
    hasAnalyses: latestAll.length > 0,
    hasAnalysesInPeriod: latest.length > 0
  };
}

export function Dashboard({ org, onNewCall }) {
  const { loading, data, error, reload } = useAsync(() => loadDashboard(org), [org.org_id]);
  const [period, setPeriod] = useState(loadStoredPeriod);
  useEffect(() => storePeriod(period), [period]);

  const canCreate = org.role !== "viewer";
  const isDirector = org.role === "owner" || org.role === "admin" || org.role === "lead";
  const d = copy.dashboard;

  if (loading) return <CenterSpinner />;
  if (error) {
    return (
      <div className="page">
        <h1 className="page-title">{d.title}</h1>
        <ErrorBox error={error} onRetry={reload} />
      </div>
    );
  }

  const periodDays = (PERIODS.find((p) => p.key === period) || PERIODS[1]).days;
  const agg = aggregate(data, periodDays);

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
          <div className="chip-row" role="tablist">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={period === p.key}
                className={period === p.key ? "filter-chip active" : "filter-chip"}
                onClick={() => setPeriod(p.key)}
              >
                {d.periods[p.key]}
              </button>
            ))}
          </div>

          {!agg.hasAnalysesInPeriod && agg.recent.length === 0 ? (
            <Card>
              <p className="muted">{d.periodEmpty}</p>
            </Card>
          ) : (
            <>
              <div className="stat-grid stat-grid-6">
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
                <StatCard
                  label={d.statAvgDuration}
                  value={agg.avgDurationSec == null ? copy.common.dash : fmtDuration(agg.avgDurationSec)}
                />
                <TrendStatCard delta={agg.scoreDelta} />
              </div>

              {isDirector ? (
                <div className="grid-2">
                  <MoneyAtRiskCard agg={agg} role={org.role} />
                  <MarketingVsSalesCard mvs={agg.mvs} />
                </div>
              ) : null}

              {agg.goldCalls.length > 0 ? (
                <GoldCallsCard
                  goldCalls={agg.goldCalls}
                  isFallback={agg.goldIsFallback}
                  membersByUserId={agg.membersByUserId}
                />
              ) : null}

              <div className={isDirector ? "grid-2" : ""}>
                <Card title={d.leaksTitle}>
                  {agg.topLeaks.length === 0 ? (
                    <p className="muted">{d.leaksEmpty}</p>
                  ) : (
                    <ul className="leak-list">
                      {agg.topLeaks.map((leak) => (
                        <LeakRow
                          key={leak.title}
                          leak={leak}
                          max={agg.topLeaks[0]?.count || 1}
                        />
                      ))}
                    </ul>
                  )}
                </Card>

                {isDirector ? (
                  <Card title={d.managersTitle}>
                    {agg.managerRank.length === 0 ? (
                      <p className="muted">{d.managersEmpty}</p>
                    ) : (
                      <ul className="rank-list">
                        {agg.managerRank.map((m, i) => (
                          <ManagerRow key={m.name} manager={m} position={i + 1} />
                        ))}
                      </ul>
                    )}
                  </Card>
                ) : null}
              </div>
            </>
          )}
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

// Score delta vs the prior period of the same length: arrow + color. The
// "all time" period has no prior period, so the card shows a dash there.
function TrendStatCard({ delta }) {
  const d = copy.dashboard;
  let value = copy.common.dash;
  let tone = "none";
  if (delta != null) {
    if (delta > 0) {
      value = `▲ +${delta}`;
      tone = "good";
    } else if (delta < 0) {
      value = `▼ ${delta}`;
      tone = "bad";
    } else {
      value = "0";
    }
  }
  return (
    <div className="card stat-card">
      <div className={tone !== "none" ? `stat-value stat-${tone}` : "stat-value"}>{value}</div>
      <div className="stat-label">
        {d.statScoreTrend}
        {delta != null ? <span className="stat-sublabel"> · {d.trendVsPrev}</span> : null}
      </div>
    </div>
  );
}

// Money-at-risk: leak-weighted estimate with the formula in plain sight —
// an open formula, not magic. Without avg_deal_amount the card turns into
// a CTA to set it (settings are owner-only).
function MoneyAtRiskCard({ agg, role }) {
  const d = copy.dashboard;

  if (agg.avgDeal == null) {
    return (
      <Card title={d.moneyTitle} className="money-card">
        <p className="muted">{d.moneyNoAvg}</p>
        {role === "owner" ? (
          <div className="form-actions">
            <a className="btn btn-ghost" href="#/settings">
              {d.moneySetCta}
            </a>
          </div>
        ) : (
          <p className="field-hint">{d.moneyAskOwner}</p>
        )}
      </Card>
    );
  }

  const total = agg.highLeakCalls + agg.mediumLeakCalls;
  return (
    <Card title={d.moneyTitle} className="money-card">
      {total === 0 ? (
        <p className="muted">{d.moneyNone}</p>
      ) : (
        <>
          <div className="money-value" title={d.moneyFormula}>
            {d.moneyApprox} {fmtMoney(agg.moneyAtRisk)}{" "}
            <span className="money-currency">{d.moneyCurrency}</span>
          </div>
          <ul className="money-breakdown">
            <li className="money-row">
              <SeverityChip severity="high" />
              <span className="money-row-label">{d.moneyHighLabel}</span>
              <span className="money-row-count">
                {agg.highLeakCalls} {pluralRu(agg.highLeakCalls, copy.plurals.calls)}{" "}
                {d.moneyTimesHigh}
              </span>
            </li>
            <li className="money-row">
              <SeverityChip severity="medium" />
              <span className="money-row-label">{d.moneyMediumLabel}</span>
              <span className="money-row-count">
                {agg.mediumLeakCalls} {pluralRu(agg.mediumLeakCalls, copy.plurals.calls)}{" "}
                {d.moneyTimesMedium}
              </span>
            </li>
          </ul>
        </>
      )}
      <p className="field-hint money-footnote" title={d.moneyFormula}>
        {d.moneyFormulaNote} {d.moneyFormula}.
      </p>
    </Card>
  );
}

// Marketing vs sales: share of bad-lead calls vs share of weak calls on good
// leads. lead_quality is only present on fresh analyses — old ones count as
// "unclear" and stay out of both bars.
function MarketingVsSalesCard({ mvs }) {
  const d = copy.dashboard;
  if (!mvs) return null;
  const rows = [
    { label: d.mvsLeads, pct: mvs.badPct, count: mvs.badLeads, cls: "bar-mid" },
    { label: d.mvsSales, pct: mvs.salesPct, count: mvs.goodLeadLowScore, cls: "bar-bad" }
  ];
  return (
    <Card title={d.mvsTitle}>
      <div className="mvs-rows">
        {rows.map((row) => (
          <div key={row.label} className="mvs-row">
            <span className="mvs-label">{row.label}</span>
            <span className="rank-bar">
              <span className={`bar-fill ${row.cls}`} style={{ width: `${Math.max(2, row.pct)}%` }} />
            </span>
            <span className="mvs-value">
              {row.pct}%{" "}
              <span className="muted">
                · {row.count} {pluralRu(row.count, copy.plurals.calls)}
              </span>
            </span>
          </div>
        ))}
      </div>
      <p className="field-hint">{d.mvsExplainer}</p>
    </Card>
  );
}

// Reference calls: score >= 85, or the period's top three as examples.
function GoldCallsCard({ goldCalls, isFallback, membersByUserId }) {
  const d = copy.dashboard;
  return (
    <Card title={d.goldTitle}>
      <p className="field-hint">{isFallback ? d.goldFallbackNote : d.goldNote}</p>
      <div className="gold-grid">
        {goldCalls.map(({ analysis, call }) => (
          <button
            key={call.id}
            type="button"
            className="gold-card"
            onClick={() => navigate(`/calls/${call.id}`)}
          >
            <span className={`gold-score score-${scoreTone(analysis.score)}`}>
              {Math.round(analysis.score)}
            </span>
            <span className="gold-body">
              <span className="gold-name">{managerName(call, membersByUserId)}</span>
              <span className="gold-meta">
                {call.customer_phone || copy.calls.noPhone} ·{" "}
                {fmtDateTime(call.started_at || call.created_at)} · {fmtDuration(call.duration_sec)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}

// Ranked-list rows in the demo's look: relative bar + count for leaks,
// position + name + score bar for managers.
function LeakRow({ leak, max }) {
  return (
    <li className="leak-row">
      <span className="leak-row-title">{leak.title}</span>
      <span className="rank-bar leak-bar">
        <span
          className={`bar-fill ${leak.severity === "high" ? "bar-bad" : leak.severity === "medium" ? "bar-mid" : "bar-good"}`}
          style={{ width: `${Math.max(6, Math.round((leak.count / max) * 100))}%` }}
        />
      </span>
      <span className="leak-row-meta">
        <SeverityChip severity={leak.severity} />
        <span className="leak-count">
          {leak.count} {pluralRu(leak.count, copy.plurals.calls)}
        </span>
      </span>
    </li>
  );
}

function ManagerRow({ manager, position }) {
  return (
    <li className="rank-row">
      <span className="rank-pos">{position}</span>
      <span className="rank-name">{manager.name}</span>
      <span className="rank-bar">
        <span
          className={`bar-fill bar-${scoreTone(manager.avg)}`}
          style={{ width: `${Math.max(4, manager.avg)}%` }}
        />
      </span>
      <span className="rank-meta">
        <ScoreBadge score={manager.avg} />
        <span className="muted rank-count">
          {manager.count} {pluralRu(manager.count, copy.plurals.calls)}
        </span>
      </span>
    </li>
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
