// Telephony connectors: Ringostat, Binotel, Phonet, UniTalk and Stream
// Telecom → one internal call shape. Together these are the five built-in
// modules KeyCRM lists — the de-facto UA SMB telephony top-5 (Nextel rebranded
// to UniTalk in June 2022, so "nextel" is an alias, not a separate kind).
//
// Each provider POSTs to /api/telephony/<kind>/<webhook_token>. The token is
// per-organization (integrations.webhook_token, unique-indexed) and is the
// only thing identifying the tenant — none of the vendors signs its payload in
// a way we can verify, so the token is the credential. Treat it like a
// password: rotate it if a client's endpoint URL leaks.
//
// SOURCES / CONFIDENCE (research dossier, 2026-08)
// - Ringostat (verified): live help.ringostat.com webhook docs (articles
//   6518985 / 6559993 / 6583751): call_id, caller, callee, status, date,
//   call_duration, waiting, dialog, record, recording_wav, has_recording,
//   employee_fio, department, staffid, outbound_number, project_id.
// - Binotel (verified): official developers.binotel.ua "API CALL COMPLETED"
//   (host geo-fenced to UA, read via Wayback; 2025-26 integrator guides
//   confirm the same flow): requestType "apiCallCompleted" + callDetails{...};
//   startTime is Unix time in SECONDS per the official doc. Kept tolerant of
//   casing variants. The endpoint must answer {"status":"success"} or Binotel
//   retries 7 times over 38h — dedupe on generalCallID covers redelivery.
// - Phonet (verified): official "HTTPS API Документация v4.1" PDF
//   (phonet.ua/teler-api-https). Webhooks (Настройки → Интеграции → Другие
//   CRM системы) POST one shape for call.dial / call.bridge / call.hangup;
//   call.hangup carries NO durations/disposition — they come from a follow-up
//   GET https://{domain}/rest/calls/company.api pull, whose record shape
//   (endAt, billSecs, duration, disposition, otherLegNum, audioRecUrl,
//   transferHistory) this normalizer accepts too. lgDirection: 1=internal,
//   2=outgoing, 4=incoming, 32/64=pause on/off. The doc explicitly warns
//   webhook events may DUPLICATE — dedupe on uuid, which the
//   unique(org_id, source, external_id) index already covers. No signing; the
//   doc recommends allowlisting source IPs 89.184.65.208, 89.184.82.130,
//   89.184.67.228, 89.184.82.191, 89.184.65.137, 95.213.132.131 (verbatim)
//   on top of the webhook token.
// - UniTalk, ex-Nextel (verified): live unitalk.cloud/api-references, "Event
//   handling". The customer creates the handler («Обработка событий») per
//   event: CALL_NEW / CALL_REDIRECT / CALL_ANSWER / CALL_END. Body type
//   'Standard JSON' wraps the call: {event, call:{id, dbid, from, to[],
//   lastGroupName, outerNumber, direction IN|OUT|INNER, date,
//   secondsFullTime, secondsTalk, state, source, link, cause}}; only CALL_END
//   carries the duration fields, `state` is null before it. UNVERIFIED:
//   outbound from/to semantics (docs only show an incoming example) and the
//   timezone governing `date`. A custom variable-template body (call_id,
//   call_from, ...) is accepted as a fallback.
// - Stream Telecom (partial): official apidoc.streamtele.com "Stream CALL API
//   v3.0.1 Events" — read via a Wayback 2022-05 snapshot because the docs
//   host is currently unreachable from non-UA networks. Server POSTs Start /
//   End_in / StartCall / Answer / Hangup; only Hangup is a completed call.
//   RE-VERIFY the whole payload against the pilot's first live event.
//
// Every normalizer keeps the raw body (audit_log stores it), so the first
// live payload from each PBX can be diffed against the UNVERIFIED notes
// below without re-instrumenting anything.

// ---------------------------------------------------------------------------
// Internal call shape — what the rest of the product consumes
// ---------------------------------------------------------------------------
// {
//   source: "ringostat" | "binotel" | "phonet" | "unitalk" | "streamtele",
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

