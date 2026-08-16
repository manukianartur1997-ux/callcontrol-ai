// Usage (owner/admin) at #/usage: current-period headline numbers, a 6-month
// history table and a rough cost estimate. GET .../usage is built in parallel,
// so a 404/501 degrades to an "unavailable yet" note. The cost is an estimate
// only — the footnote says so out loud.
import { fetchUsage } from "./api.js";
import { copy } from "./copy.js";
import { useAsync } from "./hooks.js";
import { fmtMoney } from "./format.js";
import { Card, ErrorBox, SkeletonBlock } from "./ui.jsx";

// Average blended rates (USD per 1M tokens) — deliberately conservative and
// provider-agnostic, only used when the Worker does not return its own cost.
const RATE_IN_PER_M = 0.15;
const RATE_OUT_PER_M = 0.6;

function isUnavailable(err) {
  return err && (err.status === 404 || err.status === 501);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toPeriod(r) {
  return {
    period: r.period || r.month || r.label || "",
    calls: num(r.calls_analyzed ?? r.calls),
    tokensIn: num(r.tokens_in ?? r.tokensIn),
    tokensOut: num(r.tokens_out ?? r.tokensOut),
    cost: r.cost ?? r.cost_usd ?? r.cost_estimate ?? null
  };
}

// Tolerate the several plausible shapes the Worker might return.
function normalizeUsage(raw) {
  const rows = Array.isArray(raw)
    ? raw
    : raw?.history || raw?.usage || raw?.periods || raw?.counters || [];
  const history = rows.map(toPeriod).sort((a, b) => String(b.period).localeCompare(String(a.period)));
  let current = history[0] || null;
  if (raw && raw.current && !Array.isArray(raw.current)) current = toPeriod(raw.current);
  return { current, history: history.slice(0, 6) };
}

// Prefer a server-provided cost; otherwise estimate from token counts.
function estCost(row) {
  if (row && row.cost != null) {
    const c = Number(row.cost);
    if (Number.isFinite(c)) return c;
  }
  return (row.tokensIn / 1e6) * RATE_IN_PER_M + (row.tokensOut / 1e6) * RATE_OUT_PER_M;
}

function fmtCost(usd) {
  return `$${(Number(usd) || 0).toFixed(2)}`;
}

export function Usage({ org }) {
  const t = copy.usage;
  const { loading, data, error, reload } = useAsync(async () => {
    try {
      return { usage: normalizeUsage(await fetchUsage(org.org_id)) };
    } catch (err) {
      if (isUnavailable(err)) return { unavailable: true };
      throw err;
    }
  }, [org.org_id]);

  return (
    <div className="page">
      <h1 className="page-title">{t.title}</h1>
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
      ) : !data.usage.current && data.usage.history.length === 0 ? (
        <Card>
          <p className="muted">{t.empty}</p>
        </Card>
      ) : (
        <>
          <Card title={t.currentPeriod}>
            <CurrentPeriod row={data.usage.current} />
            <p className="field-hint">{t.costFootnote}</p>
          </Card>

          <Card title={t.historyTitle} className="card-flush">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.thPeriod}</th>
                    <th>{t.thCalls}</th>
                    <th>{t.thTokensIn}</th>
                    <th>{t.thTokensOut}</th>
                    <th>{t.thCost}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.usage.history.map((r) => (
                    <tr key={r.period || Math.random()}>
                      <td className="nowrap">{r.period || copy.common.dash}</td>
                      <td>{fmtMoney(r.calls)}</td>
                      <td>{fmtMoney(r.tokensIn)}</td>
                      <td>{fmtMoney(r.tokensOut)}</td>
                      <td className="nowrap">{fmtCost(estCost(r))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.usage.history.length === 0 ? <p className="muted">{t.empty}</p> : null}
          </Card>
        </>
      )}
    </div>
  );
}

function CurrentPeriod({ row }) {
  const t = copy.usage;
  const cur = row || { calls: 0, tokensIn: 0, tokensOut: 0, cost: null };
  return (
    <div className="stat-grid">
      <div className="stat-card card">
        <div className="stat-value">{fmtMoney(cur.calls)}</div>
        <div className="stat-label">{t.statCalls}</div>
      </div>
      <div className="stat-card card">
        <div className="stat-value">{fmtMoney(cur.tokensIn)}</div>
        <div className="stat-label">{t.statTokensIn}</div>
      </div>
      <div className="stat-card card">
        <div className="stat-value">{fmtMoney(cur.tokensOut)}</div>
        <div className="stat-label">{t.statTokensOut}</div>
      </div>
      <div className="stat-card card">
        <div className="stat-value">{fmtCost(estCost(cur))}</div>
        <div className="stat-label">{t.statCost}</div>
      </div>
    </div>
  );
}
