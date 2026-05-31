# Production Roadmap

## Слой 1: сейчас уже готово

- Demo-room.
- Online lead capture.
- Manual MVP backend.
- Client workspace.
- Admin workspace.
- Mini-audit report.
- Cloudflare lead function.

## Слой 2: минимальный online MVP

Цель: убрать зависимость от включенного ноутбука.

Нужно:

- Cloudflare D1 schema.
- Worker API.
- KV/D1 lead storage.
- Worker endpoint для calls/reports.
- Client UI на Worker API.
- Telegram notification.

Статус: заготовка создана в `cloudflare/`.

## Слой 3: self-service SaaS

Цель: клиент сам регистрируется и получает отчет.

Нужно:

- Auth.
- Organization/account model.
- Role-based access.
- Upload transcripts.
- Generate report.
- Usage limits.
- Simple billing/manual invoice.

## Слой 4: SaaS на 100 пользователей

Цель: стабильность для первых платящих клиентов.

Нужно:

- R2 для аудио.
- Queue для анализа.
- D1/Postgres.
- Backups.
- Error logging.
- Rate limiting.
- Admin tools.
- Delete/export data.

## Слой 5: SaaS на 1000 пользователей

Цель: масштаб и контроль расходов.

Нужно:

- Observability.
- Worker queues/retries/dead-letter queue.
- Cost dashboard по AI.
- Billing automation.
- Team permissions.
- Telephony integrations.
- CRM webhooks.
- Security review.
- Separate environments: dev/staging/prod.

## Рекомендованный ближайший порядок

1. Выложить current demo-room на Cloudflare Pages.
2. Проверить Telegram lead capture.
3. Поднять D1 Worker из `cloudflare/`.
4. Подключить `client.html` к Worker API.
5. Добавить R2 upload.
6. Подключить реальную транскрибацию.
7. Подключить платежку.

## Что добавлено в v19

- Billing endpoints.
- Manual invoice flow.
- Files table/register endpoint.
- Cloudflare migration для invoices/files/api keys.
- AI pipeline plan.

## Что добавлено в v20

- Invite flow.
- Users/roles UI.
- Local auth endpoints.
- Cloudflare migration для invites/sessions.
- Worker endpoints для invites.