// Like toNumberOrNull, but an empty string reads as absent instead of 0 —
// urlencoded webhook bodies encode missing values as "".
function toFiniteOrNull(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return toNumberOrNull(value);
}

// Phonet and Stream Telecom send epoch timestamps, GMT+0 — timezone-safe, so
// tzOffsetMinutes never applies to them. Phonet's doc declares milliseconds
// yet its own examples show second-precision values (1431686100), and Stream
// sends STRINGS of milliseconds ("1560407026407"), occasionally a literal
// "null": anything below 1e12 is treated as seconds (dossier rule:
// value < 1e12 => seconds), junk reads as absent.
function epochToMs(value) {
  const parsed = toFiniteOrNull(value); // Number("null") is NaN → null
  if (parsed === null || parsed <= 0) return null;
  return parsed < 1e12 ? parsed * 1000 : parsed;
}

function epochToIso(value) {
  const ms = epochToMs(value);
  return ms === null ? null : new Date(ms).toISOString();
}

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(String(value ?? ""));
}

// Ringostat, Binotel and UniTalk send local wall-clock timestamps with no
// zone. Interpreting them as UTC would silently shift every call by the
// client's offset, so the organization's timezone is passed in explicitly.
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
    // recording_wav arrives signed inside the webhook. The token's TTL is
    // UNVERIFIED — download promptly, never rely on the stored link long-term.
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

// ---------------------------------------------------------------------------
// Phonet
// ---------------------------------------------------------------------------

// lgDirection per the official doc: 1=internal, 2=outgoing, 4=incoming
// (32/64 are pause toggles and never completed calls). Internal calls have no
// customer, so 1 maps to "unknown" like any unexpected value.
const PHONET_DIRECTIONS = { 2: "outbound", 4: "inbound" };

// One normalizer serves both the webhook (event/dialAt/bridgeAt/otherLegs)
// and the /rest/calls/company.api history record (endAt/billSecs/duration/
// disposition/otherLegNum/audioRecUrl) — the shapes share uuid, lgDirection
// and leg. All timestamps are epoch GMT+0, so tzOffsetMinutes is accepted
// only for signature uniformity and intentionally not applied.
export function normalizePhonet(payload, { tzOffsetMinutes = 0 } = {}) {
  void tzOffsetMinutes; // epoch timestamps are already absolute
  const body = payload || {};
  // `leg` is always the EMPLOYEE side ({id, type, ext, displayName}; type
  // 1=user, 2=group, 4=IVR), whatever the direction. The CLIENT side is
  // otherLegs[] in the webhook / otherLegNum in a history record — so the
  // customer is the other leg on both inbound and outbound calls.
  // otherLegs[].url is the client's CRM-card link, NOT a recording.
  const leg = body.leg || {};
  const other = (Array.isArray(body.otherLegs) ? body.otherLegs[0] : null) || {};

  const dialAt = epochToMs(body.dialAt);
  const bridgeAt = epochToMs(body.bridgeAt); // null = never answered
  const endAt = epochToMs(body.endAt); // history records only
  const serverTime = epochToMs(body.serverTime); // defensive, if it shows up
  const hangupAt = endAt ?? serverTime;

  const billSecs = toFiniteOrNull(body.billSecs); // TALK seconds (history)
  const totalSecs = toFiniteOrNull(body.duration); // TOTAL incl. ringing (history)

  // The hangup webhook carries NO durations — they arrive with the history
  // pull. Until then talk time is derived bridge→hangup when possible; the
  // ring-inclusive total is the last resort (Ringostat precedent).
  let durationSec = billSecs;
  if (durationSec === null && bridgeAt !== null && hangupAt !== null) {
    durationSec = Math.max(0, Math.round((hangupAt - bridgeAt) / 1000));
  }
  if (durationSec === null) durationSec = totalSecs;

  // Ring time: total − talk from a history record, else dial→bridge
  // (dial→hangup when the call was never answered).
  let waitSec = null;
  if (billSecs !== null && totalSecs !== null) {
    waitSec = Math.max(0, totalSecs - billSecs);
  } else if (dialAt !== null) {
    const ringEnd = bridgeAt ?? hangupAt;
    if (ringEnd !== null) waitSec = Math.max(0, Math.round((ringEnd - dialAt) / 1000));
  }

  // disposition (history only): 0=answered, 1=no answer, 2=congested,
  // 3=dial error, 4=busy. The webhook has no disposition — a non-null
  // bridgeAt means the call was picked up.
  const disposition = toFiniteOrNull(body.disposition);
  const answered = disposition !== null ? disposition === 0 : bridgeAt !== null;

  // History records carry no start timestamp — derive it as endAt − duration.
  let startedAtMs = dialAt;
  if (startedAtMs === null && endAt !== null) {
    startedAtMs = totalSecs !== null ? endAt - totalSecs * 1000 : endAt;
  }

  return {
    source: "phonet",
    externalId: String(body.uuid || ""),
    direction: PHONET_DIRECTIONS[String(body.lgDirection ?? "")] || "unknown",
    customerPhone: digitsOnly(body.otherLegNum ?? other.num),
    managerLabel: String(leg.displayName || ""),
    managerExtension: digitsOnly(leg.ext),
    department: "",
    startedAt: startedAtMs === null ? null : new Date(startedAtMs).toISOString(),
    durationSec,
    waitSec,
    answered,
    // The webhook has no recording link; the history pull returns audioRecUrl
    // on the constructible /rest/public/ path — see phonetRecordingUrl().
    recordingUrl: looksLikeUrl(body.audioRecUrl) ? String(body.audioRecUrl) : null,
    raw: body
  };
}

