// Telephony connector tests.
//
// The payloads below mirror the vendors' documented examples. Ringostat's are
// from its official webhook docs; Binotel's follow the third-party integration
// docs (its developer site was unreachable) — when the first real Binotel event
// arrives, diff it against BINOTEL_COMPLETED here before trusting the mapping.

import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEvent,
  normalizeRingostat,
  normalizeBinotel,
  isCompletedCallEvent,
  resolveManager,
  fetchBinotelRecording
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
