const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "dist");

const samples = {
  "edtech-ua-sample-report.md": `# CallControl AI — sample report

**SAMPLE REPORT — приклад структури, не реальний клієнт**

## Короткий висновок
EdTech-школа втрачає гроші не через якість лідів, а через провали на discovery-дзвінку: ціна звучить до цінності, а наступний крок не фіксується.

## Value at Risk
Розрахунок у реальному звіті будується на ваших заявках, середньому чеку і конверсії.

## Call Evidence
> M-2: "У нас курс коштує 14,500 грн."
>
> Клієнт: "Зрозуміло, я подумаю."

## Action Plan
30 днів: виправити discovery і next step.
60 днів: тренувати слабкі патерни по менеджерах.
90 днів: перевірити повторний зріз і оновити скрипт.
`,
  "b2b-saas-ru-sample-report.md": `# CallControl AI — пример структуры отчёта

**SAMPLE REPORT — структура отчёта, не реальный клиент**

## Executive Summary
Команда теряет pipeline между discovery и demo: контекст теряется между SDR и AE, а prospect повторяет один и тот же use case.

## Value at Risk
Расчёт строится от вашего ACV, количества SQL и текущей конверсии SQL → closed-won.

## Call Evidence
> AE: "Расскажите, что хотели бы посмотреть?"
>
> Prospect: "Мы уже подробно объяснили это на прошлом звонке."

## Action Plan
1. Ввести SDR → AE handoff template.
2. Заменить product tour на use-case demo.
3. Добавить scoring для следующего шага.
`,
  "agency-ru-sample-report.md": `# CallControl AI — пример структуры отчёта для агентства

**SAMPLE REPORT — структура отчёта, не реальный клиент**

## Executive Summary
Агентство теряет заявки на pre-sales звонках: founder быстро уходит в детали работ и не фиксирует бизнес-критерии решения.

## Action Plan
1. Добавить business discovery перед описанием услуг.
2. Перенести разговор о цене после value framing.
3. Завершать звонок конкретным decision step.
`,
};