// ---------------------------------------------------------------------------
// UniTalk (ex-Nextel)
// ---------------------------------------------------------------------------

// Documented state values: ANSWER, BUSY, FAIL, NOANSWER, CHANUNAVAIL,
// NOMONEY, BUSYOUT, WRONGDIR, BLOCKED, DIALING, UNREACHABLE, NOT_EXIST.
// Only ANSWER is a spoken call — and the only state shipping a `link`.
const UNITALK_DIRECTIONS = { IN: "inbound", OUT: "outbound" }; // INNER → unknown

export function normalizeUnitalk(payload, { tzOffsetMinutes = 0 } = {}) {
  // The handler is user-composed in the UniTalk cabinet; besides the
  // documented 'Standard JSON' body a customer can wire an urlencoded form or
  // a custom variable template. api.js decodes forms before calling in; this
  // guard keeps the normalizer safe when handed the raw text anyway.
  let body = payload || {};
  if (typeof body === "string") body = Object.fromEntries(new URLSearchParams(body));
  else if (body instanceof URLSearchParams) body = Object.fromEntries(body);

  // Custom variable-template bodies (call_id, call_from, ...) — kept from the
  // pre-dossier connector; their semantics are UNVERIFIED on live traffic.
  if ((body.call === undefined || body.call === null) && body.call_id !== undefined) {
    return unitalkFromVariables(body, tzOffsetMinutes);
  }

  // Standard JSON: {event, call:{...}}. Tolerate a flat body without the
  // wrapper (Binotel precedent) for hand-wired templates.
  const call = body.call && typeof body.call === "object" ? body.call : body;

  const direction = UNITALK_DIRECTIONS[String(call.direction ?? "").toUpperCase()] || "unknown";

  // `to` is an array of internal lines the call was routed to; on CALL_END
  // the docs say it may be empty or contain the operators who received the
  // call — the first entry is taken as the answering extension.
  const toList = Array.isArray(call.to)
    ? call.to
    : call.to === undefined || call.to === null
      ? []
      : [call.to];
  const firstTo = toList.length > 0 ? String(toList[0]) : "";
  const from = String(call.from ?? "");

  // Inbound: from = the client, to[] = operator lines. Outbound: the docs
  // only show an incoming example — the operator's internal line is EXPECTED
  // in call.from and the client number in call.to (UNVERIFIED per the
  // dossier; verify on pilot traffic). outerNumber is the company's external
  // line / site name for callbacks — never a party.
  const customerPhone = digitsOnly(direction === "outbound" ? firstTo : from);
  const managerExtension = digitsOnly(direction === "outbound" ? from : firstTo);

  // secondsTalk is TALK time; secondsFullTime includes ringing. Both arrive
  // only on CALL_END.
  const talkSec = toFiniteOrNull(call.secondsTalk);
  const fullSec = toFiniteOrNull(call.secondsFullTime);

  const state = String(call.state ?? "").toUpperCase();
  const link = String(call.link ?? "");

  return {
    source: "unitalk",
    // `id` is random and only links CALL_NEW..CALL_END of one call; `dbid` is
    // the persistent DB id assigned once the call is saved — prefer it.
    externalId: String(call.dbid ?? call.id ?? ""),
    direction,
    customerPhone,
    managerLabel: "", // call events carry no employee name (lastGroupName is a group)
    managerExtension,
    department: String(call.lastGroupName ?? ""),
    // `date` is call start as LOCAL wall-clock "YYYY-MM-DD HH:MM:SS" with no
    // offset, exactly like Binotel/Ringostat. The governing timezone is
    // UNVERIFIED (presumably the cabinet's, Europe/Kyiv for UA customers) —
    // converted with the org offset; sanity-check on the pilot by comparing
    // webhook arrival time against date + secondsFullTime.
    startedAt: toIso(call.date, tzOffsetMinutes),
    durationSec: talkSec ?? fullSec,
    waitSec: talkSec !== null && fullSec !== null ? Math.max(0, fullSec - talkSec) : null,
    // state is null on CALL_NEW/CALL_REDIRECT; if a custom template drops it,
    // non-zero talk time still reads as answered.
    answered: state ? state === "ANSWER" : (talkSec ?? 0) > 0,
    // `link` ships only when state=ANSWER, as a direct URL on
    // api.unitalk.cloud:8443/tracking/rec/{...}. Its auth and TTL are both
    // UNVERIFIED — download promptly on receipt; if it 401s, ask UniTalk
    // support about signed links.
    recordingUrl: looksLikeUrl(link) ? link : null,
    raw: body
  };
}

