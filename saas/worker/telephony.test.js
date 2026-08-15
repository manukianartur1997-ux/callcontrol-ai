// Telephony connector tests.
//
// The payloads below mirror the vendors' documented examples. Ringostat's are
// from its official webhook docs; Binotel's follow the officially documented
// apiCallCompleted flow — when the first real Binotel event arrives, diff it
// against BINOTEL_COMPLETED here before trusting the mapping. The Phonet /
// UniTalk / Stream Telecom fixtures reproduce the official docs' structures
// from the research dossier (Phonet HTTPS API v4.1 PDF; UniTalk Standard JSON
// from unitalk.cloud/api-references; Stream CALL API v3.0.1 via Wayback) with
// SYNTHETIC values where marked. Diff each provider's first live payload
// against its fixture before trusting the mapping — fields the dossier marks
// UNVERIFIED are flagged in telephony.js.

import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEvent,
  normalizeRingostat,
  normalizeBinotel,
  normalizePhonet,
  normalizeUnitalk,
  normalizeStreamtele,
  isCompletedCallEvent,
  resolveManager,
  fetchBinotelRecording,
  phonetRecordingUrl,
  PROVIDERS
} from "./telephony.js";

const RINGOSTAT_OUT = {
  call_id: "3333333333.3333333",
  caller: '"Support PhonerLite" <380671234567>',
  callee: "380441112233",
  status: "ANSWERED",
  date: "2026-08-08 11:11:11",
  call_duration: 50,
  waiting: 27,
  dialog: 23,
  type: "out",
  record: "3333333333.3333333",
  recording_wav: "https://app.ringostat.com/recordings/x.wav?token=abc",
  has_recording: "1",
  employee_fio: "Иван Иванов",
  department: "Отдел продаж",
  staffid: "1111",
  outbound_number: "380671234567"
};

const BINOTEL_COMPLETED = {
  requestType: "apiCallCompleted",
  callDetails: {
    generalCallID: "1754650000.98765",
    callID: "98765",
    startTime: "2026-08-08 14:20:00",
    callType: 0,
    internalNumber: "205",
    externalNumber: "380509998877",
    employeeName: "Петро Коваль",
    waitsec: 12,
    billsec: 187,
    disposition: "ANSWER"
  }
};

test("ringostat outbound: customer is the callee, talk time beats ring time", () => {
  const event = normalizeRingostat(RINGOSTAT_OUT);
  assert.equal(event.source, "ringostat");
  assert.equal(event.externalId, "3333333333.3333333");
  assert.equal(event.direction, "outbound");
  assert.equal(event.customerPhone, "380441112233");
  assert.equal(event.durationSec, 23, "dialog (talk time), not call_duration (50, includes ring)");
  assert.equal(event.waitSec, 27);
  assert.equal(event.answered, true);
  assert.equal(event.managerLabel, "Иван Иванов");
  assert.equal(event.managerExtension, "1111");
  assert.match(event.recordingUrl, /recordings\/x\.wav/);
});

test("ringostat inbound: customer is the caller, display name stripped", () => {
  const event = normalizeRingostat({ ...RINGOSTAT_OUT, type: "in" });
  assert.equal(event.direction, "inbound");
  assert.equal(event.customerPhone, "380671234567", "number extracted from '\"Name\" <number>'");
});

test("ringostat: has_recording 0 means no recording even if a url is absent", () => {
  const event = normalizeRingostat({ ...RINGOSTAT_OUT, has_recording: "0", recording_wav: "" });
  assert.equal(event.recordingUrl, null);
});

test("ringostat: an unanswered call is not marked answered", () => {
  const event = normalizeRingostat({ ...RINGOSTAT_OUT, status: "NOANSWER" });
  assert.equal(event.answered, false);
});

test("binotel: callDetails unwrapped, callType 0 is inbound", () => {
  const event = normalizeBinotel(BINOTEL_COMPLETED);
  assert.equal(event.source, "binotel");
  assert.equal(event.externalId, "1754650000.98765");
  assert.equal(event.direction, "inbound");
  assert.equal(event.customerPhone, "380509998877");
  assert.equal(event.managerExtension, "205");
  assert.equal(event.managerLabel, "Петро Коваль");
  assert.equal(event.durationSec, 187);
  assert.equal(event.waitSec, 12);
  assert.equal(event.answered, true);
  assert.equal(event.recordingUrl, null, "Binotel recordings are pulled separately");
});