const ru = {
  lang: "ru",
  url: "/ru/",
  title: "CallControl AI — аудит звонков отдела продаж",
  desc: "AI-аудит звонков отдела продаж: 20-50 записей, PDF-отчёт, Value at Risk, рейтинг менеджеров и план действий.",
  nav: ["Как работает", "Пример отчёта", "Форматы", "FAQ", "Запросить аудит"],
  badge: "AI-аудит звонков · done-for-you",
  h1: "Аудит звонков отдела продаж за 5 рабочих дней",
  lead: "Найдём, где теряются деньги в воронке. Вернём PDF с конкретными цитатами, рейтингом менеджеров, Marketing vs Sales verdict и планом действий.",
  cta: "Запросить аудит",
  sample: "Посмотреть пример",
  trust: [["20-50", "звонков в одном аудите"], ["5-7", "рабочих дней до отчёта"], ["30/60/90", "план действий для РОПа"]],
  proofTitle: "Что получает руководитель",
  proof: [["Value at Risk", "Оценка денег под риском в текущей воронке.", "$8.4k"], ["Manager Ranking", "Кто держит стандарт, а кому нужен коучинг.", "5 ролей"], ["Marketing vs Sales", "Где проблема: качество лида, продажа или оффер.", "verdict"], ["Call Evidence", "Цитаты с таймкодами вместо общих мнений.", "4+ блока"]],
  sampleTitle: "Так выглядит пример отчёта",
  sampleLead: "Синтетический пример показывает структуру будущего отчёта: короткий вывод, Value at Risk, цитаты, рейтинг менеджеров и action plan.",
  sampleNote: "Важно: пример не является кейсом реального клиента. Все цифры и цитаты нужны только для демонстрации формата.",
  sampleFile: "/samples/b2b-saas-ru-sample-report.md",
  cards: [["Короткий вывод", "Один главный вывод, top-3 приоритета и где теряется выручка."], ["Value at Risk", "Расчёт impact от провалов в звонках на вашем baseline."], ["Call Quotes", "Конкретные фразы менеджеров и объяснение, почему сделка остывает."], ["Action Plan", "Что исправить в первые 30, 60 и 90 дней."]],
  processTitle: "Как проходит аудит",
  processLead: "Без сложной интеграции и долгого внедрения. Сначала услуга, потом автоматизация там, где она действительно нужна.",
  steps: [["01", "Заявка и короткий звонок", "Уточняем сегмент, объём звонков, формат записей и главный вопрос аудита."], ["02", "Передача записей", "Вы передаёте записи или транскрипты через Drive/Dropbox. При необходимости подписываем NDA."], ["03", "AI-разбор и ручное ревью", "Каждый звонок проходит структурный анализ. Финальные выводы проверяются вручную."], ["04", "PDF и walk-through", "Вы получаете отчёт и разбор: что чинить первым, кого коучить и что вынести на планёрку."]],
  leakTitle: "Где обычно течёт выручка",
  leakLead: "Аудит не спорит абстрактно о плохих лидах. Он разделяет ответственность между маркетингом, продажами и процессом.",
  leaks: [["Discovery", "Менеджер говорит про продукт до того, как понял боль, бюджет и timing.", "высокий риск"], ["Next Step", "Звонок заканчивается “я перезвоню” без даты, времени и договорённости.", "частый leak"], ["Offer Fit", "Клиент пришёл с одним ожиданием, а продажа презентует другой оффер.", "marketing/sales"], ["Price Talk", "Цена звучит до ценности, и клиент уходит “подумать”.", "money leak"]],
  pricingTitle: "Форматы аудита",
  pricingLead: "Цены — за разовый аудит. Объём уточняется после короткого discovery-звонка.",
  tiers: [["Express", "от $700", "до 20 звонков · 5 рабочих дней", ["один сегмент продаж", "PDF 12-15 страниц", "30 минут walk-through", "3 главных риска и быстрые фиксы"], "Заказать Express"], ["Team", "от $1,500", "20-40 звонков · 7 рабочих дней", ["до 6 менеджеров в рейтинге", "Marketing vs Sales verdict", "Value at Risk от вашего baseline", "follow-up через 2 недели"], "Обсудить Team Audit", "Рекомендуемый"], ["Department", "от $3,000", "40-80 звонков · 10 рабочих дней", ["несколько команд или направлений", "глубокая сегментация причин потерь", "60 минут walk-through", "2 follow-up сессии"], "Обсудить scope"]],
  futureTitle: "Что появится в self-serve версии",
  futureLead: "Сейчас мы продаём аудит как услугу. Кабинет нужен позже, когда станет ясно, какие паттерны повторяются у первых клиентов.",
  future: [["Загрузка звонков", "Клиент сам добавляет аудио, транскрипты или ссылки на папку."], ["Личный кабинет", "Owner, РОП и менеджер видят разные уровни отчётов."], ["CRM summary", "Итоги звонка и следующий шаг уходят в карточку лида."], ["Weekly digest", "Короткий отчёт в Telegram для владельца и РОПа."]],
  futureNote: "Этот блок оставлен как карта развития, а не обещание сроков.",
  faqTitle: "FAQ",
  faq: [["Что если у нас нет записей звонков?", "Подходят записи Zoom, Google Meet, телефонии, голосовые из Telegram или готовые транскрипты."], ["Какой минимум звонков нужен?", "Желательно от 20 звонков. Меньше можно разобрать как быстрый срез, но выводы будут слабее."], ["Что с конфиденциальностью?", "Можно подписать NDA до передачи записей. В отчёте менеджеры обозначаются как M-1, M-2; mapping остаётся у вас."], ["Чем это отличается от Fireflies, Gong или CRM?", "Эти инструменты дают данные и транскрипты. CallControl превращает звонки в управленческий отчёт."], ["Можно ли анализировать поддержку?", "Да, но чек-лист меняется: тон, эмпатия, скорость реакции, эскалация и решение обращения."], ["Будет ли кабинет?", "Да, это направление развития. Сейчас работает done-for-you аудит: меньше внедрения, быстрее первый результат."]],
  formTitle: "Запросить аудит",
  formLead: "Оставьте контакт и короткий контекст. Я свяжусь в течение рабочего дня и скажу, какой формат подходит.",
  fields: ["Имя", "Telegram или email", "Компания", "Сайт или профиль", "Размер отдела продаж", "Сегмент", "Формат", "Что хотите понять из аудита?", "Есть ли записи или транскрипты?"],
  placeholders: ["Как к вам обращаться", "@username или email", "Название компании", "https://...", "3-7 менеджеров", "EdTech / B2B SaaS / агентство", "Express / Team / Department / не уверен", "Например: падает конверсия после первого звонка", "Есть записи в Zoom/CRM/телефонии или только текстовые транскрипты"],
  send: "Отправить заявку",
  sending: "Отправка...",
  success: ["Заявка получена.", "Свяжусь с вами в течение рабочего дня. Если срочно — напишите в Telegram: @manukianartur1997."],
  error: ["Не удалось отправить форму.", "Попробуйте ещё раз или напишите напрямую: @manukianartur1997."],
  privacy: "Данные используются только для связи по заявке и подготовки аудита.",
  footer: "CallControl AI · аудит звонков отдела продаж · Артур Манукян · Украина",
};

