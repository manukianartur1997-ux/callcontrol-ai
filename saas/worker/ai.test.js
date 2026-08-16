// Tests for the provider-agnostic analysis adapter.
//
// These assert the two things that break silently in production: the request
// shape each provider expects, and where each provider hides its token counts.
// A wrong usage field costs the client money invisibly; a wrong request shape
// fails loudly, which is the easier bug.
//
//   node --test saas/worker/

import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeCall,
  transcribeAudio,
  defaultModelFor,
  supportedProviders,
  supportedSttProviders,
  defaultSttModel,
  __testing
} from "./ai.js";

const CHECKLIST = {
  items: [
    { key: "greeting", weight: 20, label: "Приветствие", hint: "Назвал компанию" },
    { key: "needs", weight: 80, label: "Потребность", hint: "Открытые вопросы" }
  ]
};

const TRANSCRIPT =
  "Менеджер: Добрый день, это Пётр из CallControl. Клиент: Здравствуйте. " +
  "Менеджер: Расскажите, какая у вас сейчас задача с отделом продаж?";

const ANALYSIS = {
  score: 42, // deliberately wrong — the adapter must recompute from weights
  summary: "Менеджер представился и выяснил задачу.",
  items: [
    { key: "greeting", score: 100, evidence: "это Пётр из CallControl", comment: "Назвал себя и компанию" },
    { key: "needs", score: 50, evidence: "какая у вас сейчас задача", comment: "Один вопрос, неглубоко" }
  ],
  leaks: [{ title: "Нет квалификации", severity: "high", detail: "Бюджет не выяснен", money_impact: "Риск слить лид" }],
  coaching: [{ title: "Копать глубже", detail: "Три уточняющих вопроса" }],
  next_step: { present: false, detail: "Договорённости нет" }
};

// Captures the outgoing request and replies with a canned provider envelope.
function stubFetch(buildResponse) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return {
      ok: true,
      status: 200,
      json: async () => buildResponse(JSON.stringify(ANALYSIS))
    };
  };
  return { fetchImpl, calls };
}

test("anthropic: request shape, structured output, usage mapping", async () => {
  const { fetchImpl, calls } = stubFetch((text) => ({
    stop_reason: "end_turn",
    content: [{ type: "text", text }],
    usage: { input_tokens: 1200, output_tokens: 340 }
  }));

  const result = await analyzeCall({
    provider: "anthropic",
    apiKey: "sk-ant-test",
    transcript: TRANSCRIPT,
    checklist: CHECKLIST,
    fetchImpl
  });

  const [call] = calls;
  assert.equal(call.url, "https://api.anthropic.com/v1/messages");
  assert.equal(call.init.headers["x-api-key"], "sk-ant-test");
  assert.equal(call.init.headers["anthropic-version"], "2023-06-01");
  assert.equal(call.body.model, "claude-opus-5");
  assert.equal(call.body.output_config.format.type, "json_schema");

  // Sampling params are rejected on current Claude models — never send them.
  assert.equal(call.body.temperature, undefined);
  assert.equal(call.body.top_p, undefined);
  assert.equal(call.body.top_k, undefined);

  assert.equal(result.tokensIn, 1200);
  assert.equal(result.tokensOut, 340);
  assert.equal(result.provider, "anthropic");
});

test("anthropic: a classifier refusal is an error, not an empty analysis", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ stop_reason: "refusal", stop_details: { category: "cyber" }, content: [] })
  });

  await assert.rejects(
    analyzeCall({ provider: "anthropic", apiKey: "k", transcript: TRANSCRIPT, checklist: CHECKLIST, fetchImpl }),
    /anthropic_refusal_cyber/
  );
});