test("binotel: callType 1 is outbound and lowercase calltype is accepted", () => {
  const event = normalizeBinotel({
    requestType: "apiCallCompleted",
    callDetails: { ...BINOTEL_COMPLETED.callDetails, callType: undefined, calltype: 1 }
  });
  assert.equal(event.direction, "outbound");
});

test("binotel: only recordable dispositions count as answered", () => {
  const answered = ["ANSWER", "SUCCESS", "VM-SUCCESS"];
  for (const disposition of answered) {
    const event = normalizeBinotel({
      callDetails: { ...BINOTEL_COMPLETED.callDetails, disposition }
    });
    assert.equal(event.answered, true, `${disposition} should be answered`);
  }
  const missed = normalizeBinotel({
    callDetails: { ...BINOTEL_COMPLETED.callDetails, disposition: "NO ANSWER" }
  });
  assert.equal(missed.answered, false);
});

test("binotel: a flat payload without the callDetails wrapper still maps", () => {
  const event = normalizeBinotel({ ...BINOTEL_COMPLETED.callDetails });
  assert.equal(event.externalId, "1754650000.98765");
  assert.equal(event.customerPhone, "380509998877");
});

test("timestamps are converted from the org's local time to UTC", () => {
  // Kyiv in August is UTC+3, so 14:20 local is 11:20Z.
  const event = normalizeBinotel(BINOTEL_COMPLETED, { tzOffsetMinutes: 180 });
  assert.equal(event.startedAt, "2026-08-08T11:20:00.000Z");

  // Without an offset the value is taken as already-UTC, not shifted silently.
  assert.equal(normalizeBinotel(BINOTEL_COMPLETED).startedAt, "2026-08-08T14:20:00.000Z");
});

test("the raw payload is preserved for diffing against real traffic", () => {
  assert.deepEqual(normalizeBinotel(BINOTEL_COMPLETED).raw, BINOTEL_COMPLETED);
});

test("completed-call events are distinguished from other webhooks", () => {
  assert.equal(isCompletedCallEvent("binotel", BINOTEL_COMPLETED), true);
  assert.equal(isCompletedCallEvent("binotel", { requestType: "apiCallSettings" }), false);
  assert.equal(isCompletedCallEvent("ringostat", RINGOSTAT_OUT), true);
  assert.equal(isCompletedCallEvent("ringostat", { call_id: "1", type: "in" }), false);
});

test("a call with no id is rejected rather than stored anonymously", () => {
  assert.throws(() => normalizeEvent("ringostat", { type: "in" }), /ringostat_missing_call_id/);
  assert.throws(() => normalizeEvent("asterisk", {}), /unsupported_telephony_asterisk/);
});

test("manager resolution prefers extension over display name", () => {
  const members = [
    { user_id: "u1", extension: "205", full_name: "Пётр Ковалёв" },
    { user_id: "u2", extension: "206", full_name: "Петро Коваль" }
  ];
  // Name says u2, extension says u1 — the extension wins, because PBX display
  // names are hand-typed and drift.
  const event = normalizeBinotel(BINOTEL_COMPLETED);
  assert.equal(resolveManager(event, members).user_id, "u1");
});

test("manager resolution falls back to name, then to unmapped", () => {
  const members = [{ user_id: "u2", extension: "", full_name: "петро коваль" }];
  const event = { ...normalizeBinotel(BINOTEL_COMPLETED), managerExtension: "" };
  assert.equal(resolveManager(event, members).user_id, "u2");
  assert.equal(resolveManager({ managerExtension: "", managerLabel: "" }, members), null);
});

test("binotel recording fetch posts credentials and returns the link", async () => {
  let seen;
  const fetchImpl = async (url, init) => {
    seen = { url, body: JSON.parse(init.body) };
    return { ok: true, status: 200, json: async () => ({ status: "success", callRecordLink: "https://x/rec.mp3" }) };
  };

  const url = await fetchBinotelRecording({
    generalCallID: "1754650000.98765",
    apiKey: "k",
    apiSecret: "s",
    fetchImpl
  });

  assert.match(seen.url, /api\.binotel\.com/);
  assert.equal(seen.body.generalCallID, "1754650000.98765");
  assert.equal(seen.body.key, "k");
  assert.equal(url, "https://x/rec.mp3");
});