const uk = {
  ...ru,
  lang: "uk",
  url: "/uk/",
  title: "CallControl AI — аудит дзвінків відділу продажів",
  desc: "AI-аудит дзвінків відділу продажів: 20-50 записів, PDF-звіт, Value at Risk, рейтинг менеджерів і план дій.",
  nav: ["Як працює", "Приклад звіту", "Формати", "FAQ", "Запросити аудит"],
  badge: "AI-аудит дзвінків · зробимо за вас",
  h1: "Аудит дзвінків відділу продажів за 5 робочих днів",
  lead: "Знайдемо, де ви втрачаєте гроші у воронці. Повернемо PDF з конкретними цитатами, рейтингом менеджерів, Marketing vs Sales verdict і планом дій.",
  cta: "Запросити аудит",
  sample: "Подивитися приклад",
  trust: [["20-50", "дзвінків в одному аудиті"], ["5-7", "робочих днів до звіту"], ["30/60/90", "план дій для керівника продажів"]],
  proofTitle: "Що отримує керівник",
  proof: [["Value at Risk", "Оцінка грошей під ризиком у поточній воронці.", "$8.4k"], ["Manager Ranking", "Хто тримає стандарт, а кому потрібен коучинг.", "5 ролей"], ["Marketing vs Sales", "Де проблема: якість ліда, продаж або пропозиція.", "verdict"], ["Call Evidence", "Цитати з таймкодами замість загальних думок.", "4+ блоки"]],
  sampleTitle: "Так виглядає приклад звіту",
  sampleLead: "Синтетичний приклад показує структуру майбутнього звіту: короткий висновок, Value at Risk, цитати, рейтинг менеджерів і план дій.",
  sampleNote: "Важливо: приклад не є кейсом реального клієнта. Усі цифри й цитати потрібні лише для демонстрації формату.",
  sampleFile: "/samples/edtech-ua-sample-report.md",
  cards: [["Короткий висновок", "Один головний висновок, 3 пріоритети і де втрачається виручка."], ["Value at Risk", "Розрахунок впливу провалів у дзвінках на ваших базових метриках."], ["Call Quotes", "Конкретні фрази менеджерів і пояснення, чому угода холоне."], ["Action Plan", "Що виправити у перші 30, 60 і 90 днів."]],
  processTitle: "Як проходить аудит",
  processLead: "Без складної інтеграції і довгого впровадження. Спочатку послуга, потім автоматизація там, де вона справді потрібна.",
  steps: [["01", "Заявка і короткий дзвінок", "Уточнюємо сегмент, обсяг дзвінків, формат записів і головне питання аудиту."], ["02", "Передача записів", "Ви передаєте записи або транскрипти через Drive/Dropbox. За потреби підписуємо NDA."], ["03", "AI-розбір і ручна перевірка", "Кожен дзвінок проходить структурний аналіз. Фінальні висновки перевіряються вручну."], ["04", "PDF і walk-through", "Ви отримуєте звіт і розбір: що виправити першим, кого коучити і що винести на планірку."]],
  leakTitle: "Де зазвичай тече виручка",
  leakLead: "Аудит не сперечається абстрактно про погані ліди. Він розділяє відповідальність між маркетингом, продажем і процесом.",
  leaks: [["Discovery", "Менеджер говорить про продукт до того, як зрозумів біль, бюджет і timing.", "високий ризик"], ["Next Step", "Дзвінок завершується “я передзвоню” без дати, часу і домовленості.", "частий leak"], ["Offer Fit", "Клієнт прийшов з одним очікуванням, а продаж презентує іншу пропозицію.", "marketing/sales"], ["Price Talk", "Ціна звучить до цінності, і клієнт йде “подумати”.", "money leak"]],
  pricingTitle: "Формати аудиту",
  pricingLead: "Ціни — за разовий аудит. Обсяг уточнюється після короткого discovery-дзвінка.",
  tiers: [["Express", "від $700", "до 20 дзвінків · 5 робочих днів", ["один сегмент продажів", "PDF 12-15 сторінок", "30 хвилин розбору", "3 головні ризики і швидкі фікси"], "Замовити Express"], ["Team", "від $1,500", "20-40 дзвінків · 7 робочих днів", ["до 6 менеджерів у рейтингу", "висновок Marketing vs Sales", "Value at Risk від ваших базових метрик", "повторна зустріч через 2 тижні"], "Обговорити Team Audit", "Рекомендований"], ["Department", "від $3,000", "40-80 дзвінків · 10 робочих днів", ["кілька команд або напрямів", "глибока сегментація причин втрат", "60 хвилин розбору", "2 повторні сесії"], "Обговорити обсяг"]],
  futureTitle: "Що зʼявиться у версії для самостійного завантаження",
  futureLead: "Зараз ми продаємо аудит як послугу. Кабінет для самостійної роботи потрібен пізніше, коли стане зрозуміло, які патерни повторюються у перших клієнтів.",
  future: [["Завантаження дзвінків", "Клієнт сам додає аудіо, транскрипти або посилання на папку."], ["Особистий кабінет", "Власник, керівник продажів і менеджер бачать різні рівні звітів."], ["CRM-підсумок", "Підсумки дзвінка і наступний крок ідуть у картку ліда."], ["Тижневий дайджест", "Короткий звіт у Telegram для власника і керівника продажів."]],
  futureNote: "Цей блок залишено як карту розвитку, а не обіцянку строків.",
  faq: [["Що якщо у нас немає записів дзвінків?", "Підходять записи Zoom, Google Meet, телефонії, голосові з Telegram або готові транскрипти."], ["Який мінімум дзвінків потрібен?", "Бажано від 20 дзвінків. Менше можна розібрати як швидкий зріз, але висновки будуть слабші."], ["Що з конфіденційністю?", "Можна підписати NDA до передачі записів. У звіті менеджери позначаються як M-1, M-2; відповідність імен залишається у вас."], ["Чим це відрізняється від Fireflies, Gong або CRM?", "Ці інструменти дають дані й транскрипти. CallControl перетворює дзвінки на управлінський звіт."], ["Чи можна аналізувати підтримку?", "Так, але чек-лист змінюється: тон, емпатія, швидкість реакції, ескалація і вирішення звернення."], ["Чи буде кабінет?", "Так, це напрям розвитку. Зараз працює аудит у форматі послуги: менше впровадження, швидший перший результат."]],
  formTitle: "Запросити аудит",
  formLead: "Залиште контакт і короткий контекст. Я звʼяжуся протягом робочого дня і скажу, який формат підходить.",
  fields: ["Імʼя", "Telegram або email", "Компанія", "Сайт або профіль", "Розмір відділу продажів", "Сегмент", "Формат", "Що хочете зрозуміти з аудиту?", "Чи є записи або транскрипти?"],
  placeholders: ["Як до вас звертатися", "@username або email", "Назва компанії", "https://...", "3-7 менеджерів", "EdTech / B2B SaaS / агенція", "Express / Team / Department / не впевнений", "Наприклад: падає конверсія після першого дзвінка", "Є записи в Zoom/CRM/телефонії або тільки текстові транскрипти"],
  send: "Надіслати заявку",
  sending: "Надсилання...",
  success: ["Заявку отримано.", "Звʼяжуся з вами протягом робочого дня. Якщо терміново — напишіть у Telegram: @manukianartur1997."],
  error: ["Не вдалося надіслати форму.", "Спробуйте ще раз або напишіть напряму: @manukianartur1997."],
  privacy: "Дані використовуються лише для звʼязку щодо заявки і підготовки аудиту.",
  footer: "CallControl AI · аудит дзвінків відділу продажів · Артур Манукян · Україна",
};