// Custom variable-template body: the cabinet substitutes call_* variables into
// URL params or the body. Field semantics are UNVERIFIED pre-dossier guesses
// kept for tolerance; note call_outernumber may be the company line (like
// Standard JSON's outerNumber), so inbound prefers call_from.
function unitalkFromVariables(body, tzOffsetMinutes) {
  const rawDirection = String(body.call_direction ?? "").toLowerCase();
  // "out" first — "outgoing" also contains "in".
  const direction = /out/.test(rawDirection)
    ? "outbound"
    : /in/.test(rawDirection)
      ? "inbound"
      : "unknown";

  const talkSec = toFiniteOrNull(body.call_secondstalk);
  const fullSec = toFiniteOrNull(body.call_secondsfulltime);
  const state = String(body.call_state ?? "").toUpperCase();
  const link = String(body.call_link ?? "");

  return {
    source: "unitalk",
    externalId: String(body.call_id ?? ""),
    direction,
    customerPhone: digitsOnly(
      direction === "inbound" ? body.call_from ?? body.call_outernumber : body.call_outernumber
    ),
    managerLabel: "",
    managerExtension: digitsOnly(body.call_to_0), // UNVERIFIED employee mapping
    department: "",
    startedAt: toIso(body.call_date, tzOffsetMinutes),
    durationSec: talkSec ?? fullSec,
    waitSec: talkSec !== null && fullSec !== null ? Math.max(0, fullSec - talkSec) : null,
    answered: state ? state === "ANSWER" || state === "ANSWERED" : (talkSec ?? 0) > 0,
    recordingUrl: looksLikeUrl(link) ? link : null,
    raw: body
  };
}

// ---------------------------------------------------------------------------
// Stream Telecom
// ---------------------------------------------------------------------------