test("binotel recording errors surface instead of yielding a null url", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ status: "error", message: "record not found" })
  });
  await assert.rejects(
    fetchBinotelRecording({ generalCallID: "x", apiKey: "k", apiSecret: "s", fetchImpl }),
    /binotel_record_record not found/
  );
});

// ---------------------------------------------------------------------------
// Phonet
// ---------------------------------------------------------------------------

// Webhook fixture: structure and dialAt value verbatim from the official
// HTTPS API v4.1 example (which shows SECOND-precision epochs against a doc
// that says milliseconds); bridgeAt, the client number and names are
// SYNTHETIC. lgDirection 4 = incoming per the doc.
const PHONET_HANGUP = {
  event: "call.hangup",
  accountDomain: "qwerty.phonet.com.ua",
  uuid: "47a968893984475b8c20e29dec144ce3",
  parentUuid: null,
  dialAt: 1431686100, // official example value → 2015-05-15T10:35:00Z
  bridgeAt: 1431686112, // SYNTHETIC: picked up 12s in
  lgDirection: 4,
  leg: { id: 36, ext: "001", displayName: "Иван Иванов" },
  leg2: null,
  otherLegs: [
    {
      id: 1,
      name: "Клиент",
      num: "+380671112233", // SYNTHETIC
      companyName: "ТОВ Клиент",
      url: "https://crm.example.com/contact/1" // CRM card, NOT a recording
    }
  ],
  trunkNum: "+380442246595",
  trunkName: "www.phonet.com.ua"
};

// History-record fixture: field list verbatim from the /rest/calls/company.api
// section of the doc (endAt, billSecs, duration, disposition, otherLegNum,
// audioRecUrl, transferHistory); the values are SYNTHETIC.
const PHONET_HISTORY = {
  uuid: "58b979994095586c9d31f3aed255df44",
  parentUuid: null,
  endAt: 1754650300000, // epoch ms
  lgDirection: 2, // outgoing
  leg: { id: 36, type: 1, ext: "001", displayName: "Иван Иванов" },
  leg2: null,
  otherLegNum: "+380509998877",
  otherLegName: "Клиент",
  billSecs: 120, // TALK seconds
  duration: 135, // TOTAL incl. ringing
  disposition: 0, // answered
  transferHistory: null,
  audioRecUrl:
    "https://qwerty.phonet.com.ua/rest/public/calls/58b979994095586c9d31f3aed255df44/audio",
  trunk: "+380442246595"
};

test("phonet hangup webhook: leg is the employee, otherLegs the customer", () => {
  const event = normalizePhonet(PHONET_HANGUP);
  assert.equal(event.source, "phonet");
  assert.equal(event.externalId, "47a968893984475b8c20e29dec144ce3");
  assert.equal(event.direction, "inbound", "lgDirection 4 = incoming per the official doc");
  assert.equal(event.customerPhone, "380671112233", "otherLegs[0].num is the client");
  assert.equal(event.managerLabel, "Иван Иванов");
  assert.equal(event.managerExtension, "001");
  assert.equal(event.answered, true, "non-null bridgeAt means picked up");
  assert.equal(event.waitSec, 12, "derived: bridgeAt − dialAt");
  assert.equal(event.durationSec, null, "hangup carries no durations — the history pull does");
  assert.equal(event.startedAt, "2015-05-15T10:35:00.000Z");
  assert.equal(event.recordingUrl, null, "otherLegs[].url is a CRM link, not a recording");
  assert.deepEqual(event.raw, PHONET_HANGUP);
});

test("phonet history record: talk time beats total, start derived from endAt", () => {
  const event = normalizePhonet(PHONET_HISTORY);
  assert.equal(event.externalId, "58b979994095586c9d31f3aed255df44");
  assert.equal(event.direction, "outbound", "lgDirection 2 = outgoing per the official doc");
  assert.equal(event.customerPhone, "380509998877", "outbound: customer is the other leg (callee)");
  assert.equal(event.durationSec, 120, "billSecs (talk), not duration (135, includes ring)");
  assert.equal(event.waitSec, 15, "duration − billSecs");
  assert.equal(event.answered, true, "disposition 0 = answered");
  assert.match(event.recordingUrl, /rest\/public\/calls/);
  assert.equal(event.startedAt, "2025-08-08T10:49:25.000Z", "derived: endAt − duration");
});

