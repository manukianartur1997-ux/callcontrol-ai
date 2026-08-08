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
import { analyzeCall, defaultModelFor, supportedProviders, __testing } from "./ai.js";

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
