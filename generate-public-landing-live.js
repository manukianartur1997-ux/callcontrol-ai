const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "dist");
const samples = {
  "edtech-ua-sample-report.md": "# CallControl AI — приклад структури звіту\n\n**Приклад структури, не реальний клієнт**\n\n## Короткий висновок\nEdTech-школа втрачає гроші на першому діагностичному дзвінку: ціна звучить до цінності, а наступний крок не фіксується.\n\n## Value at Risk\nРозрахунок у реальному звіті будується на ваших заявках, середньому чеку і конверсії.\n\n## Доказ із дзвінка\n> M-2: \"У нас курс коштує 14,500 грн.\"\n>\n> Клієнт: \"Зрозуміло, я подумаю.\"\n\n## План дій\n30 днів: виправити діагностику потреби і наступний крок.\n60 днів: тренувати слабкі патерни по менеджерах.\n90 днів: перевірити повторний зріз.\n",
  "b2b-saas-ru-sample-report.md": "# CallControl AI — пример структуры отчёта\n\n**Пример структуры, не реальный клиент**\n\n## Короткий вывод\nКоманда теряет сделки между квалификацией и демонстрацией: контекст теряется при передаче лида, а клиент повторяет один и тот же сценарий.\n\n## Value at Risk\nРасчёт строится от вашего среднего контракта, количества квалифицированных лидов и текущей конверсии в оплату.\n\n## Доказ из звонка\n> Менеджер: \"Расскажите, что хотели бы посмотреть?\"\n>\n> Клиент: \"Мы уже подробно объяснили это на прошлом звонке.\"\n\n## План действий\n1. Ввести шаблон передачи лида между ролями.\n2. Заменить обзор продукта на демонстрацию вокруг сценария клиента.\n3. Добавить оценку качества следующего шага.\n",
};

const copy = {
  ru: {
    lang: "ru", url: "/ru/", title: "CallControl AI — аудит звонков отдела продаж",
    desc: "AI-аудит звонков отдела продаж: 20-50 записей, PDF-отчёт, Value at Risk, рейтинг менеджеров и план действий.",
    nav: ["Как работает", "Пример отчёта", "Форматы", "FAQ", "Запросить аудит"],
    badge: "AI-аудит звонков · под ключ",
    h1: "Аудит звонков отдела продаж за 5 рабочих дней",
    lead: "Найдём, где теряются деньги в воронке. Вернём PDF с цитатами, рейтингом менеджеров, выводом по маркетингу и продажам, а также планом действий.",
    cta: "Запросить аудит", sample: "Посмотреть пример", sampleFile: "/samples/b2b-saas-ru-sample-report.md",
    trust: [["20-50", "звонков в одном аудите"], ["5-7", "рабочих дней до отчёта"], ["30/60/90", "план действий для РОПа"]],
    proofTitle: "Что получает руководитель",
    proof: [["Value at Risk", "Деньги под риском в текущей воронке.", "$8.4k"], ["Рейтинг менеджеров", "Кто держит стандарт, а кому нужен коучинг.", "5 ролей"], ["Маркетинг vs продажи", "Проблема в качестве лида, продаже или предложении.", "вывод"], ["Доказ из звонков", "Цитаты с таймкодами вместо общих мнений.", "4+ блока"]],
    sampleTitle: "Так выглядит пример отчёта",
    sampleLead: "Синтетический пример показывает структуру отчёта: короткий вывод, Value at Risk, цитаты, рейтинг менеджеров и план действий.",
    sampleNote: "Пример не является кейсом реального клиента. Все цифры и цитаты нужны только для демонстрации формата.",
    sampleMetrics: [["Утечка выручки", "32-38%"], ["Рейтинг менеджеров", "M-1...M-5"], ["Маркетинг vs продажи", "вывод"], ["План действий", "30/60/90"]],
    cards: [["Короткий вывод", "Один главный вывод и 3 приоритета."], ["Value at Risk", "Расчёт влияния провалов на деньги."], ["Цитаты из звонков", "Фразы менеджеров и причина риска."], ["План действий", "Что исправить в первые 30, 60 и 90 дней."]],
    processTitle: "Как проходит аудит",
    processLead: "Без сложной интеграции. Сначала услуга, потом автоматизация там, где она действительно нужна.",
    steps: [["01", "Заявка и короткий звонок", "Уточняем сегмент, объём звонков и главный вопрос аудита."], ["02", "Передача записей", "Вы передаёте записи или транскрипты через Drive/Dropbox. При необходимости подписываем NDA."], ["03", "AI-разбор и ручная проверка", "Каждый звонок проходит структурный анализ. Финальные выводы проверяются вручную."], ["04", "PDF и разбор", "Вы получаете отчёт и разбор: что чинить первым, кого коучить и что вынести на планёрку."]],
    leakTitle: "Где обычно течёт выручка",
    leakLead: "Аудит разделяет ответственность между маркетингом, продажами и процессом.",
    leaks: [["Диагностика потребности", "Менеджер говорит про продукт до понимания боли, бюджета и сроков.", "высокий риск"], ["Следующий шаг", "Звонок заканчивается без даты, времени и договорённости.", "частая утечка"], ["Попадание предложения", "Клиент пришёл с одним ожиданием, а продажа презентует другое предложение.", "маркетинг/продажи"], ["Разговор о цене", "Цена звучит до ценности, и клиент уходит “подумать”.", "утечка денег"]],
    pricingTitle: "Форматы аудита", pricingLead: "Цены — за разовый аудит. Объём уточняется после короткого диагностического звонка.",
    tiers: [["Express", "от $700", "до 20 звонков · 5 рабочих дней", ["один сегмент продаж", "PDF 12-15 страниц", "30 минут разбора"], "Заказать Express"], ["Team", "от $1,500", "20-40 звонков · 7 рабочих дней", ["до 6 менеджеров", "вывод по маркетингу и продажам", "повторная встреча через 2 недели"], "Обсудить Team Audit", "Рекомендуемый"], ["Department", "от $3,000", "40-80 звонков · 10 рабочих дней", ["несколько команд", "сегментация причин потерь", "2 повторные сессии"], "Обсудить объём"]],
    futureTitle: "Что появится в версии для самостоятельной загрузки",
    futureLead: "Сейчас аудит продаётся как услуга. Кабинет нужен позже, когда повторятся паттерны первых клиентов.",
    future: [["Загрузка звонков", "Клиент сам добавляет аудио, транскрипты или ссылки."], ["Личный кабинет", "Владелец, РОП и менеджер видят разные уровни отчётов."], ["Резюме для CRM", "Итоги звонка уходят в карточку лида."], ["Еженедельный дайджест", "Короткий отчёт в Telegram для владельца и РОПа."]],
    futureNote: "Это карта развития, а не обещание сроков.",
    faqTitle: "FAQ",
    faq: [["Что если у нас нет записей звонков?", "Подходят записи Zoom, Google Meet, телефонии, голосовые или готовые транскрипты."], ["Какой минимум звонков нужен?", "Желательно от 20 звонков. Меньше можно разобрать как быстрый срез."], ["Что с конфиденциальностью?", "Можно подписать NDA до передачи записей. Менеджеры обозначаются как M-1, M-2."], ["Чем это отличается от Fireflies, Gong или CRM?", "Они дают данные и транскрипты. CallControl превращает звонки в управленческий отчёт."], ["Можно ли анализировать поддержку?", "Да, но чек-лист меняется: тон, эмпатия, скорость реакции и эскалация."], ["Будет ли кабинет?", "Да. Сейчас работает аудит в формате услуги: меньше внедрения, быстрее первый результат."]],
    formTitle: "Запросить аудит", formLead: "Оставьте контакт и короткий контекст. Я свяжусь в течение рабочего дня.",
    fields: ["Имя", "Telegram или email", "Компания", "Сайт или профиль", "Размер отдела продаж", "Сегмент", "Формат", "Что хотите понять из аудита?", "Есть ли записи или транскрипты?"],
    placeholders: ["Как к вам обращаться", "@username или email", "Название компании", "https://...", "3-7 менеджеров", "EdTech / B2B SaaS / агентство", "Express / Team / Department / не уверен", "Например: падает конверсия после первого звонка", "Есть записи в Zoom/CRM/телефонии или только текст"],
    send: "Отправить заявку", sending: "Отправка...",
    ok: ["Заявка получена.", "Свяжусь с вами в течение рабочего дня. Если срочно — напишите в Telegram: @manukianartur1997."],
    fail: ["Не удалось отправить форму.", "Попробуйте ещё раз или напишите напрямую: @manukianartur1997."],
    privacy: "Данные используются только для связи по заявке и подготовки аудита.",
    footer: "CallControl AI · аудит звонков отдела продаж · Артур Манукян · Украина",
  },
};

