const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "preview-dist");

const css = `
:root{--bg:#081018;--panel:#101a24;--panel2:#0d1824;--text:#eff8ff;--muted:#9fb2c7;--line:rgba(148,163,184,.22);--blue:#38bdf8;--green:#34d399}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:linear-gradient(180deg,#081018,#0b1118 48%,#080d13);color:var(--text);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.55}
a{color:inherit}.nav{position:sticky;top:0;z-index:5;background:rgba(8,16,24,.92);border-bottom:1px solid var(--line);backdrop-filter:blur(14px)}.nav-inner{max-width:1160px;margin:auto;padding:14px 20px;display:flex;align-items:center;gap:16px}.brand{font-size:20px;font-weight:900;white-space:nowrap}.links{display:flex;gap:14px;flex:1;justify-content:center}.links a,.langs a{font-size:14px;color:var(--muted);text-decoration:none}.langs{display:flex;gap:8px}.langs .active{background:var(--blue);color:#061018;border-radius:999px;padding:4px 8px;font-weight:900}.btn{display:inline-flex;justify-content:center;align-items:center;min-height:44px;border-radius:10px;padding:12px 16px;background:var(--blue);color:#061018;text-decoration:none;font-weight:900;border:0;cursor:pointer}.btn.secondary{background:transparent;color:var(--text);border:1px solid var(--line)}
.container{max-width:1160px;margin:auto;padding:64px 20px}.hero{display:grid;grid-template-columns:1.08fr .92fr;gap:28px;align-items:center;padding-top:72px}.hero-card,.card,.item{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:22px}.hero-card{border-radius:22px;padding:28px;background:radial-gradient(circle at top right,rgba(56,189,248,.2),transparent 36%),var(--panel)}
h1{font-size:clamp(34px,5vw,62px);line-height:.98;letter-spacing:-.055em;margin:0 0 16px}h2{font-size:clamp(26px,3vw,38px);line-height:1.05;letter-spacing:-.04em;margin:0 0 12px}h3{margin:0 0 10px}p{color:var(--muted);margin:0 0 12px}.lead{font-size:20px;color:#cbd9e7}.pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:6px 10px;color:var(--muted);margin:0 6px 16px 0}.pill.active{color:var(--blue);border-color:var(--blue);background:rgba(56,189,248,.08)}.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:22px}.grid{display:grid;gap:16px}.two{grid-template-columns:repeat(2,1fr)}.three{grid-template-columns:repeat(3,1fr)}.four{grid-template-columns:repeat(4,1fr)}.section-head{max-width:760px;margin-bottom:24px}.stat{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)}.stat:last-child{border-bottom:0}.stat b{color:var(--green);font-size:24px}.amount{font-size:32px;font-weight:900;color:var(--green)}.featured{border-color:rgba(56,189,248,.7);box-shadow:0 0 0 1px rgba(56,189,248,.18)}
.compare{overflow:auto}.compare table{width:100%;min-width:760px;border-collapse:collapse;background:var(--panel);border-radius:18px;overflow:hidden}.compare th,.compare td{border:1px solid var(--line);padding:14px;text-align:left;vertical-align:top}.form{display:grid;gap:12px}.form label{display:grid;gap:6px;font-weight:700}.form input,.form select,.form textarea{width:100%;border:1px solid var(--line);border-radius:10px;background:#0b1420;color:var(--text);font:inherit;padding:12px}.form textarea{min-height:120px}.success{display:none;border:1px solid rgba(34,197,94,.45);color:#bbf7d0;background:rgba(34,197,94,.08);border-radius:10px;padding:12px}.footer{border-top:1px solid var(--line);color:var(--muted)}
@media(max-width:920px){.links{display:none}.hero,.two,.three,.four{grid-template-columns:1fr}.nav-inner{flex-wrap:wrap}.nav .btn{display:none}.btn{width:100%}.container{padding:44px 18px}h1{letter-spacing:-.035em}}
`;

