# Platform ops — self-healing, alerts, rate limiting, status

Operator-facing reference (migration 0008). Nothing here is client-facing —
these are the pieces that keep the platform running itself without you
babysitting every pilot company's pipeline by hand. All require the SQL in
`saas/migrations/APPLY_0004_0008.sql` to be applied (docs/PILOT_ONBOARDING.md
step 0); everything below is a silent no-op before that.

## Self-healing retry sweep

Runs every 30 minutes (`wrangler.toml` cron `*/30 * * * *`). A call stuck on a
setup gap that may now be fixed retries itself:

- `pending` with `ai_key_missing` or `no_recording` (a telephony call whose AI
  key or PBX credentials were added after the fact) — re-runs the ingest
  pipeline (`sweepStuckCalls` → `runIngestPipeline`, same code path as the
  cabinet's "Повторить обработку" button).
- `transcribed` with no default checklist yet, or a transient analysis error
  (`retryTranscribedAnalysis`) — re-scores using the saved transcript, no
  second speech-to-text charge. Reserves a NEW quota slot, exactly like a
  human clicking "Re-analyze" would.

Capped at 8 attempts per call (`RETRY_MAX_ATTEMPTS` in `saas/worker/api.js`,
~4 hours of headroom) so a permanently broken org (a revoked PBX credential,
say) does not retry forever. A call that exhausts its attempts just stays
visibly stuck in the cabinet — no data loss, no silent failure, someone has to
look at it once.

## Platform Telegram alerts

A **separate** channel from any client's own `telegram_recipients` — this one
is for you. Set it up once:

```
wrangler secret put PLATFORM_ALERT_CHAT_ID
```

(the numeric chat id of your own Telegram chat/group with the bot — same bot
as `TELEGRAM_BOT_TOKEN`, which must also be set).

Once both secrets exist, `platformDigest` sends a daily summary at 17:00 UTC
(same cron tick as the per-client digest): total orgs, total stuck calls
broken down by org, and any org at or above 80% of its monthly quota. It
always sends — even "0 stuck" — so the message itself is proof the cron is
alive; a day with no message means the cron stopped firing, not that nothing
happened.

## Webhook rate limit

A courtesy backstop, not the real spend limit — that stays
`monthly_call_quota` (a leaked token cannot make you overspend on AI calls
regardless of this). What it DOES protect against: a leaked or misbehaving
webhook token flooding the endpoint with HTTP requests and bloating
`audit_log` with junk rows forever. Capped at 120 events/minute per
integration (`WEBHOOK_RATE_LIMIT_PER_MINUTE`), fails OPEN on any error (a
missing table or a Supabase hiccup never blocks a real vendor's traffic). Over
the cap, the request is still acked normally — the sender is never told it was
rate-limited — and nothing is written. Stale minute-buckets are swept daily
inside the existing retention purge job.

## GET /api/app/status

Public, unauthenticated, no secrets in the response. Answers two questions
without needing to be logged in or to curl-probe authenticated routes:

```
curl https://callcontrol-ai-demo.manukianartur1997.workers.dev/api/app/status
```

```json
{
  "ok": true,
  "supabase_configured": true,
  "supabase_reachable": true,
  "migrations": {
    "0005_billing_retention": true,
    "0007_stt_provider": true,
    "0008_ops_hardening": true
  }
}
```

`ok: false` with `supabase_configured: false` means the Worker has no
Supabase secrets set at all (a fresh deploy). Otherwise `ok` mirrors
`supabase_reachable`. Each migration flag is a live probe of a column that
migration introduces — `false` means "not applied yet," not "broken." Useful
for a external uptime monitor, or just for you to check "did the SQL land"
without me inferring it from a chain of authenticated-route probes.

## Bulk team add

`POST /orgs/:id/members/bulk` (cabinet: Settings → Команда → «Додати
списком»), up to 50 rows per request. Each row gets its own freshly generated
password, returned once in the response — nothing is logged, nothing is
stored in plaintext beyond that one response. One bad row (duplicate email,
invalid role) never aborts the rest of the batch; each row reports its own
`{ok, error}` or `{ok, user_id, password}`.

## Per-call feedback

`analysis_feedback` (migration 0008) — no worker route, written directly by
the cabinet via `supabase-js` under RLS (same pattern as `dashboard_prefs`).
Visibility follows the call exactly (the same
`exists (select 1 from calls c where c.id = call_id)` idiom as
`transcript_select`); writes require `actor_id = auth.uid()` and a non-viewer
role. One vote per (call, person) via `unique(call_id, actor_id)` + upsert —
voting again replaces the previous vote, it does not duplicate it. This has no
platform-level surface yet (no aggregate dashboard); it exists to start
collecting signal on whether the scoring is actually useful before building
anything on top of it.