const en = {
  ...ru,
  lang: "en",
  url: "/en/",
  title: "CallControl AI — sales call audit",
  desc: "AI sales-call audit: 20-50 recordings, PDF report, Value at Risk, manager ranking, and an action plan.",
  nav: ["Process", "Sample report", "Formats", "FAQ", "Request audit"],
  badge: "AI call audit · done-for-you",
  h1: "Sales call audit in 5 business days",
  lead: "Find where money leaks in your funnel. Get a PDF with specific call quotes, manager ranking, Marketing vs Sales verdict, and an action plan.",
  cta: "Request audit",
  sample: "View sample",
  trust: [["20-50", "calls in one audit"], ["5-7", "business days to report"], ["30/60/90", "action plan for the sales lead"]],
  proofTitle: "What leadership receives",
  proof: [["Value at Risk", "Estimated revenue at risk in the current funnel.", "$8.4k"], ["Manager Ranking", "Who keeps the standard and who needs coaching.", "5 roles"], ["Marketing vs Sales", "Where the issue sits: lead quality, sales handling, or offer.", "verdict"], ["Call Evidence", "Timestamped quotes instead of generic opinions.", "4+ blocks"]],
  sampleTitle: "Sample report structure",
  sampleLead: "A synthetic EdTech example showing the report format: executive summary, Value at Risk, quotes, manager ranking, and action plan.",
  sampleNote: "Important: this is not a real client case. Numbers and quotes are illustrative only.",
  sampleFile: "/samples/b2b-saas-ru-sample-report.md",
  cards: [["Executive Summary", "One main conclusion, top-3 priorities, and where revenue leaks."], ["Value at Risk", "Impact estimate from call failures based on your baseline."], ["Call Quotes", "Specific manager phrases and why the deal cools down."], ["Action Plan", "What to fix in the first 30, 60, and 90 days."]],
  processTitle: "How the audit works",
  processLead: "No heavy integration or long implementation. Service first, automation later where it truly matters.",
  steps: [["01", "Request and short call", "We clarify segment, call volume, recording format, and the audit question."], ["02", "Recording transfer", "You send recordings or transcripts via Drive/Dropbox. NDA can be signed before access."], ["03", "AI analysis and human review", "Each call goes through structured analysis. Final conclusions are reviewed manually."], ["04", "PDF and walk-through", "You receive the report and a review: what to fix first, whom to coach, and what to change in the team meeting."]],
  leakTitle: "Where revenue usually leaks",
  leakLead: "The audit does not argue abstractly about bad leads. It separates responsibility across marketing, sales, and process.",
  leaks: [["Discovery", "The manager talks about the product before understanding pain, budget, and timing.", "high risk"], ["Next Step", "The call ends with “I’ll call you back” without date, time, or agreement.", "common leak"], ["Offer Fit", "The client came with one expectation while sales presents another offer.", "marketing/sales"], ["Price Talk", "Price appears before value, and the client leaves to “think”.", "money leak"]],
  pricingTitle: "Audit formats",
  pricingLead: "Prices are for one-time audits. Scope can be clarified after a short discovery call.",
  tiers: [["Express", "from $700", "up to 20 calls · 5 business days", ["one sales segment", "12-15 page PDF", "30-minute walk-through", "3 main risks and quick fixes"], "Order Express"], ["Team", "from $1,500", "20-40 calls · 7 business days", ["up to 6 managers in ranking", "Marketing vs Sales verdict", "Value at Risk from your baseline", "follow-up in 2 weeks"], "Discuss Team Audit", "Recommended"], ["Department", "from $3,000", "40-80 calls · 10 business days", ["multiple teams or directions", "deep segmentation of loss reasons", "60-minute walk-through", "2 follow-up sessions"], "Discuss scope"]],
  futureTitle: "What the self-serve version will add",
  futureLead: "Right now we sell the audit as a service. A self-serve workspace comes later, once repeated patterns are clear from the first clients.",
  future: [["Call upload", "Clients add audio, transcripts, or folder links themselves."], ["Workspace", "Owner, sales lead, and manager see different report levels."], ["CRM summary", "Call outcome and next step go into the lead card."], ["Weekly digest", "Short Telegram report for the owner and sales lead."]],
  futureNote: "This is a development map, not a timeline promise.",
  faq: [["What if we do not have call recordings?", "Zoom, Google Meet, telephony recordings, Telegram voice messages, or ready transcripts work."], ["What is the minimum call volume?", "Ideally 20+ calls. Fewer calls can work as a quick scan, but the conclusions will be weaker."], ["How do you handle confidentiality?", "We can sign an NDA before receiving recordings. Managers are labeled M-1, M-2; mapping stays with you."], ["How is this different from Fireflies, Gong, or CRM?", "Those tools provide data and transcripts. CallControl turns calls into a management report."], ["Can you analyze support instead of sales?", "Yes, but the checklist changes: tone, empathy, response speed, escalation, and resolution quality."], ["Will there be a workspace?", "Yes, that is the product direction. For now, done-for-you audit means less setup and faster first value."]],
  formTitle: "Request audit",
  formLead: "Leave your contact and short context. I will reply during the business day and suggest the right format.",
  fields: ["Name", "Telegram or email", "Company", "Website or profile", "Sales team size", "Segment", "Format", "What should the audit answer?", "Do you have recordings or transcripts?"],
  placeholders: ["How should I address you?", "@username or email", "Company name", "https://...", "3-7 managers", "EdTech / B2B SaaS / agency", "Express / Team / Department / not sure", "For example: conversion drops after the first call", "Recordings in Zoom/CRM/telephony or only text transcripts"],
  send: "Send request",
  sending: "Sending...",
  success: ["Request received.", "I will reply during the business day. If urgent, message me on Telegram: @manukianartur1997."],
  error: ["The form could not be sent.", "Try again or message me directly: @manukianartur1997."],
  privacy: "Data is used only to contact you and prepare the audit.",
  footer: "CallControl AI · sales call audit · Artur Manukian · Ukraine",
};