export function normalizeStreamtele(payload, { tzOffsetMinutes = 0 } = {}) {
  void tzOffsetMinutes; // all time fields are epoch ms GMT+0 — already absolute
  const body = payload || {};
  const direction = body.type === "out" ? "outbound" : body.type === "in" ? "inbound" : "unknown";

  // All time fields are unix-epoch MILLISECOND strings; absent values can
  // arrive as the literal string "null" (the doc example shows
  // "redirecting":"null"), which epochToMs reads as absent.
  const startMs = epochToMs(body.time_start);
  const answerMs = epochToMs(body.time_answer); // null/0 when never answered
  const endMs = epochToMs(body.event_time);

  const answered = String(body.result ?? "").toLowerCase() === "answer"; // 'answer' | 'no answer'

  // The payload has NO duration fields — computed per the official doc:
  // talk = event_time − time_answer, total = event_time − time_start,
  // guarding time_answer null/0 on unanswered calls.
  let durationSec = null;
  if (answered) {
    if (endMs !== null && answerMs !== null) {
      durationSec = Math.max(0, Math.round((endMs - answerMs) / 1000));
    }
  } else {
    durationSec = 0; // never picked up — zero talk time by definition
  }

  // Ring time: start→answer, or start→hangup when never answered.
  const ringEndMs = answerMs ?? endMs;
  const waitSec =
    startMs !== null && ringEndMs !== null
      ? Math.max(0, Math.round((ringEndMs - startMs) / 1000))
      : null;

  // Inbound: from = the caller (client), to = the internal line that took the
  // call — internal lines are LONG format (e.g. "80044022203"), so no length
  // heuristics apply. Outbound: from = internal line, to = the client (per
  // the Start event doc). `via` is the company's external number, never a
  // party. No employee name or email exists in the payload.
  const from = digitsOnly(body.from);
  const to = digitsOnly(body.to);

  const recordUrl = String(body.recordUrl ?? "");

  return {
    source: "streamtele",
    // call_id is the unique per-call id; sessionid groups the legs of one
    // queue session and is only a fallback.
    externalId: String(body.call_id ?? body.sessionid ?? body.sessionId ?? ""),
    direction,
    customerPhone: direction === "outbound" ? to : from,
    managerLabel: "",
    managerExtension: direction === "outbound" ? from : to,
    department: "",
    startedAt: startMs === null ? null : new Date(startMs).toISOString(),
    durationSec,
    waitSec,
    answered,
    // recordUrl ships inside Hangup (null when unanswered):
    //   https://gate.streamtele.com/api/streamtele-v3/audio?<CALL_UUID>
    // UNVERIFIED: whether the GET needs 'Authorization: Bearer <apiKey>' and
    // whether the link expires — the download job must try a plain GET first,
    // retry with the Bearer key, and download immediately rather than relying
    // on the stored URL.
    recordingUrl: looksLikeUrl(recordUrl) ? recordUrl : null,
    raw: body
  };
}

// ---------------------------------------------------------------------------
// Registry and event discrimination
// ---------------------------------------------------------------------------

const NORMALIZERS = {
  ringostat: normalizeRingostat,
  binotel: normalizeBinotel,
  phonet: normalizePhonet,
  unitalk: normalizeUnitalk,
  streamtele: normalizeStreamtele
};

// Nextel rebranded to UniTalk in June 2022 — same platform. A legacy
// integration row with kind='nextel' keeps working, and its events normalize
// with source='unitalk' so dedupe stays stable across the rename.
const KIND_ALIASES = { nextel: "unitalk" };

function resolveKind(kind) {
  return KIND_ALIASES[kind] || kind;
}

export function normalizeEvent(kind, payload, options) {
  const resolved = resolveKind(kind);
  const normalize = NORMALIZERS[resolved];
  if (!normalize) throw new Error(`unsupported_telephony_${kind}`);

  const event = normalize(payload, options);
  if (!event.externalId) throw new Error(`${resolved}_missing_call_id`);
  return event;
}