test("gemini: OpenAPI-flavoured schema and usageMetadata mapping", async () => {
  const { fetchImpl, calls } = stubFetch((text) => ({
    candidates: [{ finishReason: "STOP", content: { parts: [{ text }] } }],
    usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 210 }
  }));

  const result = await analyzeCall({
    provider: "gemini",
    apiKey: "AIza-test",
    transcript: TRANSCRIPT,
    checklist: CHECKLIST,
    fetchImpl
  });

  const [call] = calls;
  assert.match(call.url, /generativelanguage\.googleapis\.com/);
  assert.equal(call.init.headers["x-goog-api-key"], "AIza-test");

  const schema = call.body.generationConfig.responseSchema;
  assert.equal(schema.type, "OBJECT", "Gemini wants uppercase types");
  assert.equal(
    JSON.stringify(schema).includes("additionalProperties"),
    false,
    "Gemini rejects additionalProperties anywhere in the schema"
  );

  assert.equal(result.tokensIn, 900);
  assert.equal(result.tokensOut, 210);
});

test("openai: strict json_schema and prompt/completion token mapping", async () => {
  const { fetchImpl, calls } = stubFetch((text) => ({
    choices: [{ finish_reason: "stop", message: { content: text } }],
    usage: { prompt_tokens: 1000, completion_tokens: 250 }
  }));

  const result = await analyzeCall({
    provider: "openai",
    apiKey: "sk-openai",
    transcript: TRANSCRIPT,
    checklist: CHECKLIST,
    fetchImpl
  });

  const [call] = calls;
  assert.equal(call.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(call.init.headers.authorization, "Bearer sk-openai");
  assert.equal(call.body.response_format.json_schema.strict, true);
  assert.equal(result.tokensIn, 1000);
  assert.equal(result.tokensOut, 250);
});

test("score is recomputed from checklist weights, not taken from the model", async () => {
  const { fetchImpl } = stubFetch((text) => ({
    stop_reason: "end_turn",
    content: [{ type: "text", text }],
    usage: { input_tokens: 1, output_tokens: 1 }
  }));

  const result = await analyzeCall({
    provider: "anthropic",
    apiKey: "k",
    transcript: TRANSCRIPT,
    checklist: CHECKLIST,
    fetchImpl
  });

  // (100 × 20 + 50 × 80) / 100 = 60 — not the 42 the model claimed.
  assert.equal(result.score, 60);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[1].label, "Потребность", "labels come from the checklist, not the model");
});

test("a checklist item the model skipped scores zero instead of vanishing", () => {
  const normalized = __testing.normalizeAnalysis(
    { score: 90, summary: "", items: [{ key: "greeting", score: 100 }], leaks: [], coaching: [] },
    CHECKLIST
  );
  assert.equal(normalized.items.length, 2);
  assert.equal(normalized.items[1].key, "needs");
  assert.equal(normalized.items[1].score, 0);
  assert.equal(normalized.score, 20); // 100×20/100
});

test("coaching is capped and severity is constrained to the allowed set", () => {
  const normalized = __testing.normalizeAnalysis(
    {
      items: [],
      leaks: [{ title: "x", severity: "catastrophic", detail: "", money_impact: "" }],
      coaching: [1, 2, 3, 4, 5].map((n) => ({ title: `t${n}`, detail: "" }))
    },
    { items: [] }
  );
  assert.equal(normalized.leaks[0].severity, "medium");
  assert.equal(normalized.coaching.length, 3);
});

test("garbage in place of JSON fails loudly", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "sorry, I can't" }] })
  });
  await assert.rejects(
    analyzeCall({ provider: "anthropic", apiKey: "k", transcript: TRANSCRIPT, checklist: CHECKLIST, fetchImpl }),
    /analysis_not_json/
  );
});

test("guard rails: unknown provider, missing key, stub transcript", async () => {
  await assert.rejects(
    analyzeCall({ provider: "llama", apiKey: "k", transcript: TRANSCRIPT, checklist: CHECKLIST }),
    /unsupported_provider_llama/
  );
  await assert.rejects(
    analyzeCall({ provider: "anthropic", transcript: TRANSCRIPT, checklist: CHECKLIST }),
    /api_key_missing/
  );
  await assert.rejects(
    analyzeCall({ provider: "anthropic", apiKey: "k", transcript: "алло", checklist: CHECKLIST }),
    /transcript_too_short/
  );
});

