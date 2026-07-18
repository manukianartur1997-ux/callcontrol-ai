# CallControl AI Demo Room

Кликабельная демо-комната + ручной MVP backend для приема заявок, загрузки транскриптов, mock AI-анализа и генерации mini-audit отчетов.

## GTM / Sales Pack

Рабочий GTM-пакет под UA EdTech лежит в:

`callcontrol-gtm/00_START_HERE.md`

Там собраны финальный offer ladder, outreach-сообщения, discovery script, objection handling, lead research playbook, шаблоны diagnostic/report/proposal и outreach tracker.

## Как открыть локально

Без backend можно просто открыть файл:

`salesradar-demo-room/index.html`

Форма в таком режиме покажет demo-сообщение, но не сохранит заявку.

## Автодеплой

Проект готов к схеме `GitHub push -> GitHub Actions -> Cloudflare Workers`.

Workflow лежит в `.github/workflows/deploy-cloudflare.yml` и делает:

1. checkout кода;
2. сборку `dist` через `node build-pages.js`;
3. smoke-check;
4. деплой через `npx wrangler@latest deploy`.

Для работы workflow в GitHub repository secrets должны быть:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Как запустить рабочий MVP локально

Если Node.js доступен:

```bash
cd salesradar-demo-room
npm start
```

Если `npm` недоступен, можно так:

```bash
cd salesradar-demo-room
node server.js
```

Пример переменных окружения лежит в `.env.example`.

Опциональная защита локального MVP:

```bash
APP_PIN=1234 node server.js
```

Тогда админка и клиентский кабинет попросят PIN. Публичная форма заявки продолжит работать без PIN.

Открой:

`http://localhost:8787`

Публичный лендинг (и локально, и на проде) линкует только на кликабельную платформу — она статична и не дергает backend API, поэтому безопасно работает и задеплоенной:

`http://localhost:8787/platform/`

`client.html` и `admin.html` — это ручной операторский MVP. Они работают ТОЛЬКО локально через `server.js` (там реализованы `/api/dashboard`, `/api/state`, `/api/calls`, `/api/billing/*` и т.д.) и намеренно НЕ попадают в `dist/` при билде для Cloudflare Pages — на статическом проде этих API-роутов нет, а ссылки на них вели бы в никуда или к пустой "админке" без данных. Публичный лендинг на них больше не ссылается.

Операторская админка (только локально):

`http://localhost:8787/admin.html`

Клиентский MVP-кабинет (только локально):

`http://localhost:8787/client.html`

Онлайн-заявки Cloudflare KV:

`/online-leads.html`

Заявки сохраняются локально в:

`salesradar-demo-room/data/leads.jsonl`

Проверить заявки можно по адресу:

`http://localhost:8787/api/leads`

Демо можно быстро наполнить 50 звонками:

1. Открой `http://localhost:8787/admin.html`
2. Нажми `Загрузить 50 demo calls`
3. Нажми `Сгенерировать mini-audit`

Если старая SaaS-папка рядом есть, сервер возьмет старый seed. Если ее нет, сервер сам сгенерирует 50 demo-звонков, поэтому папку можно переносить отдельно.

## Быстрые API

- `GET /api/state` — все состояние MVP
- `GET /api/me` — пользователи, роли и invite list
- `POST /api/invites` — создать invite-ссылку
- `POST /api/invites/accept` — принять invite
- `PATCH /api/users/:id` — обновить роль/активность пользователя
- `PATCH /api/workspace` — обновить компанию, нишу и менеджеров
- `POST /api/checklists` — добавить кастомный чек-лист
- `GET /api/export/state.json` — выгрузить состояние MVP
- `GET /api/billing/plans` — тарифы
- `POST /api/billing/checkout` — manual invoice/checkout
- `GET /api/billing/usage` — usage и invoices
- `POST /api/files/register` — зарегистрировать файл/ссылку
- `GET /api/dashboard` — KPI, value at risk, рейтинг менеджеров
- `GET /api/calls` — список звонков
- `GET /api/search?q=дорого` — поиск по звонкам, цитатам, тегам и рекомендациям
- `POST /api/calls` — добавить звонок/транскрипт
- `POST /api/calls/import-csv` — импорт пачки транскриптов из CSV
- `POST /api/calls/:id/analyze` — mock AI-анализ звонка
- `POST /api/jobs/analyze-pending` — batch-анализ всех ожидающих звонков
- `POST /api/reports/mini-audit` — создать mini-audit markdown
- `POST /api/leads/:id/report` — создать mini-audit markdown под конкретную заявку
- `GET /api/reports` — список отчетов
- `PATCH /api/leads/:id` — обновить статус заявки
- `POST /api/demo/load-legacy-seed` — загрузить старый seed или сгенерировать 50 demo calls
- `POST /api/demo/reset` — сбросить demo-состояние
- `GET /api/reports/:id.md` — скачать отчет markdown
- `GET /api/reports/:id.html` — открыть клиентский HTML-отчет
- `GET /api/leads.csv` — выгрузить заявки в CSV

