// Settings: AI key (owner only), team management, telephony webhooks.
// Member reads and extension edits go straight to Supabase (RLS gives
// owner/admin write on memberships); key material and user creation go
// through the Worker — the browser never sees a stored key, only its hint.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase.js";
import { createMember, fetchAiKey, fetchIntegrations, saveAiKey } from "./api.js";
import { copy } from "./copy.js";
import { useAsync } from "./hooks.js";
import { fmtDateTime, humanApiError } from "./format.js";
import { Card, ErrorBox, SkeletonBlock, Spinner } from "./ui.jsx";

const PROVIDERS = ["gemini", "anthropic", "openai"];

export function Settings({ org }) {
  const t = copy.settings;
  return (
    <div className="page">
      <h1 className="page-title">{t.title}</h1>
      {org.role === "owner" ? <AiKeyCard org={org} /> : null}
      <TeamCard org={org} />
      <TelephonyCard org={org} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// (a) AI key — owner only
// ---------------------------------------------------------------------------
function AiKeyCard({ org }) {
  const t = copy.settings.aiKey;
  const { loading, data, error, reload } = useAsync(async () => {
    try {
      const raw = await fetchAiKey(org.org_id);
      // Tolerate { key: {...} } and the bare object; 404 = no key yet.
      return raw?.key || raw || null;
    } catch (err) {
      if (err && err.status === 404) return null;
      throw err;
    }
  }, [org.org_id]);

  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedHint, setSavedHint] = useState(null);

  // Prefill the form from the current state once it arrives.
  useEffect(() => {
    if (data?.provider && PROVIDERS.includes(data.provider)) setProvider(data.provider);
    if (data?.model) setModel(data.model);
  }, [data]);

  async function submit(e) {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true);
    setSaveError(null);
    setSavedHint(null);
    try {
      const res = await saveAiKey(org.org_id, {
        provider,
        model: model.trim() || null,
        key: key.trim()
      });
      setKey(""); // never keep the secret in state longer than needed
      setSavedHint(res?.key_hint || res?.hint || "");
      reload();
    } catch (err) {
      setSaveError(err);
    }
    setBusy(false);
  }

  const hint = data?.key_hint || data?.hint;

  return (
    <Card title={t.title}>
      <p className="muted">{t.intro}</p>
      {loading ? (
        <SkeletonBlock lines={2} />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : (
        <p className="ai-current">
          {hint ? (
            <>
              {t.currentLabel}: <strong>{data.provider}</strong>
              {data.model ? <> · {data.model}</> : null} · {t.keyWord}{" "}
              <span className="mono">{hint}</span>
              {" · "}
              {data.last_ok_at ? `${t.lastOk} ${fmtDateTime(data.last_ok_at)}` : t.lastOkNever}
              {data.last_error ? (
                <span className="form-error-inline">
                  {" "}
                  {t.lastErrorLabel}: {humanApiError(data.last_error)}
                </span>
              ) : null}
            </>
          ) : (
            t.currentNone
          )}
        </p>
      )}

      <form className="ai-form" onSubmit={submit}>
        <div className="field-row">
          <label className="field">
            <span className="label">{t.provider}</span>
            <select
              className="input"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={busy}
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">{t.model}</span>
            <input
              className="input"
              type="text"
              placeholder={t.modelPlaceholder}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>
        <label className="field">
          <span className="label">{t.key}</span>
          <input
            className="input"
            type="password"
            autoComplete="off"
            placeholder={t.keyPlaceholder}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={busy}
            required
          />
        </label>

        {saveError ? <div className="form-error">{humanApiError(saveError)}</div> : null}
        {savedHint != null && !saveError ? (
          <div className="form-success">
            {t.saved} <span className="mono">{savedHint}</span>
          </div>
        ) : null}

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

      <p className="warning">{t.warning}</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// (b) Team
// ---------------------------------------------------------------------------
function TeamCard({ org }) {
  const t = copy.settings.team;
  const { loading, data, error, reload } = useAsync(async () => {
    const { data: rows, error: err } = await supabase
      .from("memberships")
      .select("id, user_id, full_name, role, status, extension")
      .eq("org_id", org.org_id)
      .order("created_at", { ascending: true });
    if (err) throw err;
    return rows || [];
  }, [org.org_id]);

  return (
    <Card title={t.title}>
      {error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : loading ? (
        <SkeletonBlock lines={4} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t.thName}</th>
                <th>{t.thRole}</th>
                <th>{t.thExtension}</th>
                <th>{t.thStatus}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <MemberRow key={m.id} member={m} />
              ))}
            </tbody>
          </table>
          {data.length === 0 ? <p className="muted">{t.empty}</p> : null}
        </div>
      )}

      <AddMemberForm org={org} onAdded={reload} />
      <InviteLinkBlock org={org} />
    </Card>
  );
}