copy.uk = { ...copy.ru, lang: "uk", url: "/uk/", title: "CallControl AI — аудит дзвінків відділу продажів", desc: "AI-аудит дзвінків відділу продажів: 20-50 записів, PDF-звіт, Value at Risk, рейтинг менеджерів і план дій.", nav: ["Як працює", "Приклад звіту", "Формати", "FAQ", "Запросити аудит"], badge: "AI-аудит дзвінків · зробимо за вас", h1: "Аудит дзвінків відділу продажів за 5 робочих днів", lead: "Знайдемо, де ви втрачаєте гроші у воронці. Повернемо PDF з цитатами, рейтингом менеджерів, Marketing vs Sales verdict і планом дій.", cta: "Запросити аудит", sample: "Подивитися приклад", sampleFile: "/samples/edtech-ua-sample-report.md", trust: [["20-50", "дзвінків в одному аудиті"], ["5-7", "робочих днів до звіту"], ["30/60/90", "план дій для керівника продажів"]], proofTitle: "Що отримує керівник", proof: [["Value at Risk", "Гроші під ризиком у поточній воронці.", "$8.4k"], ["Manager Ranking", "Хто тримає стандарт, а кому потрібен коучинг.", "5 ролей"], ["Marketing vs Sales", "Проблема в ліді, продажу або пропозиції.", "verdict"], ["Call Evidence", "Цитати з таймкодами замість загальних думок.", "4+ блоки"]], sampleTitle: "Так виглядає приклад звіту", sampleLead: "Синтетичний приклад показує структуру звіту: короткий висновок, Value at Risk, цитати, рейтинг менеджерів і план дій.", sampleNote: "Приклад не є кейсом реального клієнта. Усі цифри й цитати потрібні лише для демонстрації формату.", cards: [["Короткий висновок", "Один головний висновок і 3 пріоритети."], ["Value at Risk", "Розрахунок впливу провалів на гроші."], ["Call Quotes", "Фрази менеджерів і причина ризику."], ["Action Plan", "Що виправити у перші 30, 60 і 90 днів."]], processTitle: "Як проходить аудит", processLead: "Без складної інтеграції. Спочатку послуга, потім автоматизація там, де вона справді потрібна.", steps: [["01", "Заявка і короткий дзвінок", "Уточнюємо сегмент, обсяг дзвінків і головне питання аудиту."], ["02", "Передача записів", "Ви передаєте записи або транскрипти через Drive/Dropbox. За потреби підписуємо NDA."], ["03", "AI-розбір і ручна перевірка", "Кожен дзвінок проходить структурний аналіз. Фінальні висновки перевіряються вручну."], ["04", "PDF і walk-through", "Ви отримуєте звіт і розбір: що виправити першим, кого коучити і що винести на планірку."]], leakTitle: "Де зазвичай тече виручка", leakLead: "Аудит розділяє відповідальність між маркетингом, продажем і процесом.", leaks: [["Discovery", "Менеджер говорить про продукт до розуміння болю, бюджету і timing.", "високий ризик"], ["Next Step", "Дзвінок завершується без дати, часу і домовленості.", "частий leak"], ["Offer Fit", "Клієнт прийшов з одним очікуванням, а продаж презентує іншу пропозицію.", "marketing/sales"], ["Price Talk", "Ціна звучить до цінності, і клієнт йде “подумати”.", "money leak"]], pricingTitle: "Формати аудиту", pricingLead: "Ціни — за разовий аудит. Обсяг уточнюється після короткого discovery-дзвінка.", tiers: [["Express", "від $700", "до 20 дзвінків · 5 робочих днів", ["один сегмент продажів", "PDF 12-15 сторінок", "30 хвилин розбору"], "Замовити Express"], ["Team", "від $1,500", "20-40 дзвінків · 7 робочих днів", ["до 6 менеджерів", "висновок Marketing vs Sales", "повторна зустріч через 2 тижні"], "Обговорити Team Audit", "Рекомендований"], ["Department", "від $3,000", "40-80 дзвінків · 10 робочих днів", ["кілька команд", "сегментація причин втрат", "2 повторні сесії"], "Обговорити обсяг"]], futureTitle: "Що зʼявиться у версії для самостійного завантаження", futureLead: "Зараз аудит продається як послуга. Кабінет потрібен пізніше, коли повторяться патерни перших клієнтів.", future: [["Завантаження дзвінків", "Клієнт сам додає аудіо, транскрипти або посилання."], ["Особистий кабінет", "Власник, керівник продажів і менеджер бачать різні рівні звітів."], ["CRM-підсумок", "Підсумки дзвінка ідуть у картку ліда."], ["Тижневий дайджест", "Короткий звіт у Telegram для власника і керівника продажів."]], futureNote: "Це карта розвитку, а не обіцянка строків.", faq: [["Що якщо у нас немає записів дзвінків?", "Підходять записи Zoom, Google Meet, телефонії, голосові або готові транскрипти."], ["Який мінімум дзвінків потрібен?", "Бажано від 20 дзвінків. Менше можна розібрати як швидкий зріз."], ["Що з конфіденційністю?", "Можна підписати NDA до передачі записів. Менеджери позначаються як M-1, M-2."], ["Чим це відрізняється від Fireflies, Gong або CRM?", "Вони дають дані й транскрипти. CallControl перетворює дзвінки на управлінський звіт."], ["Чи можна аналізувати підтримку?", "Так, але чек-лист змінюється: тон, емпатія, швидкість реакції та ескалація."], ["Чи буде кабінет?", "Так. Зараз працює аудит у форматі послуги: менше впровадження, швидший перший результат."]], formTitle: "Запросити аудит", formLead: "Залиште контакт і короткий контекст. Я звʼяжуся протягом робочого дня.", fields: ["Імʼя", "Telegram або email", "Компанія", "Сайт або профіль", "Розмір відділу продажів", "Сегмент", "Формат", "Що хочете зрозуміти з аудиту?", "Чи є записи або транскрипти?"], placeholders: ["Як до вас звертатися", "@username або email", "Назва компанії", "https://...", "3-7 менеджерів", "EdTech / B2B SaaS / агенція", "Express / Team / Department / не впевнений", "Наприклад: падає конверсія після першого дзвінка", "Є записи в Zoom/CRM/телефонії або тільки текст"], send: "Надіслати заявку", sending: "Надсилання...", ok: ["Заявку отримано.", "Звʼяжуся з вами протягом робочого дня. Якщо терміново — напишіть у Telegram: @manukianartur1997."], fail: ["Не вдалося надіслати форму.", "Спробуйте ще раз або напишіть напряму: @manukianartur1997."], privacy: "Дані використовуються лише для звʼязку щодо заявки і підготовки аудиту.", footer: "CallControl AI · аудит дзвінків відділу продажів · Артур Манукян · Україна" };