// Distinguishes the completed-call webhook from progress/settings events —
// anything non-final must be acknowledged but not stored as a call.
export function isCompletedCallEvent(kind, payload) {
  const body = payload || {};
  switch (resolveKind(kind)) {
    case "binotel": {
      // Binotel identifies the completed-call webhook by requestType.
      const type = String(body.requestType || "");
      return type === "apiCallCompleted" || type === "callCompleted";
    }
    case "phonet": {
      // call.dial / call.bridge are progress events (and lgDirection 32/64
      // are pause toggles that only ever ride those); only call.hangup is
      // final. A /rest/calls/company.api history record has no `event` but
      // always carries endAt.
      const event = String(body.event || "");
      if (event) return event === "call.hangup";
      return body.endAt !== undefined;
    }
    case "unitalk": {
      // Standard JSON: CALL_NEW / CALL_REDIRECT / CALL_ANSWER are progress;
      // only CALL_END carries durations and the final state. A custom
      // variable template has no `event` — require end-of-call data so a
      // mis-wired call-start handler is not stored as a call.
      const event = String(body.event || "");
      if (event) return event === "CALL_END";
      return ["call_secondstalk", "call_secondsfulltime", "call_state", "call_link"].some(
        (key) => body[key] !== undefined
      );
    }
    case "streamtele": {
      // Start / StartCall / Answer are progress; End_in died in the IVR
      // before reaching an internal line. Queue calls (join="yes") emit one
      // Hangup per leg — only the end_sess="yes" leg closes the session, the
      // rest are skipped to avoid per-leg duplicates.
      if (String(body.event || "").toLowerCase() !== "hangup") return false;
      return body.join !== "yes" || body.end_sess === "yes";
    }
    default:
      // Ringostat fires a separate webhook per event, so the endpoint it
      // posts to is the discriminator; a payload carrying a duration is a
      // finished call.
      return body.call_duration !== undefined || body.dialog !== undefined;
  }
}

// ---------------------------------------------------------------------------
// Provider manifest — the cabinet renders the integrations settings from it
// ---------------------------------------------------------------------------

// credentialFields drive the secrets form: `secret: true` values are
// encrypted into integration_secrets and never echoed back; the rest live in
// integrations.config. Labels/placeholders/hints are default UI copy
// (Russian, like the rest of the product). Keys match what the recording
// fetchers expect (fetchBinotelRecording: apiKey/apiSecret;
// phonetRecordingUrl: accountDomain).
export const PROVIDERS = [
  {
    kind: "ringostat",
    displayName: "Ringostat",
    // Receiving calls needs nothing: the customer composes the webhook in the
    // Ringostat cabinet pointing at our URL, and recordings arrive as signed
    // recording_wav links inside the webhook itself. The API key only serves
    // a future REST pull, hence optional.
    credentialFields: [
      {
        key: "apiKey",
        label: "API-ключ (необязательно)",
        secret: true,
        placeholder: "Нужен только для выгрузки через REST API"
      }
    ],
    managerMappingHint:
      "Исходящие: сотрудник определяется по staffid из вебхука — укажите его в поле «Внутренний номер» участника. Входящие: добавьте в вебхук параметр с внутренним номером ответившего. Рекомендуем также включить в вебхук calldate_timestamp_micros — время звонка перестанет зависеть от часового пояса."
  },
  {
    kind: "binotel",
    displayName: "Binotel",
    // key+secret are issued only by support@binotel.ua on an email request
    // from the PBX admin's mailbox (no self-serve); the webhook URL is also
    // registered by Binotel support.
    credentialFields: [
      { key: "apiKey", label: "API-ключ", secret: true, placeholder: "Выдаёт support@binotel.ua" },
      { key: "apiSecret", label: "API-секрет", secret: true, placeholder: "Выдаёт support@binotel.ua" }
    ],
    managerMappingHint:
      "Сотрудник определяется по internalNumber из вебхука — укажите его в поле «Внутренний номер» участника. При переводах берётся участник historyData с disposition=ANSWER; запасной вариант — e-mail из employeeData."
  },
  {
    kind: "phonet",
    displayName: "Phonet",
    // Both values live in the Phonet cabinet: Настройки → Интеграция →
    // «Интеграция с другой CRM системой». REST session: POST
    // https://{accountDomain}/rest/security/authorize {domain, apiKey} →
    // Set-Cookie JSESSIONID, reused until a 403 forces a re-authorize.
    credentialFields: [
      {
        key: "accountDomain",
        label: "Домен АТС",
        secret: false,
        placeholder: "mycompany.phonet.com.ua"
      },
      { key: "apiKey", label: "API-ключ", secret: true, placeholder: "Ключ из кабинета Phonet" }
    ],
    managerMappingHint:
      "Сотрудник определяется по внутреннему номеру (leg.ext, напр. «001») — укажите его в поле «Внутренний номер» участника. Для групп и IVR смотрится история переводов; запасной вариант — e-mail сотрудника из /rest/users."
  },
  {
    kind: "unitalk",
    displayName: "UniTalk (ex-Nextel)",
    // Receiving webhooks needs nothing from UniTalk — the customer creates
    // the handler on the «Обработка событий» page (event CALL_END, body type
    // Standard JSON; custom headers are supported, so the webhook token can
    // also travel in a header). The apiKey only serves pull APIs /
    // click2call (Authorization header against api.unitalk.cloud/api).
    credentialFields: [
      {
        key: "apiKey",
        label: "API-ключ (необязательно)",
        secret: true,
        placeholder: "Страница «API» в кабинете UniTalk"
      }
    ],
    managerMappingHint:
      "Входящие: сотрудник определяется по внутренней линии из call.to — укажите её в поле «Внутренний номер» участника. Исходящие: линия оператора ожидается в call.from (не подтверждено документацией — проверьте на первых звонках)."
  },
  {
    kind: "streamtele",
    displayName: "Stream Telecom",
    // The apiKey is created in crm.streamtele.com → Меню → Администрирование
    // → Профиль компании. Webhook delivery is NOT self-serve: the customer
    // emails support@streamtele.com from the account's registered email
    // asking to point call events at our URL — the settings screen must show
    // the webhook URL plus that instruction.
    credentialFields: [
      {
        key: "apiKey",
        label: "API-ключ",
        secret: true,
        placeholder: "crm.streamtele.com → Профиль компании"
      }
    ],
    managerMappingHint:
      "Входящие: to = внутренняя линия сотрудника — укажите её в поле «Внутренний номер» участника. Исходящие: from = внутренняя линия. Номера линий — в «Администрирование → Сотрудники»; имени сотрудника в вебхуке нет."
  }
];