test("phonet epochs: doc says ms, examples show seconds — both accepted, tz-safe", () => {
  const fromMs = normalizePhonet({
    ...PHONET_HANGUP,
    dialAt: 1431686100000,
    bridgeAt: 1431686112000
  });
  assert.equal(fromMs.startedAt, "2015-05-15T10:35:00.000Z", "same instant as second-precision");
  assert.equal(fromMs.waitSec, 12);
  // Epoch timestamps are GMT+0 — the org timezone offset must never shift them.
  const shifted = normalizePhonet(PHONET_HANGUP, { tzOffsetMinutes: 180 });
  assert.equal(shifted.startedAt, "2015-05-15T10:35:00.000Z");
});

test("phonet: non-zero disposition and missing bridgeAt both mean unanswered", () => {
  const noAnswerHistory = normalizePhonet({ ...PHONET_HISTORY, disposition: 1, billSecs: 0 });
  assert.equal(noAnswerHistory.answered, false);
  const noBridge = normalizePhonet({ ...PHONET_HANGUP, bridgeAt: null });
  assert.equal(noBridge.answered, false);
  assert.equal(noBridge.durationSec, null);
});

test("phonet: internal calls and pause toggles have no direction mapping", () => {
  assert.equal(normalizePhonet({ ...PHONET_HANGUP, lgDirection: 1 }).direction, "unknown");
  assert.equal(normalizePhonet({ ...PHONET_HANGUP, lgDirection: 32 }).direction, "unknown");
});

test("phonet recording url is constructed from domain + uuid", () => {
  assert.equal(
    phonetRecordingUrl({ accountDomain: "qwerty.phonet.com.ua", uuid: "abc" }),
    "https://qwerty.phonet.com.ua/rest/public/calls/abc/audio"
  );
  assert.equal(
    phonetRecordingUrl({ accountDomain: "https://qwerty.phonet.com.ua/", uuid: "abc", channel: "rx" }),
    "https://qwerty.phonet.com.ua/rest/public/calls/abc-rx/audio",
    "protocol and path are stripped, split-channel suffix appended"
  );
  assert.equal(phonetRecordingUrl({ accountDomain: "", uuid: "abc" }), null);
  assert.equal(phonetRecordingUrl({ accountDomain: "x.phonet.com.ua", uuid: "" }), null);
});

// ---------------------------------------------------------------------------
// UniTalk (ex-Nextel)
// ---------------------------------------------------------------------------

// 'Standard JSON' fixture: shape and most values verbatim from the official
// docs' CALL_END example (id/dbid/from/to/lastGroupName/state/link/cause);
// the date is SYNTHETIC (docs show "2018-07-09 16:58:52", same format).
const UNITALK_END = {
  event: "CALL_END",
  call: {
    id: 1091944, // random id linking CALL_NEW..CALL_END of one call
    dbid: 275, // persistent DB id after save — the dedupe key
    from: "380505557182",
    to: ["2000"], // internal lines the call was routed to
    lastGroupName: "Sales managers",
    outerNumber: "site.ua", // company external line / site name — not a party
    direction: "IN",
    date: "2026-08-08 14:20:00", // SYNTHETIC; local wall-clock, no offset
    secondsFullTime: 19,
    secondsTalk: 9,
    callback: true, // deprecated, use source
    state: "ANSWER",
    source: "REGULAR",
    link: "https://api.unitalk.cloud:8443/tracking/rec/1531144732.920/2018-07-09",
    cause: 16
  }
};

test("unitalk CALL_END: dbid id, talk time, group as department, link kept", () => {
  const event = normalizeUnitalk(UNITALK_END);
  assert.equal(event.source, "unitalk");
  assert.equal(event.externalId, "275", "dbid (persistent), not id (random per call)");
  assert.equal(event.direction, "inbound");
  assert.equal(event.customerPhone, "380505557182", "inbound: from is the client");
  assert.equal(event.managerExtension, "2000", "first internal line from call.to");
  assert.equal(event.managerLabel, "", "call events carry no employee name");
  assert.equal(event.department, "Sales managers");
  assert.equal(event.durationSec, 9, "secondsTalk, not secondsFullTime (19, includes ring)");
  assert.equal(event.waitSec, 10, "derived: fullTime − talk");
  assert.equal(event.answered, true);
  assert.match(event.recordingUrl, /tracking\/rec/, "link ships only when state=ANSWER");
  assert.deepEqual(event.raw, UNITALK_END);
});

