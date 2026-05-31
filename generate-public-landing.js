const fs = require("fs");
const path = require("path");

const root = __dirname;
const outDir = path.join(root, "dist");

const reports = {
  "edtech-ua-sample-report.md": `# CallControl AI — Sample Report Structure

**SAMPLE REPORT — приклад структури, не реальний клієнт**

## Важливо про формат

Цей документ показує структуру звіту CallControl AI. Усі цифри, цитати й ролі нижче є синтетичними. Реальний звіт використовує ваші записи дзвінків, вашу базову конверсію і фактичні цитати з таймкодами.

## 1. Короткий висновок

У цьому прикладі EdTech-школа втрачає гроші не через якість лідів, а через провали на discovery-дзвінку: менеджер називає ціну до того, як зрозумів ціль, бюджет і timing клієнта.

Головні пріоритети:
1. Перебудувати discovery-питання.
2. Замінити "я передзвоню" на конкретний next step.
3. Розділити сценарії для батьків і учнів.

## 2. Value at Risk

У прикладі базові метрики: 250 заявок на місяць, середній чек 14,500 грн, поточна конверсія в оплату 9.2%.

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

const locales = {
  ru: {
    path: "/ru/",
    lang: "ru",
    title: "CallControl AI — аудит звонков отдела продаж",
    description: "AI-аудит звонков отдела продаж: 20-50 записей, PDF-отчёт, Value at Risk, рейтинг менеджеров и план действий.",
    nav: ["Как работает", "Пример отчёта", "Форматы", "FAQ", "Запросить аудит"],
    badge: "AI-аудит звонков · done-for-you",
    h1: "Аудит звонков отдела продаж за 5 рабочих дней",
    lead: "Найдём, где теряются деньги в воронке. Вернём PDF с конкретными цитатами, рейтингом менеджеров, Marketing vs Sales verdict и планом действий.",
    primary: "Запросить аудит",
    secondary: "Посмотреть пример",
    trust: [["20-50", "звонков в одном аудите"], ["5-7", "рабочих дней до отчёта"], ["30/60/90", "план действий для РОПа"]],
    proofTitle: "Что получает руководитель",
    proof: [["Value at Risk", "Оценка денег под риском в текущей воронке.", "$8.4k"], ["Manager Ranking", "Кто держит стандарт, а кому нужен коучинг.", "5 ролей"], ["Marketing vs Sales", "Где проблема: качество лида, продажа или оффер.", "verdict"], ["Call Evidence", "Цитаты с таймкодами вместо общих мнений.", "4+ блока"]],
    sampleTitle: "Так выглядит пример отчёта",
    sampleLead: "Синтетический пример для EdTech-школы. Он показывает структуру будущего отчёта: executive summary, Value at Risk, цитаты, рейтинг менеджеров и action plan.",
    sampleDisclaimer: "Важно: пример не является кейсом реального клиента. Все цифры и цитаты нужны только для демонстрации формата.",
    sampleCta: "Открыть пример структуры",
    sampleFile: "/samples/b2b-saas-ru-sample-report.md",
    cards: [["Короткий вывод", "Один главный вывод, top-3 приоритета и где теряется выручка."], ["Value at Risk", "Расчёт impact от провалов в звонках на вашем baseline."], ["Call Quotes", "Конкретные фразы менеджеров и объяснение, почему сделка остывает."], ["Action Plan", "Что исправить в первые 30, 60 и 90 дней."]],
    processTitle: "Как проходит аудит",
    processLead: "Без сложной интеграции и долгого внедрения. Сначала услуга, потом автоматизация там, где она действительно нужна.",
    steps: [["01", "Заявка и короткий звонок", "Уточняем сегмент, объём звонков, формат записей и главный вопрос аудита."], ["02", "Передача записей", "Вы передаёте записи или транскрипты через Drive/Dropbox. При необходимости подписываем NDA."], ["03", "AI-разбор и ручное ревью", "Каждый звонок проходит структурный анализ. Финальные выводы проверяются вручную."], ["04", "PDF и walk-through", "Вы получаете отчёт и разбор: что чинить первым, кого коучить и что вынести на планёрку."]],
    leakTitle: "Где обычно течёт выручка",
    leakLead: "Аудит не спорит абстрактно о “плохих лидах”. Он разделяет ответственность между маркетингом, продажами и процессом.",
    leaks: [["Discovery", "Менеджер говорит про продукт до того, как понял боль, бюджет и timing.", "высокий риск"], ["Next Step", "Звонок заканчивается “я перезвоню” без даты, времени и договорённости.", "частый leak"], ["Offer Fit", "Клиент пришёл с одним ожиданием, а продажа презентует другой оффер.", "marketing/sales"], ["Price Talk", "Цена звучит до ценности, и клиент уходит “подумать”.", "money leak"]],
    pricingTitle: "Форматы аудита",
    pricingLead: "Цены — за разовый аудит. Объём можно уточнить после короткого discovery-звонка.",
    tiers: [["Express", "от $700", "до 20 звонков · 5 рабочих дней", ["один сегмент продаж", "PDF 12-15 страниц", "30 минут walk-through", "3 главных риска и быстрые фиксы"], "Заказать Express"], ["Team", "от $1,500", "20-40 звонков · 7 рабочих дней", ["до 6 менеджеров в рейтинге", "Marketing vs Sales verdict", "Value at Risk от вашего baseline", "follow-up через 2 недели"], "Обсудить Team Audit", "Рекомендуемый"], ["Department", "от $3,000", "40-80 звонков · 10 рабочих дней", ["несколько команд или направлений", "глубокая сегментация причин потерь", "60 минут walk-through", "2 follow-up сессии"], "Обсудить scope"]],
    futureTitle: "Что появится в self-serve версии",
    futureLead: "Сейчас мы продаём аудит как услугу. Кабинет нужен позже, когда станет ясно, какие паттерны повторяются у первых клиентов.",
    future: [["Загрузка звонков", "Клиент сам добавляет аудио, транскрипты или ссылки на папку."], ["Личный кабинет", "Owner, РОП и менеджер видят разные уровни отчётов."], ["CRM summary", "Итоги звонка и следующий шаг уходят в карточку лида."], ["Weekly digest", "Короткий отчёт в Telegram для владельца и РОПа."]],
    futureNote: "Этот блок оставлен как карта развития, а не обещание сроков. В заявке можно отметить интерес к раннему доступу.",
    faqTitle: "FAQ",
    faq: [["Что если у нас нет записей звонков?", "Подходят записи Zoom, Google Meet, телефонии, голосовые из Telegram или готовые транскрипты. Если записей мало, лучше сначала накопить 2 недели данных."], ["Какой минимум звонков нужен?", "Желательно от 20 звонков. Меньше можно разобрать как быстрый срез, но выводы будут слабее статистически."], ["Что с конфиденциальностью?", "Можно подписать NDA до передачи записей. В отчёте менеджеры обозначаются как M-1, M-2; mapping остаётся у вас."], ["Чем это отличается от Fireflies, Gong или CRM?", "Эти инструменты дают данные и транскрипты. CallControl превращает звонки в управленческий отчёт: где риск, почему он возник и что делать."], ["Можно ли анализировать поддержку, а не продажи?", "Да, но чек-лист меняется: тон, эмпатия, скорость реакции, эскалация, решение обращения и повторные контакты."], ["Будет ли кабинет, где мы сами загружаем звонки?", "Да, это направление развития. Сейчас работает done-for-you аудит: меньше внедрения, быстрее первый результат."], ["Что происходит после отчёта?", "Вы получаете action plan. При необходимости можно отдельно обсудить коучинг менеджеров или ежемесячный контроль."]],
    formTitle: "Запросить аудит",
    formLead: "Оставьте контакт и короткий контекст. Я свяжусь в течение рабочего дня и скажу, какой формат подходит.",
    fields: ["Имя", "Telegram или email", "Компания", "Сайт или профиль", "Размер отдела продаж", "Сегмент", "Формат", "Что хотите понять из аудита?", "Есть ли записи или транскрипты?"],
    placeholders: ["Как к вам обращаться", "@username или email", "Название компании", "https://...", "3-7 менеджеров", "EdTech / B2B SaaS / агентство", "Express / Team / Department / не уверен", "Например: падает конверсия после первого звонка, менеджеры не закрывают следующий шаг", "Есть записи в Zoom/CRM/телефонии или только текстовые транскрипты"],
    submit: "Отправить заявку",
    sending: "Отправка...",
    success: ["Заявка получена.", "Свяжусь с вами в течение рабочего дня. Если срочно — напишите в Telegram: @manukianartur1997."],
    error: ["Не удалось отправить форму.", "Попробуйте ещё раз или напишите напрямую: @manukianartur1997."],
    privacy: "Данные используются только для связи по заявке и подготовки аудита.",
    footer: "CallControl AI · аудит звонков отдела продаж · Артур Манукян · Украина",
  },
};

locales.uk = {
  ...locales.ru,
  path: "/uk/",
  lang: "uk",
  title: "CallControl AI — аудит дзвінків відділу продажів",
  description: "AI-аудит дзвінків відділу продажів: 20-50 записів, PDF-звіт, Value at Risk, рейтинг менеджерів і план дій.",
  nav: ["Як працює", "Приклад звіту", "Формати", "FAQ", "Запросити аудит"],
  badge: "AI-аудит дзвінків · зробимо за вас",
  h1: "Аудит дзвінків відділу продажів за 5 робочих днів",
  lead: "Знайдемо, де ви втрачаєте гроші у воронці. Повернемо PDF з конкретними цитатами, рейтингом менеджерів, Marketing vs Sales verdict і планом дій.",
  primary: "Запросити аудит",
  secondary: "Подивитися приклад",
  trust: [["20-50", "дзвінків в одному аудиті"], ["5-7", "робочих днів до звіту"], ["30/60/90", "план дій для керівника продажів"]],
  proofTitle: "Що отримує керівник",
  proof: [["Value at Risk", "Оцінка грошей під ризиком у поточній воронці.", "$8.4k"], ["Manager Ranking", "Хто тримає стандарт, а кому потрібен коучинг.", "5 ролей"], ["Marketing vs Sales", "Де проблема: якість ліда, продаж або пропозиція.", "verdict"], ["Call Evidence", "Цитати з таймкодами замість загальних думок.", "4+ блоки"]],
  sampleTitle: "Так виглядає приклад звіту",
  sampleLead: "Синтетичний приклад для EdTech-школи. Він показує структуру майбутнього звіту: короткий висновок, Value at Risk, цитати, рейтинг менеджерів і план дій.",
  sampleDisclaimer: "Важливо: приклад не є кейсом реального клієнта. Усі цифри й цитати потрібні лише для демонстрації формату.",
  sampleCta: "Відкрити приклад структури",
  sampleFile: "/samples/edtech-ua-sample-report.md",
  cards: [["Короткий висновок", "Один головний висновок, 3 пріоритети і де втрачається виручка."], ["Value at Risk", "Розрахунок впливу провалів у дзвінках на ваших базових метриках."], ["Call Quotes", "Конкретні фрази менеджерів і пояснення, чому угода холоне."], ["Action Plan", "Що виправити у перші 30, 60 і 90 днів."]],
  processTitle: "Як проходить аудит",
  processLead: "Без складної інтеграції і довгого впровадження. Спочатку послуга, потім автоматизація там, де вона справді потрібна.",
  steps: [["01", "Заявка і короткий дзвінок", "Уточнюємо сегмент, обсяг дзвінків, формат записів і головне питання аудиту."], ["02", "Передача записів", "Ви передаєте записи або транскрипти через Drive/Dropbox. За потреби підписуємо NDA."], ["03", "AI-розбір і ручна перевірка", "Кожен дзвінок проходить структурний аналіз. Фінальні висновки перевіряються вручну."], ["04", "PDF і walk-through", "Ви отримуєте звіт і розбір: що виправити першим, кого коучити і що винести на планірку."]],
  leakTitle: "Де зазвичай тече виручка",
  leakLead: "Аудит не сперечається абстрактно про “погані ліди”. Він розділяє відповідальність між маркетингом, продажем і процесом.",
  leaks: [["Discovery", "Менеджер говорить про продукт до того, як зрозумів біль, бюджет і timing.", "високий ризик"], ["Next Step", "Дзвінок завершується “я передзвоню” без дати, часу і домовленості.", "частий leak"], ["Offer Fit", "Клієнт прийшов з одним очікуванням, а продаж презентує іншу пропозицію.", "marketing/sales"], ["Price Talk", "Ціна звучить до цінності, і клієнт йде “подумати”.", "money leak"]],
  pricingTitle: "Формати аудиту",
  pricingLead: "Ціни — за разовий аудит. Обсяг можна уточнити після короткого discovery-дзвінка.",
  tiers: [["Express", "від $700", "до 20 дзвінків · 5 робочих днів", ["один сегмент продажів", "PDF 12-15 сторінок", "30 хвилин розбору", "3 головні ризики і швидкі фікси"], "Замовити Express"], ["Team", "від $1,500", "20-40 дзвінків · 7 робочих днів", ["до 6 менеджерів у рейтингу", "висновок Marketing vs Sales", "Value at Risk від ваших базових метрик", "повторна зустріч через 2 тижні"], "Обговорити Team Audit", "Рекомендований"], ["Department", "від $3,000", "40-80 дзвінків · 10 робочих днів", ["кілька команд або напрямів", "глибока сегментація причин втрат", "60 хвилин розбору", "2 повторні сесії"], "Обговорити обсяг"]],
  futureTitle: "Що зʼявиться у версії для самостійного завантаження",
  futureLead: "Зараз ми продаємо аудит як послугу. Кабінет для самостійної роботи потрібен пізніше, коли стане зрозуміло, які патерни повторюються у перших клієнтів.",
  future: [["Завантаження дзвінків", "Клієнт сам додає аудіо, транскрипти або посилання на папку."], ["Особистий кабінет", "Власник, керівник продажів і менеджер бачать різні рівні звітів."], ["CRM-підсумок", "Підсумки дзвінка і наступний крок ідуть у картку ліда."], ["Тижневий дайджест", "Короткий звіт у Telegram для власника і керівника продажів."]],
  futureNote: "Цей блок залишено як карту розвитку, а не обіцянку строків. У заявці можна відмітити інтерес до раннього доступу.",
  faq: [["Що якщо у нас немає записів дзвінків?", "Підходять записи Zoom, Google Meet, телефонії, голосові з Telegram або готові транскрипти. Якщо записів мало, краще спочатку накопичити 2 тижні даних."], ["Який мінімум дзвінків потрібен?", "Бажано від 20 дзвінків. Менше можна розібрати як швидкий зріз, але висновки будуть статистично слабші."], ["Що з конфіденційністю?", "Можна підписати NDA до передачі записів. У звіті менеджери позначаються як M-1, M-2; відповідність імен залишається у вас."], ["Чим це відрізняється від Fireflies, Gong або CRM?", "Ці інструменти дають дані й транскрипти. CallControl перетворює дзвінки на управлінський звіт: де ризик, чому він виник і що робити."], ["Чи можна аналізувати підтримку, а не продаж?", "Так, але чек-лист змінюється: тон, емпатія, швидкість реакції, ескалація, вирішення звернення і повторні контакти."], ["Чи буде кабінет, де ми самі завантажуємо дзвінки?", "Так, це напрям розвитку. Зараз працює аудит у форматі послуги: менше впровадження, швидший перший результат."], ["Що відбувається після звіту?", "Ви отримуєте план дій. За потреби можна окремо обговорити коучинг менеджерів або щомісячний контроль."]],
  formTitle: "Запросити аудит",
  formLead: "Залиште контакт і короткий контекст. Я звʼяжуся протягом робочого дня і скажу, який формат підходить.",
  fields: ["Імʼя", "Telegram або email", "Компанія", "Сайт або профіль", "Розмір відділу продажів", "Сегмент", "Формат", "Що хочете зрозуміти з аудиту?", "Чи є записи або транскрипти?"],
  placeholders: ["Як до вас звертатися", "@username або email", "Назва компанії", "https://...", "3-7 менеджерів", "EdTech / B2B SaaS / агенція", "Express / Team / Department / не впевнений", "Наприклад: падає конверсія після першого дзвінка, менеджери не закривають наступний крок", "Є записи в Zoom/CRM/телефонії або тільки текстові транскрипти"],
  submit: "Надіслати заявку",
  sending: "Надсилання...",
  success: ["Заявку отримано.", "Звʼяжуся з вами протягом робочого дня. Якщо терміново — напишіть у Telegram: @manukianartur1997."],
  error: ["Не вдалося надіслати форму.", "Спробуйте ще раз або напишіть напряму: @manukianartur1997."],
  privacy: "Дані використовуються лише для звʼязку щодо заявки і підготовки аудиту.",
  footer: "CallControl AI · аудит дзвінків відділу продажів · Артур Манукян · Україна",
};

locales.en = {
  ...locales.ru,
  path: "/en/",
  lang: "en",
  title: "CallControl AI — sales call audit",
  description: "AI sales-call audit: 20-50 recordings, PDF report, Value at Risk, manager ranking, and an action plan.",
  nav: ["Process", "Sample report", "Formats", "FAQ", "Request audit"],
  badge: "AI call audit · done-for-you",
  h1: "Sales call audit in 5 business days",
  lead: "Find where money leaks in your funnel. Get a PDF with specific call quotes, manager ranking, Marketing vs Sales verdict, and an action plan.",
  primary: "Request audit",
  secondary: "View sample",
  trust: [["20-50", "calls in one audit"], ["5-7", "business days to report"], ["30/60/90", "action plan for the sales lead"]],
  proofTitle: "What leadership receives",
  proof: [["Value at Risk", "Estimated revenue at risk in the current funnel.", "$8.4k"], ["Manager Ranking", "Who keeps the standard and who needs coaching.", "5 roles"], ["Marketing vs Sales", "Where the issue sits: lead quality, sales handling, or offer.", "verdict"], ["Call Evidence", "Timestamped quotes instead of generic opinions.", "4+ blocks"]],
  sampleTitle: "Sample report structure",
  sampleLead: "A synthetic EdTech example showing the report format: executive summary, Value at Risk, quotes, manager ranking, and action plan.",
  sampleDisclaimer: "Important: this is not a real client case. Numbers and quotes are illustrative only.",
  sampleCta: "Open sample structure",
  sampleFile: "/samples/b2b-saas-ru-sample-report.md",
  cards: [["Executive Summary", "One main conclusion, top-3 priorities, and where revenue leaks."], ["Value at Risk", "Impact estimate from call failures based on your baseline."], ["Call Quotes", "Specific manager phrases and why the deal cools down."], ["Action Plan", "What to fix in the first 30, 60, and 90 days."]],
  processTitle: "How the audit works",
  processLead: "No heavy integration or long implementation. Service first, automation later where it truly matters.",
  steps: [["01", "Request and short call", "We clarify segment, call volume, recording format, and the audit question."], ["02", "Recording transfer", "You send recordings or transcripts via Drive/Dropbox. NDA can be signed before access."], ["03", "AI analysis and human review", "Each call goes through structured analysis. Final conclusions are reviewed manually."], ["04", "PDF and walk-through", "You receive the report and a review: what to fix first, whom to coach, and what to change in the team meeting."]],
  leakTitle: "Where revenue usually leaks",
  leakLead: "The audit does not argue abstractly about “bad leads”. It separates responsibility across marketing, sales, and process.",
  leaks: [["Discovery", "The manager talks about the product before understanding pain, budget, and timing.", "high risk"], ["Next Step", "The call ends with “I’ll call you back” without date, time, or agreement.", "common leak"], ["Offer Fit", "The client came with one expectation while sales presents another offer.", "marketing/sales"], ["Price Talk", "Price appears before value, and the client leaves to “think”.", "money leak"]],
  pricingTitle: "Audit formats",
  pricingLead: "Prices are for one-time audits. Scope can be clarified after a short discovery call.",
  tiers: [["Express", "from $700", "up to 20 calls · 5 business days", ["one sales segment", "12-15 page PDF", "30-minute walk-through", "3 main risks and quick fixes"], "Order Express"], ["Team", "from $1,500", "20-40 calls · 7 business days", ["up to 6 managers in ranking", "Marketing vs Sales verdict", "Value at Risk from your baseline", "follow-up in 2 weeks"], "Discuss Team Audit", "Recommended"], ["Department", "from $3,000", "40-80 calls · 10 business days", ["multiple teams or directions", "deep segmentation of loss reasons", "60-minute walk-through", "2 follow-up sessions"], "Discuss scope"]],
  futureTitle: "What the self-serve version will add",
  futureLead: "Right now we sell the audit as a service. A self-serve workspace comes later, once repeated patterns are clear from the first clients.",
  future: [["Call upload", "Clients add audio, transcripts, or folder links themselves."], ["Workspace", "Owner, sales lead, and manager see different report levels."], ["CRM summary", "Call outcome and next step go into the lead card."], ["Weekly digest", "Short Telegram report for the owner and sales lead."]],
  futureNote: "This is a development map, not a timeline promise. You can mention early-access interest in the form.",
  faq: [["What if we do not have call recordings?", "Zoom, Google Meet, telephony recordings, Telegram voice messages, or ready transcripts work. If you have too little data, collect two more weeks first."], ["What is the minimum call volume?", "Ideally 20+ calls. Fewer calls can work as a quick scan, but the conclusions will be statistically weaker."], ["How do you handle confidentiality?", "We can sign an NDA before receiving recordings. Managers are labeled M-1, M-2; mapping stays with you."], ["How is this different from Fireflies, Gong, or CRM?", "Those tools provide data and transcripts. CallControl turns calls into a management report: where the risk is, why it happened, and what to do."], ["Can you analyze support instead of sales?", "Yes, but the checklist changes: tone, empathy, response speed, escalation, resolution quality, and repeat contacts."], ["Will there be a workspace where we upload calls ourselves?", "Yes, that is the product direction. For now, done-for-you audit means less setup and faster first value."], ["What happens after the report?", "You receive an action plan. Manager coaching or monthly control can be discussed separately if needed."]],
  formTitle: "Request audit",
  formLead: "Leave your contact and short context. I will reply during the business day and suggest the right format.",
  fields: ["Name", "Telegram or email", "Company", "Website or profile", "Sales team size", "Segment", "Format", "What should the audit answer?", "Do you have recordings or transcripts?"],
  placeholders: ["How should I address you?", "@username or email", "Company name", "https://...", "3-7 managers", "EdTech / B2B SaaS / agency", "Express / Team / Department / not sure", "For example: conversion drops after the first call, managers do not set next steps", "Recordings in Zoom/CRM/telephony or only text transcripts"],
  submit: "Send request",
  sending: "Sending...",
  success: ["Request received.", "I will reply during the business day. If urgent, message me on Telegram: @manukianartur1997."],
  error: ["The form could not be sent.", "Try again or message me directly: @manukianartur1997."],
  privacy: "Data is used only to contact you and prepare the audit.",
  footer: "CallControl AI · sales call audit · Artur Manukian · Ukraine",
};

function e(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function link(locale) {
  return locale === "ru" ? "/ru/" : locales[locale].path;
}

function list(items) {
  return items.map((item) => `<li>${e(item)}</li>`).join("");
}

function cards(items, className = "mini-card") {
  return items.map(([title, text]) => `<article class="${className}"><strong>${e(title)}</strong><p>${e(text)}</p></article>`).join("");
}

function render(locale) {
  const t = locales[locale];
  const langs = ["ru", "uk", "en"].map((key) => `<a class="lang-pill${key === locale ? " active" : ""}" href="${link(key)}">${key === "uk" ? "UA" : key.toUpperCase()}</a>`).join("");
  const trust = t.trust.map(([value, label]) => `<div class="trust-item"><strong>${e(value)}</strong><span>${e(label)}</span></div>`).join("");
  const proof = t.proof.map(([title, text, value], index) => `<div class="proof-row"><div><strong>${e(title)}</strong><span>${e(text)}</span></div><b class="${index === 0 || index === 3 ? "risk" : ""}">${e(value)}</b></div>`).join("");
  const steps = t.steps.map(([n, title, text]) => `<article class="step-card"><small>${e(n)}</small><strong>${e(title)}</strong><p>${e(text)}</p></article>`).join("");
  const leaks = t.leaks.map(([title, text, tag]) => `<article class="leak-row"><div><strong>${e(title)}</strong><p>${e(text)}</p></div><span>${e(tag)}</span></article>`).join("");
  const tiers = t.tiers.map(([name, price, meta, bullets, cta, featured]) => `<article class="tier-card${featured ? " featured" : ""}">${featured ? `<span class="featured-label">${e(featured)}</span>` : ""}<h3>${e(name)}</h3><div class="price">${e(price)}</div><p>${e(meta)}</p><ul>${list(bullets)}</ul><a href="#request">${e(cta)}</a></article>`).join("");
  const faq = t.faq.map(([q, a]) => `<details class="faq-item"><summary>${e(q)}</summary><p>${e(a)}</p></details>`).join("");

  return `<!doctype html>
<html lang="${t.lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${e(t.title)}</title>
  <meta name="description" content="${e(t.description)}" />
  <meta property="og:title" content="${e(t.title)}" />
  <meta property="og:description" content="${e(t.description)}" />
  <meta property="og:type" content="website" />
  <style>
    @import url("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap");
    :root{--bg:#07111f;--surface:rgba(255,255,255,.075);--line:rgba(226,232,240,.16);--line2:rgba(226,232,240,.26);--text:#f8fafc;--muted:#b9c6d8;--faint:#7d8fa6;--blue:#38bdf8;--green:#22c55e;--red:#fb7185;--shadow:0 22px 90px rgba(0,0,0,.28)}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--text);background:linear-gradient(135deg,rgba(56,189,248,.16),transparent 34%),linear-gradient(215deg,rgba(99,102,241,.2),transparent 38%),linear-gradient(180deg,#020617 0%,var(--bg) 42%,#0f172a 100%);font-family:Geist,Inter,system-ui,sans-serif;letter-spacing:0}a{color:inherit}.wrap{width:min(1180px,calc(100% - 32px));margin:0 auto}
    .topbar{position:sticky;top:0;z-index:20;border-bottom:1px solid var(--line);background:rgba(2,6,23,.72);backdrop-filter:blur(18px)}.nav{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:72px}.brand{display:flex;flex-direction:column;gap:2px;text-decoration:none}.brand strong{font-size:17px;letter-spacing:-.02em}.brand span,.nav-links{color:var(--muted);font-size:14px}.brand span{font-size:12px}.nav-links{display:flex;align-items:center;gap:16px}.nav-links a{text-decoration:none}.nav-cta{padding:10px 14px;border:1px solid rgba(125,211,252,.4);border-radius:10px;background:rgba(56,189,248,.12);color:#e0f2fe;font-weight:600}.lang-switch{display:flex;gap:6px}.lang-pill{min-width:34px;padding:7px 9px;border:1px solid var(--line);border-radius:9px;text-align:center;text-decoration:none;color:var(--muted);font:600 12px "JetBrains Mono",monospace}.lang-pill.active{color:var(--text);border-color:rgba(125,211,252,.42);background:rgba(125,211,252,.11)}
    section{padding:clamp(58px,8vw,96px) 0}.hero{padding-top:clamp(54px,8vw,104px)}.hero-grid,.sample-layout,.two-col{display:grid;grid-template-columns:minmax(0,1.04fr) minmax(330px,.96fr);gap:clamp(24px,5vw,58px);align-items:center}.badge{display:inline-flex;padding:8px 11px;border:1px solid rgba(125,211,252,.28);border-radius:999px;background:rgba(125,211,252,.09);color:#bae6fd;font:600 11px "JetBrains Mono",monospace;text-transform:uppercase}h1,h2,h3{margin:0;font-weight:600;letter-spacing:-.028em}h1{max-width:790px;margin-top:20px;font-size:clamp(44px,7vw,86px);line-height:.98}.hero-lead{max-width:720px;margin:20px 0 0;color:var(--muted);font-size:clamp(17px,2vw,21px);line-height:1.55}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.button{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:12px 16px;border-radius:11px;border:1px solid var(--line2);text-decoration:none;font-weight:600}.button.primary{border-color:rgba(125,211,252,.42);background:linear-gradient(135deg,#38bdf8,#4f46e5);color:#fff;box-shadow:0 14px 38px rgba(56,189,248,.18)}.button.secondary{background:rgba(255,255,255,.07)}
    .trust-grid,.grid-4,.future-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.trust-grid{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:30px}.trust-item,.proof-card,.mini-card,.step-card,.leak-row,.tier-card,.faq-item,.form-card{border:1px solid var(--line);background:var(--surface);border-radius:14px;backdrop-filter:blur(16px);box-shadow:0 0 0 1px rgba(255,255,255,.025)}.trust-item,.mini-card,.step-card{padding:18px}.trust-item strong,.price,.proof-row b{display:block;font-family:"JetBrains Mono",monospace}.trust-item strong{color:#e0f2fe;font-size:20px}.trust-item span,.mini-card p,.step-card p{display:block;margin-top:5px;color:var(--muted);font-size:13px;line-height:1.45}.proof-card{padding:18px;box-shadow:var(--shadow)}.proof-card h2{margin-bottom:10px;font-size:22px}.proof-row{display:grid;grid-template-columns:1fr auto;gap:14px;padding:15px 0;border-bottom:1px solid var(--line)}.proof-row:last-child{border-bottom:0}.proof-row strong{display:block;margin-bottom:5px}.proof-row span{color:var(--muted);font-size:13px;line-height:1.4}.proof-row b{color:#86efac;white-space:nowrap}.proof-row b.risk{color:#fda4af}
    .section-head{max-width:780px;margin-bottom:24px}.section-head h2{font-size:clamp(30px,4.6vw,56px);line-height:1.05}.section-head p{color:var(--muted);font-size:17px;line-height:1.55}.sample-preview{min-height:430px;padding:24px;border-radius:16px;border:1px solid var(--line2);background:linear-gradient(180deg,rgba(248,250,252,.96),rgba(226,232,240,.92));color:#0f172a}.sample-preview small{color:#475569;font:600 12px "JetBrains Mono",monospace;text-transform:uppercase}.sample-preview h3{margin-top:16px;font-size:30px;color:#0f172a}.sample-preview p{color:#475569;line-height:1.55}.sample-list{display:grid;gap:10px;margin:22px 0}.sample-line{display:flex;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid rgba(15,23,42,.12);font-size:14px}.sample-line b{font-family:"JetBrains Mono",monospace;color:#00684a}.sample-side{display:grid;gap:12px}.sample-disclaimer{margin-top:14px;padding:13px 14px;border-radius:12px;background:rgba(245,158,11,.13);color:#fde68a;font-size:13px;line-height:1.45}
    .step-card small{display:block;margin-bottom:14px;color:#7dd3fc;font:600 12px "JetBrains Mono",monospace}.leak-stack{display:grid;gap:10px}.leak-row{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;padding:16px 18px}.leak-row p{margin:5px 0 0;color:var(--muted);line-height:1.5}.leak-row span{padding:7px 9px;border-radius:999px;background:rgba(251,113,133,.13);color:#fecdd3;font:600 11px "JetBrains Mono",monospace;white-space:nowrap}
    .pricing-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.tier-card{position:relative;padding:22px}.tier-card.featured{border-color:rgba(34,197,94,.38);background:rgba(34,197,94,.08)}.featured-label{position:absolute;right:16px;top:16px;padding:6px 8px;border-radius:999px;background:rgba(34,197,94,.16);color:#bbf7d0;font:600 11px "JetBrains Mono",monospace}.tier-card h3{font-size:23px}.price{margin-top:13px;color:#e0f2fe;font-size:28px}.tier-card p,.future-note{color:var(--muted)}.tier-card ul{margin:18px 0;padding-left:19px;color:var(--muted);line-height:1.65}.tier-card a{display:inline-flex;width:100%;justify-content:center;padding:12px 14px;border-radius:11px;background:rgba(255,255,255,.08);border:1px solid var(--line2);text-decoration:none;font-weight:600}.future-note{margin-top:14px;font-size:14px}
    .faq-grid{display:grid;gap:10px}.faq-item summary{cursor:pointer;padding:17px 18px;font-weight:600}.faq-item p{margin:0;padding:0 18px 18px;color:var(--muted);line-height:1.55}.form-card{padding:clamp(20px,4vw,34px)}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}label{display:grid;gap:7px;color:var(--muted);font-size:13px}input,textarea{width:100%;border:1px solid var(--line);border-radius:11px;background:rgba(2,6,23,.46);color:var(--text);font:inherit;padding:12px 13px;outline:none}textarea{min-height:106px;resize:vertical}.full{grid-column:1/-1}.form-status{margin-top:14px;min-height:42px;color:var(--muted);line-height:1.5}.form-status strong{color:var(--text)}.privacy{margin-top:10px;color:var(--faint);font-size:13px}.footer{padding:28px 0 42px;color:var(--muted);border-top:1px solid var(--line)}.footer-inner{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap}
    @media(max-width:980px){.hero-grid,.sample-layout,.two-col,.pricing-grid{grid-template-columns:1fr}.grid-4,.future-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.nav-links{display:none}}@media(max-width:640px){.wrap{width:min(100% - 24px,1180px)}h1{font-size:42px}.trust-grid,.grid-4,.future-grid,.form-grid{grid-template-columns:1fr}.leak-row{grid-template-columns:1fr}.sample-preview{min-height:auto}}
  </style>
</head>
<body>
  <header class="topbar"><div class="wrap nav"><a class="brand" href="${link(locale)}"><strong>CallControl AI</strong><span>${e(t.badge)}</span></a><nav class="nav-links"><a href="#process">${e(t.nav[0])}</a><a href="#sample">${e(t.nav[1])}</a><a href="#pricing">${e(t.nav[2])}</a><a href="#faq">${e(t.nav[3])}</a><a class="nav-cta" href="#request">${e(t.nav[4])}</a></nav><div class="lang-switch">${langs}</div></div></header>
  <main>
    <section class="hero"><div class="wrap hero-grid"><div><span class="badge">${e(t.badge)}</span><h1>${e(t.h1)}</h1><p class="hero-lead">${e(t.lead)}</p><div class="actions"><a class="button primary" href="#request">${e(t.primary)}</a><a class="button secondary" href="#sample">${e(t.secondary)}</a></div><div class="trust-grid">${trust}</div></div><aside class="proof-card"><h2>${e(t.proofTitle)}</h2>${proof}</aside></div></section>
    <section id="sample"><div class="wrap sample-layout"><article class="sample-preview"><small>Sample Report · CallControl AI</small><h3>${e(t.sampleTitle)}</h3><p>${e(t.sampleLead)}</p><div class="sample-list"><div class="sample-line"><span>Revenue Leak</span><b>32-38%</b></div><div class="sample-line"><span>Manager Ranking</span><b>M-1...M-5</b></div><div class="sample-line"><span>Marketing vs Sales</span><b>verdict</b></div><div class="sample-line"><span>Action Plan</span><b>30/60/90</b></div></div><a class="button primary" href="${t.sampleFile}">${e(t.sampleCta)}</a></article><div class="sample-side"><div class="section-head"><h2>${e(t.sampleTitle)}</h2><p>${e(t.sampleLead)}</p><div class="sample-disclaimer">${e(t.sampleDisclaimer)}</div></div><div class="grid-4">${cards(t.cards)}</div></div></div></section>
    <section id="process"><div class="wrap"><div class="section-head"><h2>${e(t.processTitle)}</h2><p>${e(t.processLead)}</p></div><div class="grid-4">${steps}</div></div></section>
    <section><div class="wrap two-col"><div class="section-head"><h2>${e(t.leakTitle)}</h2><p>${e(t.leakLead)}</p></div><div class="leak-stack">${leaks}</div></div></section>
    <section id="pricing"><div class="wrap"><div class="section-head"><h2>${e(t.pricingTitle)}</h2><p>${e(t.pricingLead)}</p></div><div class="pricing-grid">${tiers}</div></div></section>
    <section><div class="wrap"><div class="section-head"><h2>${e(t.futureTitle)}</h2><p>${e(t.futureLead)}</p></div><div class="future-grid">${cards(t.future)}</div><p class="future-note">${e(t.futureNote)}</p></div></section>
    <section id="faq"><div class="wrap"><div class="section-head"><h2>${e(t.faqTitle)}</h2></div><div class="faq-grid">${faq}</div></div></section>
    <section id="request"><div class="wrap"><div class="form-card"><div class="section-head"><h2>${e(t.formTitle)}</h2><p>${e(t.formLead)}</p></div><form id="leadForm"><div class="form-grid">${formFields(t)}</div><div class="actions"><button class="button primary" type="submit">${e(t.submit)}</button></div><div class="form-status" id="formStatus" role="status" aria-live="polite"></div><p class="privacy">${e(t.privacy)}</p></form></div></div></section>
  </main>
  <footer class="footer"><div class="wrap footer-inner"><span>${e(t.footer)}</span><span>Telegram: @manukianartur1997</span></div></footer>
  <script>
    const copy = ${JSON.stringify({ sending: t.sending, submit: t.submit, success: t.success, error: t.error })};
    const form = document.querySelector("#leadForm");
    const status = document.querySelector("#formStatus");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      button.disabled = true;
      button.textContent = copy.sending;
      status.innerHTML = "";
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.source = "callcontrol-public-landing";
      payload.locale = ${JSON.stringify(locale)};
      try {
        const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error("request_failed");
        status.innerHTML = "<strong>" + copy.success[0] + "</strong><br>" + copy.success[1];
        form.reset();
      } catch (error) {
        status.innerHTML = "<strong>" + copy.error[0] + "</strong><br>" + copy.error[1];
      } finally {
        button.disabled = false;
        button.textContent = copy.submit;
      }
    });
  </script>
</body>
</html>`;
}

function formFields(t) {
  const names = ["name", "contact", "company", "website", "teamSize", "niche", "dataFormat", "pain", "dataLink"];
  return t.fields.map((label, index) => {
    const long = index >= 7;
    const tag = long ? "textarea" : "input";
    const required = index < 3 ? " required" : "";
    const cls = index >= 6 ? " class=\"full\"" : "";
    return `<label${cls}>${e(label)}<${tag} name="${names[index]}"${required} placeholder="${e(t.placeholders[index])}"></${tag}></label>`;
  }).join("");
}

module.exports = function generatePublicLanding() {
  const samplesDir = path.join(outDir, "samples");
  fs.mkdirSync(samplesDir, { recursive: true });
  for (const [file, content] of Object.entries(reports)) {
    fs.writeFileSync(path.join(samplesDir, file), content);
  }

  for (const locale of Object.keys(locales)) {
    const html = render(locale);
    if (locale === "ru") fs.writeFileSync(path.join(outDir, "index.html"), html);
    fs.mkdirSync(path.join(outDir, locale), { recursive: true });
    fs.writeFileSync(path.join(outDir, locale, "index.html"), html);
  }
  fs.writeFileSync(path.join(outDir, "hybrid-demo.html"), render("ru"));
  console.log("Public service landing ready: dist/index.html, dist/ru/index.html, dist/uk/index.html, dist/en/index.html");
};
