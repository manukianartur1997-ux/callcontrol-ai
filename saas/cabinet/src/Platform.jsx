// Platform super-admin surface at #/platform (list) and #/platform/:orgId
// (read-only org detail). Only ever mounted when /me reported is_platform_admin
// (App guards the route); the endpoints are built in parallel, so 404/501/403
// degrade to an "unavailable yet" note. A god-view accent marks the whole
// surface as cross-tenant and read-only.
import {
  fetchPlatformStats,
  fetchPlatformOrgs,
  fetchPlatformOrg
} from "./api.js";
import { copy } from "./copy.js";
import { useAsync } from "./hooks.js";
import { fmtDate, fmtDateTime, fmtMoney } from "./format.js";
import {
  Card,
  DirectionMark,
  ErrorBox,
  ScoreBadge,
  SkeletonBlock,
  StatusBadge
} from "./ui.jsx";
import { navigate } from "./router.js";

function isUnavailable(err) {
  return err && (err.status === 404 || err.status === 501 || err.status === 403);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function Platform({ orgId }) {
  return orgId ? <PlatformOrg orgId={orgId} /> : <PlatformList />;
}

// ---------------------------------------------------------------------------
// List: totals row + every organization.
// ---------------------------------------------------------------------------
function normalizeStats(raw) {
  const s = raw?.totals || raw?.stats || raw || {};
  return {
    orgs: num(s.orgs ?? s.organizations ?? s.org_count),
    members: num(s.members ?? s.users ?? s.member_count),
    calls: num(s.calls ?? s.call_count),
    analyses: num(s.analyses ?? s.analysis_count),
    tokens: num(s.tokens ?? s.tokens_total ?? (num(s.tokens_in) + num(s.tokens_out)))
  };
}

function normalizeOrgs(raw) {
  const list = Array.isArray(raw) ? raw : raw?.orgs || raw?.organizations || [];
  return list.map((o) => ({
    id: o.id || o.org_id,
    name: o.name || o.org_name || copy.common.orgFallback,
    plan: o.plan || null,
    members: num(o.members ?? o.member_count),
    calls: num(o.calls ?? o.call_count),
    created_at: o.created_at || o.createdAt || null
  }));
}

function PlatformList() {
  const t = copy.platform;
  const { loading, data, error, reload } = useAsync(async () => {
    try {
      const [stats, orgs] = await Promise.all([
        fetchPlatformStats().catch((err) => {
          if (isUnavailable(err)) return null;
          throw err;
        }),
        fetchPlatformOrgs()
      ]);
      return { stats: normalizeStats(stats), orgs: normalizeOrgs(orgs) };
    } catch (err) {
      if (isUnavailable(err)) return { unavailable: true };
      throw err;
    }
  }, []);

  return (
    <div className="page god">
      <div className="god-banner">{t.godNote}</div>
      <h1 className="page-title">{t.title}</h1>
      <p className="muted page-explainer">{t.subtitle}</p>

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
      ) : (
        <>
          <div className="stat-grid stat-grid-god">
            <TotalCard value={data.stats.orgs} label={t.totalsOrgs} />
            <TotalCard value={data.stats.members} label={t.totalsMembers} />
            <TotalCard value={data.stats.calls} label={t.totalsCalls} />
            <TotalCard value={data.stats.analyses} label={t.totalsAnalyses} />
            <TotalCard value={data.stats.tokens} label={t.totalsTokens} />
          </div>

          <Card className="card-flush">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.thOrg}</th>
                    <th>{t.thPlan}</th>
                    <th>{t.thMembers}</th>
                    <th>{t.thCalls}</th>
                    <th>{t.thCreated}</th>
                    <th aria-label={t.open} />
                  </tr>
                </thead>
                <tbody>
                  {data.orgs.map((o) => (
                    <tr
                      key={o.id}
                      className="row-link"
                      tabIndex={0}
                      onClick={() => navigate(`/platform/${o.id}`)}
                      onKeyDown={(e) => e.key === "Enter" && navigate(`/platform/${o.id}`)}
                    >
                      <td>{o.name}</td>
                      <td>{o.plan || copy.common.dash}</td>
                      <td>{fmtMoney(o.members)}</td>
                      <td>{fmtMoney(o.calls)}</td>
                      <td className="nowrap">{o.created_at ? fmtDate(o.created_at) : copy.common.dash}</td>
                      <td className="nowrap">
                        <span className="link-like">{t.open} →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.orgs.length === 0 ? <p className="muted">{t.empty}</p> : null}
          </Card>
        </>
      )}
    </div>
  );
}

