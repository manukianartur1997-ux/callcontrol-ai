// Settings: AI key (owner only), org parameters (owner only), team
// management, telephony connections, Telegram delivery (owner/admin). Member
// reads and extension edits go straight to Supabase (RLS gives owner/admin
// write on memberships); key material, PBX credentials and user creation go
// through the Worker — the browser never sees a stored secret, only its hint
// or field names.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase.js";
import {
  createMember,
  createMembersBulk,
  fetchAiKey,
  fetchBilling,
  fetchIntegrations,
  fetchIntegrationCredentials,
  fetchStt,
  fetchTelegramRecipients,
  saveAiKey,
  saveIntegrationCredentials,
  saveOrgSettings,
  saveStt,
  saveTelegramRecipients,
  rotateWebhookToken
} from "./api.js";
// Shared connector manifest — plain data, no worker-only imports, so vite
// bundles it into the cabinet without dragging the Worker along.
import { PROVIDERS as TELEPHONY_PROVIDERS } from "../../worker/telephony.js";
import { copy, copyGet } from "./copy.js";
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
      {org.role === "owner" ? <SttCard org={org} /> : null}
      {org.role === "owner" ? <OrgSettingsCard org={org} /> : null}
      <TeamCard org={org} />
      <TelephonyCard org={org} />
      {org.role === "owner" || org.role === "admin" ? <TelegramCard org={org} /> : null}
      <DataProcessingCard org={org} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Organization parameters — owner only. Currently just avg_deal_amount; the
