// Telephony connectors: Ringostat and Binotel → one internal call shape.
//
// Each provider POSTs to /api/telephony/<kind>/<webhook_token>. The token is
// per-organization (integrations.webhook_token, unique-indexed) and is the
// only thing identifying the tenant — neither vendor signs its payload in a
// way we can verify, so the token is the credential. Treat it like a password:
// rotate it if a client's endpoint URL leaks.
//
// SOURCES / CONFIDENCE
// - Ringostat: field names verified against the official webhook docs
//   (help.ringostat.com, "Webhooks. Outbound call event" / "Incoming call
//   event"): call_id, caller, callee, status, date, call_duration, waiting,
//   dialog, record, recording_wav, has_recording, employee_fio, department,
//   staffid, outbound_number, project_id.
// - Binotel: developers.binotel.ua was unreachable when this was written, so
//   the shape below (requestType: "apiCallCompleted", callDetails{...}) comes
//   from third-party integration documentation. It is deliberately tolerant of
//   casing and missing fields. VERIFY against the pilot client's first real
//   payload — normalizeBinotel() keeps the raw body so the first live event
//   can be inspected without re-instrumenting anything.

// ---------------------------------------------------------------------------
// Internal call shape — what the rest of the product consumes
// ---------------------------------------------------------------------------
// {
//   source: "ringostat" | "binotel",
//   externalId: string,          // unique per call within the source
//   direction: "inbound" | "outbound" | "unknown",
//   customerPhone: string,
//   managerLabel: string,        // name from the PBX; mapped to a user later
//   managerExtension: string,    // internal number, the reliable mapping key
//   department: string,
//   startedAt: string | null,    // ISO 8601 UTC
//   durationSec: number | null,  // talk time, not including ring
//   waitSec: number | null,
//   answered: boolean,
//   recordingUrl: string | null,
//   raw: object                  // the untouched payload
// }

const DIGITS = /\D+/g;

function digitsOnly(value) {
  return String(value ?? "").replace(DIGITS, "");
}

// Ringostat sends caller as a display string: '"Ivan" <380671234567>'.
function extractNumber(value) {
  const text = String(value ?? "");
  const angled = text.match(/<([^>]+)>/);
  return digitsOnly(angled ? angled[1] : text);
}

function toNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Both vendors send local wall-clock timestamps with no zone. Interpreting
// them as UTC would silently shift every call by the client's offset, so the
// organization's timezone is passed in explicitly.
function toIso(value, tzOffsetMinutes = 0) {
  if (!value) return null;
  const text = String(value).trim().replace(" ", "T");
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(text);
  const parsed = Date.parse(hasZone ? text : `${text}Z`);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed - (hasZone ? 0 : tzOffsetMinutes * 60_000)).toISOString();
}

// ---------------------------------------------------------------------------
// Ringostat
// ---------------------------------------------------------------------------

const RINGOSTAT_ANSWERED = new Set(["ANSWERED", "ANSWER"]);

export function normalizeRingostat(payload, { tzOffsetMinutes = 0 } = {}) {
  const body = payload || {};
  const direction = body.type === "out" ? "outbound" : body.type === "in" ? "inbound" : "unknown";

  // On an outbound call the customer is the callee; on an inbound one, the caller.
  const customerPhone =
    direction === "outbound" ? extractNumber(body.callee) : extractNumber(body.caller);

  // `dialog` is talk time; `call_duration` includes ringing. Coaching cares
  // about the conversation, so prefer dialog and fall back.
  const durationSec = toNumberOrNull(body.dialog) ?? toNumberOrNull(body.call_duration);

  const hasRecording = String(body.has_recording ?? "") === "1" || Boolean(body.recording_wav);

  return {
    source: "ringostat",
    externalId: String(body.call_id || body.record || ""),
    direction,
    customerPhone,
    managerLabel: String(body.employee_fio || ""),
    managerExtension: digitsOnly(body.staffid || body.outbound_number || ""),
    department: String(body.department || ""),
    startedAt: toIso(body.date, tzOffsetMinutes),
    durationSec,
    waitSec: toNumberOrNull(body.waiting),
    answered: RINGOSTAT_ANSWERED.has(String(body.status || "").toUpperCase()),
    recordingUrl: hasRecording ? String(body.recording_wav || "") || null : null,
    raw: body
  };
}

// ---------------------------------------------------------------------------
// Binotel
// ---------------------------------------------------------------------------

// Only these dispositions can carry a recording, per Binotel's own docs.
const BINOTEL_ANSWERED = new Set(["ANSWER", "ANSWERED", "SUCCESS", "VM-SUCCESS"]);