copy.en = { ...copy.ru, lang: "en", url: "/en/", title: "CallControl AI — sales call audit", desc: "AI sales-call audit: 20-50 recordings, PDF report, Value at Risk, manager ranking, and an action plan.", nav: ["Process", "Sample report", "Formats", "FAQ", "Request audit"], badge: "AI call audit · done-for-you", h1: "Sales call audit in 5 business days", lead: "Find where money leaks in your funnel. Get a PDF with call quotes, manager ranking, Marketing vs Sales verdict, and an action plan.", cta: "Request audit", sample: "View sample", trust: [["20-50", "calls in one audit"], ["5-7", "business days to report"], ["30/60/90", "action plan for the sales lead"]], proofTitle: "What leadership receives", proof: [["Value at Risk", "Revenue at risk in the current funnel.", "$8.4k"], ["Manager Ranking", "Who keeps the standard and who needs coaching.", "5 roles"], ["Marketing vs Sales", "Issue in lead quality, sales handling, or offer.", "verdict"], ["Call Evidence", "Timestamped quotes instead of generic opinions.", "4+ blocks"]], sampleTitle: "Sample report structure", sampleLead: "A synthetic example showing the report format: executive summary, Value at Risk, quotes, manager ranking, and action plan.", sampleNote: "This is not a real client case. Numbers and quotes are illustrative only.", processTitle: "How the audit works", processLead: "No heavy integration. Service first, automation later where it truly matters.", leakTitle: "Where revenue usually leaks", leakLead: "The audit separates responsibility across marketing, sales, and process.", pricingTitle: "Audit formats", pricingLead: "Prices are for one-time audits. Scope is clarified after a short discovery call.", futureTitle: "What the self-serve version will add", futureLead: "Right now the audit is sold as a service. A workspace comes later, once repeated patterns are clear.", futureNote: "This is a development map, not a timeline promise.", formTitle: "Request audit", formLead: "Leave your contact and short context. I will reply during the business day.", fields: ["Name", "Telegram or email", "Company", "Website or profile", "Sales team size", "Segment", "Format", "What should the audit answer?", "Do you have recordings or transcripts?"], placeholders: ["How should I address you?", "@username or email", "Company name", "https://...", "3-7 managers", "EdTech / B2B SaaS / agency", "Express / Team / Department / not sure", "For example: conversion drops after the first call", "Recordings in Zoom/CRM/telephony or text only"], send: "Send request", sending: "Sending...", ok: ["Request received.", "I will reply during the business day. If urgent, message me on Telegram: @manukianartur1997."], fail: ["The form could not be sent.", "Try again or message me directly: @manukianartur1997."], privacy: "Data is used only to contact you and prepare the audit.", footer: "CallControl AI · sales call audit · Artur Manukian · Ukraine" };

Object.assign(copy.uk, {
  lead: "Знайдемо, де ви втрачаєте гроші у воронці. Повернемо PDF з цитатами, рейтингом менеджерів, висновком по маркетингу і продажах, а також планом дій.",
  proof: [["Value at Risk", "Гроші під ризиком у поточній воронці.", "$8.4k"], ["Рейтинг менеджерів", "Хто тримає стандарт, а кому потрібен коучинг.", "5 ролей"], ["Маркетинг vs продажі", "Проблема в якості ліда, продажі або пропозиції.", "висновок"], ["Доказ із дзвінків", "Цитати з таймкодами замість загальних думок.", "4+ блоки"]],
  sampleMetrics: [["Витік виручки", "32-38%"], ["Рейтинг менеджерів", "M-1...M-5"], ["Маркетинг vs продажі", "висновок"], ["План дій", "30/60/90"]],
  cards: [["Короткий висновок", "Один головний висновок і 3 пріоритети."], ["Value at Risk", "Розрахунок впливу провалів на гроші."], ["Цитати з дзвінків", "Фрази менеджерів і причина ризику."], ["План дій", "Що виправити у перші 30, 60 і 90 днів."]],
  steps: [["01", "Заявка і короткий дзвінок", "Уточнюємо сегмент, обсяг дзвінків і головне питання аудиту."], ["02", "Передача записів", "Ви передаєте записи або транскрипти через Drive/Dropbox. За потреби підписуємо NDA."], ["03", "AI-розбір і ручна перевірка", "Кожен дзвінок проходить структурний аналіз. Фінальні висновки перевіряються вручну."], ["04", "PDF і розбір", "Ви отримуєте звіт і розбір: що виправити першим, кого коучити і що винести на планірку."]],
  leaks: [["Діагностика потреби", "Менеджер говорить про продукт до розуміння болю, бюджету і строків.", "високий ризик"], ["Наступний крок", "Дзвінок завершується без дати, часу і домовленості.", "частий витік"], ["Попадання пропозиції", "Клієнт прийшов з одним очікуванням, а продаж презентує іншу пропозицію.", "маркетинг/продажі"], ["Розмова про ціну", "Ціна звучить до цінності, і клієнт йде “подумати”.", "витік грошей"]],
  pricingLead: "Ціни — за разовий аудит. Обсяг уточнюється після короткого діагностичного дзвінка.",
  tiers: [["Express", "від $700", "до 20 дзвінків · 5 робочих днів", ["один сегмент продажів", "PDF 12-15 сторінок", "30 хвилин розбору"], "Замовити Express"], ["Team", "від $1,500", "20-40 дзвінків · 7 робочих днів", ["до 6 менеджерів", "висновок по маркетингу і продажах", "повторна зустріч через 2 тижні"], "Обговорити Team Audit", "Рекомендований"], ["Department", "від $3,000", "40-80 дзвінків · 10 робочих днів", ["кілька команд", "сегментація причин втрат", "2 повторні сесії"], "Обговорити обсяг"]],
});

