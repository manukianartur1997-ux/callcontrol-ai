// Provider-agnostic call analysis.
//
// One internal contract, three drivers. The organization chooses the provider
// and supplies its own API key (BYO), so the same transcript must produce the
// same shaped result whichever backend runs it.
//
// Raw fetch rather than a vendor SDK on purpose: this file's whole job is to
// hold three providers behind one interface, and mixing one SDK with two
// hand-rolled clients would make the drivers inconsistent with each other.
// Every request shape below follows the provider's documented wire format.
//
// Nothing here mutates the database. The caller (api.js) owns quota checks,
// key decryption and persistence — this module takes a key and text and
// returns a parsed analysis plus token counts.

// ---------------------------------------------------------------------------
// Result contract
// ---------------------------------------------------------------------------
// analyzeCall() resolves to:
// {
//   score: 0-100,
//   summary: string,
//   items:    [{ key, score, evidence, comment }],   // one per checklist item
//   leaks:    [{ title, severity, detail, money_impact }],
//   coaching: [{ title, detail }],
//   next_step: { present: bool, detail: string },
//   provider, model, tokensIn, tokensOut
// }

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "summary", "items", "leaks", "coaching", "next_step"],
  properties: {
    score: { type: "integer", description: "Итоговый балл звонка, 0-100" },
    summary: { type: "string", description: "2-3 предложения: что произошло на звонке" },
    items: {
      type: "array",
      description: "По одному объекту на каждый пункт чек-листа, в том же порядке",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "score", "evidence", "comment"],
        properties: {
          key: { type: "string", description: "key пункта чек-листа" },
          score: { type: "integer", description: "0-100 по этому пункту" },
          evidence: { type: "string", description: "Дословная цитата из транскрипта или пустая строка" },
          comment: { type: "string", description: "Одно предложение: почему такой балл" }
        }
      }
    },
    leaks: {
      type: "array",
      description: "Где на этом звонке потеряны деньги. Пусто, если потерь нет.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "severity", "detail", "money_impact"],
        properties: {
          title: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          detail: { type: "string" },
          money_impact: { type: "string", description: "Как это влияет на выручку, словами" }
        }
      }
    },
    coaching: {
      type: "array",
      description: "Что менеджеру делать иначе. Максимум 3, самое важное первым.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail"],
        properties: { title: { type: "string" }, detail: { type: "string" } }
      }
    },
    next_step: {
      type: "object",
      additionalProperties: false,
      required: ["present", "detail"],
      properties: {
        present: { type: "boolean", description: "Зафиксирован ли конкретный следующий шаг" },
        detail: { type: "string" }
      }
    }
  }
};

const SYSTEM_PROMPT = `Ты — руководитель отдела продаж, который разбирает звонок менеджера.

Оценивай только то, что слышно в транскрипте. Не додумывай: если пункт
чек-листа в разговоре не затрагивался, ставь низкий балл и пиши это прямо,
а не предполагай, что менеджер «наверное сделал это за кадром».

В evidence приводи дословную цитату из транскрипта. Если подтверждения в
тексте нет — пустая строка, а не пересказ.

Итоговый score — взвешенная сумма пунктов по их весам, а не среднее.

Пиши на языке транскрипта. Формулировки — как для живого РОПа: коротко,
конкретно, без обтекаемых советов вроде «улучшить коммуникацию».`;

function buildUserPrompt({ checklist, transcript, context }) {
  const items = (checklist?.items || [])
    .map((item) => `- ${item.key} (вес ${item.weight}) — ${item.label}: ${item.hint || ""}`)
    .join("\n");

  const meta = [
    context?.managerName && `Менеджер: ${context.managerName}`,
    context?.direction && `Направление звонка: ${context.direction}`,
    context?.durationSec && `Длительность: ${Math.round(context.durationSec / 60)} мин`
  ]
    .filter(Boolean)
    .join("\n");

  return `Чек-лист (оцени каждый пункт, ключи возвращай ровно как здесь):
${items}

${meta ? `Контекст звонка:\n${meta}\n` : ""}
Транскрипт:
"""
${transcript}
"""`;
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------

const DEFAULT_MODELS = {
  anthropic: "claude-opus-5",
  // A rolling alias: always points at the current stable Gemini Flash.
  // Pinned version ids (gemini-2.5-flash etc.) 404 for keys created after that
  // version was superseded, even though they still appear in the models list.
  gemini: "gemini-flash-latest",
  openai: "gpt-5"
};

const MAX_OUTPUT_TOKENS = 8000;

async function readError(response) {
  const body = await response.text().catch(() => "");
  return `${response.status} ${body.slice(0, 400)}`;
}

// Anthropic Messages API. Structured outputs via output_config.format, so the
// first text block is guaranteed-parseable JSON.
//
// Note: temperature / top_p / top_k are rejected on current Claude models —
// steer with the prompt instead, do not add them back.
async function runAnthropic({ apiKey, model, system, user, fetchImpl }) {
  const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema: ANALYSIS_SCHEMA } }
    })
  });

  if (!response.ok) throw new Error(`anthropic_http_${await readError(response)}`);
  const data = await response.json();

  // A safety classifier can decline with HTTP 200 — check before reading content.
  if (data.stop_reason === "refusal") {
    throw new Error(`anthropic_refusal_${data.stop_details?.category || "unknown"}`);
  }
  if (data.stop_reason === "max_tokens") throw new Error("anthropic_truncated");

  const text = (data.content || []).find((block) => block.type === "text")?.text;
  if (!text) throw new Error("anthropic_empty_response");

  return {
    text,
    tokensIn: data.usage?.input_tokens ?? null,
    tokensOut: data.usage?.output_tokens ?? null
  };
}