test("lead_quality: in the schema, in the prompt rubric, defaulted in normalize", () => {
  // The schema requires the field and constrains it to the three values.
  assert.ok(__testing.ANALYSIS_SCHEMA.required.includes("lead_quality"));
  assert.deepEqual(__testing.ANALYSIS_SCHEMA.properties.lead_quality.enum, [
    "good", "bad", "unclear"
  ]);
  // The model gets an actual rubric, not just a field name.
  assert.match(__testing.SYSTEM_PROMPT, /lead_quality/);
  assert.match(__testing.SYSTEM_PROMPT, /целевой/);

  // Missing or garbage values collapse to 'unclear'; valid ones pass through.
  const base = { items: [], leaks: [], coaching: [] };
  assert.equal(__testing.normalizeAnalysis(base, { items: [] }).lead_quality, "unclear");
  assert.equal(
    __testing.normalizeAnalysis({ ...base, lead_quality: "excellent" }, { items: [] }).lead_quality,
    "unclear"
  );
  assert.equal(
    __testing.normalizeAnalysis({ ...base, lead_quality: "good" }, { items: [] }).lead_quality,
    "good"
  );
  assert.equal(
    __testing.normalizeAnalysis({ ...base, lead_quality: "bad" }, { items: [] }).lead_quality,
    "bad"
  );
});

test("analyzeCall carries lead_quality through to the result", async () => {
  const { fetchImpl } = stubFetch((text) => ({
    stop_reason: "end_turn",
    content: [{ type: "text", text }],
    usage: { input_tokens: 1, output_tokens: 1 }
  }));
  // The canned ANALYSIS fixture has no lead_quality — the default applies.
  const result = await analyzeCall({
    provider: "anthropic",
    apiKey: "k",
    transcript: TRANSCRIPT,
    checklist: CHECKLIST,
    fetchImpl
  });
  assert.equal(result.lead_quality, "unclear");
});

// ---------------------------------------------------------------------------
// STT: transcribeAudio (Gemini inline audio)
// ---------------------------------------------------------------------------

const DIARIZED = "Менеджер: Добрый день, это Пётр.\nКлиент: Здравствуйте, расскажите про тарифы.";

function sttEnvelope(payload, usage = { promptTokenCount: 4800, candidatesTokenCount: 260 }) {
  return {
    candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(payload) }] } }],
    usageMetadata: usage
  };
}

test("transcribeAudio: inline audio request shape, diarization prompt, result mapping", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => sttEnvelope({ lang: "RU", text: DIARIZED }) };
  };

  const result = await transcribeAudio({
    provider: "gemini",
    apiKey: "AIza-stt-test",
    audioB64: "QUJD",
    mime: "audio/mpeg",
    fetchImpl
  });

  const [call] = calls;
  assert.match(call.url, /generativelanguage\.googleapis\.com/);
  assert.match(call.url, /gemini-flash-latest/, "default model when none is chosen");
  assert.equal(call.init.headers["x-goog-api-key"], "AIza-stt-test");

  const parts = call.body.contents[0].parts;
  const audioPart = parts.find((part) => part.inlineData);
  assert.equal(audioPart.inlineData.mimeType, "audio/mpeg");
  assert.equal(audioPart.inlineData.data, "QUJD");
  const promptPart = parts.find((part) => part.text);
  // The strict per-utterance diarization format is spelled out in the prompt.
  assert.match(promptPart.text, /Менеджер: …/);
  assert.match(promptPart.text, /Клиент: …/);
  assert.match(promptPart.text, /на языке оригинала/);
  assert.equal(call.body.generationConfig.responseMimeType, "application/json");

  assert.equal(result.text, DIARIZED);
  assert.equal(result.lang, "ru", "lang is lowercased");
  assert.equal(result.tokensIn, 4800);
  assert.equal(result.tokensOut, 260);
});

test("transcribeAudio: an explicit model overrides the default", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url });
    return { ok: true, status: 200, json: async () => sttEnvelope({ lang: "uk", text: DIARIZED }) };
  };
  await transcribeAudio({
    apiKey: "k", model: "gemini-pro-latest", audioB64: "QUJD", mime: "audio/wav", fetchImpl
  });
  assert.match(calls[0].url, /gemini-pro-latest/);
});