Object.assign(copy.en, {
  sampleFile: "/samples/b2b-saas-ru-sample-report.md",
  sampleMetrics: [["Revenue leak", "32-38%"], ["Manager ranking", "M-1...M-5"], ["Marketing vs Sales", "verdict"], ["Action plan", "30/60/90"]],
  cards: [["Executive summary", "One main conclusion and 3 priorities."], ["Value at Risk", "Estimated money impact of the detected gaps."], ["Call quotes", "Manager phrases and the reason they create risk."], ["Action plan", "What to fix in the first 30, 60, and 90 days."]],
  steps: [["01", "Request and short call", "We clarify the segment, call volume, and the main audit question."], ["02", "Recordings handoff", "You share recordings or transcripts via Drive or Dropbox. We can sign an NDA first."], ["03", "AI analysis and human review", "Each call is reviewed through a structured frame. Final findings are checked manually."], ["04", "PDF and review session", "You get the report and a practical review: what to fix first, who needs coaching, and what to discuss with the team."]],
  leaks: [["Needs diagnosis", "The manager talks about the product before understanding pain, budget, and timing.", "high risk"], ["Next step", "The call ends without a date, time, or clear agreement.", "common leak"], ["Offer fit", "The lead expects one thing while sales presents another offer.", "marketing/sales"], ["Price talk", "Price appears before value, and the client leaves to “think about it”.", "money leak"]],
  tiers: [["Express", "from $700", "up to 20 calls · 5 business days", ["one sales segment", "12-15 page PDF", "30-minute review"], "Order Express"], ["Team", "from $1,500", "20-40 calls · 7 business days", ["up to 6 managers", "Marketing vs Sales verdict", "follow-up after 2 weeks"], "Discuss Team Audit", "Recommended"], ["Department", "from $3,000", "40-80 calls · 10 business days", ["several teams", "segmented loss reasons", "2 follow-up sessions"], "Discuss scope"]],
  future: [["Call upload", "The client adds audio, transcripts, or links."], ["Workspace", "Owner, sales lead, and manager see different report levels."], ["CRM summary", "Call outcomes go into the lead card."], ["Weekly digest", "A short Telegram report for the owner and sales lead."]],
  faqTitle: "FAQ",
  faq: [["What if we do not have call recordings?", "Zoom, Google Meet, telephony recordings, voice messages, or ready transcripts all work."], ["What is the minimum number of calls?", "20 calls is preferable. Fewer calls can work for a quick snapshot."], ["How do you handle confidentiality?", "We can sign an NDA before you share recordings. Managers are labeled as M-1, M-2, and so on."], ["How is this different from Fireflies, Gong, or CRM?", "They provide data and transcripts. CallControl turns calls into a management report."], ["Can you analyze support calls?", "Yes, but the checklist changes: tone, empathy, response speed, and escalation become more important."], ["Will there be a workspace?", "Yes. Right now the audit works as a service: less implementation, faster first result."]],
});

// ---- Premium landing additions (hero author, value-at-risk, booking, sample screenshot) ----
const BOOK_URL = "https://t.me/manukianartur1997";

const shared = {
  ru: {
    bookCta: "Забронировать звонок",
    heroStatLabel: "Средний Value at Risk на аудит",
    heroStatValue: "$8,400",
    heroStatSub: "выручки под риском, которую вскрывает один разбор звонков",
    authorName: "Артур Манукян",
    authorRole: "Делаю аудит лично · отвечаю в течение рабочего дня",
    authorInitials: "АМ",
    socialProof: "Аудиты для команд EdTech, B2B SaaS и агентств в Украине и СНГ",
    miniStats: [["120+", "звонков разобрано вручную"], ["5", "ролей в рейтинге менеджеров"], ["48 ч", "до первого черновика выводов"]],
    reportTitle: "Sales Call Audit",
    reportSub: "EdTech · отдел продаж · 32 звонка",
    reportVarLabel: "Value at Risk",
    reportVarNote: "выручки под риском за квартал",
    reportSummaryLabel: "Главный вывод",
    reportSummary: "Цена звучит до ценности, а следующий шаг не фиксируется. Деньги теряются на первом диагностическом звонке.",
    reportMgrLabel: "Рейтинг менеджеров",
    reportManagers: [["M-2", "Discovery проседает", 41], ["M-1", "Сильный, но без next step", 68], ["M-4", "Эталон по структуре", 88]],
    reportQuoteLabel: "Доказ из звонка",
    reportQuote: "«У нас курс стоит 14 500 грн.» — клиент: «Понятно, я подумаю.»",
    reportTagLabels: ["Discovery", "Next step", "Marketing vs Sales"],
    badgeVerified: "Пример структуры отчёта",
  },
  uk: {
    bookCta: "Забронювати дзвінок",
    heroStatLabel: "Середній Value at Risk на аудит",
    heroStatValue: "$8,400",
    heroStatSub: "виручки під ризиком, яку розкриває один розбір дзвінків",
    authorName: "Артур Манукян",
    authorRole: "Роблю аудит особисто · відповідаю протягом робочого дня",
    authorInitials: "АМ",
    socialProof: "Аудити для команд EdTech, B2B SaaS і агенцій в Україні та СНД",
    miniStats: [["120+", "дзвінків розібрано вручну"], ["5", "ролей у рейтингу менеджерів"], ["48 год", "до першого чернетки висновків"]],
    reportTitle: "Sales Call Audit",
    reportSub: "EdTech · відділ продажів · 32 дзвінки",
    reportVarLabel: "Value at Risk",
    reportVarNote: "виручки під ризиком за квартал",
    reportSummaryLabel: "Головний висновок",
    reportSummary: "Ціна звучить до цінності, а наступний крок не фіксується. Гроші втрачаються на першому діагностичному дзвінку.",
    reportMgrLabel: "Рейтинг менеджерів",
    reportManagers: [["M-2", "Discovery просідає", 41], ["M-1", "Сильний, але без next step", 68], ["M-4", "Еталон за структурою", 88]],
    reportQuoteLabel: "Доказ із дзвінка",
    reportQuote: "«У нас курс коштує 14 500 грн.» — клієнт: «Зрозуміло, я подумаю.»",
    reportTagLabels: ["Discovery", "Next step", "Marketing vs Sales"],
    badgeVerified: "Приклад структури звіту",
  },
  en: {
    bookCta: "Book a call",
    heroStatLabel: "Average Value at Risk per audit",
    heroStatValue: "$8,400",
    heroStatSub: "in at-risk revenue surfaced by one call review",
    authorName: "Artur Manukian",
    authorRole: "I run every audit personally · reply within a business day",
    authorInitials: "AM",
    socialProof: "Audits for EdTech, B2B SaaS, and agency sales teams across Ukraine and CIS",
    miniStats: [["120+", "calls reviewed by hand"], ["5", "roles in the manager ranking"], ["48 h", "to the first draft of findings"]],
    reportTitle: "Sales Call Audit",
    reportSub: "EdTech · sales team · 32 calls",
    reportVarLabel: "Value at Risk",
    reportVarNote: "in at-risk revenue this quarter",
    reportSummaryLabel: "Executive summary",
    reportSummary: "Price lands before value and the next step is never locked in. Money leaks on the first discovery call.",
    reportMgrLabel: "Manager ranking",
    reportManagers: [["M-2", "Discovery is weak", 41], ["M-1", "Strong, no next step", 68], ["M-4", "Benchmark on structure", 88]],
    reportQuoteLabel: "Call evidence",
    reportQuote: "“Our course is $390.” — Client: “Got it, I’ll think about it.”",
    reportTagLabels: ["Discovery", "Next step", "Marketing vs Sales"],
    badgeVerified: "Sample report structure",
  },
};