const locales = { ru, uk, en };
const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const url = (l) => (l === "ru" ? "/ru/" : locales[l].url);
const list = (items) => items.map((i) => `<li>${esc(i)}</li>`).join("");
const mini = (items) => items.map(([a, b]) => `<article class="mini-card"><strong>${esc(a)}</strong><p>${esc(b)}</p></article>`).join("");

function formFields(t) {
  const names = ["name", "contact", "company", "website", "teamSize", "niche", "dataFormat", "pain", "dataLink"];
  return t.fields.map((label, i) => {
    const tag = i >= 7 ? "textarea" : "input";
    return `<label${i >= 6 ? ' class="full"' : ""}>${esc(label)}<${tag} name="${names[i]}"${i < 3 ? " required" : ""} placeholder="${esc(t.placeholders[i])}"></${tag}></label>`;
  }).join("");
}

function render(locale) {
  const t = locales[locale];
  const langs = ["ru", "uk", "en"].map((l) => `<a class="lang-pill${l === locale ? " active" : ""}" href="${url(l)}">${l === "uk" ? "UA" : l.toUpperCase()}</a>`).join("");
  const trust = t.trust.map(([a, b]) => `<div class="trust-item"><strong>${esc(a)}</strong><span>${esc(b)}</span></div>`).join("");
  const proof = t.proof.map(([a, b, c], i) => `<div class="proof-row"><div><strong>${esc(a)}</strong><span>${esc(b)}</span></div><b class="${i === 0 || i === 3 ? "risk" : ""}">${esc(c)}</b></div>`).join("");
  const steps = t.steps.map(([a, b, c]) => `<article class="step-card"><small>${esc(a)}</small><strong>${esc(b)}</strong><p>${esc(c)}</p></article>`).join("");
  const leaks = t.leaks.map(([a, b, c]) => `<article class="leak-row"><div><strong>${esc(a)}</strong><p>${esc(b)}</p></div><span>${esc(c)}</span></article>`).join("");
  const tiers = t.tiers.map(([a, b, c, d, e, f]) => `<article class="tier-card${f ? " featured" : ""}">${f ? `<span class="featured-label">${esc(f)}</span>` : ""}<h3>${esc(a)}</h3><div class="price">${esc(b)}</div><p>${esc(c)}</p><ul>${list(d)}</ul><a href="#request">${esc(e)}</a></article>`).join("");
  const faq = t.faq.map(([a, b]) => `<details class="faq-item"><summary>${esc(a)}</summary><p>${esc(b)}</p></details>`).join("");
  return `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(t.title)}</title><meta name="description" content="${esc(t.desc)}"/><style>${css()}</style></head><body><header class="topbar"><div class="wrap nav"><a class="brand" href="${url(locale)}"><strong>CallControl AI</strong><span>${esc(t.badge)}</span></a><nav class="nav-links"><a href="#process">${esc(t.nav[0])}</a><a href="#sample">${esc(t.nav[1])}</a><a href="#pricing">${esc(t.nav[2])}</a><a href="#faq">${esc(t.nav[3])}</a><a class="nav-cta" href="#request">${esc(t.nav[4])}</a></nav><div class="lang-switch">${langs}</div></div></header><main><section class="hero"><div class="wrap hero-grid"><div><span class="badge">${esc(t.badge)}</span><h1>${esc(t.h1)}</h1><p class="hero-lead">${esc(t.lead)}</p><div class="actions"><a class="button primary" href="#request">${esc(t.cta)}</a><a class="button secondary" href="#sample">${esc(t.sample)}</a></div><div class="trust-grid">${trust}</div></div><aside class="proof-card"><h2>${esc(t.proofTitle)}</h2>${proof}</aside></div></section><section id="sample"><div class="wrap sample-layout"><article class="sample-preview"><small>Sample Report · CallControl AI</small><h3>${esc(t.sampleTitle)}</h3><p>${esc(t.sampleLead)}</p><div class="sample-list"><div class="sample-line"><span>Revenue Leak</span><b>32-38%</b></div><div class="sample-line"><span>Manager Ranking</span><b>M-1...M-5</b></div><div class="sample-line"><span>Marketing vs Sales</span><b>verdict</b></div><div class="sample-line"><span>Action Plan</span><b>30/60/90</b></div></div><a class="button primary" href="${t.sampleFile}">${esc(t.sampleCta || t.sample)}</a></article><div class="sample-side"><div class="section-head"><h2>${esc(t.sampleTitle)}</h2><p>${esc(t.sampleLead)}</p><div class="sample-disclaimer">${esc(t.sampleNote)}</div></div><div class="grid-4">${mini(t.cards)}</div></div></div></section><section id="process"><div class="wrap"><div class="section-head"><h2>${esc(t.processTitle)}</h2><p>${esc(t.processLead)}</p></div><div class="grid-4">${steps}</div></div></section><section><div class="wrap two-col"><div class="section-head"><h2>${esc(t.leakTitle)}</h2><p>${esc(t.leakLead)}</p></div><div class="leak-stack">${leaks}</div></div></section><section id="pricing"><div class="wrap"><div class="section-head"><h2>${esc(t.pricingTitle)}</h2><p>${esc(t.pricingLead)}</p></div><div class="pricing-grid">${tiers}</div></div></section><section><div class="wrap"><div class="section-head"><h2>${esc(t.futureTitle)}</h2><p>${esc(t.futureLead)}</p></div><div class="future-grid">${mini(t.future)}</div><p class="future-note">${esc(t.futureNote)}</p></div></section><section id="faq"><div class="wrap"><div class="section-head"><h2>${esc(t.faqTitle)}</h2></div><div class="faq-grid">${faq}</div></div></section><section id="request"><div class="wrap"><div class="form-card"><div class="section-head"><h2>${esc(t.formTitle)}</h2><p>${esc(t.formLead)}</p></div><form id="leadForm"><div class="form-grid">${formFields(t)}</div><div class="actions"><button class="button primary" type="submit">${esc(t.send)}</button></div><div class="form-status" id="formStatus"></div><p class="privacy">${esc(t.privacy)}</p></form></div></div></section></main><footer class="footer"><div class="wrap footer-inner"><span>${esc(t.footer)}</span><span>Telegram: @manukianartur1997</span></div></footer><script>const copy=${JSON.stringify({ ru: ru.success, uk: uk.success, en: en.success })}[${JSON.stringify(locale)}];const err=${JSON.stringify({ ru: ru.error, uk: uk.error, en: en.error })}[${JSON.stringify(locale)}];const sending=${JSON.stringify(t.sending)};const submit=${JSON.stringify(t.send)};const form=document.querySelector("#leadForm");const status=document.querySelector("#formStatus");form.addEventListener("submit",async(e)=>{e.preventDefault();const b=form.querySelector("button");b.disabled=true;b.textContent=sending;status.innerHTML="";const p=Object.fromEntries(new FormData(form).entries());p.source="callcontrol-public-landing";p.locale=${JSON.stringify(locale)};try{const r=await fetch("/api/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});if(!r.ok)throw new Error("request_failed");status.innerHTML="<strong>"+copy[0]+"</strong><br>"+copy[1];form.reset()}catch(_){status.innerHTML="<strong>"+err[0]+"</strong><br>"+err[1]}finally{b.disabled=false;b.textContent=submit}})</script></body></html>`;
}

