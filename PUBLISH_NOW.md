# Быстрая публикация CallControl AI

Цель: GitHub -> Cloudflare Worker + Assets, чтобы все правки автоматически обновлялись по одной публичной ссылке.

## Что уже готово

- `index.html` — публичная демо-витрина.
- `client.html` — self-service кабинет клиента.
- `admin.html` — ручная операторская админка.
- `online-leads.html` — просмотр заявок из Cloudflare KV.
- `cloudflare-worker.example.js` — текущий online Worker для приема заявок, Telegram-уведомлений, KV-хранения и CSV.
- `functions/api/leads.js` — запасной вариант под Cloudflare Pages Functions.
- `cloudflare/` — следующий слой для Worker + D1 + R2 + Queues.

## Вариант А: быстро через GitHub + Cloudflare Worker

1. GitHub repo уже подключен к Cloudflare.
2. Cloudflare: `Workers & Pages` -> проект `callcontrol-ai-demo`.
3. Build/deploy настройки:
   - Root directory: `/`
   - Build command: `node build-pages.js`
   - Deploy command: `npx wrangler deploy`
   - Output/assets берутся из `dist/` через `wrangler.toml`.
4. При push в `main` Cloudflare автоматически пересобирает demo-room.

## Переменные для формы заявок

В Cloudflare Worker project -> Settings -> Variables and Secrets добавь:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `ADMIN_TOKEN` — пароль для `/online-leads.html` и `/api/leads`.

Токены не вставлять в HTML и не коммитить в GitHub.

## KV для хранения заявок

1. Cloudflare -> Workers & Pages -> KV.
2. Create namespace: `CALLCONTROL_LEADS`.
3. В Worker project -> Settings -> Bindings.
4. Add binding -> KV namespace.
5. Variable name: `LEADS_KV`.
6. Namespace: `CALLCONTROL_LEADS`.

После этого:

- форма отправляет заявку в `/api/leads`;
- Telegram получает уведомление;
- заявка сохраняется в KV;
- заявки можно смотреть через `/online-leads.html`;
- CSV можно скачать через `/api/leads?token=ADMIN_TOKEN&format=csv`.

Если KV не подключен, заявка все равно принимается и Telegram может приходить, но онлайн-таблица заявок будет писать `KV не подключен`.

## Проверка после публикации

1. Открыть публичную ссылку Cloudflare Pages.
2. Отправить тестовую заявку.
3. Проверить Telegram.
4. Открыть `/online-leads.html`.
5. Ввести `ADMIN_TOKEN`.
6. Убедиться, что заявка видна в таблице.

## Если нужен временный короткий адрес

Cloudflare даст адрес вида:

`https://project-name.pages.dev`

Для старта это бесплатно и достаточно. Домен можно подключить позже.