// Invite by link: an invites row via supabase-js (RLS grants owner/admin the
// write), the DB generates the 48-hex token, and the link carries it. The
// invitee opens /app/#/join/<token> and proves the email named here.
function InviteLinkBlock({ org }) {
  const t = copy.settings.invite;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("manager");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [link, setLink] = useState(null);
  const [copied, setCopied] = useState(false);

  const roles = org.role === "owner" ? ["admin", "lead", "manager", "viewer"] : ["lead", "manager", "viewer"];

  async function create(e) {
    e.preventDefault();
    setErr(null);
    setLink(null);
    setCopied(false);
    if (!email.includes("@")) {
      setErr(t.badEmail);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("invites")
      .insert({ org_id: org.org_id, email: email.trim(), role })
      .select("token")
      .single();
    setBusy(false);
    if (error) {
      setErr(humanApiError(error));
      return;
    }
    setLink(`${window.location.origin}/app/#/join/${data.token}`);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch (_) {
      // clipboard may be blocked — the link is selectable text either way
    }
  }

  return (
    <div className="invite-block">
      <h3 className="sub-title">{t.title}</h3>
      <p className="muted">{t.hint}</p>
      <form onSubmit={create} className="invite-form">
        <input
          className="input"
          type="email"
          placeholder={t.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <select className="input" value={role} onChange={(e) => setRole(e.target.value)} disabled={busy}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {copy.roles[r] || r}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <Spinner small /> : t.submit}
        </button>
      </form>
      {err ? <p className="form-error">{err}</p> : null}
      {link ? (
        <div className="invite-result">
          <code className="invite-link">{link}</code>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyLink}>
            {copied ? t.copied : t.copy}
          </button>
          <p className="muted">{t.expires}</p>
        </div>
      ) : null}
    </div>
  );
}