const locales = {
  ru: {
    label: "RU",
    title: "CallControl AI — AI-аудит звонков отдела продаж",
    nav: ["Как это работает", "Что получите", "Пример отчёта", "Цены", "FAQ"],
    h1: "AI-аудит звонков отдела продаж онлайн-школы",
    sub: "Разбираем звонки вашего отдела продаж и показываем, где менеджеры теряют клиентов. PDF-отчёт с цитатами, рейтингом команды и планом действий — за 5–10 дней. Без интеграций и кабинетов.",
    bullets: ["Бесплатный старт: до 5 звонков для первой проверки", "Полный аудит: 30–100 звонков в одном отчёте", "PDF с цитатами, ошибками и планом действий для РОПа"],
    cta: "Получить бесплатный аудит 5 звонков",
    cta2: "Посмотреть пример отчёта",
    panel: "Что увидит руководитель",
    stats: [["5–10 дней", "подготовка отчёта"], ["3–5 страниц", "короткий бесплатный аудит"], ["15–40 страниц", "командный или отделский аудит"]],
    howTitle: "Как проходит аудит",
    howSub: "Четыре шага. Без интеграций: вы передаёте записи, мы возвращаем отчёт.",
    how: [["Оставляете заявку", "Коротко описываете команду, продукт и что хотите проверить."], ["Передаёте записи", "Google Drive, выгрузка из CRM, телефонии или Zoom/Meet."], ["Мы анализируем звонки", "AI находит паттерны, человек проверяет выводы."], ["Получаете PDF", "Цитаты, рейтинг менеджеров, ошибки по этапам и план действий."]],
    getTitle: "Что внутри отчёта",
    getSub: "Конкретика вместо общих фраз. Каждый вывод привязан к звонку и цитате.",
    get: [["Рейтинг менеджеров", "Кто сильнее закрывает и кто теряет клиента."], ["Ошибки по этапам", "Где не спросили бюджет, не обработали возражение или не назначили следующий шаг."], ["Цитаты с таймкодами", "Прямой фрагмент разговора, который можно проверить."], ["Голос клиента", "Повторяющиеся возражения и причины отказа."], ["План для РОПа", "Что разобрать на планёрке и кого обучать первым."], ["Сравнение менеджеров", "Конкретные различия в подходе, а не общая оценка."]],
    sampleTitle: "Пример отчёта",
    samples: [["Онлайн-школа", "47 звонков, 7 менеджеров", "В 31 звонке менеджер не уточнил бюджет до цены. В 23 звонках клиент сказал “подумаю”, и разговор завершили без обработки."], ["B2B-агентство", "38 звонков, 4 менеджера", "В 22 звонках цену называли до выявления боли. Команда теряет больше всего лидов после первого звонка: нет follow-up."]],
    useTitle: "Кому подходит",
    use: [["Команда выросла", "РОП больше не успевает слушать всех вручную."], ["Конверсия просела", "Лиды те же, реклама та же, но продажи падают."], ["Новый продукт", "Проверяем, как менеджеры объясняют продукт."], ["Перед обучением", "Даём диагностику до тренера или нового РОПа."]],
    diffTitle: "Чем отличается от других инструментов",
    compare: [["Что это", "Телефония и запись звонков", "Транскрипты встреч", "Аудит звонков с выводами"], ["Что нужно", "Настройка", "Подключение аккаунта", "Передать записи"], ["Лучше всего для", "Постоянной телефонии", "Текста встреч", "Понимания, где теряются клиенты"]],
    pricingTitle: "Цены",
    prices: [["Бесплатный аудит", "$0", "До 5 звонков, короткий PDF 3–5 страниц.", "Получить бесплатно"], ["Аудит команды", "$299", "До 30 звонков, 3–5 менеджеров, PDF 15–20 страниц.", "Заказать аудит"], ["Аудит отдела", "$799", "До 100 звонков, 6–15 менеджеров, стратегия роста.", "Заказать аудит"], ["Регулярный аудит", "от $500/мес", "Ежемесячная внешняя проверка и динамика.", "Обсудить формат"]],
    faqTitle: "Частые вопросы",
    faqs: [["Это SaaS?", "Нет. Сейчас это услуга: вы передаёте записи, мы возвращаем PDF-отчёт."], ["Нужны интеграции?", "Нет. Можно прислать записи, ссылки или выгрузку."], ["Кто делает отчёт?", "AI помогает искать паттерны, человек проверяет выводы."], ["Как с конфиденциальностью?", "Записи используются только для аудита и удаляются по запросу."]],
    formTitle: "Оставьте заявку",
    formSub: "Ответим в течение рабочего дня.",
    fields: ["Ваше имя", "Email", "Telegram или телефон", "Компания", "Сайт компании", "Размер отдела", "Формат", "Что хотите проверить?"],
    send: "Отправить заявку",
    ok: "Заявка получена. Мы свяжемся с вами в течение рабочего дня.",
    privacy: "Данные используются только для связи по вашему запросу.",
    footer: "AI-аудит звонков отдела продаж. Без интеграций, кабинетов и долгого внедрения."
  },
  uk: {
    label: "UK",
    title: "CallControl AI — AI-аудит дзвінків відділу продажів",
    nav: ["Як це працює", "Що отримаєте", "Приклад звіту", "Ціни", "FAQ"],
    h1: "AI-аудит дзвінків відділу продажів онлайн-школи",
    sub: "Розбираємо дзвінки вашого відділу продажів і показуємо, де менеджери втрачають клієнтів. PDF-звіт із цитатами, рейтингом команди та планом дій — за 5–10 днів. Без інтеграцій і кабінетів.",
    bullets: ["Безкоштовний старт: до 5 дзвінків для першої перевірки", "Повний аудит: 30–100 дзвінків в одному звіті", "PDF із цитатами, помилками та планом дій для керівника продажів"],
    cta: "Отримати безкоштовний аудит 5 дзвінків",
    cta2: "Подивитися приклад звіту",
    panel: "Що побачить керівник",
    stats: [["5–10 днів", "підготовка звіту"], ["3–5 сторінок", "короткий безкоштовний аудит"], ["15–40 сторінок", "командний або віддільний аудит"]],
    howTitle: "Як проходить аудит",
    howSub: "Чотири кроки. Без інтеграцій: ви передаєте записи, ми повертаємо звіт.",
    how: [["Залишаєте заявку", "Коротко описуєте команду, продукт і що хочете перевірити."], ["Передаєте записи", "Google Drive, експорт із CRM, телефонії або Zoom/Meet."], ["Ми аналізуємо дзвінки", "AI знаходить патерни, людина перевіряє висновки."], ["Отримуєте PDF", "Цитати, рейтинг менеджерів, помилки за етапами та план дій."]],
    getTitle: "Що всередині звіту",
    getSub: "Конкретика замість загальних фраз. Кожен висновок прив'язаний до дзвінка й цитати.",
    get: [["Рейтинг менеджерів", "Хто сильніше закриває і хто втрачає клієнта."], ["Помилки за етапами", "Де не запитали бюджет, не відпрацювали заперечення або не призначили наступний крок."], ["Цитати з таймкодами", "Прямий фрагмент розмови, який можна перевірити."], ["Голос клієнта", "Повторювані заперечення та причини відмови."], ["План для керівника продажів", "Що розібрати на планерці й кого навчати першим."], ["Порівняння менеджерів", "Конкретні відмінності в підході, а не загальна оцінка."]],
    sampleTitle: "Приклад звіту",
    samples: [["Онлайн-школа", "47 дзвінків, 7 менеджерів", "У 31 дзвінку менеджер не уточнив бюджет до ціни. У 23 дзвінках клієнт сказав “подумаю”, і розмову завершили без відпрацювання."], ["B2B-агенція", "38 дзвінків, 4 менеджери", "У 22 дзвінках ціну називали до виявлення болю. Команда втрачає найбільше лідів після першого дзвінка: немає follow-up."]],
    useTitle: "Кому підходить",
    use: [["Команда виросла", "Керівник продажів більше не встигає слухати всіх вручну."], ["Конверсія просіла", "Ліди ті самі, реклама та сама, але продажі падають."], ["Новий продукт", "Перевіряємо, як менеджери пояснюють продукт."], ["Перед навчанням", "Даємо діагностику до тренера або нового керівника продажів."]],
    diffTitle: "Чим відрізняємось від інших інструментів",
    compare: [["Що це", "Телефонія та запис дзвінків", "Транскрипти зустрічей", "Аудит дзвінків із висновками"], ["Що потрібно", "Налаштування", "Підключення акаунта", "Передати записи"], ["Найкраще для", "Постійної телефонії", "Тексту зустрічей", "Розуміння, де втрачаються клієнти"]],
    pricingTitle: "Ціни",
    prices: [["Безкоштовний аудит", "$0", "До 5 дзвінків, короткий PDF 3–5 сторінок.", "Отримати безкоштовно"], ["Аудит команди", "$299", "До 30 дзвінків, 3–5 менеджерів, PDF 15–20 сторінок.", "Замовити аудит"], ["Аудит відділу", "$799", "До 100 дзвінків, 6–15 менеджерів, стратегія росту.", "Замовити аудит"], ["Регулярний аудит", "від $500/міс", "Щомісячна зовнішня перевірка та динаміка.", "Обговорити формат"]],
    faqTitle: "Часті запитання",
    faqs: [["Це SaaS?", "Ні. Зараз це послуга: ви передаєте записи, ми повертаємо PDF-звіт."], ["Потрібні інтеграції?", "Ні. Можна надіслати записи, посилання або експорт."], ["Хто робить звіт?", "AI допомагає шукати патерни, людина перевіряє висновки."], ["Як із конфіденційністю?", "Записи використовуються тільки для аудиту й видаляються за запитом."]],
    formTitle: "Залиште заявку",
    formSub: "Відповімо протягом робочого дня.",
    fields: ["Ваше ім'я", "Email", "Telegram або телефон", "Компанія", "Сайт компанії", "Розмір відділу", "Формат", "Що хочете перевірити?"],
    send: "Надіслати заявку",
    ok: "Заявку отримано. Ми зв'яжемося з вами протягом робочого дня.",
    privacy: "Дані використовуються лише для зв'язку за вашим запитом.",
    footer: "AI-аудит дзвінків відділу продажів. Без інтеграцій, кабінетів і довгого впровадження."
  },
  en: {
    label: "EN",
    title: "CallControl AI — AI audit of sales calls",
    nav: ["How it works", "What you get", "Sample report", "Pricing", "FAQ"],
    h1: "AI audit of sales calls for online schools",
    sub: "We review your sales team's calls and show where managers lose clients. A PDF report with quotes, team rankings, and an action plan — in 5–10 days. No integrations, no logins.",
    bullets: ["Free start: up to 5 calls for the first check", "Full audit: 30–100 calls in one report", "PDF with quotes, mistakes, and an action plan for your sales lead"],
    cta: "Get a free audit of 5 calls",
    cta2: "See a sample report",
    panel: "What the sales lead sees",
    stats: [["5–10 days", "report delivery time"], ["3–5 pages", "short free audit"], ["15–40 pages", "team or department audit"]],
    howTitle: "How the audit works",
    howSub: "Four steps. No integrations: you send recordings, we send back the report.",
    how: [["Submit a request", "Briefly describe your team, product, and what you want us to check."], ["Share recordings", "Google Drive, CRM export, phone system, Zoom or Meet."], ["We analyze the calls", "AI finds patterns, a human reviews the findings."], ["Get the PDF", "Quotes, manager rankings, funnel-stage mistakes and an action plan."]],
    getTitle: "What is inside the report",
    getSub: "Specifics instead of vague notes. Every finding links to a call and a quote.",
    get: [["Manager rankings", "Who closes better and who loses clients."], ["Funnel-stage mistakes", "Where budget was not checked, objections were missed, or no next step was set."], ["Quotes with timestamps", "A direct call fragment you can verify."], ["Voice of customer", "Recurring objections and refusal reasons."], ["Action plan", "What to discuss and whom to coach first."], ["Manager comparison", "Specific differences in approach, not a vague score."]],
    sampleTitle: "Sample report",
    samples: [["Online school", "47 calls, 7 managers", "In 31 calls, the manager did not ask about budget before price. In 23 calls, the client said “I will think about it” and the call ended without handling it."], ["B2B agency", "38 calls, 4 managers", "In 22 calls, price was named before understanding the pain. The team loses most leads after the first call: no follow-up."]],
    useTitle: "Who this is for",
    use: [["The team has grown", "The sales lead can no longer listen manually."], ["Conversion dropped", "Same leads, same ads, but sales are falling."], ["New product", "We check how managers explain the product."], ["Before training", "Get diagnostics before hiring a trainer or a new sales lead."]],
    diffTitle: "How we differ from other tools",
    compare: [["What it is", "Phone system and call recording", "Meeting transcripts", "Call audit with findings"], ["What is needed", "Setup", "Account connection", "Send recordings"], ["Best for", "Ongoing telephony", "Meeting text", "Understanding where clients are lost"]],
    pricingTitle: "Pricing",
    prices: [["Free audit", "$0", "Up to 5 calls, short 3–5 page PDF.", "Get it free"], ["Team audit", "$299", "Up to 30 calls, 3–5 managers, 15–20 page PDF.", "Order audit"], ["Department audit", "$799", "Up to 100 calls, 6–15 managers, growth strategy.", "Order audit"], ["Ongoing audit", "from $500/mo", "Monthly external review and trend tracking.", "Discuss format"]],
    faqTitle: "Frequently asked questions",
    faqs: [["Is this SaaS?", "No. Right now it is a service: you send recordings, we return a PDF report."], ["Do we need integrations?", "No. You can send recordings, links, or an export."], ["Who makes the report?", "AI helps find patterns, a human reviews the findings."], ["What about confidentiality?", "Recordings are used only for the audit and deleted on request."]],
    formTitle: "Send a request",
    formSub: "We reply within one business day.",
    fields: ["Your name", "Email", "Telegram or phone", "Company", "Company website", "Sales team size", "Format", "What do you want us to check?"],
    send: "Send request",
    ok: "Request received. We will get back to you within one business day.",
    privacy: "We use your data only to follow up on your request.",
    footer: "AI audit of sales calls. No integrations, no accounts, no long implementation."
  }
};

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const list = (items) => `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
const cards = (items) => items.map(([a, b]) => `<div class="item"><h3>${esc(a)}</h3><p>${esc(b)}</p></div>`).join("");

function render(lang) {
  const l = locales[lang];
  const nav = l.nav.map((x, i) => `<a href="#${["how", "get", "sample", "pricing", "faq"][i]}">${esc(x)}</a>`).join("");
  const langs = Object.keys(locales).map((key) => `<a class="${key === lang ? "active" : ""}" href="/${key}/">${locales[key].label}</a>`).join("");
  const stat = l.stats.map(([a, b]) => `<div class="stat"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("");
  const how = l.how.map(([a, b], i) => `<div class="item"><small>${i + 1}</small><h3>${esc(a)}</h3><p>${esc(b)}</p></div>`).join("");
  const samples = l.samples.map(([a, b, c]) => `<div class="card"><span class="pill">${esc(b)}</span><h3>${esc(a)}</h3><p>${esc(c)}</p></div>`).join("");
  const compare = l.compare.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("");
  const prices = l.prices.map(([a, b, c, d], i) => `<div class="card ${i === 1 ? "featured" : ""}"><h3>${esc(a)}</h3><div class="amount">${esc(b)}</div><p>${esc(c)}</p><a class="btn" href="#lead">${esc(d)}</a></div>`).join("");
  const faqs = l.faqs.map(([a, b]) => `<div class="item"><h3>${esc(a)}</h3><p>${esc(b)}</p></div>`).join("");
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(l.title)}</title><style>${css}</style></head><body>
  <header class="nav"><div class="nav-inner"><div class="brand">CallControl AI</div><div class="links">${nav}</div><div class="langs">${langs}</div><a class="btn" href="#lead">${esc(l.cta)}</a></div></header>
  <main>
    <section class="container hero"><div><span class="pill active">EdTech</span><span class="pill">B2B</span><h1>${esc(l.h1)}</h1><p class="lead">${esc(l.sub)}</p>${list(l.bullets)}<div class="actions"><a class="btn" href="#lead">${esc(l.cta)}</a><a class="btn secondary" href="#sample">${esc(l.cta2)}</a></div></div><aside class="hero-card"><h2>${esc(l.panel)}</h2>${stat}</aside></section>
    <section id="how" class="container"><div class="section-head"><h2>${esc(l.howTitle)}</h2><p>${esc(l.howSub)}</p></div><div class="grid four">${how}</div></section>
    <section id="get" class="container"><div class="section-head"><h2>${esc(l.getTitle)}</h2><p>${esc(l.getSub)}</p></div><div class="grid three">${cards(l.get)}</div></section>
    <section id="sample" class="container"><div class="section-head"><h2>${esc(l.sampleTitle)}</h2></div><div class="grid two">${samples}</div></section>
    <section class="container"><div class="section-head"><h2>${esc(l.useTitle)}</h2></div><div class="grid four">${cards(l.use)}</div></section>
    <section class="container compare"><div class="section-head"><h2>${esc(l.diffTitle)}</h2></div><table><tbody>${compare}</tbody></table></section>
    <section id="pricing" class="container"><div class="section-head"><h2>${esc(l.pricingTitle)}</h2></div><div class="grid four">${prices}</div></section>
    <section id="faq" class="container"><div class="section-head"><h2>${esc(l.faqTitle)}</h2></div><div class="grid two">${faqs}</div></section>
    <section id="lead" class="container"><div class="section-head"><h2>${esc(l.formTitle)}</h2><p>${esc(l.formSub)}</p></div><form class="card form" onsubmit="event.preventDefault();document.getElementById('ok').style.display='block'"><label>${esc(l.fields[0])}<input required></label><label>${esc(l.fields[1])}<input type="email" required></label><label>${esc(l.fields[2])}<input required></label><label>${esc(l.fields[3])}<input></label><label>${esc(l.fields[4])}<input></label><label>${esc(l.fields[5])}<select><option>1–2</option><option>3–5</option><option>6–15</option><option>15+</option></select></label><label>${esc(l.fields[6])}<select><option>${esc(l.prices[0][0])}</option><option>${esc(l.prices[1][0])}</option><option>${esc(l.prices[2][0])}</option></select></label><label>${esc(l.fields[7])}<textarea></textarea></label><button class="btn">${esc(l.send)}</button><p>${esc(l.privacy)}</p><div id="ok" class="success">${esc(l.ok)}</div></form></section>
  </main><footer class="container footer">${esc(l.footer)}</footer></body></html>`;
}

fs.rmSync(outDir, { recursive: true, force: true });
for (const lang of Object.keys(locales)) {
  const dir = path.join(outDir, lang);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), render(lang));
}
fs.writeFileSync(path.join(outDir, "index.html"), '<!doctype html><meta http-equiv="refresh" content="0; url=/ru/"><script>location.replace("/ru/")</script>');
console.log(outDir);