function css() {
  return `@import url("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap");*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:#f8fafc;background:linear-gradient(135deg,rgba(56,189,248,.16),transparent 34%),linear-gradient(215deg,rgba(99,102,241,.2),transparent 38%),linear-gradient(180deg,#020617 0%,#07111f 42%,#0f172a 100%);font-family:Geist,Inter,system-ui,sans-serif;letter-spacing:0}a{color:inherit}.wrap{width:min(1180px,calc(100% - 32px));margin:0 auto}.topbar{position:sticky;top:0;z-index:20;border-bottom:1px solid rgba(226,232,240,.16);background:rgba(2,6,23,.72);backdrop-filter:blur(18px)}.nav{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:72px}.brand{display:flex;flex-direction:column;text-decoration:none}.brand strong{font-size:17px;letter-spacing:-.02em}.brand span,.nav-links{color:#b9c6d8;font-size:14px}.brand span{font-size:12px}.nav-links{display:flex;align-items:center;gap:16px}.nav-links a{text-decoration:none}.nav-cta{padding:10px 14px;border:1px solid rgba(125,211,252,.4);border-radius:10px;background:rgba(56,189,248,.12);color:#e0f2fe;font-weight:600}.lang-switch{display:flex;gap:6px}.lang-pill{min-width:34px;padding:7px 9px;border:1px solid rgba(226,232,240,.16);border-radius:9px;text-align:center;text-decoration:none;color:#b9c6d8;font:600 12px "JetBrains Mono",monospace}.lang-pill.active{color:#f8fafc;border-color:rgba(125,211,252,.42);background:rgba(125,211,252,.11)}section{padding:clamp(58px,8vw,96px) 0}.hero{padding-top:clamp(54px,8vw,104px)}.hero-grid,.sample-layout,.two-col{display:grid;grid-template-columns:minmax(0,1.04fr) minmax(330px,.96fr);gap:clamp(24px,5vw,58px);align-items:center}.badge{display:inline-flex;padding:8px 11px;border:1px solid rgba(125,211,252,.28);border-radius:999px;background:rgba(125,211,252,.09);color:#bae6fd;font:600 11px "JetBrains Mono",monospace;text-transform:uppercase}h1,h2,h3{margin:0;font-weight:600;letter-spacing:-.028em}h1{max-width:790px;margin-top:20px;font-size:clamp(44px,7vw,86px);line-height:.98}.hero-lead{max-width:720px;margin:20px 0 0;color:#b9c6d8;font-size:clamp(17px,2vw,21px);line-height:1.55}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:12px 16px;border-radius:11px;border:1px solid rgba(226,232,240,.26);text-decoration:none;font-weight:600}.button.primary{border-color:rgba(125,211,252,.42);background:linear-gradient(135deg,#38bdf8,#4f46e5);color:#fff;box-shadow:0 14px 38px rgba(56,189,248,.18)}.button.secondary{background:rgba(255,255,255,.07)}.trust-grid,.grid-4,.future-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.trust-grid{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:30px}.trust-item,.proof-card,.mini-card,.step-card,.leak-row,.tier-card,.faq-item,.form-card{border:1px solid rgba(226,232,240,.16);background:rgba(255,255,255,.075);border-radius:14px;backdrop-filter:blur(16px)}.trust-item,.mini-card,.step-card{padding:18px}.trust-item strong,.price,.proof-row b{display:block;font-family:"JetBrains Mono",monospace}.trust-item strong{color:#e0f2fe;font-size:20px}.trust-item span,.mini-card p,.step-card p{display:block;margin-top:5px;color:#b9c6d8;font-size:13px;line-height:1.45}.proof-card{padding:18px;box-shadow:0 22px 90px rgba(0,0,0,.28)}.proof-card h2{margin-bottom:10px;font-size:22px}.proof-row{display:grid;grid-template-columns:1fr auto;gap:14px;padding:15px 0;border-bottom:1px solid rgba(226,232,240,.16)}.proof-row:last-child{border-bottom:0}.proof-row strong{display:block;margin-bottom:5px}.proof-row span{color:#b9c6d8;font-size:13px;line-height:1.4}.proof-row b{color:#86efac;white-space:nowrap}.proof-row b.risk{color:#fda4af}.section-head{max-width:780px;margin-bottom:24px}.section-head h2{font-size:clamp(30px,4.6vw,56px);line-height:1.05}.section-head p{color:#b9c6d8;font-size:17px;line-height:1.55}.sample-preview{min-height:430px;padding:24px;border-radius:16px;border:1px solid rgba(226,232,240,.26);background:linear-gradient(180deg,rgba(248,250,252,.96),rgba(226,232,240,.92));color:#0f172a}.sample-preview small{color:#475569;font:600 12px "JetBrains Mono",monospace;text-transform:uppercase}.sample-preview h3{margin-top:16px;font-size:30px;color:#0f172a}.sample-preview p{color:#475569;line-height:1.55}.sample-list{display:grid;gap:10px;margin:22px 0}.sample-line{display:flex;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid rgba(15,23,42,.12);font-size:14px}.sample-line b{font-family:"JetBrains Mono",monospace;color:#00684a}.sample-side{display:grid;gap:12px}.sample-disclaimer{margin-top:14px;padding:13px 14px;border-radius:12px;background:rgba(245,158,11,.13);color:#fde68a;font-size:13px;line-height:1.45}.step-card small{display:block;margin-bottom:14px;color:#7dd3fc;font:600 12px "JetBrains Mono",monospace}.leak-stack{display:grid;gap:10px}.leak-row{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;padding:16px 18px}.leak-row p{margin:5px 0 0;color:#b9c6d8;line-height:1.5}.leak-row span{padding:7px 9px;border-radius:999px;background:rgba(251,113,133,.13);color:#fecdd3;font:600 11px "JetBrains Mono",monospace;white-space:nowrap}.pricing-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.tier-card{position:relative;padding:22px}.tier-card.featured{border-color:rgba(34,197,94,.38);background:rgba(34,197,94,.08)}.featured-label{position:absolute;right:16px;top:16px;padding:6px 8px;border-radius:999px;background:rgba(34,197,94,.16);color:#bbf7d0;font:600 11px "JetBrains Mono",monospace}.tier-card h3{font-size:23px}.price{margin-top:13px;color:#e0f2fe;font-size:28px}.tier-card p,.future-note{color:#b9c6d8}.tier-card ul{margin:18px 0;padding-left:19px;color:#b9c6d8;line-height:1.65}.tier-card a{display:inline-flex;width:100%;justify-content:center;padding:12px 14px;border-radius:11px;background:rgba(255,255,255,.08);border:1px solid rgba(226,232,240,.26);text-decoration:none;font-weight:600}.future-note{margin-top:14px;font-size:14px}.faq-grid{display:grid;gap:10px}.faq-item summary{cursor:pointer;padding:17px 18px;font-weight:600}.faq-item p{margin:0;padding:0 18px 18px;color:#b9c6d8;line-height:1.55}.form-card{padding:clamp(20px,4vw,34px)}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}label{display:grid;gap:7px;color:#b9c6d8;font-size:13px}input,textarea{width:100%;border:1px solid rgba(226,232,240,.16);border-radius:11px;background:rgba(2,6,23,.46);color:#f8fafc;font:inherit;padding:12px 13px;outline:none}textarea{min-height:106px;resize:vertical}.full{grid-column:1/-1}.form-status{margin-top:14px;min-height:42px;color:#b9c6d8;line-height:1.5}.form-status strong{color:#f8fafc}.privacy{margin-top:10px;color:#7d8fa6;font-size:13px}.footer{padding:28px 0 42px;color:#b9c6d8;border-top:1px solid rgba(226,232,240,.16)}.footer-inner{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap}@media(max-width:980px){.hero-grid,.sample-layout,.two-col,.pricing-grid{grid-template-columns:1fr}.grid-4,.future-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.nav-links{display:none}}@media(max-width:640px){.wrap{width:min(100% - 24px,1180px)}h1{font-size:42px}.trust-grid,.grid-4,.future-grid,.form-grid{grid-template-columns:1fr}.leak-row{grid-template-columns:1fr}.sample-preview{min-height:auto}}`;
}

module.exports = function generatePublicLandingLite() {
  const samplesDir = path.join(outDir, "samples");
  fs.mkdirSync(samplesDir, { recursive: true });
  for (const [file, content] of Object.entries(samples)) fs.writeFileSync(path.join(samplesDir, file), content);
  for (const locale of ["ru", "uk", "en"]) {
    const html = render(locale);
    if (locale === "ru") fs.writeFileSync(path.join(outDir, "index.html"), html);
    fs.mkdirSync(path.join(outDir, locale), { recursive: true });
    fs.writeFileSync(path.join(outDir, locale, "index.html"), html);
  }
  fs.writeFileSync(path.join(outDir, "hybrid-demo.html"), render("ru"));
  console.log("Public service landing ready: dist/index.html, dist/ru/index.html, dist/uk/index.html, dist/en/index.html");
};