test("transcribeAudio errors follow the driver conventions", async () => {
  const args = { apiKey: "k", audioB64: "QUJD", mime: "audio/mpeg" };

  await assert.rejects(
    transcribeAudio({ ...args, fetchImpl: async () => ({ ok: false, status: 429, text: async () => "quota" }) }),
    /gemini_http_429/
  );
  await assert.rejects(
    transcribeAudio({
      ...args,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "x" }] } }] }) })
    }),
    /gemini_truncated/
  );
  await assert.rejects(
    transcribeAudio({
      ...args,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "not json at all" }] } }] }) })
    }),
    /transcription_not_json/
  );
  await assert.rejects(
    transcribeAudio({
      ...args,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => sttEnvelope({ lang: "ru", text: "  " }) })
    }),
    /transcription_empty/
  );
  await assert.rejects(transcribeAudio({ ...args, provider: "whisper" }), /unsupported_stt_provider_whisper/);
  await assert.rejects(transcribeAudio({ apiKey: "", audioB64: "QUJD", mime: "audio/mpeg" }), /api_key_missing/);
  await assert.rejects(transcribeAudio({ apiKey: "k", audioB64: "", mime: "audio/mpeg" }), /audio_missing/);
});

test("checklist weights and hints reach the prompt", () => {
  const prompt = __testing.buildUserPrompt({
    checklist: CHECKLIST,
    transcript: TRANSCRIPT,
    context: { managerName: "Пётр", durationSec: 300 }
  });
  assert.match(prompt, /greeting \(вес 20\)/);
  assert.match(prompt, /Открытые вопросы/);
  assert.match(prompt, /Менеджер: Пётр/);
  assert.match(prompt, /5 мин/);
});

test("every provider has a default model", () => {
  for (const provider of supportedProviders()) {
    assert.ok(defaultModelFor(provider), `${provider} has no default model`);
  }
});

// ---------------------------------------------------------------------------
// STT: transcribeAudio (Deepgram Nova-3, real diarization)
// ---------------------------------------------------------------------------

// A Deepgram diarized envelope: two speakers, utterances plus a matching word
// stream, detected language and duration in metadata.
function deepgramEnvelope({
  detected = "uk",
  duration = 132,
  withUtterances = true
} = {}) {
  const words = [
    { word: "добрий", punctuated_word: "Добрий", speaker: 0 },
    { word: "день", punctuated_word: "день,", speaker: 0 },
    { word: "це", punctuated_word: "це", speaker: 0 },
    { word: "петро", punctuated_word: "Петро.", speaker: 0 },
    { word: "вітаю", punctuated_word: "Вітаю,", speaker: 1 },
    { word: "розкажіть", punctuated_word: "розкажіть", speaker: 1 },
    { word: "про", punctuated_word: "про", speaker: 1 },
    { word: "тарифи", punctuated_word: "тарифи.", speaker: 1 }
  ];
  const results = {
    channels: [{ detected_language: detected, alternatives: [{ words }] }]
  };
  if (withUtterances) {
    results.utterances = [
      { speaker: 0, transcript: "Добрий день, це Петро." },
      { speaker: 1, transcript: "Вітаю, розкажіть про тарифи." }
    ];
  }
  return { metadata: { duration }, results };
}

// atob decode of "QUJD" is "ABC" -> bytes 65,66,67.
const AUDIO_B64 = "QUJD";

function deepgramStub(buildResponse, { ok = true, status = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok, status, json: async () => buildResponse(), text: async () => buildResponse() };
  };
  return { fetchImpl, calls };
}

