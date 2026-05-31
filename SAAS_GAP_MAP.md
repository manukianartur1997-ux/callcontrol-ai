# SaaS Gap Map

Что уже закрыто в текущем MVP и что еще нужно для настоящей SaaS.

## Уже есть

- Публичная demo-room.
- Форма заявки.
- Telegram/Cloudflare lead capture.
- Cloudflare KV lead storage.
- Онлайн-страница заявок `online-leads.html`.
- Локальная админка.
- Клиентский workspace.
- Настройки компании.
- Менеджеры.
- Кастомные чек-листы.
- Ручная загрузка транскриптов.
- CSV import.
- Mock AI-score.
- Batch-анализ pending-звонков.
- Поиск по звонкам.
- Mini-audit report markdown/html.
- Export leads CSV.
- Export state JSON.
- Optional APP_PIN.
- Invite links.
- Users and roles scaffold.
- Usage tracking по минутам.
- Audit log действий.

## Нужно для полноценной SaaS

1. Auth:
   - регистрация;
   - email/password или Google login;
   - восстановление пароля;
   - роли owner/admin/manager/viewer;
   - invite flow уже есть как MVP-заготовка.

2. Billing:
   - Stripe/WayForPay;
   - тарифы;
   - лимиты минут;
   - invoices;
   - блокировка при превышении лимита.

3. File storage:
   - загрузка аудио;
   - хранение в S3/R2;
   - удаление файлов;
   - лимиты размера.

4. AI pipeline:
   - транскрибация;
   - очередь анализа;
   - retries;
   - обработка ошибок;
   - реальные модели вместо mock-score.

5. Database:
   - Postgres/D1/Supabase;
   - миграции;
   - multi-tenant isolation;
   - backups.

6. Integrations:
   - Telegram digest;
   - CRM notes;
   - telephony API;
   - webhooks.

7. Security:
   - audit log в базе;
   - encryption at rest;
   - access policies;
   - data retention;
   - export/delete company data.

## Следующий лучший технический шаг

Перенести локальный `server.js` на нормальный backend:

- быстрый вариант: VPS + Node + SQLite;
- аккуратный serverless вариант: Cloudflare Workers + D1 + R2 + Queues;
- самый быстрый no-code вариант: Cloudflare Pages + KV + Make/Sheets.

Каркас Cloudflare Workers + D1 + R2 + Queues уже добавлен в `cloudflare/`.

Для первых лидов достаточно текущей схемы:

Cloudflare Pages для формы → Telegram/KV → локальная обработка через `server.js` → HTML/PDF отчет клиенту.