// Google AI Studio (Gemini). The free tier is the zero-cost path for pilots —
// see the data-retention warning surfaced in the cabinet before enabling it.
async function runGemini({ apiKey, model, system, user, fetchImpl }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(ANALYSIS_SCHEMA),
        maxOutputTokens: MAX_OUTPUT_TOKENS
      }
    })
  });

  if (!response.ok) throw new Error(`gemini_http_${await readError(response)}`);
  const data = await response.json();

  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === "SAFETY") throw new Error("gemini_safety_block");
  if (candidate?.finishReason === "MAX_TOKENS") throw new Error("gemini_truncated");

  const text = candidate?.content?.parts?.map((part) => part.text).join("") || "";
  if (!text) throw new Error("gemini_empty_response");

  return {
    text,
    tokensIn: data.usageMetadata?.promptTokenCount ?? null,
    tokensOut: data.usageMetadata?.candidatesTokenCount ?? null
  };
}

// Gemini's responseSchema is OpenAPI-flavoured: it rejects the JSON Schema
// keywords `additionalProperties` and `$schema`, and wants uppercase types.
function toGeminiSchema(node) {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (node === null || typeof node !== "object") return node;

  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "additionalProperties" || key === "$schema") continue;
    if (key === "type" && typeof value === "string") {
      out.type = value.toUpperCase();
      continue;
    }
    out[key] = toGeminiSchema(value);
  }
  return out;
}

async function runOpenAI({ apiKey, model, system, user, fetchImpl }) {
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "call_analysis", strict: true, schema: ANALYSIS_SCHEMA }
      }
    })
  });

  if (!response.ok) throw new Error(`openai_http_${await readError(response)}`);
  const data = await response.json();

  const choice = data.choices?.[0];
  if (choice?.finish_reason === "length") throw new Error("openai_truncated");
  const text = choice?.message?.content;
  if (!text) throw new Error("openai_empty_response");

  return {
    text,
    tokensIn: data.usage?.prompt_tokens ?? null,
    tokensOut: data.usage?.completion_tokens ?? null
  };
}

const DRIVERS = { anthropic: runAnthropic, gemini: runGemini, openai: runOpenAI };

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function defaultModelFor(provider) {
  return DEFAULT_MODELS[provider] || null;
}

export function supportedProviders() {
  return Object.keys(DRIVERS);
}

export async function analyzeCall({
  provider,
  apiKey,
  model,
  transcript,
  checklist,
  context = {},
  fetchImpl = fetch
}) {
  const driver = DRIVERS[provider];
  if (!driver) throw new Error(`unsupported_provider_${provider}`);
  if (!apiKey) throw new Error("api_key_missing");

  const text = String(transcript || "").trim();
  if (text.length < 40) throw new Error("transcript_too_short");

  const chosenModel = model || DEFAULT_MODELS[provider];
  const result = await driver({
    apiKey,
    model: chosenModel,
    system: SYSTEM_PROMPT,
    user: buildUserPrompt({ checklist, transcript: text, context }),
    fetchImpl
  });

  let parsed;
  try {
    parsed = JSON.parse(result.text);
  } catch (_) {
    throw new Error("analysis_not_json");
  }

  return {
    ...normalizeAnalysis(parsed, checklist),
    provider,
    model: chosenModel,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut
  };
}

// Schema enforcement is per-provider and imperfect. Clamp and backfill here so
// downstream code and the dashboard never have to defend against a stray shape.
function normalizeAnalysis(raw, checklist) {
  const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const byKey = new Map(
    (Array.isArray(raw?.items) ? raw.items : []).map((item) => [item?.key, item])
  );

  const items = (checklist?.items || []).map((definition) => {
    const found = byKey.get(definition.key) || {};
    return {
      key: definition.key,
      label: definition.label,
      weight: definition.weight,
      score: clamp(found.score),
      evidence: String(found.evidence || ""),
      comment: String(found.comment || "")
    };
  });

  // Recompute the weighted score locally rather than trusting the model's
  // arithmetic — the number drives the dashboard and must be reproducible.
  const totalWeight = items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  const computed = totalWeight
    ? Math.round(items.reduce((sum, i) => sum + i.score * (Number(i.weight) || 0), 0) / totalWeight)
    : clamp(raw?.score);

  return {
    score: computed,
    summary: String(raw?.summary || ""),
    items,
    leaks: (Array.isArray(raw?.leaks) ? raw.leaks : []).map((leak) => ({
      title: String(leak?.title || ""),
      severity: ["low", "medium", "high"].includes(leak?.severity) ? leak.severity : "medium",
      detail: String(leak?.detail || ""),
      money_impact: String(leak?.money_impact || "")
    })),
    coaching: (Array.isArray(raw?.coaching) ? raw.coaching : [])
      .slice(0, 3)
      .map((tip) => ({ title: String(tip?.title || ""), detail: String(tip?.detail || "") })),
    next_step: {
      present: Boolean(raw?.next_step?.present),
      detail: String(raw?.next_step?.detail || "")
    }
  };
}

export const __testing = { ANALYSIS_SCHEMA, toGeminiSchema, normalizeAnalysis, buildUserPrompt };