test("unitalk: wall-clock date converts with the org offset, like binotel", () => {
  assert.equal(
    normalizeUnitalk(UNITALK_END, { tzOffsetMinutes: 180 }).startedAt,
    "2026-08-08T11:20:00.000Z"
  );
  assert.equal(normalizeUnitalk(UNITALK_END).startedAt, "2026-08-08T14:20:00.000Z");
});

test("unitalk outbound: from/to swap (UNVERIFIED in vendor docs — pilot check)", () => {
  const event = normalizeUnitalk({
    event: "CALL_END",
    call: { ...UNITALK_END.call, direction: "OUT", from: "2000", to: ["380505557182"] }
  });
  assert.equal(event.direction, "outbound");
  assert.equal(event.customerPhone, "380505557182", "outbound: customer is the callee");
  assert.equal(event.managerExtension, "2000", "operator line expected in call.from");
});

test("unitalk: only state=ANSWER is answered; no link on a missed call", () => {
  const missed = normalizeUnitalk({
    event: "CALL_END",
    call: { ...UNITALK_END.call, state: "NOANSWER", link: undefined, secondsTalk: 0 }
  });
  assert.equal(missed.answered, false);
  assert.equal(missed.durationSec, 0);
  assert.equal(missed.recordingUrl, null);
  assert.equal(normalizeUnitalk({
    event: "CALL_END",
    call: { ...UNITALK_END.call, direction: "INNER" }
  }).direction, "unknown", "INNER is not a customer call");
});

test("unitalk: dbid falls back to id; a flat body without the wrapper maps", () => {
  const noDb = normalizeUnitalk({
    event: "CALL_END",
    call: { ...UNITALK_END.call, dbid: undefined }
  });
  assert.equal(noDb.externalId, "1091944");
  const flat = normalizeUnitalk(UNITALK_END.call);
  assert.equal(flat.externalId, "275");
  assert.equal(flat.customerPhone, "380505557182");
});

// SYNTHETIC variable-template fixture (call_* substitutions composed in the
// UniTalk cabinet) — the pre-dossier fallback shape, UNVERIFIED semantics.
const UNITALK_VARIABLES = {
  call_id: "756123456789",
  call_from: "380971234567",
  call_outernumber: "0800300111",
  call_to_0: "102",
  call_secondstalk: "95",
  call_secondsfulltime: "117",
  call_direction: "in",
  call_date: "2026-08-08 14:20:00",
  call_state: "ANSWERED",
  call_link: "https://my.unitalk.cloud/records/756123456789.mp3"
};

test("unitalk variable-template fallback: call_* keys and urlencoded bodies", () => {
  const event = normalizeUnitalk(UNITALK_VARIABLES);
  assert.equal(event.externalId, "756123456789");
  assert.equal(event.direction, "inbound");
  assert.equal(event.customerPhone, "380971234567", "inbound prefers call_from over the outer line");
  assert.equal(event.managerExtension, "102");
  assert.equal(event.durationSec, 95, "call_secondstalk, not call_secondsfulltime (117)");
  assert.equal(event.waitSec, 22);
  assert.equal(event.answered, true);
  assert.equal(event.recordingUrl, "https://my.unitalk.cloud/records/756123456789.mp3");

  const encoded = new URLSearchParams(UNITALK_VARIABLES).toString();
  const fromText = normalizeUnitalk(encoded);
  assert.equal(fromText.externalId, "756123456789");
  assert.equal(fromText.durationSec, 95);
});

test("unitalk: empty urlencoded values read as absent, not zero", () => {
  const event = normalizeUnitalk({
    ...UNITALK_VARIABLES,
    call_secondstalk: "",
    call_secondsfulltime: "40"
  });
  assert.equal(event.durationSec, 40, "'' falls through to call_secondsfulltime");
});

// ---------------------------------------------------------------------------
// Stream Telecom
// ---------------------------------------------------------------------------