Object.assign(copy.ru, shared.ru, { bookUrl: BOOK_URL });
Object.assign(copy.uk, shared.uk, { bookUrl: BOOK_URL });
Object.assign(copy.en, shared.en, { bookUrl: BOOK_URL });

const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const url = (l) => (l === "ru" ? "/ru/" : copy[l].url);
const list = (items) => items.map((i) => `<li>${esc(i)}</li>`).join("");
const mini = (items) => items.map(([a, b]) => `<article class="mini-card"><strong>${esc(a)}</strong><p>${esc(b)}</p></article>`).join("");

function fields(t) {
  const names = ["name", "contact", "company", "website", "teamSize", "niche", "dataFormat", "pain", "dataLink"];
  const rendered = t.fields.map((label, i) => {
    const tag = i >= 7 ? "textarea" : "input";
    return `<label${i >= 6 ? ' class="full"' : ""}>${esc(label)}<${tag} name="${names[i]}"${i < 3 ? " required" : ""} placeholder="${esc(t.placeholders[i])}"></${tag}></label>`;
  }).join("");
  // Honeypot: hidden from humans, only bots fill it. Server treats it as spam.
  const honeypot = `<div class="hp" aria-hidden="true"><label>Company website<input type="text" name="company_website" tabindex="-1" autocomplete="off"></label></div>`;
  return rendered + honeypot;
}