export function normalizeBinotel(payload, { tzOffsetMinutes = 0 } = {}) {
  const body = payload || {};
  // Field casing varies between Binotel's own examples and integrator docs.
  const details = body.callDetails || body.callDetail || body;

  const pick = (...names) => {
    for (const name of names) {
      if (details[name] !== undefined && details[name] !== null && details[name] !== "") {
        return details[name];
      }
    }
    return undefined;
  };

  // callType is numeric in the payloads seen: 0 = incoming, 1 = outgoing.
  const rawType = pick("callType", "calltype");
  const direction =
    String(rawType) === "1" || String(rawType).toLowerCase() === "outgoing"
      ? "outbound"
      : String(rawType) === "0" || String(rawType).toLowerCase() === "incoming"
        ? "inbound"
        : "unknown";

  const disposition = String(pick("disposition") || "").toUpperCase();

  return {
    source: "binotel",
    externalId: String(pick("generalCallID", "generalCallId", "callID", "callId") || ""),
    direction,
    customerPhone: digitsOnly(pick("externalNumber")),
    managerLabel: String(pick("employeeName", "employeeFullName") || ""),
    managerExtension: digitsOnly(pick("internalNumber")),
    department: String(pick("department") || ""),
    startedAt: toIso(pick("startTime"), tzOffsetMinutes),
    durationSec: toNumberOrNull(pick("billsec")),
    waitSec: toNumberOrNull(pick("waitsec")),
    answered: BINOTEL_ANSWERED.has(disposition),
    // Binotel does not put a recording link in the webhook — it is fetched
    // afterwards and the URL expires in 15 minutes, so the pull job downloads
    // it immediately rather than storing the link. See fetchBinotelRecording().
    recordingUrl: null,
    raw: body
  };
}

const NORMALIZERS = { ringostat: normalizeRingostat, binotel: normalizeBinotel };

export function normalizeEvent(kind, payload, options) {
  const normalize = NORMALIZERS[kind];
  if (!normalize) throw new Error(`unsupported_telephony_${kind}`);

  const event = normalize(payload, options);
  if (!event.externalId) throw new Error(`${kind}_missing_call_id`);
  return event;
}

// Binotel identifies the completed-call webhook by requestType; anything else
// (call started, call settings) must be acknowledged but not stored as a call.
export function isCompletedCallEvent(kind, payload) {
  if (kind === "binotel") {
    const type = String(payload?.requestType || "");
    return type === "apiCallCompleted" || type === "callCompleted";
  }
  // Ringostat fires a separate webhook per event, so the endpoint it posts to
  // is the discriminator; a payload carrying a duration is a finished call.
  return payload?.call_duration !== undefined || payload?.dialog !== undefined;
}

// ---------------------------------------------------------------------------
// Recording retrieval
// ---------------------------------------------------------------------------

// Ringostat's recording_wav is a signed URL that arrives in the webhook and can
// be fetched directly. Binotel's must be requested with the account key/secret
// and expires quickly, so it is downloaded immediately rather than stored.
export async function fetchBinotelRecording({
  generalCallID,
  apiKey,
  apiSecret,
  fetchImpl = fetch
}) {
  const response = await fetchImpl("https://api.binotel.com/api/4.0/stats/call-record.json", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: apiKey, secret: apiSecret, generalCallID })
  });

  if (!response.ok) throw new Error(`binotel_record_http_${response.status}`);
  const data = await response.json();
  if (data.status && data.status !== "success") {
    throw new Error(`binotel_record_${data.message || data.status}`);
  }
  const url = data.callRecordLink || data.url || null;
  if (!url) throw new Error("binotel_record_missing_link");
  return url;
}

// ---------------------------------------------------------------------------
// Mapping a PBX employee onto a membership
// ---------------------------------------------------------------------------

// The internal extension is the stable key — display names are typed by hand
// in the PBX and drift. Falls back to a case-insensitive name match so a call
// still lands on the right person before extensions are configured.
export function resolveManager(event, members) {
  const extension = digitsOnly(event.managerExtension);
  if (extension) {
    const byExtension = members.find((m) => digitsOnly(m.extension) === extension);
    if (byExtension) return byExtension;
  }

  const label = event.managerLabel.trim().toLowerCase();
  if (label) {
    const byName = members.find((m) => String(m.full_name || "").trim().toLowerCase() === label);
    if (byName) return byName;
  }

  // Unmapped is a valid outcome: the call is stored with manager_label set and
  // no manager_id, visible to admins, and can be assigned later by hand.
  return null;
}

export const __testing = { extractNumber, toIso, digitsOnly };
