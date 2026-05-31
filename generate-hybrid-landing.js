const fs = require("fs");
const path = require("path");

const root = __dirname;
const outDir = path.join(root, "dist");

const locales = {
  ru: {
    htmlLang: "ru",
    dir: "",
    title: "CallControl AI — аудит звонков отдела продаж",
    description: "Productized AI-аудит звонков отдела продаж: 20-50 записей, PDF-отчёт, Value at Risk, рейтинг менеджеров и план действий.",
    nav: {
      process: "Как работает",
      sample: "Пример отчёта",
      pricing: "Форматы",
      faq: "FAQ",
      request: "Запросить аудит",
    },
    switcherLabel: "Язык",
    badge: "AI-аудит звонков · done-for-you",
    h1: "Аудит звонков отдела продаж за 5 рабочих дней",
    lead: "Найдём, где теряются деньги в воронке. Вернём PDF с конкретными цитатами, рейтингом менеджеров, Marketing vs Sales verdict и планом действий.",
    primary: "Запросить аудит",
    secondary: "Посмотреть пример",
    trust: [
      ["20-50", "звонков в одном аудите"],
      ["5-7", "рабочих дней до отчёта"],
      ["30/60/90", "план действий для РОПа"],
    ],
    proofTitle: "Что получает руководитель",
    proofRows: [
      ["Value at Risk", "Оценка денег под риском в текущей воронке.", "$8.4k", "risk"],
      ["Manager Ranking", "Кто держит стандарт, а кому нужен коучинг.", "5 ролей", ""],
      ["Marketing vs Sales", "Где проблема: качество лида, продажа или оффер.", "verdict", ""],
      ["Call Evidence", "Цитаты с таймкодами вместо общих мнений.", "4+ блока", "risk"],
    ],
    sampleTitle: "Так выглядит пример отчёта",
    sampleLead: "Синтетический пример для EdTech-школы. Он показывает структуру будущего отчёта: executive summary, Value at Risk, цитаты, рейтинг менеджеров и action plan.",
    sampleDisclaimer: "Важно: пример не является кейсом реального клиента. Все цифры и цитаты нужны только для демонстрации формата.",
    sampleCta: "Открыть пример структуры",
    sampleCards: [
      ["Короткий висновок", "Один главный вывод, top-3 приоритета и где теряется выручка."],
      ["Value at Risk", "Расчёт impact от провалов в звонках на вашем baseline."],
      ["Call Quotes", "Конкретные фразы менеджеров и объяснение, почему сделка остывает."],
      ["Action Plan", "Что исправить в первые 30, 60 и 90 дней."],
    ],
    processTitle: "Как проходит аудит",
    processLead: "Без сложной интеграции и долгого внедрения. Сначала услуга, потом уже автоматизация там, где она действительно нужна.",
    steps: [
      ["01", "Заявка и короткий звонок", "Вы оставляете контакт. Мы уточняем сегмент, объём звонков, формат записей и главный вопрос аудита."],
      ["02", "Передача записей", "Вы передаёте записи или транскрипты через Drive/Dropbox. При необходимости подписываем NDA до доступа к данным."],
      ["03", "AI-разбор и ручное ревью", "Каждый звонок проходит структурный анализ. Финальные выводы проверяются вручную, чтобы убрать сырой AI-output."],
      ["04", "PDF и walk-through", "Вы получаете отчёт и разбор: что чинить первым, кого коучить и какие изменения внедрить на планёрке."],
    ],
    leakTitle: "Где обычно течёт выручка",
    leakLead: "Аудит не спорит абстрактно о “плохих лидах”. Он разделяет ответственность между маркетингом, продажами и процессом.",
    leaks: [
      ["Discovery", "Менеджер говорит про продукт до того, как понял боль, бюджет и timing.", "высокий риск"],
      ["Next Step", "Звонок заканчивается “я перезвоню” без даты, времени и договорённости.", "частый leak"],
      ["Offer Fit", "Клиент пришёл с одним ожиданием, а продажа презентует другой оффер.", "marketing/sales"],
      ["Price Talk", "Цена звучит до ценности, и клиент уходит “подумать”.", "money leak"],
    ],
    pricingTitle: "Форматы аудита",
    pricingLead: "Цены — за разовый аудит. Объём можно уточнить после короткого discovery-звонка.",
    tiers: [
      {
        name: "Express",
        price: "от $700",
        meta: "до 20 звонков · 5 рабочих дней",
        bullets: ["один сегмент продаж", "PDF 12-15 страниц", "30 минут walk-through", "3 главных риска и быстрые фиксы"],
        cta: "Заказать Express",
      },
      {
        name: "Team",
        price: "от $1,500",
        meta: "20-40 звонков · 7 рабочих дней",
        bullets: ["до 6 менеджеров в рейтинге", "Marketing vs Sales verdict", "Value at Risk от вашего baseline", "follow-up через 2 недели"],
        cta: "Обсудить Team Audit",
        featured: "Рекомендуемый",
      },
      {
        name: "Department",
        price: "от $3,000",
        meta: "40-80 звонков · 10 рабочих дней",
        bullets: ["несколько команд или направлений", "глубокая сегментация причин потерь", "60 минут walk-through", "2 follow-up сессии"],
        cta: "Обсудить scope",
      },
    ],
    futureTitle: "Что появится в self-serve версии",
    futureLead: "Сейчас мы продаём аудит как услугу. Self-serve кабинет нужен позже, когда станет ясно, какие паттерны повторяются у первых клиентов.",
    futureItems: [
      ["Загрузка звонков", "Клиент сам добавляет аудио, транскрипты или ссылки на папку."],
      ["Личный кабинет", "Owner, РОП и менеджер видят разные уровни отчётов."],
      ["CRM summary", "Итоги звонка и следующий шаг уходят в карточку лида."],
      ["Weekly digest", "Короткий отчёт в Telegram для владельца и РОПа."],
    ],
    futureNote: "Этот блок оставлен как карта развития, а не обещание сроков. В заявке можно отметить интерес к раннему доступу.",
    faqTitle: "FAQ",
    faqs: [
      ["Что если у нас нет записей звонков?", "Подходят записи Zoom, Google Meet, телефонии, голосовые из Telegram или готовые транскрипты. Если записей мало, лучше сначала накопить 2 недели данных."],
      ["Какой минимум звонков нужен?", "Желательно от 20 звонков. Меньше можно разобрать как быстрый срез, но выводы будут слабее статистически."],
      ["Что с конфиденциальностью?", "Можно подписать NDA до передачи записей. В отчёте менеджеры обозначаются как M-1, M-2 и так далее; mapping остаётся у вас."],
      ["Чем это отличается от Fireflies, Gong или CRM?", "Эти инструменты дают данные и транскрипты. CallControl превращает звонки в управленческий отчёт: где риск, почему он возник и что делать."],
      ["Можно ли анализировать поддержку, а не продажи?", "Да, но чек-лист меняется: тон, эмпатия, скорость реакции, эскалация, решение обращения и повторные контакты."],
      ["Будет ли кабинет, где мы сами загружаем звонки?", "Да, это направление развития. Сейчас работает done-for-you аудит: меньше внедрения, быстрее первый результат."],
      ["Что происходит после отчёта?", "Вы получаете action plan. При необходимости можно отдельно обсудить коучинг менеджеров или ежемесячный контроль."],
    ],
    formTitle: "Запросить аудит",
    formLead: "Оставьте контакт и короткий контекст. Я свяжусь в течение рабочего дня и скажу, какой формат подходит.",
    form: {
      name: "Имя",
      contact: "Telegram или email",
      company: "Компания",
      site: "Сайт или профиль",
      teamSize: "Размер отдела продаж",
      niche: "Сегмент",
      tariff: "Формат",
      pain: "Что хотите понять из аудита?",
      data: "Есть ли записи или транскрипты?",
      submit: "Отправить заявку",
      sending: "Отправка...",
      successTitle: "Заявка получена.",
      successText: "Свяжусь с вами в течение рабочего дня. Если срочно — напишите в Telegram: @manukianartur1997.",
      errorTitle: "Не удалось отправить форму.",
      errorText: "Попробуйте ещё раз или напишите напрямую: @manukianartur1997.",
      privacy: "Данные используются только для связи по заявке и подготовки аудита.",
    },
    placeholders: {
      name: "Как к вам обращаться",
      contact: "@username или email",
      company: "Название компании",
      site: "https://...",
      teamSize: "3-7 менеджеров",
      niche: "EdTech / B2B SaaS / агентство",
      tariff: "Express / Team / Department / не уверен",
      pain: "Например: падает конверсия после первого звонка, менеджеры не закрывают следующий шаг",
      data: "Есть записи в Zoom/CRM/телефонии или только текстовые транскрипты",
    },
    footer: "CallControl AI · аудит звонков отдела продаж · Артур Манукян · Украина",
  },
  uk: {
    htmlLang: "uk",
    dir: "/uk/",
    title: "CallControl AI — аудит дзвінків відділу продажів",
    description: "Формат послуги: AI-аудит дзвінків відділу продажів: 20-50 записів, PDF-звіт, Value at Risk, рейтинг менеджерів і план дій.",
    nav: {
      process: "Як працює",
      sample: "Приклад звіту",
      pricing: "Формати",
      faq: "FAQ",
      request: "Запросити аудит",
    },
    switcherLabel: "Мова",
    badge: "AI-аудит дзвінків · зробимо за вас",
    h1: "Аудит дзвінків відділу продажів за 5 робочих днів",
    lead: "Знайдемо, де ви втрачаєте гроші у воронці. Повернемо PDF з конкретними цитатами, рейтингом менеджерів, Marketing vs Sales verdict і планом дій.",
    primary: "Запросити аудит",
    secondary: "Подивитися приклад",
    trust: [
      ["20-50", "дзвінків в одному аудиті"],
      ["5-7", "робочих днів до звіту"],
      ["30/60/90", "план дій для керівника продажів"],
    ],
    proofTitle: "Що отримує керівник",
    proofRows: [
      ["Value at Risk", "Оцінка грошей під ризиком у поточній воронці.", "$8.4k", "risk"],
      ["Manager Ranking", "Хто тримає стандарт, а кому потрібен коучинг.", "5 ролей", ""],
      ["Marketing vs Sales", "Де проблема: якість ліда, продаж або пропозиція.", "verdict", ""],
      ["Call Evidence", "Цитати з таймкодами замість загальних думок.", "4+ блоки", "risk"],
    ],
    sampleTitle: "Так виглядає приклад звіту",
    sampleLead: "Синтетичний приклад для EdTech-школи. Він показує структуру майбутнього звіту: короткий висновок, Value at Risk, цитати, рейтинг менеджерів і план дій.",
    sampleDisclaimer: "Важливо: приклад не є кейсом реального клієнта. Усі цифри й цитати потрібні лише для демонстрації формату.",
    sampleCta: "Відкрити приклад структури",
    sampleCards: [
      ["Короткий висновок", "Один головний висновок, 3 пріоритети і де втрачається виручка."],
      ["Value at Risk", "Розрахунок впливу провалів у дзвінках на ваших базових метриках."],
      ["Call Quotes", "Конкретні фрази менеджерів і пояснення, чому угода холоне."],
      ["Action Plan", "Що виправити у перші 30, 60 і 90 днів."],
    ],
    processTitle: "Як проходить аудит",
    processLead: "Без складної інтеграції і довгого впровадження. Спочатку послуга, потім автоматизація там, де вона справді потрібна.",
    steps: [
      ["01", "Заявка і короткий дзвінок", "Ви залишаєте контакт. Ми уточнюємо сегмент, обсяг дзвінків, формат записів і головне питання аудиту."],
      ["02", "Передача записів", "Ви передаєте записи або транскрипти через Drive/Dropbox. За потреби підписуємо NDA до доступу до даних."],
      ["03", "AI-розбір і ручна перевірка", "Кожен дзвінок проходить структурний аналіз. Фінальні висновки перевіряються вручну, щоб прибрати сирі AI-висновки."],
      ["04", "PDF і walk-through", "Ви отримуєте звіт і розбір: що виправити першим, кого коучити і які зміни внести на планірці."],
    ],
    leakTitle: "Де зазвичай тече виручка",
    leakLead: "Аудит не сперечається абстрактно про “погані ліди”. Він розділяє відповідальність між маркетингом, продажем і процесом.",
    leaks: [
      ["Discovery", "Менеджер говорить про продукт до того, як зрозумів біль, бюджет і timing.", "високий ризик"],
      ["Next Step", "Дзвінок завершується “я передзвоню” без дати, часу і домовленості.", "частий leak"],
      ["Offer Fit", "Клієнт прийшов з одним очікуванням, а продаж презентує іншу пропозицію.", "marketing/sales"],
      ["Price Talk", "Ціна звучить до цінності, і клієнт йде “подумати”.", "money leak"],
    ],
    pricingTitle: "Формати аудиту",
    pricingLead: "Ціни — за разовий аудит. Обсяг можна уточнити після короткого discovery-дзвінка.",
    tiers: [
      {
        name: "Express",
        price: "від $700",
        meta: "до 20 дзвінків · 5 робочих днів",
        bullets: ["один сегмент продажів", "PDF 12-15 сторінок", "30 хвилин розбору", "3 головні ризики і швидкі фікси"],
        cta: "Замовити Express",
      },
      {
        name: "Team",
        price: "від $1,500",
        meta: "20-40 дзвінків · 7 робочих днів",
        bullets: ["до 6 менеджерів у рейтингу", "висновок Marketing vs Sales", "Value at Risk від ваших базових метрик", "повторна зустріч через 2 тижні"],
        cta: "Обговорити Team Audit",
        featured: "Рекомендований",
      },
      {
        name: "Department",
        price: "від $3,000",
        meta: "40-80 дзвінків · 10 робочих днів",
        bullets: ["кілька команд або напрямів", "глибока сегментація причин втрат", "60 хвилин розбору", "2 повторні сесії"],
        cta: "Обговорити обсяг",
      },
    ],
    futureTitle: "Що зʼявиться у версії для самостійного завантаження",
    futureLead: "Зараз ми продаємо аудит як послугу. Кабінет для самостійної роботи потрібен пізніше, коли стане зрозуміло, які патерни повторюються у перших клієнтів.",
    futureItems: [
      ["Завантаження дзвінків", "Клієнт сам додає аудіо, транскрипти або посилання на папку."],
      ["Особистий кабінет", "Власник, керівник продажів і менеджер бачать різні рівні звітів."],
      ["CRM-підсумок", "Підсумки дзвінка і наступний крок ідуть у картку ліда."],
      ["Тижневий дайджест", "Короткий звіт у Telegram для власника і керівника продажів."],
    ],
    futureNote: "Цей блок залишено як карту розвитку, а не обіцянку строків. У заявці можна відмітити інтерес до раннього доступу.",
    faqTitle: "FAQ",
    faqs: [
      ["Що якщо у нас немає записів дзвінків?", "Підходять записи Zoom, Google Meet, телефонії, голосові з Telegram або готові транскрипти. Якщо записів мало, краще спочатку накопичити 2 тижні даних."],
      ["Який мінімум дзвінків потрібен?", "Бажано від 20 дзвінків. Менше можна розібрати як швидкий зріз, але висновки будуть статистично слабші."],
      ["Що з конфіденційністю?", "Можна підписати NDA до передачі записів. У звіті менеджери позначаються як M-1, M-2 і так далі; відповідність імен залишається у вас."],
      ["Чим це відрізняється від Fireflies, Gong або CRM?", "Ці інструменти дають дані й транскрипти. CallControl перетворює дзвінки на управлінський звіт: де ризик, чому він виник і що робити."],
      ["Чи можна аналізувати підтримку, а не продаж?", "Так, але чек-лист змінюється: тон, емпатія, швидкість реакції, ескалація, вирішення звернення і повторні контакти."],
      ["Чи буде кабінет, де ми самі завантажуємо дзвінки?", "Так, це напрям розвитку. Зараз працює аудит у форматі послуги: менше впровадження, швидший перший результат."],
      ["Що відбувається після звіту?", "Ви отримуєте план дій. За потреби можна окремо обговорити коучинг менеджерів або щомісячний контроль."],
    ],
    formTitle: "Запросити аудит",
    formLead: "Залиште контакт і короткий контекст. Я звʼяжуся протягом робочого дня і скажу, який формат підходить.",
    form: {
      name: "Імʼя",
      contact: "Telegram або email",
      company: "Компанія",
      site: "Сайт або профіль",
      teamSize: "Розмір відділу продажів",
      niche: "Сегмент",
      tariff: "Формат",
      pain: "Що хочете зрозуміти з аудиту?",
      data: "Чи є записи або транскрипти?",
      submit: "Надіслати заявку",
      sending: "Надсилання...",
      successTitle: "Заявку отримано.",
      successText: "Звʼяжуся з вами протягом робочого дня. Якщо терміново — напишіть у Telegram: @manukianartur1997.",
      errorTitle: "Не вдалося надіслати форму.",
      errorText: "Спробуйте ще раз або напишіть напряму: @manukianartur1997.",
      privacy: "Дані використовуються лише для звʼязку щодо заявки і підготовки аудиту.",
    },
    placeholders: {
      name: "Як до вас звертатися",
      contact: "@username або email",
      company: "Назва компанії",
      site: "https://...",
      teamSize: "3-7 менеджерів",
      niche: "EdTech / B2B SaaS / агенція",
      tariff: "Express / Team / Department / не впевнений",
      pain: "Наприклад: падає конверсія після першого дзвінка, менеджери не закривають наступний крок",
      data: "Є записи в Zoom/CRM/телефонії або тільки текстові транскрипти",
    },
    footer: "CallControl AI · аудит дзвінків відділу продажів · Артур Манукян · Україна",
  },
  en: {
    htmlLang: "en",
    dir: "/en/",
    title: "CallControl AI — sales call audit",
    description: "Productized AI sales-call audit: 20-50 recordings, PDF report, Value at Risk, manager ranking, and an action plan.",
    nav: {
      process: "Process",
      sample: "Sample report",
      pricing: "Formats",
      faq: "FAQ",
      request: "Request audit",
    },
    switcherLabel: "Language",
    badge: "AI call audit · done-for-you",
    h1: "Sales call audit in 5 business days",
    lead: "Find where money leaks in your funnel. Get a PDF with specific call quotes, manager ranking, Marketing vs Sales verdict, and an action plan.",
    primary: "Request audit",
    secondary: "View sample",
    trust: [
      ["20-50", "calls in one audit"],
      ["5-7", "business days to report"],
      ["30/60/90", "action plan for the sales lead"],
    ],
    proofTitle: "What leadership receives",
    proofRows: [
      ["Value at Risk", "Estimated revenue at risk in the current funnel.", "$8.4k", "risk"],
      ["Manager Ranking", "Who keeps the standard and who needs coaching.", "5 roles", ""],
      ["Marketing vs Sales", "Where the issue sits: lead quality, sales handling, or offer.", "verdict", ""],
      ["Call Evidence", "Timestamped quotes instead of generic opinions.", "4+ blocks", "risk"],
    ],
    sampleTitle: "Sample report structure",
    sampleLead: "A synthetic EdTech example showing the report format: executive summary, Value at Risk, quotes, manager ranking, and action plan.",
    sampleDisclaimer: "Important: this is not a real client case. Numbers and quotes are illustrative only.",
    sampleCta: "Open sample structure",
    sampleCards: [
      ["Executive Summary", "One main conclusion, top-3 priorities, and where revenue leaks."],
      ["Value at Risk", "Impact estimate from call failures based on your baseline."],
      ["Call Quotes", "Specific manager phrases and why the deal cools down."],
      ["Action Plan", "What to fix in the first 30, 60, and 90 days."],
    ],
    processTitle: "How the audit works",
    processLead: "No heavy integration or long implementation. Service first, automation later where it truly matters.",
    steps: [
      ["01", "Request and short call", "You leave your contact. We clarify segment, call volume, recording format, and the audit question."],
      ["02", "Recording transfer", "You send recordings or transcripts via Drive/Dropbox. NDA can be signed before any access."],
      ["03", "AI analysis and human review", "Each call goes through structured analysis. Final conclusions are reviewed manually to avoid raw AI output."],
      ["04", "PDF and walk-through", "You receive the report and a review: what to fix first, whom to coach, and what to change in the team meeting."],
    ],
    leakTitle: "Where revenue usually leaks",
    leakLead: "The audit does not argue abstractly about “bad leads”. It separates responsibility across marketing, sales, and process.",
    leaks: [
      ["Discovery", "The manager talks about the product before understanding pain, budget, and timing.", "high risk"],
      ["Next Step", "The call ends with “I’ll call you back” without date, time, or agreement.", "common leak"],
      ["Offer Fit", "The client came with one expectation while sales presents another offer.", "marketing/sales"],
      ["Price Talk", "Price appears before value, and the client leaves to “think”.", "money leak"],
    ],
    pricingTitle: "Audit formats",
    pricingLead: "Prices are for one-time audits. Scope can be clarified after a short discovery call.",
    tiers: [
      {
        name: "Express",
        price: "from $700",
        meta: "up to 20 calls · 5 business days",
        bullets: ["one sales segment", "12-15 page PDF", "30-minute walk-through", "3 main risks and quick fixes"],
        cta: "Order Express",
      },
      {
        name: "Team",
        price: "from $1,500",
        meta: "20-40 calls · 7 business days",
        bullets: ["up to 6 managers in ranking", "Marketing vs Sales verdict", "Value at Risk from your baseline", "follow-up in 2 weeks"],
        cta: "Discuss Team Audit",
        featured: "Recommended",
      },
      {
        name: "Department",
        price: "from $3,000",
        meta: "40-80 calls · 10 business days",
        bullets: ["multiple teams or directions", "deep segmentation of loss reasons", "60-minute walk-through", "2 follow-up sessions"],
        cta: "Discuss scope",
      },
    ],
    futureTitle: "What the self-serve version will add",
    futureLead: "Right now we sell the audit as a service. A self-serve workspace comes later, once repeated patterns are clear from the first clients.",
    futureItems: [
      ["Call upload", "Clients add audio, transcripts, or folder links themselves."],
      ["Workspace", "Owner, sales lead, and manager see different report levels."],
      ["CRM summary", "Call outcome and next step go into the lead card."],
      ["Weekly digest", "Short Telegram report for the owner and sales lead."],
    ],
    futureNote: "This is a development map, not a timeline promise. You can mention early-access interest in the form.",
    faqTitle: "FAQ",
    faqs: [
      ["What if we do not have call recordings?", "Zoom, Google Meet, telephony recordings, Telegram voice messages, or ready transcripts work. If you have too little data, collect two more weeks first."],
      ["What is the minimum call volume?", "Ideally 20+ calls. Fewer calls can work as a quick scan, but the conclusions will be statistically weaker."],
      ["How do you handle confidentiality?", "We can sign an NDA before receiving recordings. Managers are labeled M-1, M-2, etc.; mapping stays with you."],
      ["How is this different from Fireflies, Gong, or CRM?", "Those tools provide data and transcripts. CallControl turns calls into a management report: where the risk is, why it happened, and what to do."],
      ["Can you analyze support instead of sales?", "Yes, but the checklist changes: tone, empathy, response speed, escalation, resolution quality, and repeat contacts."],
      ["Will there be a workspace where we upload calls ourselves?", "Yes, that is the product direction. For now, done-for-you audit means less setup and faster first value."],
      ["What happens after the report?", "You receive an action plan. Manager coaching or monthly control can be discussed separately if needed."],
    ],
    formTitle: "Request audit",
    formLead: "Leave your contact and short context. I will reply during the business day and suggest the right format.",
    form: {
      name: "Name",
      contact: "Telegram or email",
      company: "Company",
      site: "Website or profile",
      teamSize: "Sales team size",
      niche: "Segment",
      tariff: "Format",
      pain: "What should the audit answer?",
      data: "Do you have recordings or transcripts?",
      submit: "Send request",
      sending: "Sending...",
      successTitle: "Request received.",
      successText: "I will reply during the business day. If urgent, message me on Telegram: @manukianartur1997.",
      errorTitle: "The form could not be sent.",
      errorText: "Try again or message me directly: @manukianartur1997.",
      privacy: "Data is used only to contact you and prepare the audit.",
    },
    placeholders: {
      name: "How should I address you?",
      contact: "@username or email",
      company: "Company name",
      site: "https://...",
      teamSize: "3-7 managers",
      niche: "EdTech / B2B SaaS / agency",
      tariff: "Express / Team / Department / not sure",
      pain: "For example: conversion drops after the first call, managers do not set next steps",
      data: "Recordings in Zoom/CRM/telephony or only text transcripts",
    },
    footer: "CallControl AI · sales call audit · Artur Manukian · Ukraine",
  },
};

