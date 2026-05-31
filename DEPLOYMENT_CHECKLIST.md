# Cloudflare MVP Deployment Checklist

Цель: выложить demo-room онлайн так, чтобы форма заявки работала даже при выключенном ноутбуке.

## Что публиковать

Папка: `salesradar-demo-room`

Внутри уже есть:

- `index.html` — продающая demo-room;
- `client.html` — self-service MVP workspace;
- `admin.html` — локальная операторская админка;
- `online-leads.html` — просмотр Cloudflare KV-заявок по `ADMIN_TOKEN`;
- `cloudflare-worker.example.js` — текущий Cloudflare Worker для заявок, Telegram, KV и CSV;
- `functions/api/leads.js` — альтернативный Pages Function, если позже вернемся к Pages-only режиму;
- `sample-import.csv` — пример импорта транскриптов;
- `mini-audit-template.html` — шаблон отчета;
- `server.js` — локальный ручной backend.

## Cloudflare Worker + Assets

1. Cloudflare Dashboard.
2. Workers & Pages.
3. Project: `callcontrol-ai-demo`.
4. GitHub repo: `manukianartur1997-ux/callcontrol-ai-demo`.
5. Branch: `main`.
6. Build command: `node build-pages.js`.
7. Deploy command: `npx wrangler deploy`.
8. `wrangler.toml` должен указывать:
   - `main = "cloudflare-worker.example.js"`
   - assets directory: `./dist`

## Env-переменные

В Cloudflare Worker project → Settings → Variables and Secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `ADMIN_TOKEN` — пароль-токен для просмотра онлайн-заявок через `/api/leads?token=...`

Для онлайн-таблицы заявок:

- `LEADS_KV` — KV binding для хранения заявок.

## KV для заявок

1. Workers & Pages → KV.
2. Create namespace: `CALLCONTROL_LEADS`.
3. В Worker проекте открыть Settings → Bindings.
4. Variable name: `LEADS_KV`.
5. Namespace: `CALLCONTROL_LEADS`.

Если KV не подключить, форма все равно отправит Telegram-уведомление. Просто онлайн-база заявок в Cloudflare не сохранится.

## Проверка после публикации

1. Открыть главную страницу.
2. Открыть `Client MVP`.
3. Вернуться на главную.
4. Открыть `Заявка`.
5. Отправить тестовую заявку.
6. Проверить Telegram.
7. Открыть `/api/health`, убедиться, что вернулся `ok: true`.
8. Открыть `online-leads.html`, вставить `ADMIN_TOKEN`, проверить список заявок.
9. Если Telegram не пришел, проверить env-переменные, deployment logs, правильный `TELEGRAM_CHAT_ID` и что бот уже получал сообщение от тебя.

## Что Cloudflare версия умеет

- Показывает demo-room через Worker Assets.
- Открывает client workspace как UI.
- Принимает форму `/api/leads`.
- Отправляет Telegram-уведомление.
- Сохраняет заявку в KV, если binding `LEADS_KV` подключен.
- Может отдать список заявок из KV через `GET /api/leads?token=ADMIN_TOKEN`.
- Может отдать CSV через `GET /api/leads?token=ADMIN_TOKEN&format=csv`.
- Дает страницу `online-leads.html` для просмотра заявок без Make/n8n.

## Что текущая online-версия пока не умеет без D1/R2 backend

- Локальный `server.js` на Cloudflare Pages не запускается.
- `client.html` в Cloudflare без backend не сможет реально сохранять звонки и отчеты.
- Для полного online MVP нужен один из вариантов: Cloudflare Workers + D1/R2/Queues, VPS, Supabase/Firebase или Tally/Make/Sheets как no-code база.

## Самый быстрый честный запуск

1. Cloudflare Pages для публичной demo-room и формы.
2. Telegram уведомления для новых лидов.
3. Локальный `server.js` для ручной обработки заявок и отчетов.
4. Клиенту отправлять HTML/PDF-отчет вручную.

Это уже рабочий ручной MVP без затрат на сервер.