// Worker answers 503 migration_required until migration 0004 is applied.
// ---------------------------------------------------------------------------
function OrgSettingsCard({ org }) {
  const t = copy.settings.orgSettings;
  const [amount, setAmount] = useState(
    org.avg_deal_amount != null ? String(org.avg_deal_amount) : ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const trimmed = amount.trim();
    const value = trimmed === "" ? null : Number(trimmed.replace(",", "."));
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      setError(t.badAmount);
      return;
    }
    setBusy(true);
    setError(null);
    setOk(false);
    try {
      await saveOrgSettings(org.org_id, { avg_deal_amount: value });
      setOk(true);
    } catch (err) {
      if (err && err.error === "migration_required") setMigrationNeeded(true);
      else setError(humanApiError(err));
    }
    setBusy(false);
  }

  return (
    <Card title={t.title}>
      {migrationNeeded ? (
        <p className="warning">{t.migrationRequired}</p>
      ) : (
        <form className="ai-form" onSubmit={submit}>
          <label className="field field-narrow">
            <span className="label">{t.avgDealLabel}</span>
            <input
              className="input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder={t.avgDealPlaceholder}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
            />
            <span className="field-hint">{t.avgDealHint}</span>
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          {ok && !error ? <div className="form-success">{t.saved}</div> : null}
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
// (a2) STT provider — owner only. The transcription backend is separate from
// the analysis LLM: Gemini is cheaper and reuses the org's existing Gemini key
// (nothing extra to paste); Deepgram gives real speaker separation but needs
// its own key. GET/PUT /orgs/:id/stt is built in parallel with the Worker, so
// this degrades on 404/501 (endpoint absent) and 503 migration_required
// (pre-0005). The browser only ever sees a key hint, never the stored value.
// ---------------------------------------------------------------------------
const STT_PROVIDERS = ["gemini", "deepgram"];

function SttCard({ org }) {
  const t = copy.settings.stt;
  const { loading, data, error, reload } = useAsync(async () => {
    try {
      const raw = await fetchStt(org.org_id);
      return { state: raw?.stt || raw || {} };
    } catch (err) {
      if (err && (err.status === 404 || err.status === 501)) return { unavailable: true };
      if (err && err.error === "migration_required") return { migration: true };
      throw err;
    }
  }, [org.org_id]);

  const [provider, setProvider] = useState("gemini");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState(false);

  const state = data?.state || {};
  const activeProvider = STT_PROVIDERS.includes(state.provider) ? state.provider : "gemini";
  const deepgramHint = state.deepgram_hint || state.deepgram_key_hint || null;
  const deepgramConfigured = Boolean(state.deepgram_configured || deepgramHint);

  // Prefill the select from the active provider once state arrives.
  useEffect(() => {
    if (data?.state && STT_PROVIDERS.includes(data.state.provider)) {
      setProvider(data.state.provider);
    }
  }, [data]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setSaveError(null);
    setSaved(false);
    setMigrationNeeded(false);
    try {
      const body = { provider };
      // A Deepgram key is only sent when the field was filled; switching back
      // to Gemini never needs one and reuses the org's Gemini key.
      if (provider === "deepgram" && key.trim()) body.key = key.trim();
      await saveStt(org.org_id, body);
      setKey(""); // never keep the secret in state longer than needed
      setSaved(true);
      reload();
    } catch (err) {
      if (err && err.error === "migration_required") setMigrationNeeded(true);
      else setSaveError(err);
    }
    setBusy(false);
  }

  return (
    <Card title={t.title}>
      <p className="muted">{t.intro}</p>
      {loading ? (
        <SkeletonBlock lines={2} />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : data.unavailable ? (
        <p className="warning">{t.unavailable}</p>
      ) : data.migration ? (
        <p className="warning">{copy.settings.orgSettings.migrationRequired}</p>
      ) : (
        <>
          <p className="ai-current">
            {t.activeLabel}: <strong>{t.providerNames[activeProvider] || activeProvider}</strong>
            {deepgramConfigured ? (
              <>
                {" · "}
                {t.deepgramKeyWord}{" "}
                <span className="mono">{deepgramHint || t.deepgramConfigured}</span>
              </>
            ) : null}
          </p>

          <form className="ai-form" onSubmit={submit}>
            <label className="field">
              <span className="label">{t.providerLabel}</span>
              <select
                className="input"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                disabled={busy}
              >
                {STT_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {t.providerOptions[p]}
                  </option>
                ))}
              </select>
              <span className="field-hint">{t.needsKey}</span>
            </label>

            {provider === "deepgram" ? (
              <label className="field">
                <span className="label">{t.keyLabel}</span>
                <input
                  className="input"
                  type="password"
                  autoComplete="off"
                  placeholder={deepgramConfigured ? t.keyPlaceholderSet : t.keyPlaceholder}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  disabled={busy}
                />
                <span className="field-hint">{t.keyHint}</span>
              </label>
            ) : null}

            {migrationNeeded ? (
              <p className="warning">{copy.settings.orgSettings.migrationRequired}</p>
            ) : null}
            {saveError ? <div className="form-error">{humanApiError(saveError)}</div> : null}
            {saved && !saveError ? <div className="form-success">{t.saved}</div> : null}

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
        </>
      )}
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
      <BulkAddForm org={org} onAdded={reload} />
      <InviteLinkBlock org={org} />
    </Card>
  );
}

// Paste-a-list onboarding: one text box, one row per person
// (email; full name; extension; role), submitted as a single bulk request.
// Reuses the SAME server-side validation as the single-add form — a bad row
// never aborts the rest of the paste, and each row reports its own outcome.
// Rows never carry a password: the Worker generates a fresh one per row and
// returns it exactly once, here, for the admin to copy and hand out.
const ROLE_ALIASES = { owner: "manager", admin: "manager" }; // never bulk-mint either
function parseBulkRows(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [email, fullName, extension, role] = line.split(";").map((s) => (s || "").trim());
      const safeRole = role ? (ROLE_ALIASES[role] || role) : "manager";
      return { email, full_name: fullName || "", extension: extension || null, role: safeRole };
    });
}