function MemberRow({ member }) {
  const t = copy.settings.team;
  const [ext, setExt] = useState(member.extension || "");
  const [saved, setSaved] = useState(member.extension || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function save() {
    if (ext.trim() === saved) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from("memberships")
      .update({ extension: ext.trim() || null })
      .eq("id", member.id);
    setBusy(false);
    if (error) {
      setErr(error.code === "23505" ? t.extConflict : humanApiError(error));
    } else {
      setSaved(ext.trim());
    }
  }

  return (
    <tr>
      <td>{member.full_name || t.noName}</td>
      <td>{copy.roles[member.role] || member.role}</td>
      <td>
        <span className="ext-edit">
          <input
            className="input input-sm"
            type="text"
            placeholder={t.extPlaceholder}
            value={ext}
            disabled={busy}
            onChange={(e) => setExt(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          {busy ? <Spinner small /> : null}
        </span>
        {err ? <div className="form-error-inline">{err}</div> : null}
      </td>
      <td>
        <span className={member.status === "active" ? "chip chip-green" : "chip chip-gray"}>
          {member.status === "active" ? t.statusActive : t.statusSuspended}
        </span>
      </td>
    </tr>
  );
}

function AddMemberForm({ org, onAdded }) {
  const t = copy.settings.team;
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "manager", extension: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);

  // You may only create roles strictly below your own; nobody creates owners
  // from this form (ownership transfer is a support operation on the pilot).
  const roleOptions = useMemo(
    () => (org.role === "owner" ? ["admin", "lead", "manager", "viewer"] : ["lead", "manager", "viewer"]),
    [org.role]
  );

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      await createMember(org.org_id, {
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        role: form.role,
        extension: form.extension.trim() || null
      });
      setForm({ email: "", password: "", full_name: "", role: "manager", extension: "" });
      setOk(true);
      onAdded();
    } catch (err) {
      setError(err);
    }
    setBusy(false);
  }

  return (
    <form className="add-member" onSubmit={submit}>
      <h3 className="sub-title">{t.addTitle}</h3>
      <div className="field-row field-row-wrap">
        <label className="field">
          <span className="label">{t.email}</span>
          <input className="input" type="email" required value={form.email} onChange={set("email")} disabled={busy} />
        </label>
        <label className="field">
          <span className="label">{t.password}</span>
          <input
            className="input"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            disabled={busy}
          />
        </label>
        <label className="field">
          <span className="label">{t.name}</span>
          <input className="input" type="text" required value={form.full_name} onChange={set("full_name")} disabled={busy} />
        </label>
        <label className="field">
          <span className="label">{t.role}</span>
          <select className="input" value={form.role} onChange={set("role")} disabled={busy}>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {copy.roles[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">{t.extension}</span>
          <input
            className="input"
            type="text"
            placeholder={t.extPlaceholder}
            value={form.extension}
            onChange={set("extension")}
            disabled={busy}
          />
        </label>
      </div>

      {error ? <div className="form-error">{humanApiError(error)}</div> : null}
      {ok && !error ? <div className="form-success">{t.added}</div> : null}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? (
            <>
              <Spinner small /> {t.submitting}
            </>
          ) : (
            t.submit
          )}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// (c) Telephony webhooks
// ---------------------------------------------------------------------------
function TelephonyCard({ org }) {
  const t = copy.settings.telephony;
  const { loading, data, error, reload } = useAsync(async () => {
    const raw = await fetchIntegrations(org.org_id);
    return Array.isArray(raw) ? raw : raw?.integrations || [];
  }, [org.org_id]);

  return (
    <Card title={t.title}>
      {loading ? (
        <SkeletonBlock lines={2} />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <p className="muted">{t.empty}</p>
      ) : (
        <>
          <div className="integration-list">
            {data.map((integration) => (
              <IntegrationRow key={integration.kind} integration={integration} />
            ))}
          </div>
          <p className="field-hint">{t.hint}</p>
        </>
      )}
    </Card>
  );
}

function IntegrationRow({ integration }) {
  const t = copy.settings.telephony;
  const [copied, setCopied] = useState(false);

  // The Worker returns a same-origin path; an absolute URL wins if present.
  const path =
    integration.webhook_path ||
    (integration.webhook_token
      ? `/api/telephony/${integration.kind}/${integration.webhook_token}`
      : "");
  const url = integration.webhook_url || (path ? window.location.origin + path : "");

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard denied (http origin) — the URL is selectable text anyway.
    }
  }

  return (
    <div className="integration-row">
      <div className="integration-head">
        <span className="integration-kind">{t.kinds[integration.kind] || integration.kind}</span>
        <span className="muted">
          {integration.last_event_at
            ? `${t.lastEvent} ${fmtDateTime(integration.last_event_at)}`
            : t.noEvents}
        </span>
      </div>
      <div className="copy-row">
        <code className="mono webhook-url">{url}</code>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copyUrl} disabled={!url}>
          {copied ? t.copied : t.copy}
        </button>
      </div>
    </div>
  );
}