// ---------------------------------------------------------------------------
// Recording retrieval
// ---------------------------------------------------------------------------

// Per provider:
// - Ringostat: recording_wav / record_link arrive signed inside the webhook
//   (token TTL UNVERIFIED — download promptly).
// - Binotel: pulled via fetchBinotelRecording(); the returned link lives 15
//   MINUTES and only exists for ANSWER / VM-SUCCESS / SUCCESS dispositions —
//   download immediately upon webhook processing.
// - Phonet: constructible URL — see phonetRecordingUrl().
// - UniTalk: call.link arrives in CALL_END when state=ANSWER (auth/TTL
//   UNVERIFIED).
// - Stream Telecom: recordUrl arrives in Hangup (Bearer requirement and TTL
//   UNVERIFIED — plain GET first, then retry with the apiKey).

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

// Phonet recordings are not in the webhook, but the official doc gives a
// constructible path (available only after the call ends; unanswered calls
// have none — audioRecUrl is null in history then):
//   GET https://{accountDomain}/rest/public/calls/{uuid}/audio       (wav|mp3)
//   GET https://{accountDomain}/rest/public/calls/{uuid}-rx/audio    (split RX)
//   GET https://{accountDomain}/rest/public/calls/{uuid}-tx/audio    (split TX)
// audioRecUrl returned by /rest/calls/company.api uses the same path.
// UNVERIFIED (the doc is silent): whether the GET needs the JSESSIONID cookie
// from POST /rest/security/authorize {domain, apiKey}, and whether links
// expire. The download job should try unauthenticated first, fall back to an
// authorized session (re-authorize on 403), and download promptly.
export function phonetRecordingUrl({ accountDomain, uuid, channel = "" }) {
  const domain = String(accountDomain || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
  const id = String(uuid || "");
  if (!domain || !id) return null;
  if (channel && channel !== "rx" && channel !== "tx") return null;
  const suffix = channel ? `-${channel}` : "";
  return `https://${domain}/rest/public/calls/${id}${suffix}/audio`;
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

export const __testing = {
  extractNumber,
  toIso,
  digitsOnly,
  toFiniteOrNull,
  epochToMs,
  epochToIso,
  looksLikeUrl
};