function BulkAddForm({ org, onAdded }) {
  const t = copy.settings.team;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const rows = parseBulkRows(text);
    if (!rows.length) return;
    setBusy(true);
    setError(null);
    setResults(null);
    setCopied(false);
    try {
      const { results: rowResults } = await createMembersBulk(org.org_id, rows);
      setResults(rowResults);
      if (rowResults.some((r) => r.ok)) onAdded();
    } catch (err) {
      setError(err);
    }
    setBusy(false);
  }

  async function copyPasswords() {
    const lines = (results || [])
      .filter((r) => r.ok)
      .map((r) => `${r.email}: ${r.password}`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
    } catch (_) {
      // clipboard may be blocked — the table below is selectable either way
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        {t.bulkToggle}
      </button>
    );
  }

  return (
    <div className="bulk-add-block">
      <h3 className="sub-title">{t.bulkTitle}</h3>
      <p className="muted">{t.bulkHint}</p>
      <form onSubmit={submit}>
        <textarea
          className="input textarea"
          rows={5}
          placeholder={t.bulkPlaceholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
        <div className="modal-actions">
          <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
            {busy ? <Spinner small /> : t.bulkSubmit}
          </button>
        </div>
      </form>
      {error ? <ErrorBox error={error} /> : null}
      {results ? (
        <div className="table-wrap">
          <h4 className="sub-title">{t.bulkResultsTitle}</h4>
          <table className="table">
            <thead>
              <tr>
                <th>{t.email}</th>
                <th>{t.bulkPasswordWord}</th>
                <th>{t.thStatus}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td>{r.email}</td>
                  <td>{r.ok ? <code>{r.password}</code> : "—"}</td>
                  <td>{r.ok ? "✓" : humanApiError(r.error)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.some((r) => r.ok) ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyPasswords}>
              {copied ? t.bulkCopied : t.bulkCopyAll}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
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
// (c) Telephony connections — an accordion over the shared PROVIDERS
// manifest (saas/worker/telephony.js). A provider with an integrations row
// renders as connected; one the database does not know yet (its kind is
// absent from the GET response — pre-0004 CHECK constraint) renders muted as
// "soon" with a migration note instead of a webhook.
// ---------------------------------------------------------------------------
// Manifest i18n contract (see saas/worker/telephony.js): a provider MAY carry
// an i18n object { titleKey?, mappingHintKey, fields:[{key, labelKey,
// placeholderKey}] } whose values are dot-paths into the providers.* subtree of
// copy.js. The cabinet resolves each string as copyGet(<key>) ?? <manifest
// literal>, so an absent subtree (or a pre-i18n manifest) degrades to the
// manifest's own Russian fallback without a crash.
function providerTitle(provider) {
  return (
    copyGet(provider.i18n?.titleKey) ||
    provider.displayName ||
    provider.label ||
    copy.settings.telephony.kinds[provider.kind] ||
    provider.kind
  );
}

function providerMappingHint(provider) {
  return (
    copyGet(provider.i18n?.mappingHintKey) ||
    provider.managerMappingHint ||
    copy.settings.telephony.mappingFallback
  );
}

// Merge the manifest's credentialFields with their i18n key-paths (matched by
// key), tolerating either an i18n.fields array or keys placed straight on the
// credentialField. Downstream reads copyGet(field.labelKey) ?? field.label.
function resolveFields(provider) {
  const byKey = {};
  for (const f of provider.i18n?.fields || []) byKey[f.key] = f;
  return (provider.credentialFields || []).map((f) => ({
    ...f,
    labelKey: f.labelKey || byKey[f.key]?.labelKey,
    placeholderKey: f.placeholderKey || byKey[f.key]?.placeholderKey
  }));
}

function TelephonyCard({ org }) {
  const t = copy.settings.telephony;
  const [openKind, setOpenKind] = useState(null);
  const { loading, data, error, reload } = useAsync(async () => {
    const raw = await fetchIntegrations(org.org_id);
    return Array.isArray(raw) ? raw : raw?.integrations || [];
  }, [org.org_id]);

  const rows = data || [];
  const rowByKind = Object.fromEntries(rows.map((r) => [r.kind, r]));
  // Rows for kinds the manifest does not know keep rendering (nothing an
  // operator provisioned may silently vanish from this screen).
  const manifestKinds = new Set(TELEPHONY_PROVIDERS.map((p) => p.kind));
  const extraProviders = rows
    .filter((r) => !manifestKinds.has(r.kind))
    .map((r) => ({ kind: r.kind, credentialFields: [] }));

  return (
    <Card title={t.title}>
      <p className="muted">{t.intro}</p>
      {loading ? (
        <SkeletonBlock lines={3} />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : (
        <div className="acc-list">
          {[...TELEPHONY_PROVIDERS, ...extraProviders].map((provider) => (
            <ProviderSection
              key={provider.kind}
              org={org}
              provider={provider}
              row={rowByKind[provider.kind] || null}
              open={openKind === provider.kind}
              onToggle={() =>
                setOpenKind((k) => (k === provider.kind ? null : provider.kind))
              }
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function ProviderSection({ org, provider, row, open, onToggle }) {
  const t = copy.settings.telephony;
  const connected = Boolean(row);

  const sectionClass = [
    "acc-section",
    connected ? "" : "acc-muted",
    open ? "open" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClass}>
      <button
        type="button"
        className="acc-head"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="acc-title">{providerTitle(provider)}</span>
        <span className={connected ? "chip chip-green" : "chip chip-outline"}>
          {connected ? t.statusConnected : t.statusSoon}
        </span>
        <span className="acc-chevron" aria-hidden="true">
          {"▸"}
        </span>
      </button>

      {open ? (
        <div className="acc-body">
          {connected ? (
            <>
              <WebhookBlock org={org} row={row} />
              <CredentialsBlock org={org} provider={provider} />
            </>
          ) : (
            <p className="muted">{t.soonNote}</p>
          )}
          <p className="field-hint">{providerMappingHint(provider)}</p>
        </div>
      ) : null}
    </section>
  );
}

function WebhookBlock({ org, row }) {
  const t = copy.settings.telephony;
  const [copied, setCopied] = useState(false);
  // Once rotated, the fresh token/path from the Worker wins over the stale row.
  const [rotated, setRotated] = useState(null);
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState(null);

  // The Worker returns a same-origin path; an absolute URL wins if present.
  const token = rotated?.webhook_token || row.webhook_token;
  const path =
    rotated?.webhook_path ||
    row.webhook_path ||
    (token ? `/api/telephony/${row.kind}/${token}` : "");
  const url = row.webhook_url && !rotated ? row.webhook_url : path ? window.location.origin + path : "";

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard denied (http origin) — the URL is selectable text anyway.
    }
  }

  async function rotate() {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t.rotateConfirm)) return;
    setRotating(true);
    setRotateError(null);
    try {
      const res = await rotateWebhookToken(org.org_id, row.kind);
      setRotated({
        webhook_token: res?.webhook_token || null,
        webhook_path: res?.webhook_path || null
      });
    } catch (err) {
      setRotateError(err);
    }
    setRotating(false);
  }

  return (
    <div className="webhook-block">
      <div className="integration-head">
        <span className="label">{t.webhookLabel}</span>
        <span className="muted">
          {row.last_event_at ? `${t.lastEvent} ${fmtDateTime(row.last_event_at)}` : t.noEvents}
        </span>
      </div>
      <div className="copy-row">
        <code className="mono webhook-url">{url}</code>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copyUrl} disabled={!url}>
          {copied ? t.copied : t.copy}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={rotate} disabled={rotating}>
          {rotating ? (
            <>
              <Spinner small /> {t.rotating}
            </>
          ) : (
            t.rotate
          )}
        </button>
      </div>
      {rotated ? (
        <p className="form-success">
          {t.rotated} <span className="mono">{path}</span>
        </p>
      ) : null}
      {rotateError ? <div className="form-error">{humanApiError(rotateError)}</div> : null}
      <p className="field-hint">{t.hint}</p>
      <p className="field-hint">{t.rotateHint}</p>
    </div>
  );
}

// Credential form per manifest: secret fields render as password inputs, and
// after a save the screen only ever shows configured/not — the Worker returns
// field NAMES at most, never values.
function CredentialsBlock({ org, provider }) {
  const t = copy.settings.telephony;
  const fields = resolveFields(provider);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  const status = useAsync(async () => {
    if (!fields.length) return { configured: false };
    try {
      return await fetchIntegrationCredentials(org.org_id, provider.kind);
    } catch (err) {
      // 404 = kind exists but nothing stored / pre-manifest worker — both
      // render as "not configured" rather than an error wall.
      if (err && err.status === 404) return { configured: false };
      throw err;
    }
  }, [org.org_id, provider.kind]);

  if (!fields.length) return <p className="field-hint">{t.credsNoFields}</p>;

  async function submit(e) {
    e.preventDefault();
    const filled = {};
    for (const f of fields) {
      const v = (values[f.key] || "").trim();
      if (v) filled[f.key] = v;
    }
    if (!Object.keys(filled).length) return;
    setBusy(true);
    setSaveError(null);
    setSaved(false);
    try {
      await saveIntegrationCredentials(org.org_id, provider.kind, filled);
      setValues({}); // never keep secrets in state longer than needed
      setSaved(true);
      status.reload();
    } catch (err) {
      setSaveError(err);
    }
    setBusy(false);
  }

  const configured = Boolean(status.data?.configured);

  return (
    <form className="cred-block" onSubmit={submit}>
      <h3 className="sub-title">{t.credsTitle}</h3>
      {status.loading ? (
        <SkeletonBlock lines={1} />
      ) : status.error ? (
        <ErrorBox error={status.error} onRetry={status.reload} />
      ) : (
        <p className="field-hint">{configured ? t.credsConfigured : t.credsNone}</p>
      )}
      <div className="field-row field-row-wrap">
        {fields.map((f) => (
          <label key={f.key} className="field">
            <span className="label">{copyGet(f.labelKey) ?? f.label ?? f.key}</span>
            <input
              className="input"
              type={f.secret ? "password" : "text"}
              autoComplete="off"
              placeholder={copyGet(f.placeholderKey) ?? f.placeholder ?? ""}
              value={values[f.key] || ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
              }
              disabled={busy}
            />
          </label>
        ))}
      </div>
      {saveError ? <div className="form-error">{humanApiError(saveError)}</div> : null}
      {saved && !saveError ? <div className="form-success">{t.credsSaved}</div> : null}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? (
            <>
              <Spinner small /> {t.credsSaving}
            </>
          ) : (
            t.credsSave
          )}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// (d) Telegram delivery — owner/admin. GET/PUT /orgs/:orgId/telegram; the
// Worker answers 503 migration_required until migration 0004 lands, rendered
// as the same muted note the org-settings card uses. PUT replaces the whole
// recipient set, so the save button always sends every row.
// ---------------------------------------------------------------------------
const TELEGRAM_KINDS = ["per_call", "daily"];
// Mirrors the Worker's validation: a numeric id, group chats lead with "-".
const TELEGRAM_CHAT_ID_RE = /^-?\d{5,20}$/;
const MAX_TELEGRAM_RECIPIENTS = 10;

// Client-only identity for editable rows — index keys would make React reuse
// input state across a mid-list removal.
let telegramRowKey = 0;

function TelegramCard({ org }) {
  const t = copy.settings.telegram;
  const { loading, data, error, reload } = useAsync(async () => {
    try {
      const raw = await fetchTelegramRecipients(org.org_id);
      return { migration: false, recipients: raw?.recipients || [] };
    } catch (err) {
      if (err && err.error === "migration_required") return { migration: true, recipients: [] };
      throw err;
    }
  }, [org.org_id]);

  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(null); // always a human string
  const [ok, setOk] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState(false);

  // Re-seed the editable rows whenever the server state (re)arrives.
  useEffect(() => {
    if (!data) return;
    setRows(
      data.recipients.map((r) => ({
        key: ++telegramRowKey,
        chat_id: String(r.chat_id ?? ""),
        label: r.label || "",
        kind: TELEGRAM_KINDS.includes(r.kind) ? r.kind : "per_call"
      }))
    );
  }, [data]);

  const migration = migrationNeeded || Boolean(data?.migration);

  function setRow(key, field, value) {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((list) =>
      list.length >= MAX_TELEGRAM_RECIPIENTS
        ? list
        : [...list, { key: ++telegramRowKey, chat_id: "", label: "", kind: "per_call" }]
    );
  }

  function removeRow(key) {
    setRows((list) => list.filter((r) => r.key !== key));
  }

  async function submit(e) {
    e.preventDefault();
    setOk(false);
    // A row added and left fully blank is dropped silently, not an error.
    const kept = rows.filter((r) => r.chat_id.trim() || r.label.trim());
    for (const r of kept) {
      const id = r.chat_id.trim();
      if (!TELEGRAM_CHAT_ID_RE.test(id)) {
        setSaveError(id ? t.badChatId.replace("{value}", id) : t.emptyChatId);
        return;
      }
    }
    setBusy(true);
    setSaveError(null);
    try {
      await saveTelegramRecipients(
        org.org_id,
        kept.map((r) => ({ chat_id: r.chat_id.trim(), kind: r.kind, label: r.label.trim() }))
      );
      setOk(true);
      reload(); // pick up server ids and the canonical order
    } catch (err) {
      if (err && err.error === "migration_required") setMigrationNeeded(true);
      else setSaveError(humanApiError(err));
    }
    setBusy(false);
  }

  return (
    <Card title={t.title}>
      <p className="muted">{t.intro}</p>
      {loading ? (
        <SkeletonBlock lines={2} />
      ) : error ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : migration ? (
        // Same muted state and copy key as the avg-deal (org-settings) card.
        <p className="warning">{copy.settings.orgSettings.migrationRequired}</p>
      ) : (
        <>
          <form className="ai-form" onSubmit={submit}>
            {rows.length === 0 ? <p className="muted">{t.empty}</p> : null}
            <div className="tg-rows">
              {rows.map((r) => (
                <div key={r.key} className="tg-row">
                  <label className="field tg-field-chat">
                    <span className="label">{t.chatId}</span>
                    <input
                      className="input mono"
                      type="text"
                      inputMode="numeric"
                      placeholder={t.chatIdPlaceholder}
                      value={r.chat_id}
                      onChange={(e) => setRow(r.key, "chat_id", e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <label className="field tg-field-label">
                    <span className="label">{t.labelField}</span>
                    <input
                      className="input"
                      type="text"
                      maxLength={120}
                      placeholder={t.labelPlaceholder}
                      value={r.label}
                      onChange={(e) => setRow(r.key, "label", e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <label className="field tg-field-kind">
                    <span className="label">{t.kindField}</span>
                    <select
                      className="input"
                      value={r.kind}
                      onChange={(e) => setRow(r.key, "kind", e.target.value)}
                      disabled={busy}
                    >
                      {TELEGRAM_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {t.kinds[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm tg-remove"
                    onClick={() => removeRow(r.key)}
                    disabled={busy}
                  >
                    {t.remove}
                  </button>
                </div>
              ))}
            </div>

            {rows.length >= MAX_TELEGRAM_RECIPIENTS ? (
              <p className="field-hint">{t.maxNote}</p>
            ) : null}
            {saveError ? <div className="form-error">{saveError}</div> : null}
            {ok && !saveError ? <div className="form-success">{t.saved}</div> : null}

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={addRow}
                disabled={busy || rows.length >= MAX_TELEGRAM_RECIPIENTS}
              >
                {t.add}
              </button>
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

          <details className="tg-help">
            <summary>{t.helpTitle}</summary>
            <p>{t.helpPersonal}</p>
            <p>{t.helpGroup}</p>
            <p>{t.helpToken}</p>
          </details>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// (e) Data processing / privacy posture — visible to everyone who can reach
// Settings. Plain-language summary of the DPA: who is controller vs processor,
// the call-recording announcement duty, and how long raw text is kept before
// deletion. The retention number is read from /orgs/:id/billing when available
// (default 90 shown otherwise); this card never edits anything — the exact
// window is set on the Billing screen, the legal detail lives in the DPA.
// ---------------------------------------------------------------------------
function DataProcessingCard({ org }) {
  const t = copy.settings.dataProcessing;
  const { data } = useAsync(async () => {
    try {
      const raw = await fetchBilling(org.org_id);
      const days = raw?.retention_days;
      return { days: Number.isFinite(Number(days)) ? Number(days) : null };
    } catch {
      // Billing may 404/501/503 while the Worker ships — fall back to the
      // documented default rather than failing this informational card.
      return { days: null };
    }
  }, [org.org_id]);

  const days = data?.days ?? 90;
  const known = data && data.days != null;

  return (
    <Card title={t.title}>
      <p className="muted">{t.intro}</p>
      <ul className="dp-list">
        <li>{t.controllerLine}</li>
        <li>{t.announcementLine}</li>
        <li>
          {t.retentionLine.replace("{days}", days)}
          {known ? null : ` ${t.retentionDefaultNote}`}
        </li>
      </ul>
      <p className="field-hint">{t.dpaNote}</p>
    </Card>
  );
}