// Hangup fixture: field set and value formats verbatim from the official
// v3.0.1 Events doc (epoch-ms STRINGS, literal "null" strings, long internal
// line "80044022203"); the doc's example repeats one timestamp everywhere, so
// the epochs here are SYNTHETIC to make the duration math observable.
const STREAMTELE_HANGUP = {
  event: "Hangup",
  type: "in",
  event_time: "1754650130000", // hangup moment
  time_start: "1754650000000",
  time_ring: "1754650000000",
  time_answer: "1754650008000", // answered 8s in
  from: "380631234567", // the caller (client)
  to: "80044022203", // internal line that took the call (long format)
  via: "380441112233", // company external number — never a party
  redirecting: "null", // literal string "null", as in the doc example
  result: "answer",
  call_id: "1558695235.5669089", // unique call id — the dedupe key
  sessionid: "1586343097.1229109",
  recordUrl: "https://gate.streamtele.com/api/streamtele-v3/audio?abc-uuid",
  join: null,
  end_sess: null
};

test("streamtele hangup: durations computed from the epoch-ms strings", () => {
  const event = normalizeStreamtele(STREAMTELE_HANGUP);
  assert.equal(event.source, "streamtele");
  assert.equal(event.externalId, "1558695235.5669089", "call_id, not sessionid");
  assert.equal(event.direction, "inbound");
  assert.equal(event.customerPhone, "380631234567", "inbound: from is the caller");
  assert.equal(event.managerExtension, "80044022203", "to = internal line, long format");
  assert.equal(event.managerLabel, "", "no employee name in the payload");
  assert.equal(event.durationSec, 122, "event_time − time_answer (talk), not − time_start (130)");
  assert.equal(event.waitSec, 8, "time_answer − time_start");
  assert.equal(event.answered, true, "result 'answer'");
  assert.equal(event.startedAt, "2025-08-08T10:46:40.000Z", "time_start, GMT+0");
  assert.match(event.recordingUrl, /streamtele-v3\/audio/);
  assert.deepEqual(event.raw, STREAMTELE_HANGUP);
});

test("streamtele outbound: from is the internal line, to is the client", () => {
  const event = normalizeStreamtele({
    ...STREAMTELE_HANGUP,
    type: "out",
    from: "80044022203",
    to: "380631234567"
  });
  assert.equal(event.direction, "outbound");
  assert.equal(event.customerPhone, "380631234567", "outbound: customer is the callee");
  assert.equal(event.managerExtension, "80044022203");
});

test("streamtele no-answer: zero talk, rang until hangup, 'null' url guarded", () => {
  const event = normalizeStreamtele({
    ...STREAMTELE_HANGUP,
    result: "no answer",
    time_answer: "null", // guard: literal string null / 0 on unanswered calls
    recordUrl: null
  });
  assert.equal(event.answered, false);
  assert.equal(event.durationSec, 0, "never picked up — zero talk by definition");
  assert.equal(event.waitSec, 130, "event_time − time_start when never answered");
  assert.equal(event.recordingUrl, null);
});

test("streamtele: epoch timestamps ignore the org timezone offset", () => {
  const shifted = normalizeStreamtele(STREAMTELE_HANGUP, { tzOffsetMinutes: 180 });
  assert.equal(shifted.startedAt, "2025-08-08T10:46:40.000Z", "already GMT+0, no shift");
});

// ---------------------------------------------------------------------------
// Cross-provider plumbing
// ---------------------------------------------------------------------------

test("new kinds discriminate completed calls from progress events", () => {
  // Phonet: only call.hangup is final; a pulled history record has no
  // `event` but carries endAt.
  assert.equal(isCompletedCallEvent("phonet", PHONET_HANGUP), true);
  assert.equal(isCompletedCallEvent("phonet", { ...PHONET_HANGUP, event: "call.dial" }), false);
  assert.equal(isCompletedCallEvent("phonet", { ...PHONET_HANGUP, event: "call.bridge" }), false);
  assert.equal(isCompletedCallEvent("phonet", PHONET_HISTORY), true);

  // UniTalk Standard JSON: only CALL_END; the variable-template fallback has
  // no `event` and is judged by end-of-call data presence.
  assert.equal(isCompletedCallEvent("unitalk", UNITALK_END), true);
  assert.equal(isCompletedCallEvent("unitalk", { ...UNITALK_END, event: "CALL_NEW" }), false);
  assert.equal(isCompletedCallEvent("unitalk", { ...UNITALK_END, event: "CALL_ANSWER" }), false);
  assert.equal(isCompletedCallEvent("unitalk", UNITALK_VARIABLES), true);
  assert.equal(isCompletedCallEvent("unitalk", { call_id: "1", call_from: "x" }), false);

  // Stream Telecom: Hangup only — Start/StartCall/Answer are progress and
  // End_in died in the IVR; queue calls keep only the end_sess="yes" leg.
  assert.equal(isCompletedCallEvent("streamtele", STREAMTELE_HANGUP), true);
  assert.equal(isCompletedCallEvent("streamtele", { ...STREAMTELE_HANGUP, event: "Start" }), false);
  assert.equal(isCompletedCallEvent("streamtele", { ...STREAMTELE_HANGUP, event: "Answer" }), false);
  assert.equal(isCompletedCallEvent("streamtele", { ...STREAMTELE_HANGUP, event: "End_in" }), false);
  assert.equal(
    isCompletedCallEvent("streamtele", { ...STREAMTELE_HANGUP, join: "yes" }),
    false,
    "queue leg without end_sess is a per-leg duplicate"
  );
  assert.equal(
    isCompletedCallEvent("streamtele", { ...STREAMTELE_HANGUP, join: "yes", end_sess: "yes" }),
    true
  );
});