const sampleReports = {
  "edtech-ua-sample-report.md": `# CallControl AI — Sample Report Structure

**SAMPLE REPORT — приклад структури, не реальний клієнт**

## Важливо про формат

Цей документ показує структуру звіту CallControl AI. Усі цифри, цитати й ролі нижче є синтетичними. Реальний звіт використовує ваші записи дзвінків, вашу базову конверсію і ваші фактичні цитати з таймкодами.

## 1. Короткий висновок

У цьому прикладі EdTech-школа втрачає гроші не через якість лідів, а через провали на discovery-дзвінку: менеджер називає ціну до того, як зрозумів ціль, бюджет і timing клієнта.

Головні пріоритети:

1. Перебудувати discovery-питання.
2. Замінити "я передзвоню" на конкретний next step.
3. Розділити сценарії для батьків і учнів.

## 2. Value at Risk

У прикладі базові метрики: 250 заявок на місяць, середній чек 14,500 грн, поточна конверсія в оплату 9.2%.

Вплив у реальному звіті рахується від ваших даних, а не від цієї синтетичної моделі.

## 3. Call Quotes

> M-2: "У нас курс коштує 14,500 грн."
>
> Клієнт: "Зрозуміло, я подумаю."

Що сталося: ціна прозвучала до цінності. Менеджер не дізнався ціль, поточний рівень, дедлайн і критерій вибору.

## 4. Manager Ranking

Менеджери оцінюються за якістю discovery, активним слуханням, фокусом на результаті, чіткістю наступного кроку й роботою із запереченнями.

## 5. Marketing vs Sales Verdict

Звіт розділяє втрати між якістю лідів, роботою продажів і процесними прогалинами.

## 6. Action Plan

30 днів: виправити discovery і next step.

60 днів: тренувати слабкі патерни по менеджерах.

90 днів: перевірити повторний зріз і оновити скрипт.
`,
  "b2b-saas-ru-sample-report.md": `# CallControl AI — пример структуры отчёта для B2B SaaS

**SAMPLE REPORT — структура отчёта, не реальный клиент**

## Executive Summary

В этом примере команда теряет pipeline между discovery и demo: SDR передаёт AE мало контекста, AE начинает разговор заново, prospect устает повторять один и тот же use case.

## Value at Risk

Impact рассчитывается от вашего ACV, количества SQL и текущей конверсии SQL → closed-won. Цифры в этом примере синтетические.

## Call Evidence

> AE: "Расскажите, что хотели бы посмотреть?"
>
> Prospect: "Мы уже подробно объяснили это на прошлом звонке."

Риск: потеря контекста между SDR и AE.

## Action Plan

1. Ввести SDR → AE handoff template.
2. Заменить product tour на use-case demo.
3. Добавить mini-MEDDIC scoring.
`,
  "agency-ru-sample-report.md": `# CallControl AI — пример структуры отчёта для агентства

**SAMPLE REPORT — структура отчёта, не реальный клиент**

## Executive Summary

В этом примере агентство теряет заявки на pre-sales звонках: founder быстро уходит в детали работы и не фиксирует бизнес-критерии решения.

## Value at Risk

Impact считается от среднего ретейнера, количества входящих заявок и conversion inquiry → signed.

## Call Evidence

> Клиент: "Нам важно понять, окупится ли это за квартал."
>
> Агентство: "Мы можем сделать контент-стратегию, дизайн и performance."

Риск: клиент спрашивает о бизнес-результате, а получает список работ.

## Action Plan

1. Добавить business discovery перед описанием услуг.
2. Перенести разговор о цене после value framing.
3. Завершать звонок конкретным decision step.
`,
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function localeUrl(locale) {
  if (locale === "ru") return "/ru/";
  if (locale === "uk") return "/uk/";
  return "/en/";
}

function renderList(items) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderPage(localeKey) {
  const t = locales[localeKey];
  const languageLinks = ["ru", "uk", "en"].map((key) => {
    const label = key === "uk" ? "UA" : key.toUpperCase();
    const active = key === localeKey ? " active" : "";
    return `<a class="lang-pill${active}" href="${localeUrl(key)}" hreflang="${locales[key].htmlLang}">${label}</a>`;
  }).join("");

  const proofRows = t.proofRows.map(([title, text, value, tone]) => `
          <div class="proof-row">
            <div>
              <strong>${escapeHtml(title)}</strong>
              <span>${escapeHtml(text)}</span>
            </div>
            <b class="${tone === "risk" ? "risk" : ""}">${escapeHtml(value)}</b>
          </div>`).join("");

  const trust = t.trust.map(([value, label]) => `
            <div class="trust-item">
              <strong>${escapeHtml(value)}</strong>
              <span>${escapeHtml(label)}</span>
            </div>`).join("");

  const sampleCards = t.sampleCards.map(([title, text]) => `
            <article class="mini-card">
              <strong>${escapeHtml(title)}</strong>
              <p>${escapeHtml(text)}</p>
            </article>`).join("");

  const steps = t.steps.map(([num, title, text]) => `
            <article class="step-card">
              <small>${escapeHtml(num)}</small>
              <strong>${escapeHtml(title)}</strong>
              <p>${escapeHtml(text)}</p>
            </article>`).join("");

  const leaks = t.leaks.map(([title, text, tag]) => `
            <article class="leak-row">
              <div>
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(text)}</p>
              </div>
              <span>${escapeHtml(tag)}</span>
            </article>`).join("");

  const tiers = t.tiers.map((tier) => `
            <article class="tier-card${tier.featured ? " featured" : ""}">
              ${tier.featured ? `<span class="featured-label">${escapeHtml(tier.featured)}</span>` : ""}
              <h3>${escapeHtml(tier.name)}</h3>
              <div class="price">${escapeHtml(tier.price)}</div>
              <p>${escapeHtml(tier.meta)}</p>
              <ul>${renderList(tier.bullets)}</ul>
              <a href="#request">${escapeHtml(tier.cta)}</a>
            </article>`).join("");

  const future = t.futureItems.map(([title, text]) => `
            <article class="mini-card">
              <strong>${escapeHtml(title)}</strong>
              <p>${escapeHtml(text)}</p>
            </article>`).join("");

  const faqs = t.faqs.map(([question, answer]) => `
            <details class="faq-item">
              <summary>${escapeHtml(question)}</summary>
              <p>${escapeHtml(answer)}</p>
            </details>`).join("");

  const samplePath = localeKey === "en" ? "/samples/b2b-saas-ru-sample-report.md" : localeKey === "uk" ? "/samples/edtech-ua-sample-report.md" : "/samples/b2b-saas-ru-sample-report.md";

  return `<!doctype html>
<html lang="${t.htmlLang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(t.title)}</title>
    <meta name="description" content="${escapeHtml(t.description)}" />
    <meta property="og:title" content="${escapeHtml(t.title)}" />
    <meta property="og:description" content="${escapeHtml(t.description)}" />
    <meta property="og:type" content="website" />
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap");

      :root {
        --bg: #07111f;
        --bg-2: #0f172a;
        --surface: rgba(255, 255, 255, 0.075);
        --surface-strong: rgba(255, 255, 255, 0.11);
        --line: rgba(226, 232, 240, 0.16);
        --line-strong: rgba(226, 232, 240, 0.26);
        --text: #f8fafc;
        --muted: #b9c6d8;
        --faint: #7d8fa6;
        --blue: #38bdf8;
        --indigo: #6366f1;
        --green: #22c55e;
        --red: #fb7185;
        --yellow: #f59e0b;
        --shadow: 0 22px 90px rgba(0, 0, 0, 0.28);
      }

      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body {
        margin: 0;
        color: var(--text);
        background:
          linear-gradient(135deg, rgba(56, 189, 248, 0.16), transparent 34%),
          linear-gradient(215deg, rgba(99, 102, 241, 0.2), transparent 38%),
          linear-gradient(180deg, #020617 0%, var(--bg) 42%, var(--bg-2) 100%);
        font-family: "Geist", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: 0;
      }

      a { color: inherit; }
      .wrap { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
      .topbar {
        position: sticky;
        top: 0;
        z-index: 20;
        border-bottom: 1px solid var(--line);
        background: rgba(2, 6, 23, 0.72);
        backdrop-filter: blur(18px);
      }
      .nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        min-height: 72px;
      }
      .brand { display: flex; flex-direction: column; gap: 2px; text-decoration: none; }
      .brand strong { font-size: 17px; letter-spacing: -0.02em; }
      .brand span { color: var(--muted); font-size: 12px; }
      .nav-links { display: flex; align-items: center; gap: 16px; color: var(--muted); font-size: 14px; }
      .nav-links a { text-decoration: none; }
      .nav-links a:hover { color: var(--text); }
      .nav-cta {
        padding: 10px 14px;
        border: 1px solid rgba(125, 211, 252, 0.4);
        border-radius: 10px;
        background: rgba(56, 189, 248, 0.12);
        color: #e0f2fe;
        font-weight: 600;
      }
      .lang-switch { display: flex; gap: 6px; align-items: center; }
      .lang-pill {
        min-width: 34px;
        padding: 7px 9px;
        border: 1px solid var(--line);
        border-radius: 9px;
        text-align: center;
        text-decoration: none;
        color: var(--muted);
        font: 600 12px "JetBrains Mono", ui-monospace, monospace;
      }
      .lang-pill.active {
        color: var(--text);
        border-color: rgba(125, 211, 252, 0.42);
        background: rgba(125, 211, 252, 0.11);
      }

      section { padding: clamp(58px, 8vw, 96px) 0; }
      .hero { padding-top: clamp(54px, 8vw, 104px); }
      .hero-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.04fr) minmax(330px, 0.96fr);
        gap: clamp(24px, 5vw, 58px);
        align-items: center;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        padding: 8px 11px;
        border: 1px solid rgba(125, 211, 252, 0.28);
        border-radius: 999px;
        background: rgba(125, 211, 252, 0.09);
        color: #bae6fd;
        font: 600 11px "JetBrains Mono", ui-monospace, monospace;
        text-transform: uppercase;
      }
      h1, h2, h3 {
        margin: 0;
        font-weight: 600;
        letter-spacing: -0.028em;
      }
      h1 {
        max-width: 790px;
        margin-top: 20px;
        font-size: clamp(44px, 7vw, 86px);
        line-height: 0.98;
      }
      .hero-lead {
        max-width: 720px;
        margin: 20px 0 0;
        color: var(--muted);
        font-size: clamp(17px, 2vw, 21px);
        line-height: 1.55;
      }
      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        padding: 12px 16px;
        border-radius: 11px;
        border: 1px solid var(--line-strong);
        text-decoration: none;
        font-weight: 600;
      }
      .button.primary {
        border-color: rgba(125, 211, 252, 0.42);
        background: linear-gradient(135deg, #38bdf8, #4f46e5);
        color: white;
        box-shadow: 0 14px 38px rgba(56, 189, 248, 0.18);
      }
      .button.secondary { background: rgba(255, 255, 255, 0.07); color: var(--text); }
      .trust-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 30px;
      }
      .trust-item,
      .proof-card,
      .mini-card,
      .step-card,
      .leak-row,
      .tier-card,
      .faq-item,
      .form-card {
        border: 1px solid var(--line);
        background: var(--surface);
        border-radius: 14px;
        backdrop-filter: blur(16px);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.025);
      }
      .trust-item { padding: 16px; }
      .trust-item strong,
      .price,
      .proof-row b {
        display: block;
        font-family: "JetBrains Mono", ui-monospace, monospace;
      }
      .trust-item strong { color: #e0f2fe; font-size: 20px; }
      .trust-item span { display: block; margin-top: 5px; color: var(--muted); font-size: 13px; line-height: 1.35; }
      .proof-card { padding: 18px; box-shadow: var(--shadow); }
      .proof-card h2 { margin-bottom: 10px; font-size: 22px; }
      .proof-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 14px;
        padding: 15px 0;
        border-bottom: 1px solid var(--line);
      }
      .proof-row:last-child { border-bottom: 0; }
      .proof-row strong { display: block; margin-bottom: 5px; }
      .proof-row span { color: var(--muted); font-size: 13px; line-height: 1.4; }
      .proof-row b { color: #86efac; white-space: nowrap; }
      .proof-row b.risk { color: #fda4af; }
      .section-head { max-width: 780px; margin-bottom: 24px; }
      .section-head h2 { font-size: clamp(30px, 4.6vw, 56px); line-height: 1.05; }
      .section-head p { color: var(--muted); font-size: 17px; line-height: 1.55; }
      .sample-layout,
      .two-col {
        display: grid;
        grid-template-columns: minmax(0, 0.95fr) minmax(320px, 1.05fr);
        gap: 18px;
        align-items: stretch;
      }
      .sample-preview {
        min-height: 430px;
        padding: 24px;
        border-radius: 16px;
        border: 1px solid var(--line-strong);
        background:
          linear-gradient(180deg, rgba(248, 250, 252, 0.96), rgba(226, 232, 240, 0.92));
        color: #0f172a;
      }
      .sample-preview small {
        color: #475569;
        font-family: "JetBrains Mono", ui-monospace, monospace;
        font-weight: 600;
        text-transform: uppercase;
      }
      .sample-preview h3 { margin-top: 16px; font-size: 30px; color: #0f172a; }
      .sample-preview p { color: #475569; line-height: 1.55; }
      .sample-list { display: grid; gap: 10px; margin: 22px 0; }
      .sample-line {
        display: flex;
        justify-content: space-between;
        gap: 14px;
        padding: 12px 0;
        border-bottom: 1px solid rgba(15, 23, 42, 0.12);
        font-size: 14px;
      }
      .sample-line b { font-family: "JetBrains Mono", ui-monospace, monospace; color: #00684a; }
      .sample-side { display: grid; gap: 12px; }
      .mini-card, .step-card { padding: 18px; }
      .mini-card strong, .step-card strong { display: block; margin-bottom: 8px; font-size: 17px; }
      .mini-card p, .step-card p { margin: 0; color: var(--muted); line-height: 1.5; }
      .sample-disclaimer {
        margin-top: 14px;
        padding: 13px 14px;
        border-radius: 12px;
        background: rgba(245, 158, 11, 0.13);
        color: #fde68a;
        font-size: 13px;
        line-height: 1.45;
      }
      .grid-4 {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }
      .leak-stack { display: grid; gap: 10px; }
      .leak-row {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 16px;
        align-items: center;
        padding: 16px 18px;
      }
      .leak-row p { margin: 5px 0 0; color: var(--muted); line-height: 1.5; }
      .leak-row span {
        padding: 7px 9px;
        border-radius: 999px;
        background: rgba(251, 113, 133, 0.13);
        color: #fecdd3;
        font: 600 11px "JetBrains Mono", ui-monospace, monospace;
        white-space: nowrap;
      }
      .pricing-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }
      .tier-card { position: relative; padding: 22px; }
      .tier-card.featured { border-color: rgba(34, 197, 94, 0.38); background: rgba(34, 197, 94, 0.08); }
      .featured-label {
        position: absolute;
        right: 16px;
        top: 16px;
        padding: 6px 8px;
        border-radius: 999px;
        background: rgba(34, 197, 94, 0.16);
        color: #bbf7d0;
        font: 600 11px "JetBrains Mono", ui-monospace, monospace;
      }
      .tier-card h3 { font-size: 23px; }
      .price { margin-top: 13px; color: #e0f2fe; font-size: 28px; }
      .tier-card p { color: var(--muted); }
      .tier-card ul { margin: 18px 0; padding-left: 19px; color: var(--muted); line-height: 1.65; }
      .tier-card a {
        display: inline-flex;
        width: 100%;
        justify-content: center;
        padding: 12px 14px;
        border-radius: 11px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid var(--line-strong);
        text-decoration: none;
        font-weight: 600;
      }
      .future-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }
      .future-note { margin-top: 14px; color: var(--muted); font-size: 14px; }
      .faq-grid { display: grid; gap: 10px; }
      .faq-item { padding: 0; }
      .faq-item summary { cursor: pointer; padding: 17px 18px; font-weight: 600; }
      .faq-item p { margin: 0; padding: 0 18px 18px; color: var(--muted); line-height: 1.55; }
      .form-card { padding: clamp(20px, 4vw, 34px); }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      label { display: grid; gap: 7px; color: var(--muted); font-size: 13px; }
      input, textarea {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 11px;
        background: rgba(2, 6, 23, 0.46);
        color: var(--text);
        font: inherit;
        padding: 12px 13px;
        outline: none;
      }
      textarea { min-height: 106px; resize: vertical; }
      .full { grid-column: 1 / -1; }
      .form-status { margin-top: 14px; min-height: 42px; color: var(--muted); line-height: 1.5; }
      .form-status strong { color: var(--text); }
      .privacy { margin-top: 10px; color: var(--faint); font-size: 13px; }
      .footer { padding: 28px 0 42px; color: var(--muted); border-top: 1px solid var(--line); }
      .footer-inner { display: flex; justify-content: space-between; gap: 18px; flex-wrap: wrap; }

      @media (max-width: 980px) {
        .hero-grid,
        .sample-layout,
        .two-col,
        .pricing-grid {
          grid-template-columns: 1fr;
        }
        .grid-4,
        .future-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .nav-links { display: none; }
      }

      @media (max-width: 640px) {
        .wrap { width: min(100% - 24px, 1180px); }
        .nav { min-height: 64px; }
        h1 { font-size: 42px; }
        .trust-grid,
        .grid-4,
        .future-grid,
        .form-grid {
          grid-template-columns: 1fr;
        }
        .leak-row { grid-template-columns: 1fr; }
        .sample-preview { min-height: auto; }
      }
    </style>
  </head>
  <body>
    <header class="topbar">
      <div class="wrap nav">
        <a class="brand" href="${localeUrl(localeKey)}" aria-label="CallControl AI">
          <strong>CallControl AI</strong>
          <span>${escapeHtml(t.badge)}</span>
        </a>
        <nav class="nav-links" aria-label="Primary">
          <a href="#process">${escapeHtml(t.nav.process)}</a>
          <a href="#sample">${escapeHtml(t.nav.sample)}</a>
          <a href="#pricing">${escapeHtml(t.nav.pricing)}</a>
          <a href="#faq">${escapeHtml(t.nav.faq)}</a>
          <a class="nav-cta" href="#request">${escapeHtml(t.nav.request)}</a>
        </nav>
        <div class="lang-switch" aria-label="${escapeHtml(t.switcherLabel)}">${languageLinks}</div>
      </div>
    </header>

    <main>
      <section class="hero">
        <div class="wrap hero-grid">
          <div>
            <span class="badge">${escapeHtml(t.badge)}</span>
            <h1>${escapeHtml(t.h1)}</h1>
            <p class="hero-lead">${escapeHtml(t.lead)}</p>
            <div class="actions">
              <a class="button primary" href="#request">${escapeHtml(t.primary)}</a>
              <a class="button secondary" href="#sample">${escapeHtml(t.secondary)}</a>
            </div>
            <div class="trust-grid">${trust}</div>
          </div>
          <aside class="proof-card" aria-label="${escapeHtml(t.proofTitle)}">
            <h2>${escapeHtml(t.proofTitle)}</h2>
            ${proofRows}
          </aside>
        </div>
      </section>

      <section id="sample">
        <div class="wrap sample-layout">
          <article class="sample-preview">
            <small>Sample Report · CallControl AI</small>
            <h3>${escapeHtml(t.sampleTitle)}</h3>
            <p>${escapeHtml(t.sampleLead)}</p>
            <div class="sample-list">
              <div class="sample-line"><span>Revenue Leak</span><b>32-38%</b></div>
              <div class="sample-line"><span>Manager Ranking</span><b>M-1...M-5</b></div>
              <div class="sample-line"><span>Marketing vs Sales</span><b>verdict</b></div>
              <div class="sample-line"><span>Action Plan</span><b>30/60/90</b></div>
            </div>
            <a class="button primary" href="${samplePath}">${escapeHtml(t.sampleCta)}</a>
          </article>
          <div class="sample-side">
            <div class="section-head">
              <h2>${escapeHtml(t.sampleTitle)}</h2>
              <p>${escapeHtml(t.sampleLead)}</p>
              <div class="sample-disclaimer">${escapeHtml(t.sampleDisclaimer)}</div>
            </div>
            <div class="grid-4">${sampleCards}</div>
          </div>
        </div>
      </section>

      <section id="process">
        <div class="wrap">
          <div class="section-head">
            <h2>${escapeHtml(t.processTitle)}</h2>
            <p>${escapeHtml(t.processLead)}</p>
          </div>
          <div class="grid-4">${steps}</div>
        </div>
      </section>

      <section>
        <div class="wrap two-col">
          <div class="section-head">
            <h2>${escapeHtml(t.leakTitle)}</h2>
            <p>${escapeHtml(t.leakLead)}</p>
          </div>
          <div class="leak-stack">${leaks}</div>
        </div>
      </section>

      <section id="pricing">
        <div class="wrap">
          <div class="section-head">
            <h2>${escapeHtml(t.pricingTitle)}</h2>
            <p>${escapeHtml(t.pricingLead)}</p>
          </div>
          <div class="pricing-grid">${tiers}</div>
        </div>
      </section>

      <section>
        <div class="wrap">
          <div class="section-head">
            <h2>${escapeHtml(t.futureTitle)}</h2>
            <p>${escapeHtml(t.futureLead)}</p>
          </div>
          <div class="future-grid">${future}</div>
          <p class="future-note">${escapeHtml(t.futureNote)}</p>
        </div>
      </section>

      <section id="faq">
        <div class="wrap">
          <div class="section-head">
            <h2>${escapeHtml(t.faqTitle)}</h2>
          </div>
          <div class="faq-grid">${faqs}</div>
        </div>
      </section>

      <section id="request">
        <div class="wrap">
          <div class="form-card">
            <div class="section-head">
              <h2>${escapeHtml(t.formTitle)}</h2>
              <p>${escapeHtml(t.formLead)}</p>
            </div>
            <form id="leadForm">
              <div class="form-grid">
                <label>${escapeHtml(t.form.name)}<input name="name" required placeholder="${escapeHtml(t.placeholders.name)}" /></label>
                <label>${escapeHtml(t.form.contact)}<input name="contact" required placeholder="${escapeHtml(t.placeholders.contact)}" /></label>
                <label>${escapeHtml(t.form.company)}<input name="company" required placeholder="${escapeHtml(t.placeholders.company)}" /></label>
                <label>${escapeHtml(t.form.site)}<input name="website" placeholder="${escapeHtml(t.placeholders.site)}" /></label>
                <label>${escapeHtml(t.form.teamSize)}<input name="teamSize" placeholder="${escapeHtml(t.placeholders.teamSize)}" /></label>
                <label>${escapeHtml(t.form.niche)}<input name="niche" placeholder="${escapeHtml(t.placeholders.niche)}" /></label>
                <label class="full">${escapeHtml(t.form.tariff)}<input name="dataFormat" placeholder="${escapeHtml(t.placeholders.tariff)}" /></label>
                <label class="full">${escapeHtml(t.form.pain)}<textarea name="pain" placeholder="${escapeHtml(t.placeholders.pain)}"></textarea></label>
                <label class="full">${escapeHtml(t.form.data)}<textarea name="dataLink" placeholder="${escapeHtml(t.placeholders.data)}"></textarea></label>
              </div>
              <div class="actions">
                <button class="button primary" type="submit">${escapeHtml(t.form.submit)}</button>
              </div>
              <div class="form-status" id="formStatus" role="status" aria-live="polite"></div>
              <p class="privacy">${escapeHtml(t.form.privacy)}</p>
            </form>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="wrap footer-inner">
        <span>${escapeHtml(t.footer)}</span>
        <span>Telegram: @manukianartur1997</span>
      </div>
    </footer>

    <script>
      const formCopy = ${JSON.stringify(t.form)};
      const form = document.querySelector("#leadForm");
      const status = document.querySelector("#formStatus");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = form.querySelector("button[type='submit']");
        button.disabled = true;
        button.textContent = formCopy.sending;
        status.innerHTML = "";

        const payload = Object.fromEntries(new FormData(form).entries());
        payload.source = "callcontrol-public-landing";
        payload.locale = ${JSON.stringify(localeKey)};

        try {
          const response = await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error("request_failed");
          status.innerHTML = "<strong>" + formCopy.successTitle + "</strong><br>" + formCopy.successText;
          form.reset();
        } catch (error) {
          status.innerHTML = "<strong>" + formCopy.errorTitle + "</strong><br>" + formCopy.errorText;
        } finally {
          button.disabled = false;
          button.textContent = formCopy.submit;
        }
      });
    </script>
  </body>
</html>`;
}

module.exports = function generateHybridLanding() {
  const samplesDir = path.join(outDir, "samples");
  fs.mkdirSync(samplesDir, { recursive: true });
  for (const [filename, content] of Object.entries(sampleReports)) {
    fs.writeFileSync(path.join(samplesDir, filename), content);
  }

  for (const locale of Object.keys(locales)) {
    const html = renderPage(locale);
    if (locale === "ru") {
      fs.writeFileSync(path.join(outDir, "index.html"), html);
    }
    fs.mkdirSync(path.join(outDir, locale), { recursive: true });
    fs.writeFileSync(path.join(outDir, locale, "index.html"), html);
  }

  fs.writeFileSync(path.join(outDir, "hybrid-demo.html"), renderPage("ru"));
  console.log("Public service landing ready: dist/index.html, dist/ru/index.html, dist/uk/index.html, dist/en/index.html");
};
