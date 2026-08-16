// Billing (owner/admin) at #/billing: the current-month minutes + cost as the
// headline, a 6-month history table, the owner-editable per-minute rate and
// retention window, and the plan/currency the org runs on.
//
// GET/PUT /orgs/:id/billing is built in parallel with the Worker, so the
// screen degrades three ways: 503 { error: "migration_required" } (pre-0005
// schema) shows the shared migration note; 404/501 (endpoint not shipped yet)
// shows an "unavailable" note; everything else is a normal error wall.
//
// The rate is only ever an estimate on the pilot — the footnote says so out
// loud, and editing the rate/retention is owner-only (admins see them
// read-only). The retention field carries a plain-language note: raw call text
// is deleted after N days, the scores stay.
import { useEffect, useState } from "react";
import { fetchBilling, saveBilling } from "./api.js";
import { copy } from "./copy.js";
import { useAsync } from "./hooks.js";
import { fmtMoney, humanApiError } from "./format.js";
import { Card, ErrorBox, SkeletonBlock, Spinner } from "./ui.jsx";

function isUnavailable(err) {
  return err && (err.status === 404 || err.status === 501);
}

function isMigration(err) {
  return err && err.error === "migration_required";
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toPeriod(r) {
  return {
    period: r.period || r.month || r.label || "",
    minutes: num(r.minutes ?? r.minutes_total),
    calls: num(r.calls ?? r.calls_analyzed),
    cost: r.cost ?? r.cost_total ?? null
  };
}

// Tolerate the several plausible shapes the Worker might return.
function normalizeBilling(raw) {
  const rows = Array.isArray(raw?.history) ? raw.history : Array.isArray(raw) ? raw : [];
  const history = rows
    .map(toPeriod)
    .sort((a, b) => String(b.period).localeCompare(String(a.period)))
    .slice(0, 6);
  let current = null;
  if (raw && raw.current_month) current = toPeriod(raw.current_month);
  else if (raw && raw.current) current = toPeriod(raw.current);
  else current = history[0] || null;
  return {
    plan: raw?.plan || null,
    currency: raw?.currency || raw?.billing_currency || "UAH",
    rate: raw?.rate_per_minute ?? raw?.rate ?? null,
    retentionDays: raw?.retention_days ?? null,
    current,
    history
  };
}

function fmtCost(amount, currency) {
  if (amount == null || Number.isNaN(Number(amount))) return copy.common.dash;
  return `${fmtMoney(Number(amount))} ${currency}`;
}

export function Billing({ org }) {
  const t = copy.billing;
  const canEdit = org.role === "owner";
  const { loading, data, error, reload } = useAsync(async () => {
    try {
      return { billing: normalizeBilling(await fetchBilling(org.org_id)) };
    } catch (err) {
      if (isMigration(err)) return { migration: true };
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
      ) : data.migration ? (
        <Card>
          <p className="warning">{copy.settings.orgSettings.migrationRequired}</p>
        </Card>
      ) : data.unavailable ? (
        <Card>
          <p className="warning">{t.unavailable}</p>
        </Card>
      ) : (
        <>
          <Card title={t.currentMonth}>
            <CurrentMonth billing={data.billing} />
            <p className="field-hint">{t.footnote}</p>
          </Card>

          <RateCard
            org={org}
            canEdit={canEdit}
            rate={data.billing.rate}
            retentionDays={data.billing.retentionDays}
            currency={data.billing.currency}
            plan={data.billing.plan}
            onSaved={reload}
          />

          <Card title={t.historyTitle} className="card-flush">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.thPeriod}</th>
                    <th>{t.thMinutes}</th>
                    <th>{t.thCalls}</th>
                    <th>{t.thCost}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.billing.history.map((r) => (
                    <tr key={r.period || Math.random()}>
                      <td className="nowrap">{r.period || copy.common.dash}</td>
                      <td>{fmtMoney(r.minutes)}</td>
                      <td>{fmtMoney(r.calls)}</td>
                      <td className="nowrap">{fmtCost(r.cost, data.billing.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.billing.history.length === 0 ? <p className="muted">{t.empty}</p> : null}
          </Card>
        </>
      )}
    </div>
  );
}

function CurrentMonth({ billing }) {
  const t = copy.billing;
  const cur = billing.current || { minutes: 0, cost: null };
  return (
    <div className="stat-grid">
      <div className="stat-card card">
        <div className="stat-value">{fmtMoney(cur.minutes)}</div>
        <div className="stat-label">{t.statMinutes}</div>
      </div>
      <div className="stat-card card">
        <div className="stat-value">{fmtCost(cur.cost, billing.currency)}</div>
        <div className="stat-label">{t.statCost}</div>
      </div>
    </div>
  );
}

// The rate + retention editor. Owner sees inputs and a save button; admin sees
// the same numbers read-only with a one-line note that only the owner edits.
function RateCard({ org, canEdit, rate, retentionDays, currency, plan, onSaved }) {
  const t = copy.billing;
  const [rateInput, setRateInput] = useState(rate != null ? String(rate) : "");
  const [retInput, setRetInput] = useState(retentionDays != null ? String(retentionDays) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [ok, setOk] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState(false);

  // Re-seed once the server values arrive / change.
  useEffect(() => {
    setRateInput(rate != null ? String(rate) : "");
    setRetInput(retentionDays != null ? String(retentionDays) : "");
  }, [rate, retentionDays]);

  async function submit(e) {
    e.preventDefault();
    setOk(false);
    setErr(null);

    const body = {};
    const rateTrim = rateInput.trim();
    if (rateTrim !== "") {
      const r = Number(rateTrim.replace(",", "."));
      if (!Number.isFinite(r) || r < 0) {
        setErr(t.badRate);
        return;
      }
      body.rate_per_minute = r;
    } else {
      body.rate_per_minute = null;
    }

    const retTrim = retInput.trim();
    if (retTrim !== "") {
      const d = Number(retTrim);
      if (!Number.isInteger(d) || d < 1) {
        setErr(t.badRetention);
        return;
      }
      body.retention_days = d;
    }

    setBusy(true);
    try {
      await saveBilling(org.org_id, body);
      setOk(true);
      onSaved();
    } catch (e2) {
      if (isMigration(e2)) setMigrationNeeded(true);
      else setErr(humanApiError(e2));
    }
    setBusy(false);
  }

  const currencyLine = (
    <p className="field-hint">
      {t.currencyLabel}: <strong>{currency}</strong>
      {plan ? (
        <>
          {" · "}
          {t.planLabel}: <strong>{plan}</strong>
        </>
      ) : null}
    </p>
  );

  if (!canEdit) {
    return (
      <Card title={t.rateCardTitle}>
        <p className="ai-current">
          {t.rateLabel}: <strong>{rate != null ? `${rate} ${currency}` : copy.common.dash}</strong>
        </p>
        <p className="ai-current">
          {t.retentionLabel}:{" "}
          <strong>{retentionDays != null ? `${retentionDays}` : copy.common.dash}</strong>
        </p>
        <p className="field-hint">{t.retentionNote.replace("{days}", retentionDays ?? 90)}</p>
        {currencyLine}
        <p className="field-hint">{t.readOnlyNote}</p>
      </Card>
    );
  }

  return (
    <Card title={t.rateCardTitle}>
      {migrationNeeded ? (
        <p className="warning">{copy.settings.orgSettings.migrationRequired}</p>
      ) : (
        <form className="ai-form" onSubmit={submit}>
          <div className="field-row">
            <label className="field field-narrow">
              <span className="label">{t.rateLabel}</span>
              <input
                className="input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder={t.ratePlaceholder}
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                disabled={busy}
              />
              <span className="field-hint">{t.rateHint.replace("{currency}", currency)}</span>
            </label>
            <label className="field field-narrow">
              <span className="label">{t.retentionLabel}</span>
              <input
                className="input"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder={t.retentionPlaceholder}
                value={retInput}
                onChange={(e) => setRetInput(e.target.value)}
                disabled={busy}
              />
              <span className="field-hint">
                {t.retentionNote.replace("{days}", retInput.trim() || retentionDays || 90)}
              </span>
            </label>
          </div>

          {currencyLine}

          {err ? <div className="form-error">{err}</div> : null}
          {ok && !err ? <div className="form-success">{t.saved}</div> : null}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
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
      )}
    </Card>
  );
}