test("new kinds reject a payload with no call id", () => {
  assert.throws(
    () => normalizeEvent("phonet", { ...PHONET_HANGUP, uuid: "" }),
    /phonet_missing_call_id/
  );
  assert.throws(
    () => normalizeEvent("unitalk", { event: "CALL_END", call: {} }),
    /unitalk_missing_call_id/
  );
  assert.throws(() => normalizeEvent("streamtele", { event: "Hangup" }), /streamtele_missing_call_id/);
});

test("legacy 'nextel' kind is an alias of unitalk", () => {
  const event = normalizeEvent("nextel", UNITALK_END);
  assert.equal(event.source, "unitalk", "dedupe key stays stable across the rebrand");
  assert.equal(isCompletedCallEvent("nextel", UNITALK_END), true);
});

test("new-provider extensions resolve against memberships like the others", () => {
  const streamMembers = [{ user_id: "u9", extension: "80044022203", full_name: "Ольга Стрим" }];
  assert.equal(
    resolveManager(normalizeStreamtele(STREAMTELE_HANGUP), streamMembers).user_id,
    "u9"
  );
  const phonetMembers = [{ user_id: "u7", extension: "001", full_name: "Иван Иванов" }];
  assert.equal(resolveManager(normalizePhonet(PHONET_HANGUP), phonetMembers).user_id, "u7");
});

test("PROVIDERS manifest covers all five kinds with renderable fields", () => {
  assert.deepEqual(
    PROVIDERS.map((p) => p.kind),
    ["ringostat", "binotel", "phonet", "unitalk", "streamtele"]
  );
  for (const provider of PROVIDERS) {
    assert.ok(provider.displayName.length > 0, `${provider.kind} has a display name`);
    assert.ok(Array.isArray(provider.credentialFields), `${provider.kind} credentialFields`);
    for (const field of provider.credentialFields) {
      assert.equal(typeof field.key, "string");
      assert.ok(field.label.length > 0);
      assert.equal(typeof field.secret, "boolean");
      assert.equal(typeof field.placeholder, "string");
    }
    assert.ok(provider.managerMappingHint.length > 0, `${provider.kind} mapping hint`);
    // Every advertised kind must actually normalize — an empty payload has no
    // call id, so the registered normalizer must throw exactly that.
    assert.throws(
      () => normalizeEvent(provider.kind, {}),
      new RegExp(`${provider.kind}_missing_call_id`)
    );
  }

  const byKind = Object.fromEntries(PROVIDERS.map((p) => [p.kind, p]));
  assert.deepEqual(
    byKind.binotel.credentialFields.map((f) => f.key),
    ["apiKey", "apiSecret"],
    "matches fetchBinotelRecording's arguments"
  );
  assert.deepEqual(
    byKind.phonet.credentialFields.map((f) => f.key),
    ["accountDomain", "apiKey"],
    "matches phonetRecordingUrl's arguments"
  );
  assert.equal(byKind.phonet.credentialFields[0].secret, false, "the domain is not a secret");
  assert.deepEqual(byKind.ringostat.credentialFields.map((f) => f.key), ["apiKey"]);
  assert.deepEqual(byKind.unitalk.credentialFields.map((f) => f.key), ["apiKey"]);
  assert.deepEqual(byKind.streamtele.credentialFields.map((f) => f.key), ["apiKey"]);
});
