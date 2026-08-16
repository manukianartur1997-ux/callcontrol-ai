-- CallControl: per-org STT (speech-to-text) provider choice + Deepgram key.
--
-- Apply AFTER 0001-0006. Worker degrades gracefully until this lands: the
-- pipeline defaults to Gemini STT, and GET/PUT /stt answer 503 migration_required.
-- Idempotent (add column if not exists).
--
-- WHY on organizations (not org_ai_keys): STT is org-level config, and the
-- analysis provider enum (app.ai_provider) is gemini/anthropic/openai — Deepgram
-- is STT-only, so its key lives here alongside the provider choice rather than
-- stretching the analysis-provider enum. The key is stored ENCRYPTED (AES-GCM
-- envelope, same as org_ai_keys.key_ciphertext); only the 4-char hint is ever
-- shown. Selecting 'deepgram' requires a key (enforced in the worker).
alter table organizations
  add column if not exists stt_provider text not null default 'gemini'
    check (stt_provider in ('gemini', 'deepgram')),
  add column if not exists stt_deepgram_key_ciphertext text,
  add column if not exists stt_deepgram_key_hint text;