test("deepgram: request shape — nova-3, diarize, Token auth, decoded body, key not in URL", async () => {
  const { fetchImpl, calls } = deepgramStub(() => deepgramEnvelope());

  await transcribeAudio({
    provider: "deepgram",
    apiKey: "dg-secret-key",
    audioB64: AUDIO_B64,
    mime: "audio/mpeg",
    fetchImpl
  });

  const [call] = calls;
  assert.match(call.url, /^https:\/\/api\.deepgram\.com\/v1\/listen\?/);
  assert.match(call.url, /model=nova-3/);
  assert.match(call.url, /diarize=true/);
  assert.match(call.url, /punctuate=true/);
  assert.match(call.url, /smart_format=true/);
  assert.match(call.url, /detect_language=true/);

  // The key rides the Authorization header, never the URL.
  assert.equal(call.init.headers.authorization, "Token dg-secret-key");
  assert.equal(call.url.includes("dg-secret-key"), false, "key must never appear in the URL");

  // Content-Type is the source mime, and the body is the decoded audio bytes.
  assert.equal(call.init.headers["content-type"], "audio/mpeg");
  assert.ok(call.init.body instanceof Uint8Array, "body is raw bytes, not a JSON string");
  assert.deepEqual([...call.init.body], [65, 66, 67], "QUJD decodes to ABC");
});

test("deepgram: diarized utterances -> Менеджер/Клиент labelled multi-line transcript", async () => {
  const { fetchImpl } = deepgramStub(() => deepgramEnvelope());

  const result = await transcribeAudio({
    provider: "deepgram",
    apiKey: "k",
    audioB64: AUDIO_B64,
    mime: "audio/wav",
    fetchImpl
  });

  assert.equal(
    result.text,
    "Менеджер: Добрий день, це Петро.\nКлиент: Вітаю, розкажіть про тарифи."
  );
  assert.equal(result.lang, "uk", "detect_language maps to lang, lowercased");
  assert.equal(result.provider, "deepgram");
  assert.equal(result.tokensIn, null);
  assert.equal(result.tokensOut, null);
  assert.equal(result.minutes, 132 / 60, "minutes come from metadata.duration");
});

test("deepgram: falls back to the diarized word stream when there are no utterances", () => {
  // Same speaker turns, reconstructed by grouping consecutive same-speaker words.
  const text = __testing.deepgramTranscript(deepgramEnvelope({ withUtterances: false }));
  assert.equal(
    text,
    "Менеджер: Добрий день, це Петро.\nКлиент: Вітаю, розкажіть про тарифи."
  );
});

test("deepgram: the first speaker to talk is Менеджер regardless of index", () => {
  // Speaker numbering starts at 1 here; whoever speaks first is still Менеджер.
  const data = {
    results: {
      utterances: [
        { speaker: 1, transcript: "Алло?" },
        { speaker: 2, transcript: "Добрий день." }
      ]
    }
  };
  assert.equal(
    __testing.deepgramTranscript(data),
    "Менеджер: Алло?\nКлиент: Добрий день."
  );
});

test("deepgram: a 500 throws deepgram_http_500 with a body snippet", async () => {
  const { fetchImpl } = deepgramStub(() => "internal error", { ok: false, status: 500 });
  await assert.rejects(
    transcribeAudio({ provider: "deepgram", apiKey: "k", audioB64: AUDIO_B64, mime: "audio/mpeg", fetchImpl }),
    /deepgram_http_500 internal error/
  );
});

test("deepgram: an empty diarization throws transcription_empty", async () => {
  const { fetchImpl } = deepgramStub(() => ({ metadata: {}, results: { utterances: [] } }));
  await assert.rejects(
    transcribeAudio({ provider: "deepgram", apiKey: "k", audioB64: AUDIO_B64, mime: "audio/mpeg", fetchImpl }),
    /transcription_empty/
  );
});

test("stt provider registry: gemini is default, deepgram is registered, models resolve", () => {
  const providers = supportedSttProviders();
  assert.deepEqual(providers, ["gemini", "deepgram"], "gemini stays first / default");
  for (const provider of providers) {
    assert.ok(defaultSttModel(provider), `${provider} has no default STT model`);
  }
  assert.equal(defaultSttModel("deepgram"), "nova-3");
  assert.equal(defaultSttModel("whisper"), null);
});