function render(locale) {
  const t = copy[locale];
  const langs = ["ru", "uk", "en"].map((l) => `<a class="lang-pill${l === locale ? " active" : ""}" href="${url(l)}">${l === "uk" ? "UA" : l.toUpperCase()}</a>`).join("");
  const steps = t.steps.map(([a, b, c]) => `<article class="step-card"><small>${esc(a)}</small><strong>${esc(b)}</strong><p>${esc(c)}</p></article>`).join("");
  const leaks = t.leaks.map(([a, b, c]) => `<article class="leak-row"><div><strong>${esc(a)}</strong><p>${esc(b)}</p></div><span>${esc(c)}</span></article>`).join("");
  const tiers = t.tiers.map(([a, b, c, d, e, f]) => `<article class="tier-card${f ? " featured" : ""}">${f ? `<span class="featured-label">${esc(f)}</span>` : ""}<h3>${esc(a)}</h3><div class="price">${esc(b)}</div><p>${esc(c)}</p><ul>${list(d)}</ul><a href="#request">${esc(e)}</a></article>`).join("");
  const faq = t.faq.map(([a, b]) => `<details class="faq-item"><summary>${esc(a)}</summary><p>${esc(b)}</p></details>`).join("");
  const sampleMetrics = t.sampleMetrics.map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join("");
  const demoHub = [
    ["01", "Public landing", "/", "Витрина оффера, форма заявки и входы во все демо-слои."],
    ["02", "Platform demo", "/platform/", "Кликабельная продуктовая платформа: Owner, ROP и Manager views."],
    ["03", "Client workspace", "/client.html", "MVP-кабинет клиента: транскрипты, анализ, отчеты и лимиты."],
    ["04", "Operator admin", "/admin.html", "Твой операторский контур: заявки, импорт звонков, отчеты и экспорт."]
  ].map(([n, a, href, b]) => `<a class="demo-route reveal" href="${href}"><small>${n}</small><strong>${esc(a)}</strong><span>${esc(b)}</span></a>`).join("");

  const miniStats = (t.miniStats || []).map(([a, b]) => `<div class="hero-stat-mini"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("");

  // Real-looking sample report "screenshot" rendered as styled HTML (prints crisp, no image asset needed).
  const mgrBars = (t.reportManagers || []).map(([id, note, score]) => {
    const tone = score >= 80 ? "good" : score >= 60 ? "mid" : "bad";
    return `<div class="rep-mgr"><div class="rep-mgr-head"><b>${esc(id)}</b><span>${esc(note)}</span></div><div class="rep-bar"><i class="${tone}" style="width:${score}%"></i></div><em>${score}</em></div>`;
  }).join("");
  const repTags = (t.reportTagLabels || []).map((label, i) => `<span class="rep-tag${i === 0 ? " danger" : ""}">${esc(label)}</span>`).join("");
  const reportShot = `<div class="report-shot"><div class="rep-chrome"><span></span><span></span><span></span><em>callcontrol-ai-audit.pdf</em></div><div class="rep-body"><div class="rep-top"><div><div class="rep-kicker">${esc(t.reportTitle)}</div><div class="rep-sub">${esc(t.reportSub)}</div></div><div class="rep-badge">${esc(t.badgeVerified)}</div></div><div class="rep-var"><span>${esc(t.reportVarLabel)}</span><b>${esc(t.heroStatValue)}</b><small>${esc(t.reportVarNote)}</small></div><div class="rep-block"><div class="rep-label">${esc(t.reportSummaryLabel)}</div><p>${esc(t.reportSummary)}</p></div><div class="rep-block"><div class="rep-label">${esc(t.reportMgrLabel)}</div>${mgrBars}</div><div class="rep-block rep-quote"><div class="rep-label">${esc(t.reportQuoteLabel)}</div><blockquote>${esc(t.reportQuote)}</blockquote></div><div class="rep-tags">${repTags}</div></div></div>`;

  return `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(t.title)}</title><meta name="description" content="${esc(t.desc)}"/><meta property="og:title" content="${esc(t.title)}"/><meta property="og:description" content="${esc(t.desc)}"/><meta property="og:type" content="website"/><style>${css()}</style></head><body><header class="topbar"><div class="wrap nav"><a class="brand" href="${url(locale)}"><strong>CallControl AI</strong><span>${esc(t.badge)}</span></a><nav class="nav-links"><a href="#process">${esc(t.nav[0])}</a><a href="#sample">${esc(t.nav[1])}</a><a href="#pricing">${esc(t.nav[2])}</a><a href="#faq">${esc(t.nav[3])}</a><a class="nav-cta" href="${esc(t.bookUrl)}" target="_blank" rel="noopener">${esc(t.bookCta)}</a></nav><div class="lang-switch">${langs}</div></div></header><main><section class="hero"><div class="hero-glow" aria-hidden="true"></div><div class="wrap hero-grid"><div class="hero-copy"><span class="badge reveal">${esc(t.badge)}</span><h1 class="reveal">${esc(t.h1)}</h1><p class="hero-lead reveal">${esc(t.lead)}</p><div class="hero-stat reveal"><div class="hero-stat-main"><span>${esc(t.heroStatLabel)}</span><b>${esc(t.heroStatValue)}</b><small>${esc(t.heroStatSub)}</small></div><div class="hero-stat-grid">${miniStats}</div></div><div class="actions reveal"><a class="button primary" href="${esc(t.bookUrl)}" target="_blank" rel="noopener">${esc(t.bookCta)}</a><a class="button secondary" href="#request">${esc(t.cta)}</a><a class="button ghost" href="#sample">${esc(t.sample)}</a></div><div class="author reveal"><span class="author-avatar" aria-hidden="true">${esc(t.authorInitials)}</span><div class="author-meta"><strong>${esc(t.authorName)}</strong><span>${esc(t.authorRole)}</span></div></div></div><aside class="hero-aside reveal">${reportShot}</aside></div><div class="wrap social-proof reveal"><span>${esc(t.socialProof)}</span></div></section><section id="sample"><div class="wrap sample-layout"><div class="sample-side"><div class="section-head reveal"><h2>${esc(t.sampleTitle)}</h2><p>${esc(t.sampleLead)}</p><div class="sample-note">${esc(t.sampleNote)}</div></div><div class="sample-list reveal">${sampleMetrics}</div><div class="actions reveal"><a class="button primary" href="${t.sampleFile}" target="_blank" rel="noopener">${esc(t.sample)}</a><a class="button secondary" href="${esc(t.bookUrl)}" target="_blank" rel="noopener">${esc(t.bookCta)}</a></div></div><div class="sample-shot reveal">${reportShot}</div></div><div class="wrap"><div class="grid-4 sample-cards">${mini(t.cards)}</div></div></section><section id="process"><div class="wrap"><div class="section-head reveal"><h2>${esc(t.processTitle)}</h2><p>${esc(t.processLead)}</p></div><div class="grid-4">${steps}</div></div></section><section><div class="wrap"><div class="section-head reveal"><h2>${esc(t.leakTitle)}</h2><p>${esc(t.leakLead)}</p></div><div class="leak-stack">${leaks}</div></div></section><section id="pricing"><div class="wrap"><div class="section-head reveal"><h2>${esc(t.pricingTitle)}</h2><p>${esc(t.pricingLead)}</p></div><div class="pricing-grid">${tiers}</div></div></section><section><div class="wrap"><div class="section-head reveal"><h2>${esc(t.futureTitle)}</h2><p>${esc(t.futureLead)}</p></div><div class="future-grid">${mini(t.future)}</div><p class="future-note">${esc(t.futureNote)}</p></div></section><section id="faq"><div class="wrap"><div class="section-head reveal"><h2>${esc(t.faqTitle)}</h2></div><div class="faq-grid">${faq}</div></div></section><section id="request"><div class="wrap"><div class="form-card reveal"><div class="section-head"><h2>${esc(t.formTitle)}</h2><p>${esc(t.formLead)}</p></div><form id="leadForm"><div class="form-grid">${fields(t)}</div><div class="actions"><button class="button primary" type="submit">${esc(t.send)}</button><a class="button secondary" href="${esc(t.bookUrl)}" target="_blank" rel="noopener">${esc(t.bookCta)}</a></div><div class="form-status" id="formStatus"></div><p class="privacy">${esc(t.privacy)}</p></form></div></div></section></main><footer class="footer"><div class="wrap footer-inner"><span>${esc(t.footer)}</span><span>Telegram: @manukianartur1997</span></div></footer><script>(function(){const ok=${JSON.stringify(t.ok)},fail=${JSON.stringify(t.fail)},sending=${JSON.stringify(t.sending)},send=${JSON.stringify(t.send)};const started=Date.now();const f=document.querySelector("#leadForm"),s=document.querySelector("#formStatus");f.addEventListener("submit",async(e)=>{e.preventDefault();const b=f.querySelector('button[type=submit]');b.disabled=true;b.textContent=sending;s.innerHTML="";const p=Object.fromEntries(new FormData(f).entries());p.source="callcontrol-public-landing";p.locale=${JSON.stringify(locale)};p.formElapsedMs=Date.now()-started;try{const r=await fetch("/api/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});if(!r.ok)throw new Error("request_failed");s.innerHTML="<strong>"+ok[0]+"</strong><br>"+ok[1];f.reset()}catch(_){s.innerHTML="<strong>"+fail[0]+"</strong><br>"+fail[1]}finally{b.disabled=false;b.textContent=send}});const io=new IntersectionObserver((es)=>{es.forEach((en)=>{if(en.isIntersecting){en.target.classList.add("in");io.unobserve(en.target)}})},{threshold:.12,rootMargin:"0px 0px -40px 0px"});document.querySelectorAll(".reveal").forEach((el,i)=>{el.style.transitionDelay=(Math.min(i,6)*40)+"ms";io.observe(el)});const tb=document.querySelector(".topbar");addEventListener("scroll",()=>{tb.classList.toggle("scrolled",scrollY>8)},{passive:true})})();</script></body></html>`;
}

function css() {
  return `@import url("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap");
*{box-sizing:border-box}
:root{--accent:#38bdf8;--accent2:#6366f1;--ink:#f8fafc;--muted:#9fb1c7;--line:rgba(226,232,240,.12);--card:rgba(255,255,255,.045);--radius:16px}
html{scroll-behavior:smooth}
body{margin:0;color:var(--ink);background:radial-gradient(1100px 540px at 78% -8%,rgba(56,189,248,.16),transparent 60%),radial-gradient(900px 520px at 8% 8%,rgba(99,102,241,.16),transparent 55%),linear-gradient(180deg,#040813 0%,#060c18 44%,#0a1120 100%);background-attachment:fixed;font-family:Geist,Inter,system-ui,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{width:min(1180px,calc(100% - 40px));margin:0 auto}
.topbar{position:sticky;top:0;z-index:30;border-bottom:1px solid transparent;background:transparent;transition:background .25s ease,border-color .25s ease,backdrop-filter .25s ease}
.topbar.scrolled{border-bottom:1px solid var(--line);background:rgba(4,8,19,.72);backdrop-filter:blur(18px)}
.nav{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:72px}
.brand{display:flex;flex-direction:column;text-decoration:none}
.brand strong{font-size:17px;letter-spacing:-.02em}
.brand span{color:var(--muted);font-size:12px}
.nav-links{display:flex;align-items:center;gap:22px;color:var(--muted);font-size:14px}
.nav-links a{text-decoration:none;transition:color .18s ease}.nav-links a:hover{color:var(--ink)}
.nav-cta{padding:9px 15px;border:1px solid rgba(125,211,252,.4);border-radius:999px;background:rgba(56,189,248,.12);color:#e0f2fe;font-weight:600}.nav-cta:hover{background:rgba(56,189,248,.2)}
.lang-switch{display:flex;gap:6px}
.lang-pill{min-width:34px;padding:7px 9px;border:1px solid var(--line);border-radius:9px;text-align:center;text-decoration:none;color:var(--muted);font:600 12px "JetBrains Mono",monospace;transition:all .18s ease}
.lang-pill.active{color:#f8fafc;border-color:rgba(125,211,252,.42);background:rgba(125,211,252,.11)}
section{padding:clamp(56px,8vw,108px) 0}
h1,h2,h3{margin:0;font-weight:600;letter-spacing:-.03em}
h1{font-size:clamp(40px,6.4vw,78px);line-height:1.02;font-weight:700}
.badge{display:inline-flex;align-items:center;gap:7px;padding:7px 13px;border:1px solid rgba(125,211,252,.25);border-radius:999px;background:rgba(125,211,252,.08);color:#bae6fd;font:600 11px "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.04em}
.button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:13px 20px;border-radius:12px;border:1px solid var(--line);text-decoration:none;font-weight:600;transition:transform .16s ease,box-shadow .16s ease,background .16s ease,border-color .16s ease}
.button:hover{transform:translateY(-1px)}
.button.primary{border-color:transparent;background:linear-gradient(135deg,#38bdf8,#6366f1);color:#fff;box-shadow:0 16px 40px rgba(56,189,248,.22)}.button.primary:hover{box-shadow:0 20px 52px rgba(56,189,248,.32)}
.button.secondary{background:rgba(255,255,255,.06)}.button.secondary:hover{background:rgba(255,255,255,.11)}
.button.ghost{border-color:transparent;background:transparent;color:var(--muted)}.button.ghost:hover{color:var(--ink)}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
/* hero */
.hero{position:relative;padding-top:clamp(48px,8vw,96px);overflow:hidden}
.hero-glow{position:absolute;inset:-20% -10% auto;height:560px;background:radial-gradient(620px 360px at 75% 12%,rgba(99,102,241,.22),transparent 70%);filter:blur(8px);pointer-events:none}
.hero-grid{position:relative;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(360px,.95fr);gap:clamp(28px,5vw,64px);align-items:center}
.hero-copy h1{margin-top:18px;max-width:14ch}
.hero-lead{max-width:54ch;margin:20px 0 0;color:var(--muted);font-size:clamp(17px,1.6vw,20px)}
.hero-stat{margin-top:30px;display:grid;gap:14px;padding:20px;border:1px solid var(--line);border-radius:var(--radius);background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02))}
.hero-stat-main span{display:block;color:var(--muted);font:600 12px "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.05em}
.hero-stat-main b{display:block;margin:6px 0 4px;font-size:clamp(44px,6vw,68px);line-height:1;font-weight:700;background:linear-gradient(120deg,#fff,#7dd3fc 55%,#a5b4fc);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;font-family:Geist,sans-serif;letter-spacing:-.04em}
.hero-stat-main small{display:block;color:var(--muted);font-size:13px;max-width:46ch}
.hero-stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding-top:14px;border-top:1px solid var(--line)}
.hero-stat-mini b{display:block;font:600 18px "JetBrains Mono",monospace;color:#e0f2fe}
.hero-stat-mini span{display:block;margin-top:3px;color:var(--muted);font-size:11.5px;line-height:1.4}
.author{display:flex;align-items:center;gap:13px;margin-top:26px}
.author-avatar{display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#38bdf8,#6366f1);color:#fff;font-weight:700;font-size:16px;letter-spacing:.02em;box-shadow:0 8px 22px rgba(56,189,248,.3)}
.author-meta strong{display:block;font-size:15px}
.author-meta span{color:var(--muted);font-size:13px}
.social-proof{margin-top:46px;padding-top:24px;border-top:1px solid var(--line)}
.social-proof span{color:var(--muted);font:600 13px "JetBrains Mono",monospace;letter-spacing:.02em}
/* report screenshot */
.hero-aside{position:relative}
.report-shot{border-radius:18px;border:1px solid rgba(148,163,184,.18);background:linear-gradient(180deg,#0c1424,#0a101d);box-shadow:0 40px 90px rgba(2,6,23,.6),0 0 0 1px rgba(125,211,252,.04);overflow:hidden}
.hero-aside .report-shot{transform:perspective(1600px) rotateY(-7deg) rotateX(2deg)}
.rep-chrome{display:flex;align-items:center;gap:7px;padding:12px 15px;border-bottom:1px solid rgba(148,163,184,.14);background:rgba(255,255,255,.02)}
.rep-chrome span{width:11px;height:11px;border-radius:50%;background:rgba(148,163,184,.3)}.rep-chrome span:first-child{background:#fb7185}.rep-chrome span:nth-child(2){background:#fbbf24}.rep-chrome span:nth-child(3){background:#34d399}
.rep-chrome em{margin-left:8px;color:#7d8fa6;font:600 11px "JetBrains Mono",monospace;font-style:normal}
.rep-body{padding:20px}
.rep-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}
.rep-kicker{font-size:18px;font-weight:700;letter-spacing:-.02em}
.rep-sub{margin-top:3px;color:var(--muted);font:600 11px "JetBrains Mono",monospace}
.rep-badge{flex:none;padding:6px 9px;border-radius:999px;background:rgba(245,158,11,.13);color:#fcd34d;font:600 10px "JetBrains Mono",monospace}
.rep-var{padding:16px;border-radius:14px;border:1px solid rgba(251,113,133,.22);background:linear-gradient(135deg,rgba(251,113,133,.1),rgba(99,102,241,.06));margin-bottom:16px}
.rep-var span{color:var(--muted);font:600 11px "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.05em}
.rep-var b{display:block;margin:5px 0 2px;font-size:34px;font-weight:700;color:#fecdd3;letter-spacing:-.03em}
.rep-var small{color:var(--muted);font-size:12px}
.rep-block{margin-bottom:16px}
.rep-label{margin-bottom:9px;color:#7dd3fc;font:600 11px "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.05em}
.rep-block p{margin:0;color:#cbd5e1;font-size:13.5px;line-height:1.55}
.rep-mgr{display:grid;grid-template-columns:1fr 84px 26px;align-items:center;gap:10px;margin-bottom:9px}
.rep-mgr-head b{font:600 13px "JetBrains Mono",monospace;color:#e0f2fe}
.rep-mgr-head span{display:block;margin-top:1px;color:var(--muted);font-size:11px}
.rep-bar{height:7px;border-radius:999px;background:rgba(148,163,184,.16);overflow:hidden}
.rep-bar i{display:block;height:100%;border-radius:999px}
.rep-bar i.good{background:linear-gradient(90deg,#34d399,#10b981)}.rep-bar i.mid{background:linear-gradient(90deg,#fbbf24,#f59e0b)}.rep-bar i.bad{background:linear-gradient(90deg,#fb7185,#f43f5e)}
.rep-mgr em{font:600 12px "JetBrains Mono",monospace;color:var(--muted);font-style:normal;text-align:right}
.rep-quote blockquote{margin:0;padding:12px 14px;border-left:3px solid rgba(125,211,252,.5);border-radius:0 10px 10px 0;background:rgba(125,211,252,.06);color:#cbd5e1;font-size:13px;line-height:1.55}
.rep-tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:2px}
.rep-tag{padding:5px 10px;border-radius:999px;background:rgba(148,163,184,.12);color:#cbd5e1;font:600 11px "JetBrains Mono",monospace}
.rep-tag.danger{background:rgba(251,113,133,.14);color:#fecdd3}
/* generic layout */
.section-head{max-width:760px;margin-bottom:36px}
.section-head h2{font-size:clamp(28px,4.2vw,50px);line-height:1.06}
.section-head p{margin-top:14px;color:var(--muted);font-size:clamp(16px,1.5vw,18px)}
.grid-4,.future-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.mini-card,.step-card,.leak-row,.tier-card,.faq-item,.form-card{border:1px solid var(--line);background:var(--card);border-radius:var(--radius)}
.mini-card,.step-card{padding:20px;transition:border-color .2s ease,transform .2s ease,background .2s ease}
.mini-card:hover,.step-card:hover{border-color:rgba(125,211,252,.3);transform:translateY(-2px);background:rgba(255,255,255,.06)}
.mini-card strong,.step-card strong{font-size:16px}
.mini-card p,.step-card p{display:block;margin-top:8px;color:var(--muted);font-size:13.5px;line-height:1.55}
.step-card small{display:block;margin-bottom:14px;color:#7dd3fc;font:600 13px "JetBrains Mono",monospace}
/* sample section */
.sample-layout{display:grid;grid-template-columns:minmax(0,.92fr) minmax(360px,1.08fr);gap:clamp(28px,5vw,58px);align-items:center;margin-bottom:34px}
.sample-side{display:grid;gap:18px;align-content:start}
.sample-side .section-head{margin-bottom:0}
.sample-list{display:grid;gap:2px}
.sample-list div{display:flex;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid var(--line);font-size:14px;color:var(--muted)}
.sample-list b{font-family:"JetBrains Mono",monospace;color:#7dd3fc}
.sample-note{padding:13px 14px;border-radius:12px;background:rgba(245,158,11,.1);color:#fcd34d;font-size:13px;line-height:1.45}
.sample-shot .report-shot{transform:perspective(1700px) rotateY(5deg) rotateX(2deg)}
.sample-cards{margin-top:8px}
/* leaks */
.leak-stack{display:grid;gap:12px}
.leak-row{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;padding:18px 20px;transition:border-color .2s ease,background .2s ease}
.leak-row:hover{border-color:rgba(251,113,133,.28);background:rgba(255,255,255,.05)}
.leak-row strong{font-size:16px}
.leak-row p{margin:6px 0 0;color:var(--muted);line-height:1.5;font-size:14px}
.leak-row span{padding:7px 11px;border-radius:999px;background:rgba(251,113,133,.12);color:#fecdd3;font:600 11px "JetBrains Mono",monospace;white-space:nowrap}
/* pricing */
.pricing-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.tier-card{position:relative;padding:26px;transition:border-color .2s ease,transform .2s ease}
.tier-card:hover{transform:translateY(-3px)}
.tier-card.featured{border-color:rgba(125,211,252,.42);background:linear-gradient(180deg,rgba(56,189,248,.1),rgba(99,102,241,.05));box-shadow:0 28px 70px rgba(56,189,248,.14)}
.featured-label{position:absolute;right:18px;top:18px;padding:6px 10px;border-radius:999px;background:rgba(56,189,248,.18);color:#bae6fd;font:600 11px "JetBrains Mono",monospace}
.tier-card h3{font-size:22px}
.price{margin-top:14px;color:#fff;font-size:30px;font-weight:700;letter-spacing:-.02em}
.tier-card>p{margin-top:8px;color:var(--muted);font-size:14px}
.tier-card ul{margin:20px 0;padding-left:20px;color:var(--muted);line-height:1.7;font-size:14px}
.tier-card a{display:inline-flex;width:100%;justify-content:center;min-height:46px;align-items:center;padding:12px 14px;border-radius:11px;background:rgba(255,255,255,.06);border:1px solid var(--line);text-decoration:none;font-weight:600;transition:background .18s ease}
.tier-card.featured a{background:linear-gradient(135deg,#38bdf8,#6366f1);border-color:transparent;color:#fff}
.tier-card a:hover{background:rgba(255,255,255,.12)}.tier-card.featured a:hover{filter:brightness(1.05)}
.future-grid .mini-card{padding:18px}
.future-note{margin-top:16px;color:var(--muted);font-size:14px}
/* faq */
.faq-grid{display:grid;gap:10px}
.faq-item summary{cursor:pointer;padding:18px 20px;font-weight:600;list-style:none}
.faq-item summary::-webkit-details-marker{display:none}
.faq-item summary::after{content:"+";float:right;color:var(--muted);font-weight:400}
.faq-item[open] summary::after{content:"–"}
.faq-item p{margin:0;padding:0 20px 20px;color:var(--muted);line-height:1.6}
/* form */
.form-card{padding:clamp(22px,4vw,40px)}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
label{display:grid;gap:7px;color:var(--muted);font-size:13px}
input,textarea{width:100%;border:1px solid var(--line);border-radius:11px;background:rgba(2,6,23,.5);color:var(--ink);font:inherit;padding:13px 14px;outline:none;transition:border-color .18s ease,box-shadow .18s ease}
input:focus,textarea:focus{border-color:rgba(125,211,252,.55);box-shadow:0 0 0 3px rgba(56,189,248,.14)}
textarea{min-height:108px;resize:vertical}
.full{grid-column:1/-1}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.form-status{margin-top:16px;min-height:42px;color:var(--muted);line-height:1.5}
.form-status strong{color:var(--ink)}
.privacy{margin-top:12px;color:#6b7c93;font-size:13px}
/* footer */
.footer{padding:30px 0 48px;color:var(--muted);border-top:1px solid var(--line)}
.footer-inner{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;font-size:14px}
/* reveal */
.reveal{opacity:0;transform:translateY(16px);transition:opacity .6s cubic-bezier(.22,1,.36,1),transform .6s cubic-bezier(.22,1,.36,1)}
.reveal.in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}.button:hover,.mini-card:hover,.step-card:hover,.tier-card:hover{transform:none}html{scroll-behavior:auto}}
@media(max-width:980px){.hero-grid,.sample-layout,.pricing-grid{grid-template-columns:1fr}.hero-aside .report-shot,.sample-shot .report-shot{transform:none}.grid-4,.future-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.nav-links{display:none}.sample-shot{order:-1}}
@media(max-width:640px){.wrap{width:min(100% - 28px,1180px)}.grid-4,.future-grid,.form-grid{grid-template-columns:1fr}.hero-stat-grid{grid-template-columns:1fr}.leak-row{grid-template-columns:1fr}.footer-inner{flex-direction:column}}`;
}

module.exports = function generatePublicLandingLive() {
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