Если задан `APP_PIN`, защищенные API принимают заголовок `X-App-Pin` или query `?pin=...`.

## Ручной MVP workflow

1. Клиент оставляет заявку в форме.
2. Оператор открывает `http://localhost:8787/admin.html`.
3. Статус заявки переводится в `02_DATA_CHECK`.
4. Транскрипты добавляются вручную или через CSV import. Пример есть в `sample-import.csv`.
5. Звонки проходят mock AI-анализ.
6. Оператор генерирует mini-audit report и открывает клиентскую ссылку `.html`.
7. Заявка переводится в `04_READY`, затем `05_SENT`.
8. После фидбека заявка переводится в `06_FOLLOW_UP` или `07_CONVERTED`.

## Как опубликовать бесплатно

### Вариант 1: Netlify Drop

1. Открой `https://app.netlify.com/drop`
2. Перетащи папку `salesradar-demo-room`
3. Получишь публичную ссылку

### Вариант 2: Cloudflare Pages

1. Открой Cloudflare Dashboard
2. Workers & Pages
3. Create application
4. Pages
5. Upload assets или подключи GitHub
6. Выбери папку `salesradar-demo-room`
7. Добавь переменные окружения Pages Functions:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `ADMIN_TOKEN` для просмотра заявок через GET `/api/leads?token=...`
8. Опционально подключи KV binding `LEADS_KV`, чтобы заявки сохранялись в Cloudflare.

В папке уже есть `functions/api/leads.js`. На Cloudflare Pages форма будет отправлять заявку в `/api/leads`, функция отправит уведомление в Telegram и сохранит заявку в KV, если binding подключен. Токен нельзя вставлять в HTML.

Для следующего шага к полноценной SaaS есть отдельный Cloudflare Worker/D1/R2/Queues каркас: `cloudflare/`.

Продовая дорожная карта: `PRODUCTION_ROADMAP.md`.

Billing план: `BILLING_PLAN.md`.

AI/transcription план: `AI_PIPELINE_PLAN.md`.

Подробный чек-лист деплоя: `DEPLOYMENT_CHECKLIST.md`.

Для следующего шага к полноценной SaaS есть отдельный Cloudflare Worker/D1/R2/Queues каркас: `cloudflare/`.

Продовая дорожная карта: `PRODUCTION_ROADMAP.md`.

## Что нужно заменить перед публикацией

Сейчас локальный backend сохраняет заявки только на компьютере, где запущен сервер.

Для публикации на Cloudflare Pages нужен один из вариантов:

- Cloudflare Worker `/api/leads` -> Telegram/Google Sheets;
- Tally/Google Form;
- Make/n8n webhook.

Для быстрого запуска лучше Cloudflare Pages Function, потому что она работает даже если ноутбук выключен.

## Что показывает демка

- Dashboard с Value at Risk
- Risk Calls
- Call Detail с цитатой ошибки
- ROP Heatmap
- Manager Coaching
- Weekly Report
- Use Cases
- Sample Report
- Implementation path
- FAQ
- Offer ladder: Free / $10 / $50 / Custom
- Форма заявки на free mini-audit
- Client workspace: `client.html`
- Workspace settings: компания, ниша, менеджеры, кастомный чек-лист
- Optional APP_PIN, usage tracking, audit log и batch-анализ pending-звонков

## Готовность по этапам

- Предпоказ людям: 100% — можно давать ссылку на демо и собирать обратную связь.
- Ручной MVP: 97-98% — заявки, импорт транскриптов, анализ, статусы, отчеты, playbook и экспорт уже есть; нужен реальный прогон на твоем ноуте.
- Online lead capture: 92-95% — Cloudflare Function готова; осталось добавить env-переменные, KV binding и проверить Telegram.
- Self-service SaaS: 60-70% — есть client workspace, настройки компании, менеджеры, чек-листы, анализ, поиск и отчеты; нужен настоящий auth, платежи, хранение файлов и очередь AI.
- 100 пользователей: 45-50% — нужна продовая база, лимиты, очередь, мониторинг, права доступа.
- 1000 пользователей: 15-25% — нужна нормальная cloud-архитектура, биллинг, observability, безопасность и масштабируемое хранилище.
