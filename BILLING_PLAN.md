# Billing Plan

## Что уже есть

- Тарифы в API: `GET /api/billing/plans`.
- Manual checkout: `POST /api/billing/checkout`.
- Usage endpoint: `GET /api/billing/usage`.
- Локальные invoices в `server.js`.
- D1 migration для `invoices`.
- Cloudflare Worker endpoints для billing.

## MVP-логика оплаты

На старте не нужен полноценный Stripe/WayForPay checkout внутри продукта.

Достаточно:

1. Клиент выбирает пакет в `client.html`.
2. Система создает invoice в статусе `manual_payment_pending`.
3. Ты отправляешь клиенту WayForPay/Mono/банковскую ссылку вручную.
4. После оплаты вручную меняешь статус на paid в следующем слое.

## Пакеты

- Free Mini-Audit: $0, до 5 звонков, до 75 минут.
- Fatal Error Scan: $10, до 5 звонков, до 75 минут.
- Pattern Search: $50, до 20 звонков, до 300 минут.
- Custom Audit: индивидуально.

## Что добавить дальше

1. `PATCH /api/billing/invoices/:id` — вручную отметить paid/cancelled.
2. WayForPay invoice link.
3. Webhook оплаты.
4. Блокировку анализа при превышении minutesLimit.
5. Email/Telegram уведомление “оплата получена”.

## Почему пока manual

Это быстрее для первых денег. На стадии первых 1-5 клиентов важнее проверить готовность платить, чем строить идеальный биллинг.
