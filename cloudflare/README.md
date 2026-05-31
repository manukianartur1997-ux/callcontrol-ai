# Cloudflare Production Track

Это не замена текущей demo-room, а заготовка для переноса MVP в serverless SaaS.

## Что внутри

- `migrations/0001_initial.sql` — D1-схема для organizations, users, managers, calls, reports, leads, jobs, audit log, subscriptions.
- `migrations/0002_billing_files.sql` — invoices, files, api keys.
- `migrations/0003_auth_invites.sql` — invites and sessions.
- `src/worker.js` — Worker API-каркас.
- `wrangler.toml.example` — пример привязок D1/R2/Queues.

## Как развернуть

1. Установить Wrangler.
2. Создать D1:

   ```bash
   wrangler d1 create callcontrol-ai
   ```

3. Вставить `database_id` в `wrangler.toml`.
4. Применить миграцию:

   ```bash
   wrangler d1 migrations apply callcontrol-ai
   ```

5. Создать R2 bucket:

   ```bash
   wrangler r2 bucket create callcontrol-audio
   ```

6. Создать queue:

   ```bash
   wrangler queues create callcontrol-analysis
   ```

7. Добавить secrets:

   ```bash
   wrangler secret put ADMIN_TOKEN
   wrangler secret put TELEGRAM_BOT_TOKEN
   wrangler secret put TELEGRAM_CHAT_ID
   ```

8. Деплой:

   ```bash
   wrangler deploy
   ```

## Что уже покрывает Worker

- `POST /api/leads`
- `GET /api/leads`
- `GET /api/state`
- `PATCH /api/workspace`
- `POST /api/calls`
- `POST /api/calls/import-csv`
- `GET /api/calls`
- `GET /api/search`
- `POST /api/reports/mini-audit`
- `GET /api/billing/plans`
- `POST /api/billing/checkout`
- `GET /api/billing/usage`
- `POST /api/files/register`
- `GET /api/me`
- `POST /api/invites`
- `POST /api/invites/accept`
- queue consumer для анализа звонков

## Что еще нужно доделать перед боем

- Настоящий auth вместо `ADMIN_TOKEN`.
- Signed upload URL для аудио в R2.
- Настоящая транскрибация и LLM-анализ.
- Billing webhook.
- Rate limits.
- Организации по subdomain/custom domain.
- UI подключить к Worker API вместо локального `server.js`.