function TotalCard({ value, label }) {
  return (
    <div className="stat-card card">
      <div className="stat-value">{fmtMoney(value)}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail: read-only cross-tenant view of one organization.
// ---------------------------------------------------------------------------
function normalizeDetail(raw) {
  const org = raw?.org || raw?.organization || raw || {};
  const members = raw?.members || org.members || [];
  const integrations = raw?.integrations || org.integrations || [];
  const calls = raw?.recent_calls || raw?.recentCalls || raw?.calls || [];
  const usage = raw?.usage || null;
  return {
    org: {
      name: org.name || org.org_name || copy.common.orgFallback,
      plan: org.plan || null,
      created_at: org.created_at || null,
      avg_deal_amount: org.avg_deal_amount ?? null,
      calls: num(org.calls ?? org.call_count)
    },
    members: (Array.isArray(members) ? members : []).map((m) => ({
      id: m.id || m.user_id || Math.random(),
      name: m.full_name || m.name || copy.settings.team.noName,
      role: m.role || "viewer",
      status: m.status || "active"
    })),
    integrations: (Array.isArray(integrations) ? integrations : []).map((i) => ({
      kind: i.kind,
      enabled: Boolean(i.enabled),
      last_event_at: i.last_event_at || null
    })),
    usage: usage
      ? {
          calls: num(usage.calls_analyzed ?? usage.calls),
          tokensIn: num(usage.tokens_in),
          tokensOut: num(usage.tokens_out),
          period: usage.period || ""
        }
      : null,
    calls: (Array.isArray(calls) ? calls : []).slice(0, 20).map((c) => ({
      id: c.id,
      direction: c.direction,
      status: c.status,
      source: c.source,
      started_at: c.started_at || c.created_at || null,
      score: c.score ?? (Array.isArray(c.analyses) && c.analyses[0]?.score) ?? null
    }))
  };
}

function PlatformOrg({ orgId }) {
  const t = copy.platform;
  const { loading, data, error, reload } = useAsync(async () => {
    try {
      return { detail: normalizeDetail(await fetchPlatformOrg(orgId)) };
    } catch (err) {
      if (isUnavailable(err)) return { unavailable: true };
      throw err;
    }
  }, [orgId]);

  return (
    <div className="page god">
      <div className="god-banner">{t.godNote}</div>
      <a className="back-link" href="#/platform">
        {t.backToList}
      </a>

      {error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : loading ? (
        <Card>
          <SkeletonBlock lines={5} />
        </Card>
      ) : data.unavailable ? (
        <Card>
          <p className="warning">{t.unavailable}</p>
        </Card>
      ) : (
        <PlatformOrgBody detail={data.detail} />
      )}
    </div>
  );
}

function PlatformOrgBody({ detail }) {
  const t = copy.platform;
  const { org, members, integrations, usage, calls } = detail;

  return (
    <>
      <h1 className="page-title">{org.name}</h1>

      <Card title={t.detailInfo}>
        <dl className="kv-grid">
          <div className="kv">
            <dt>{t.infoPlan}</dt>
            <dd>{org.plan || copy.common.dash}</dd>
          </div>
          <div className="kv">
            <dt>{t.infoCreated}</dt>
            <dd>{org.created_at ? fmtDate(org.created_at) : copy.common.dash}</dd>
          </div>
          <div className="kv">
            <dt>{t.infoAvgDeal}</dt>
            <dd>{org.avg_deal_amount != null ? fmtMoney(org.avg_deal_amount) : copy.common.dash}</dd>
          </div>
          <div className="kv">
            <dt>{t.infoCalls}</dt>
            <dd>{fmtMoney(org.calls)}</dd>
          </div>
        </dl>
      </Card>

      {usage ? (
        <Card title={t.detailUsage}>
          <div className="stat-grid">
            <TotalCard value={usage.calls} label={copy.usage.statCalls} />
            <TotalCard value={usage.tokensIn} label={copy.usage.statTokensIn} />
            <TotalCard value={usage.tokensOut} label={copy.usage.statTokensOut} />
          </div>
        </Card>
      ) : null}

      <Card title={t.detailMembers} className="card-flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t.memName}</th>
                <th>{t.memRole}</th>
                <th>{t.memStatus}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{copy.roles[m.role] || m.role}</td>
                  <td>
                    <span className={m.status === "active" ? "chip chip-green" : "chip chip-gray"}>
                      {m.status === "active"
                        ? copy.settings.team.statusActive
                        : copy.settings.team.statusSuspended}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {members.length === 0 ? <p className="muted">{t.noMembers}</p> : null}
      </Card>

      <Card title={t.detailIntegrations} className="card-flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t.intKind}</th>
                <th>{t.intStatus}</th>
                <th>{t.intLastEvent}</th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((i) => (
                <tr key={i.kind}>
                  <td>{copyProviderTitle(i.kind)}</td>
                  <td>
                    <span className={i.enabled ? "chip chip-green" : "chip chip-gray"}>
                      {i.enabled ? t.intEnabled : t.intDisabled}
                    </span>
                  </td>
                  <td className="nowrap">
                    {i.last_event_at ? fmtDateTime(i.last_event_at) : copy.common.dash}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {integrations.length === 0 ? <p className="muted">{t.noIntegrations}</p> : null}
      </Card>

      <Card title={t.detailRecentCalls} className="card-flush">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t.callDate}</th>
                <th aria-label={t.callDirection} />
                <th>{t.callStatus}</th>
                <th>{t.callScore}</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id}>
                  <td className="nowrap">{c.started_at ? fmtDateTime(c.started_at) : copy.common.dash}</td>
                  <td className="dir-cell">
                    <DirectionMark direction={c.direction} />
                  </td>
                  <td>
                    <StatusBadge status={c.status} source={c.source} />
                  </td>
                  <td>
                    <ScoreBadge score={c.score} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {calls.length === 0 ? <p className="muted">{t.noCalls}</p> : null}
      </Card>
    </>
  );
}

// The manifest carries brand titles under providers.<kind>.title; fall back to
// the raw kind for anything the dictionary does not know.
function copyProviderTitle(kind) {
  const providers = copy.providers || {};
  return providers[kind]?.title || kind || copy.common.dash;
}
