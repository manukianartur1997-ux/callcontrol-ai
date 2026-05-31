const fs = require("fs");
const path = require("path");

const root = __dirname;
const outDir = path.join(root, "dist");

const css = `
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap");
:root{
  --bg:#f7f8fa;
  --paper:#ffffff;
  --ink:#121212;
  --muted:#667085;
  --soft:#eef0f3;
  --line:#e5e7eb;
  --risk:#e63946;
  --risk-soft:#fff1f2;
  --profit:#00684a;
  --profit-soft:#ecfdf5;
  --warn:#b45309;
  --warn-soft:#fff7ed;
  --navy:#101828;
  --mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  --sans:"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.55}
a{color:inherit}
.topbar{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.88);border-bottom:1px solid var(--line);backdrop-filter:blur(18px)}
.nav{max-width:1180px;margin:auto;padding:14px 20px;display:flex;align-items:center;gap:18px}
.brand{font-weight:800;letter-spacing:-.03em;font-size:20px;white-space:nowrap}
.navlinks{display:flex;gap:16px;flex:1;justify-content:center}
.navlinks a,.langs a{font-size:14px;color:var(--muted);text-decoration:none;font-weight:600}
.langs{display:flex;gap:6px;align-items:center}
.langs a{border:1px solid transparent;border-radius:999px;padding:6px 9px}
.langs a.active{border-color:var(--ink);color:var(--ink);background:var(--paper)}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border-radius:999px;padding:12px 18px;background:var(--ink);color:#fff;text-decoration:none;font-weight:800;border:1px solid var(--ink);cursor:pointer;font:inherit}
.btn.secondary{background:transparent;color:var(--ink);border-color:var(--line)}
.btn.green{background:var(--profit);border-color:var(--profit)}
.wrap{max-width:1180px;margin:auto;padding:72px 20px}
.hero{display:grid;grid-template-columns:1.05fr .95fr;gap:38px;align-items:center;padding-top:82px}
.eyebrow{display:inline-flex;gap:8px;align-items:center;border:1px solid var(--line);background:var(--paper);border-radius:999px;padding:7px 11px;color:var(--muted);font-weight:700;font-size:13px;margin-bottom:18px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--profit)}
h1,h2,h3,p{margin-top:0}
h1{font-size:clamp(38px,5vw,68px);line-height:.96;letter-spacing:-.055em;margin-bottom:18px}
h2{font-size:clamp(28px,3vw,44px);line-height:1.04;letter-spacing:-.045em;margin-bottom:14px}
h3{font-size:19px;line-height:1.18;letter-spacing:-.025em;margin-bottom:8px}
p{color:var(--muted)}
.lead{font-size:20px;color:#475467;max-width:660px}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}
.micro{font-size:13px;color:var(--muted)}
.grid{display:grid;gap:16px}
.two{grid-template-columns:repeat(2,minmax(0,1fr))}
.three{grid-template-columns:repeat(3,minmax(0,1fr))}
.four{grid-template-columns:repeat(4,minmax(0,1fr))}
.six{grid-template-columns:repeat(6,minmax(0,1fr))}
.card,.demo,.price,.formbox,.report{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:22px}
.demo{border-radius:22px;padding:26px;box-shadow:0 24px 70px rgba(16,24,40,.08)}
.hero-demo{background:linear-gradient(180deg,#fff,#f9fafb);border:1px solid var(--line);border-radius:24px;padding:18px;box-shadow:0 30px 90px rgba(16,24,40,.12)}
.screen-top{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:14px}
.traffic{display:flex;gap:6px}.traffic span{width:10px;height:10px;border-radius:50%;background:#d0d5dd}.traffic span:nth-child(1){background:#ef4444}.traffic span:nth-child(2){background:#f59e0b}.traffic span:nth-child(3){background:#22c55e}
.mono{font-family:var(--mono);font-weight:700;letter-spacing:-.02em}
.kpi{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}
.kpi div{background:#f9fafb;border:1px solid var(--line);border-radius:14px;padding:14px}
.kpi strong{display:block;font-family:var(--mono);font-size:24px;letter-spacing:-.04em}
.profit{color:var(--profit)}.risk{color:var(--risk)}.warn{color:var(--warn)}
.badge{display:inline-flex;align-items:center;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:800;border:1px solid var(--line);color:var(--muted);background:#fff}
.badge.risk{border-color:#fecdd3;background:var(--risk-soft);color:var(--risk)}
.badge.profit{border-color:#bbf7d0;background:var(--profit-soft);color:var(--profit)}
.badge.warn{border-color:#fed7aa;background:var(--warn-soft);color:var(--warn)}
.section-head{max-width:760px;margin-bottom:26px}
.section-head.wide{max-width:960px}
.mini-card{background:#f9fafb;border:1px solid var(--line);border-radius:16px;padding:16px}
.mini-card p:last-child,.card p:last-child{margin-bottom:0}
.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:18px;background:var(--paper)}
table{width:100%;border-collapse:collapse;min-width:760px}
th,td{padding:14px 16px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);background:#f9fafb}
tr:last-child td{border-bottom:0}
.leak-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}
.leak-row:last-child{border-bottom:0}
.bar{height:8px;background:var(--soft);border-radius:999px;overflow:hidden;margin-top:8px}
.bar i{display:block;height:100%;border-radius:999px;background:var(--risk)}
.quote{border-left:3px solid var(--risk);padding:12px 14px;background:var(--risk-soft);border-radius:0 12px 12px 0;color:#7f1d1d}
.split{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.proof-icon{width:38px;height:38px;border-radius:12px;background:#f2f4f7;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-weight:800;color:var(--ink);margin-bottom:12px}
.soon{background:#101828;color:#fff;border-radius:24px;padding:30px}
.soon p{color:#d0d5dd}.soon .badge{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18);color:#fff}
.price.featured{border-color:var(--profit);box-shadow:0 0 0 3px rgba(0,104,74,.08)}
.amount{font-family:var(--mono);font-size:34px;font-weight:800;letter-spacing:-.04em;margin:8px 0 10px}
.faq details{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:16px}
.faq summary{font-weight:800;cursor:pointer}
.faq p{margin-top:10px;margin-bottom:0}
.formbox form{display:grid;gap:12px}
label{display:grid;gap:6px;font-weight:700;color:#344054}
input,select,textarea{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px 13px;font:inherit;background:#fff;color:var(--ink)}
textarea{min-height:118px;resize:vertical}
.success{display:none;border:1px solid #bbf7d0;background:var(--profit-soft);color:var(--profit);border-radius:12px;padding:12px;font-weight:800}
.error{display:none;border:1px solid #fecdd3;background:var(--risk-soft);color:var(--risk);border-radius:12px;padding:12px;font-weight:800}
footer{border-top:1px solid var(--line);padding:28px 20px;color:var(--muted)}
.footer-inner{max-width:1180px;margin:auto;display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap}
@media(max-width:980px){.hero,.two,.split{grid-template-columns:1fr}.three,.four,.six{grid-template-columns:repeat(2,minmax(0,1fr))}.navlinks{display:none}.hero{padding-top:52px}.wrap{padding:54px 18px}}
@media(max-width:620px){.three,.four,.six,.kpi{grid-template-columns:1fr}.nav{flex-wrap:wrap}.nav .btn{display:none}.actions .btn{width:100%}h1{letter-spacing:-.035em}.hero-demo{padding:14px}.card,.demo,.price,.formbox,.report{padding:18px}}
`;

const commonProof = {
  ru: [
    ["₴540k", "Утечки выручки", "Сколько денег утекает из-за повторяющихся ошибок в звонках."],
    ["7", "Рейтинг менеджеров", "Кто закрывает, кто сливает и какой навык чинить первым."],
    ["18:04", "Разбор звонка", "Цитаты, тайм-коды и конкретные пропуски в одном звонке."],
    ["55.6%", "Маркетинг и продажи", "Где виноват слабый лид, а где продажи не дожали."],
    ["66%", "Чек-лист качества", "Как реально выполняется скрипт по 12 пунктам."],
    ["Пн 9:00", "Недельный отчёт", "Что обсудить на планёрке и кого обучать на неделе."]
  ],
  uk: [
    ["₴540k", "Втрати виручки", "Скільки грошей витікає через повторювані помилки у дзвінках."],
    ["7", "Рейтинг менеджерів", "Хто закриває, хто зливає і яку навичку лагодити першою."],
    ["18:04", "Розбір дзвінка", "Цитати, таймкоди та конкретні пропуски в одному дзвінку."],
    ["55.6%", "Маркетинг і продажі", "Де винен слабкий лід, а де продажі не дотиснули."],
    ["66%", "Чек-лист якості", "Як реально виконується скрипт за 12 пунктами."],
    ["Пн 9:00", "Тижневий звіт", "Що обговорити на планерці і кого навчати цього тижня."]
  ],
  en: [
    ["₴540k", "Revenue Leak", "How much money leaks through repeated mistakes in calls."],
    ["7", "Manager Ranking", "Who closes, who leaks, and which skill to fix first."],
    ["18:04", "Call Detail", "Quotes, timestamps, and specific misses in one call."],
    ["55.6%", "Marketing vs Sales", "Where the lead was weak and where sales failed to close."],
    ["66%", "Checklist Quality", "How the script is actually followed across 12 points."],
    ["Mon 9:00", "Weekly Report", "What to discuss and whom to coach this week."]
  ]
};

const locales = {
  ru: {
    label: "RU",
    title: "CallControl AI — аудит упущенной выручки в звонках",
    nav: ["Что получите", "Утечки", "Рейтинг", "Отчёт", "Цены", "Вопросы"],
    eyebrow: "AI-аудит звонков отдела продаж",
    h1: "Найдём, где ваш отдел продаж теряет деньги в звонках",
    sub: "За 5–10 дней разбираем переданную выборку звонков и возвращаем PDF-отчёт: revenue leaks, рейтинг менеджеров, ошибки по чек-листу, спор маркетинга и продаж, план действий для РОПа.",
    cta: "Получить бесплатный аудит 5 звонков",
    cta2: "Посмотреть пример анализа",
    trust: ["Без интеграций на старте", "Можно аудио или транскрипты", "RU / UK / EN"],
    heroPanel: {
      title: "Фрагмент будущего отчёта",
      leak: "Деньги под риском",
      leakText: "47 звонков без следующего шага",
      score: "Средний score",
      scoreText: "по чек-листу качества",
      quote: "«Ну подумайте, если что — напишите»",
      verdict: "AI-вывод: тёплый лид потерян на этапе закрытия. Нужно назначить конкретное время следующего контакта."
    },
    proofTitle: "Что вы увидите в отчёте",
    proofSub: "Это не простыня транскриптов. Отчёт показывает деньги, риск, доказательство в звонке и действие для руководителя.",
    revenue: {
      title: "Куда утекают деньги в отделе продаж",
      sub: "Не «конверсия 19%», а конкретные причины потерь по этапам — в деньгах.",
      period: "Октябрь 2025 · 312 звонков · 60 продаж",
      actual: "1 200 000 ₴",
      potential: "1 740 000 ₴",
      leak: "540 000 ₴",
      rows: [
        ["Не назначен следующий шаг", "47 звонков", "188 000 ₴", 84],
        ["Не отработано возражение «дорого»", "38 звонков", "152 000 ₴", 72],
        ["Не выявлен дедлайн решения", "29 звонков", "116 000 ₴", 55],
        ["Не предложена рассрочка", "18 звонков", "72 000 ₴", 34]
      ],
      takeaway: "Один аудит окупает себя, если команда закрывает хотя бы одну повторяющуюся причину потерь."
    },
    ranking: {
      title: "Рейтинг менеджеров: кто закрывает, кто сливает",
      sub: "Не по настроению руководителя и не только по выручке, а по качеству каждого звонка.",
      heads: ["Менеджер", "Звонков", "Конверсия", "Score", "Главная зона роста"],
      rows: [
        ["Ирина К.", "51", "27.5%", "87", "Бенчмарк команды"],
        ["Дмитрий П.", "48", "22.9%", "79", "Дожим дедлайна"],
        ["Анна Л.", "42", "21.4%", "76", "Возражения"],
        ["Сергей М.", "45", "17.8%", "64", "Следующий шаг"],
        ["Олег В.", "39", "15.4%", "58", "Цена и скидки"],
        ["Юлия Т.", "44", "13.6%", "52", "ЛПР и квалификация"]
      ],
      note: "Подтянуть низ команды до среднего = +6–8 продаж в месяц при текущем потоке."
    },
    call: {
      title: "Разбор одного звонка: что услышал AI",
      sub: "Тайм-коды, цитаты и конкретные пропуски — то, что увидел бы РОП, если бы слушал каждый звонок.",
      meta: "SF-2025-10-17-0042 · Сергей М. · 18 мин 04 сек · итог: не оплатил",
      misses: [
        ["04:11", "«Я сейчас в декрете, муж против таких трат...»", "Пропущен ЛПР. Нужно договориться о звонке втроём."],
        ["09:33", "«А это вообще реально 20 тыщ стоит?»", "Цена названа без декомпозиции ценности и рассрочки."],
        ["14:50", "«Мне надо подумать, посоветоваться»", "Нет конкретного времени следующего контакта."]
      ],
      better: "Лучше сказать: «Давайте зафиксируем следующий шаг: завтра в 12:00 я отправлю расчёт, и мы созвонимся на 10 минут».",
      forecast: "Вероятность оплаты до пятницы: 18%"
    },
    mvs: {
      title: "Маркетинг и продажи: где реальная причина слива",
      sub: "AI помогает закончить спор «лиды плохие» / «продажи не умеют продавать» цифрами из звонков.",
      cards: [
        ["Маркетинг", "35.3%", "89 лидов не совпали с ICP: не та сфера, нет бюджета, не та страна или не та боль."],
        ["Продажи", "55.6%", "140 целевых лидов потеряны из-за пропущенного этапа, возражения или следующего шага."],
        ["Оффер / внешнее", "9.1%", "23 отказа связаны с личными обстоятельствами или слабым совпадением оффера."]
      ],
      verdict: "Планёрка «кто виноват» превращается в планёрку «что чиним первым»."
    },
    checklist: {
      title: "Чек-лист качества: что менеджеры реально делают",
      sub: "Скрипт есть у всех. Вопрос в том, на сколько процентов он выполняется.",
      heads: ["Этап", "Критерий", "Выполнение"],
      rows: [
        ["Открытие", "Представился, обозначил тайминг", "96%"],
        ["Выявление", "Выявил боль / цель обучения", "74%"],
        ["Выявление", "Выявил ЛПР", "41%"],
        ["Выявление", "Выявил дедлайн решения", "38%"],
        ["Закрытие", "Отработал минимум одно возражение", "52%"],
        ["Закрытие", "Назначил конкретный следующий шаг", "45%"]
      ],
      note: "Не нужно чинить все 12 пунктов. Достаточно начать с 4 проваленных этапов."
    },
    weekly: {
      title: "Недельный отчёт для РОПа",
      sub: "Один документ на понедельник: что изменилось, кого обучать, какие звонки переслушать и какой скрипт поправить.",
      items: [
        ["Главное за неделю", "Конверсия выросла до 20.5%, но 3 крупных лида потеряны из-за пропуска ЛПР."],
        ["Что чинить", "Тренировка по выявлению ЛПР, 1-on-1 с Юлией, обновить блок «посоветуюсь»."],
        ["Сильные звонки", "Ирина К. — образцовая отработка «дорого» через рассрочку."],
        ["Красная зона", "Сергей М. — лид с бюджетом потерян на этапе следующего шага."]
      ]
    },
    report: {
      title: "Что клиент получает после аудита",
      sub: "Не доступ в пустой кабинет, а готовый управленческий артефакт: PDF, выводы, звонки-доказательства и план действий.",
      items: ["Краткое резюме на 1 страницу", "Дашборд утечек выручки", "Рейтинг менеджеров", "Разбор звонка с цитатами", "Вердикт по маркетингу и продажам", "План действий на неделю"]
    },
    soon: {
      title: "Сейчас аудит как услуга. Скоро — личный кабинет",
      sub: "Сейчас вы передаёте записи, мы анализируем их и возвращаем PDF-отчёт. Параллельно готовим самостоятельную версию: загрузка звонков, история отчётов, роли для РОПа и менеджеров, чек-листы, CRM/телефония и регулярные недельные отчёты.",
      cta: "Попасть в ранний доступ"
    },
    pricingTitle: "Форматы работы",
    prices: [
      ["Бесплатный аудит", "$0", "До 5 звонков. Короткий PDF 3–5 страниц: главный риск, цитаты и следующие шаги.", "Получить бесплатно"],
      ["Аудит команды", "$299", "До 30 звонков, 3–5 менеджеров, рейтинг команды и план для РОПа.", "Заказать аудит"],
      ["Аудит отдела", "$799", "До 100 звонков, 6–15 менеджеров, маркетинг и продажи, стратегия роста.", "Заказать аудит"],
      ["Регулярный аудит", "от $500/мес", "Регулярная внешняя проверка, недельный отчёт и динамика по команде.", "Обсудить формат"]
    ],
    faqTitle: "Вопросы и ответы",
    faqs: [
      ["Это SaaS?", "Сейчас это услуга аудита. Личный кабинет и самостоятельная версия готовятся как следующий этап."],
      ["Нужно что-то подключать?", "Нет. На старте достаточно передать аудио, транскрипты, CSV или ссылку на папку."],
      ["Можно прислать транскрипты вместо аудио?", "Да. Для первого аудита это часто даже быстрее."],
      ["Чем отличается от транскрибатора?", "Транскрибатор даёт текст. CallControl AI даёт управленческий вывод: деньги под риском, причина, цитата и действие."],
      ["Что с данными?", "Записи используются только для аудита. Если данные чувствительные — можно прислать обезличенные транскрипты."],
      ["Что входит в бесплатный аудит?", "До 5 звонков, короткий вывод, 2–3 цитаты, главный риск и рекомендация, что проверить дальше."]
    ],
    form: {
      title: "Получить бесплатный аудит",
      sub: "Оставьте контакт и кратко опишите команду. Заявка уйдёт в Telegram, мы вернёмся с форматом передачи звонков.",
      fields: ["Имя", "Email", "Telegram или телефон", "Компания", "Сайт", "Размер отдела", "Формат аудита", "Что хотите проверить?", "Ссылка на записи / транскрипты"],
      send: "Отправить заявку",
      ok: "Заявка отправлена. Мы свяжемся с вами в течение рабочего дня.",
      error: "Не получилось отправить заявку. Попробуйте ещё раз или напишите напрямую.",
      privacy: "Записи используются только для аудита и не передаются третьим лицам."
    },
    footer: "CallControl AI · AI-аудит упущенной выручки в звонках"
    ,
    ui: {
      aiFinding: "AI-вывод",
      actual: "Факт",
      potential: "Потенциал",
      score: "Оценка",
      forecast: "Прогноз",
      pdf: "PDF-отчёт",
      start: "Старт",
      audit: "Аудит",
      risk: "Риск",
      legacy: "Старая демка"
      ,
      soon: "Скоро"
    }
  },
  uk: {
    label: "UK",
    title: "CallControl AI — аудит втраченої виручки у дзвінках",
    nav: ["Що отримаєте", "Втрати", "Рейтинг", "Звіт", "Ціни", "Питання"],
    eyebrow: "AI-аудит дзвінків відділу продажів",
    h1: "Знайдемо, де ваш відділ продажів втрачає гроші у дзвінках",
    sub: "За 5–10 днів розбираємо передану вибірку дзвінків і повертаємо PDF-звіт: revenue leaks, рейтинг менеджерів, помилки за чек-листом, висновок маркетинг vs продажі та план дій для керівника продажів.",
    cta: "Отримати безкоштовний аудит 5 дзвінків",
    cta2: "Подивитися приклад аналізу",
    trust: ["Без інтеграцій на старті", "Можна аудіо або транскрипти", "RU / UK / EN"],
    heroPanel: {
      title: "Фрагмент майбутнього звіту",
      leak: "Гроші під ризиком",
      leakText: "47 дзвінків без наступного кроку",
      score: "Середній score",
      scoreText: "за чек-листом якості",
      quote: "«Ну подумайте, якщо що — напишіть»",
      verdict: "AI-висновок: теплий лід втрачено на етапі закриття. Треба призначити конкретний час наступного контакту."
    },
    proofTitle: "Що ви побачите у звіті",
    proofSub: "Це не полотно транскриптів. Звіт показує гроші, ризик, доказ у дзвінку і дію для керівника.",
    revenue: {
      title: "Куди витікають гроші у відділі продажів",
      sub: "Не «конверсія 19%», а конкретні причини втрат за етапами — у грошах.",
      period: "Жовтень 2025 · 312 дзвінків · 60 продажів",
      actual: "1 200 000 ₴",
      potential: "1 740 000 ₴",
      leak: "540 000 ₴",
      rows: [
        ["Не призначено наступний крок", "47 дзвінків", "188 000 ₴", 84],
        ["Не відпрацьовано заперечення «дорого»", "38 дзвінків", "152 000 ₴", 72],
        ["Не виявлено дедлайн рішення", "29 дзвінків", "116 000 ₴", 55],
        ["Не запропоновано розстрочку", "18 дзвінків", "72 000 ₴", 34]
      ],
      takeaway: "Один аудит окупається, якщо команда закриває хоча б одну повторювану причину втрат."
    },
    ranking: {
      title: "Рейтинг менеджерів: хто закриває, хто зливає",
      sub: "Не за настроєм керівника і не тільки за виручкою, а за якістю кожного дзвінка.",
      heads: ["Менеджер", "Дзвінків", "Конверсія", "Score", "Головна зона росту"],
      rows: [
        ["Ірина К.", "51", "27.5%", "87", "Бенчмарк команди"],
        ["Дмитро П.", "48", "22.9%", "79", "Дотиск дедлайну"],
        ["Анна Л.", "42", "21.4%", "76", "Заперечення"],
        ["Сергій М.", "45", "17.8%", "64", "Наступний крок"],
        ["Олег В.", "39", "15.4%", "58", "Ціна і знижки"],
        ["Юлія Т.", "44", "13.6%", "52", "ЛПР і кваліфікація"]
      ],
      note: "Підтягнути низ команди до середнього = +6–8 продажів на місяць при поточному потоці."
    },
    call: {
      title: "Розбір одного дзвінка: що почув AI",
      sub: "Таймкоди, цитати та конкретні пропуски — те, що побачив би керівник продажів, якби слухав кожен дзвінок.",
      meta: "SF-2025-10-17-0042 · Сергій М. · 18 хв 04 сек · результат: не оплатив",
      misses: [
        ["04:11", "«Я зараз у декреті, чоловік проти таких витрат...»", "Пропущено ЛПР. Треба домовитися про дзвінок утрьох."],
        ["09:33", "«А це взагалі реально 20 тисяч коштує?»", "Ціну названо без декомпозиції цінності та розстрочки."],
        ["14:50", "«Мені треба подумати, порадитися»", "Немає конкретного часу наступного контакту."]
      ],
      better: "Краще сказати: «Давайте зафіксуємо наступний крок: завтра о 12:00 я надішлю розрахунок, і ми зідзвонимося на 10 хвилин».",
      forecast: "Ймовірність оплати до п'ятниці: 18%"
    },
    mvs: {
      title: "Маркетинг і продажі: де реальна причина втрати",
      sub: "AI допомагає закінчити суперечку «ліди погані» / «продажі не вміють продавати» цифрами з дзвінків.",
      cards: [
        ["Маркетинг", "35.3%", "89 лідів не збіглися з ICP: не та сфера, немає бюджету, не та країна або не той біль."],
        ["Продажі", "55.6%", "140 цільових лідів втрачено через пропущений етап, заперечення або наступний крок."],
        ["Офер / зовнішнє", "9.1%", "23 відмови пов'язані з особистими обставинами або слабким збігом офера."]
      ],
      verdict: "Планерка «хто винен» перетворюється на планерку «що лагодимо першим»."
    },
    checklist: {
      title: "Чек-лист якості: що менеджери реально роблять",
      sub: "Скрипт є у всіх. Питання в тому, на скільки відсотків він виконується.",
      heads: ["Етап", "Критерій", "Виконання"],
      rows: [
        ["Відкриття", "Представився, позначив таймінг", "96%"],
        ["Виявлення", "Виявив біль / ціль навчання", "74%"],
        ["Виявлення", "Виявив ЛПР", "41%"],
        ["Виявлення", "Виявив дедлайн рішення", "38%"],
        ["Закриття", "Відпрацював мінімум одне заперечення", "52%"],
        ["Закриття", "Призначив конкретний наступний крок", "45%"]
      ],
      note: "Не треба лагодити всі 12 пунктів. Достатньо почати з 4 провалених етапів."
    },
    weekly: {
      title: "Тижневий звіт для керівника продажів",
      sub: "Один документ на понеділок: що змінилося, кого навчати, які дзвінки переслухати і який скрипт поправити.",
      items: [
        ["Головне за тиждень", "Конверсія виросла до 20.5%, але 3 великі ліди втрачені через пропуск ЛПР."],
        ["Що лагодити", "Тренування з виявлення ЛПР, 1-on-1 з Юлією, оновити блок «порадитися»."],
        ["Сильні дзвінки", "Ірина К. — зразкове відпрацювання «дорого» через розстрочку."],
        ["Червона зона", "Сергій М. — лід з бюджетом втрачено на етапі наступного кроку."]
      ]
    },
    report: {
      title: "Що клієнт отримує після аудиту",
      sub: "Не доступ у порожній кабінет, а готовий управлінський артефакт: PDF, висновки, дзвінки-докази і план дій.",
      items: ["Коротке резюме на 1 сторінку", "Дашборд втрат виручки", "Рейтинг менеджерів", "Розбір дзвінка з цитатами", "Вердикт по маркетингу і продажах", "План дій на тиждень"]
    },
    soon: {
      title: "Зараз аудит як послуга. Незабаром — особистий кабінет",
      sub: "Зараз ви передаєте записи, ми аналізуємо їх і повертаємо PDF-звіт. Паралельно готуємо самостійну версію: завантаження дзвінків, історія звітів, ролі для керівника і менеджерів, чек-листи, CRM/телефонія та регулярні тижневі звіти.",
      cta: "Потрапити в ранній доступ"
    },
    pricingTitle: "Формати роботи",
    prices: [
      ["Безкоштовний аудит", "$0", "До 5 дзвінків. Короткий PDF 3–5 сторінок: головний ризик, цитати і наступні кроки.", "Отримати безкоштовно"],
      ["Аудит команди", "$299", "До 30 дзвінків, 3–5 менеджерів, рейтинг команди і план для керівника.", "Замовити аудит"],
      ["Аудит відділу", "$799", "До 100 дзвінків, 6–15 менеджерів, маркетинг і продажі, стратегія росту.", "Замовити аудит"],
      ["Регулярний аудит", "від $500/міс", "Регулярна зовнішня перевірка, тижневий звіт і динаміка по команді.", "Обговорити формат"]
    ],
    faqTitle: "Питання і відповіді",
    faqs: [
      ["Це SaaS?", "Зараз це послуга аудиту. Особистий кабінет і самостійна версія готуються як наступний етап."],
      ["Потрібно щось підключати?", "Ні. На старті достатньо передати аудіо, транскрипти, CSV або посилання на папку."],
      ["Можна надіслати транскрипти замість аудіо?", "Так. Для першого аудиту це часто навіть швидше."],
      ["Чим відрізняється від транскрибатора?", "Транскрибатор дає текст. CallControl AI дає управлінський висновок: гроші під ризиком, причина, цитата і дія."],
      ["Що з даними?", "Записи використовуються тільки для аудиту. Якщо дані чутливі — можна надіслати знеособлені транскрипти."],
      ["Що входить у безкоштовний аудит?", "До 5 дзвінків, короткий висновок, 2–3 цитати, головний ризик і рекомендація, що перевірити далі."]
    ],
    form: {
      title: "Отримати безкоштовний аудит",
      sub: "Залиште контакт і коротко опишіть команду. Заявка піде в Telegram, ми повернемося з форматом передачі дзвінків.",
      fields: ["Ім'я", "Email", "Telegram або телефон", "Компанія", "Сайт", "Розмір відділу", "Формат аудиту", "Що хочете перевірити?", "Посилання на записи / транскрипти"],
      send: "Надіслати заявку",
      ok: "Заявку відправлено. Ми зв'яжемося з вами протягом робочого дня.",
      error: "Не вийшло відправити заявку. Спробуйте ще раз або напишіть напряму.",
      privacy: "Записи використовуються тільки для аудиту і не передаються третім особам."
    },
    footer: "CallControl AI · AI-аудит втраченої виручки у дзвінках"
    ,
    ui: {
      aiFinding: "AI-висновок",
      actual: "Факт",
      potential: "Потенціал",
      score: "Оцінка",
      forecast: "Прогноз",
      pdf: "PDF-звіт",
      start: "Старт",
      audit: "Аудит",
      risk: "Ризик",
      legacy: "Стара демка"
      ,
      soon: "Незабаром"
    }
  },
  en: {
    label: "EN",
    title: "CallControl AI — audit revenue leaks in sales calls",
    nav: ["What you get", "Leaks", "Ranking", "Report", "Pricing", "FAQ"],
    eyebrow: "AI audit of sales calls",
    h1: "Find where your sales team loses money in calls",
    sub: "In 5–10 days, we review your call sample and return a PDF report: revenue leaks, manager ranking, checklist misses, marketing vs sales verdict, and an action plan for your sales lead.",
    cta: "Get a free audit of 5 calls",
    cta2: "See sample analysis",
    trust: ["No integrations to start", "Audio or transcripts", "RU / UK / EN"],
    heroPanel: {
      title: "Preview of the future report",
      leak: "Revenue at risk",
      leakText: "47 calls with no next step",
      score: "Average score",
      scoreText: "by quality checklist",
      quote: "“Think about it and message us if anything”",
      verdict: "AI verdict: warm lead lost at closing stage. A specific next contact time should be scheduled."
    },
    proofTitle: "What you will see in the report",
    proofSub: "Not a wall of transcripts. The report shows money, risk, proof from the call, and a management action.",
    revenue: {
      title: "Where revenue leaks in the sales team",
      sub: "Not “19% conversion”, but specific loss reasons by funnel stage — in money.",
      period: "October 2025 · 312 calls · 60 sales",
      actual: "1,200,000 ₴",
      potential: "1,740,000 ₴",
      leak: "540,000 ₴",
      rows: [
        ["No next step scheduled", "47 calls", "188,000 ₴", 84],
        ["Price objection not handled", "38 calls", "152,000 ₴", 72],
        ["Decision deadline not discovered", "29 calls", "116,000 ₴", 55],
        ["Installment option not offered", "18 calls", "72,000 ₴", 34]
      ],
      takeaway: "One audit pays back if the team fixes just one repeated leakage reason."
    },
    ranking: {
      title: "Manager ranking: who closes, who leaks",
      sub: "Not based on gut feeling or only revenue, but on quality of every call.",
      heads: ["Manager", "Calls", "Conversion", "Score", "Main growth area"],
      rows: [
        ["Iryna K.", "51", "27.5%", "87", "Team benchmark"],
        ["Dmytro P.", "48", "22.9%", "79", "Deadline closing"],
        ["Anna L.", "42", "21.4%", "76", "Objections"],
        ["Serhii M.", "45", "17.8%", "64", "Next step"],
        ["Oleh V.", "39", "15.4%", "58", "Price and discounts"],
        ["Yuliia T.", "44", "13.6%", "52", "Decision maker and qualification"]
      ],
      note: "Moving the bottom of the team to average = +6–8 sales per month with the same lead flow."
    },
    call: {
      title: "Single call breakdown: what AI heard",
      sub: "Timestamps, quotes, and specific misses — what a strong sales lead would catch if they had time to listen to every call.",
      meta: "SF-2025-10-17-0042 · Serhii M. · 18 min 04 sec · result: no payment",
      misses: [
        ["04:11", "“I am on maternity leave, my husband is against such expenses...”", "Decision maker missed. A three-person call should be arranged."],
        ["09:33", "“Is this really worth 20 thousand?”", "Price named without value breakdown or installment framing."],
        ["14:50", "“I need to think and discuss it”", "No specific next contact time."]
      ],
      better: "Better: “Let's fix the next step: tomorrow at 12:00 I will send the calculation and we will have a 10-minute call.”",
      forecast: "Payment probability by Friday: 18%"
    },
    mvs: {
      title: "Marketing vs Sales: where the real leak is",
      sub: "AI helps end the “bad leads” / “bad sales” argument with call-based numbers.",
      cards: [
        ["Marketing", "35.3%", "89 leads did not match ICP: wrong field, no budget, wrong country or wrong pain."],
        ["Sales", "55.6%", "140 qualified leads were lost due to a missed stage, objection, or next step."],
        ["Offer / external", "9.1%", "23 losses were linked to personal circumstances or weak offer fit."]
      ],
      verdict: "The “who is guilty” meeting becomes a “what do we fix first” meeting."
    },
    checklist: {
      title: "Quality checklist: what managers actually do",
      sub: "Everyone has a script. The question is what percentage is actually followed.",
      heads: ["Stage", "Criterion", "Done"],
      rows: [
        ["Opening", "Introduced themselves and set timing", "96%"],
        ["Discovery", "Discovered pain / learning goal", "74%"],
        ["Discovery", "Identified decision maker", "41%"],
        ["Discovery", "Identified decision deadline", "38%"],
        ["Closing", "Handled at least one objection", "52%"],
        ["Closing", "Scheduled a specific next step", "45%"]
      ],
      note: "You do not need to fix all 12 points. Start with the 4 broken stages."
    },
    weekly: {
      title: "Weekly Report for the sales lead",
      sub: "One Monday document: what changed, whom to coach, which calls to replay, and which script to fix.",
      items: [
        ["Main weekly insight", "Conversion grew to 20.5%, but 3 large leads were lost due to missed decision maker."],
        ["What to fix", "Decision-maker training, 1-on-1 with Yuliia, update the “need to discuss” block."],
        ["Strong calls", "Iryna K. — excellent price objection handling through installment framing."],
        ["Red zone", "Serhii M. — lead with budget lost at next-step stage."]
      ]
    },
    report: {
      title: "What the client gets after the audit",
      sub: "Not access to an empty dashboard, but a ready management artifact: PDF, findings, proof calls, and an action plan.",
      items: ["One-page executive summary", "Revenue Leak Dashboard", "Manager ranking", "Call Detail with quotes", "Marketing vs Sales verdict", "Weekly action plan"]
    },
    soon: {
      title: "Now audit as a service. Soon — self-service workspace",
      sub: "Today you send recordings, we analyze them and return a PDF report. In parallel, we are preparing the self-service version: call upload, report history, roles for sales leads and managers, checklists, CRM/telephony, and regular weekly reports.",
      cta: "Join early access"
    },
    pricingTitle: "Ways to work",
    prices: [
      ["Free audit", "$0", "Up to 5 calls. Short 3–5 page PDF: main risk, quotes and next steps.", "Get it free"],
      ["Team audit", "$299", "Up to 30 calls, 3–5 managers, team ranking and action plan.", "Order audit"],
      ["Department audit", "$799", "Up to 100 calls, 6–15 managers, marketing vs sales and growth strategy.", "Order audit"],
      ["Ongoing audit", "from $500/mo", "Regular external review, weekly report and team dynamics.", "Discuss format"]
    ],
    faqTitle: "FAQ",
    faqs: [
      ["Is this SaaS?", "Right now it is an audit service. The self-service workspace is planned as the next step."],
      ["Do we need to connect anything?", "No. To start, you can send audio, transcripts, CSV, or a folder link."],
      ["Can we send transcripts instead of audio?", "Yes. For the first audit, this is often faster."],
      ["How is this different from a transcript tool?", "A transcript tool gives text. CallControl AI gives a management verdict: revenue at risk, reason, quote, and action."],
      ["What about data?", "Recordings are used only for the audit. If data is sensitive, you can send anonymized transcripts."],
      ["What is inside the free audit?", "Up to 5 calls, a short finding, 2–3 quotes, the main risk, and a recommendation on what to check next."]
    ],
    form: {
      title: "Get a free audit",
      sub: "Leave your contact and briefly describe the team. The request goes to Telegram, and we return with the call transfer format.",
      fields: ["Name", "Email", "Telegram or phone", "Company", "Website", "Team size", "Audit format", "What do you want to check?", "Link to recordings / transcripts"],
      send: "Send request",
      ok: "Request sent. We will get back to you within one business day.",
      error: "Could not send the request. Try again or message us directly.",
      privacy: "Recordings are used only for the audit and are not shared with third parties."
    },
    footer: "CallControl AI · AI audit of revenue leaks in sales calls"
    ,
    ui: {
      aiFinding: "AI finding",
      actual: "Actual",
      potential: "Potential",
      score: "Score",
      forecast: "Forecast",
      pdf: "PDF report",
      start: "Start",
      audit: "Audit",
      risk: "Risk",
      legacy: "Legacy demo"
      ,
      soon: "Soon"
    }
  }
};

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function proofCards(lang) {
  return commonProof[lang].map(([metric, title, text]) => `
    <article class="mini-card">
      <div class="proof-icon">${esc(metric)}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
    </article>
  `).join("");
}

function leakageRows(rows, l) {
  return rows.map(([name, count, money, width]) => `
    <div class="leak-row">
      <div><strong>${esc(name)}</strong><p class="micro">${esc(count)} · ${esc(money)}</p><div class="bar"><i style="width:${Number(width)}%"></i></div></div>
      <span class="badge risk">${esc(l.ui.risk)}</span>
    </div>
  `).join("");
}

function table(heads, rows) {
  return `<div class="table-wrap"><table><thead><tr>${heads.map((head) => `<th>${esc(head)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function listCards(items) {
  return items.map(([title, text]) => `<article class="mini-card"><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join("");
}

function priceCards(l) {
  return l.prices.map(([title, amount, text, cta], index) => `
    <article class="price ${index === 1 ? "featured" : ""}">
      <span class="badge ${index === 0 ? "profit" : ""}">${esc(index === 0 ? l.ui.start : l.ui.audit)}</span>
      <h3>${esc(title)}</h3>
      <div class="amount">${esc(amount)}</div>
      <p>${esc(text)}</p>
      <a class="btn ${index === 0 ? "green" : ""}" href="#lead">${esc(cta)}</a>
    </article>
  `).join("");
}

function faq(l) {
  return l.faqs.map(([q, a], index) => `<details ${index === 0 ? "open" : ""}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");
}

function langLinks(lang) {
  return Object.keys(locales).map((key) => `<a class="${key === lang ? "active" : ""}" href="/${key}/">${locales[key].label}</a>`).join("");
}

function navLinks(l) {
  const ids = ["proof", "revenue", "ranking", "report", "pricing", "faq"];
  return l.nav.map((label, index) => `<a href="#${ids[index]}">${esc(label)}</a>`).join("");
}

function render(lang) {
  const l = locales[lang];
  const auditOptions = l.prices.map(([title]) => `<option value="${esc(title)}">${esc(title)}</option>`).join("");
  return `<!doctype html>
<html lang="${esc(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(l.title)}</title>
  <meta name="description" content="${esc(l.sub)}">
  <style>${css}</style>
</head>
<body>
  <header class="topbar">
    <nav class="nav">
      <div class="brand">CallControl AI</div>
      <div class="navlinks">${navLinks(l)}</div>
      <div class="langs">${langLinks(lang)}</div>
      <a class="btn" href="#lead">${esc(l.cta)}</a>
    </nav>
  </header>

  <main>
    <section class="wrap hero">
      <div>
        <div class="eyebrow"><span class="dot"></span>${esc(l.eyebrow)}</div>
        <h1>${esc(l.h1)}</h1>
        <p class="lead">${esc(l.sub)}</p>
        <div class="actions">
          <a class="btn green" href="#lead">${esc(l.cta)}</a>
          <a class="btn secondary" href="#call">${esc(l.cta2)}</a>
        </div>
        <p class="micro" style="margin-top:18px">${l.trust.map(esc).join(" · ")}</p>
      </div>
      <aside class="hero-demo">
        <div class="screen-top"><div class="traffic"><span></span><span></span><span></span></div><span class="badge risk">${esc(l.ui.aiFinding)}</span></div>
        <h3>${esc(l.heroPanel.title)}</h3>
        <div class="kpi">
          <div><p class="micro">${esc(l.heroPanel.leak)}</p><strong class="risk">188k ₴</strong><p class="micro">${esc(l.heroPanel.leakText)}</p></div>
          <div><p class="micro">${esc(l.heroPanel.score)}</p><strong>66/100</strong><p class="micro">${esc(l.heroPanel.scoreText)}</p></div>
        </div>
        <p class="quote">${esc(l.heroPanel.quote)}</p>
        <p>${esc(l.heroPanel.verdict)}</p>
      </aside>
    </section>

    <section id="proof" class="wrap">
      <div class="section-head wide">
        <h2>${esc(l.proofTitle)}</h2>
        <p>${esc(l.proofSub)}</p>
      </div>
      <div class="grid three">${proofCards(lang)}</div>
    </section>

    <section id="revenue" class="wrap">
      <div class="grid two">
        <div class="demo">
          <span class="badge risk">${esc(l.revenue.period)}</span>
          <h2>${esc(l.revenue.title)}</h2>
          <p>${esc(l.revenue.sub)}</p>
          <div class="kpi">
            <div><p class="micro">${esc(l.ui.actual)}</p><strong>${esc(l.revenue.actual)}</strong></div>
            <div><p class="micro">${esc(l.ui.potential)}</p><strong class="profit">${esc(l.revenue.potential)}</strong></div>
          </div>
          <div class="amount risk">${esc(l.revenue.leak)}</div>
          <p>${esc(l.revenue.takeaway)}</p>
        </div>
        <div class="card">${leakageRows(l.revenue.rows, l)}</div>
      </div>
    </section>

    <section id="ranking" class="wrap">
      <div class="section-head">
        <h2>${esc(l.ranking.title)}</h2>
        <p>${esc(l.ranking.sub)}</p>
      </div>
      ${table(l.ranking.heads, l.ranking.rows)}
      <p class="micro" style="margin-top:14px">${esc(l.ranking.note)}</p>
    </section>

    <section id="call" class="wrap">
      <div class="grid two">
        <div class="demo">
          <span class="badge warn">${esc(l.call.meta)}</span>
          <h2>${esc(l.call.title)}</h2>
          <p>${esc(l.call.sub)}</p>
          <div class="kpi">
            <div><p class="micro">${esc(l.ui.score)}</p><strong>64/100</strong></div>
            <div><p class="micro">${esc(l.ui.forecast)}</p><strong class="risk">18%</strong></div>
          </div>
          <p class="quote">${esc(l.call.better)}</p>
          <p><strong>${esc(l.call.forecast)}</strong></p>
        </div>
        <div class="grid">
          ${l.call.misses.map(([time, quote, action]) => `<article class="card"><span class="badge risk">${esc(time)}</span><h3>${esc(quote)}</h3><p>${esc(action)}</p></article>`).join("")}
        </div>
      </div>
    </section>

    <section id="mvs" class="wrap">
      <div class="section-head">
        <h2>${esc(l.mvs.title)}</h2>
        <p>${esc(l.mvs.sub)}</p>
      </div>
      <div class="grid three">
        ${l.mvs.cards.map(([title, amount, text], index) => `<article class="card"><span class="badge ${index === 1 ? "risk" : index === 0 ? "warn" : ""}">${esc(title)}</span><div class="amount">${esc(amount)}</div><p>${esc(text)}</p></article>`).join("")}
      </div>
      <p class="micro" style="margin-top:14px">${esc(l.mvs.verdict)}</p>
    </section>

    <section id="checklist" class="wrap">
      <div class="section-head">
        <h2>${esc(l.checklist.title)}</h2>
        <p>${esc(l.checklist.sub)}</p>
      </div>
      ${table(l.checklist.heads, l.checklist.rows)}
      <p class="micro" style="margin-top:14px">${esc(l.checklist.note)}</p>
    </section>

    <section id="report" class="wrap">
      <div class="grid two">
        <div>
          <div class="section-head">
            <h2>${esc(l.weekly.title)}</h2>
            <p>${esc(l.weekly.sub)}</p>
          </div>
          <div class="grid two">${listCards(l.weekly.items)}</div>
        </div>
        <aside class="report">
          <span class="badge profit">${esc(l.ui.pdf)}</span>
          <h2>${esc(l.report.title)}</h2>
          <p>${esc(l.report.sub)}</p>
          <div class="grid two">${l.report.items.map((item) => `<div class="mini-card mono">${esc(item)}</div>`).join("")}</div>
        </aside>
      </div>
    </section>

    <section class="wrap">
      <div class="soon">
        <span class="badge">${esc(l.ui.soon)}</span>
        <h2>${esc(l.soon.title)}</h2>
        <p>${esc(l.soon.sub)}</p>
        <a class="btn" href="#lead">${esc(l.soon.cta)}</a>
      </div>
    </section>

    <section id="pricing" class="wrap">
      <div class="section-head">
        <h2>${esc(l.pricingTitle)}</h2>
      </div>
      <div class="grid four">${priceCards(l)}</div>
    </section>

    <section id="faq" class="wrap faq">
      <div class="section-head">
        <h2>${esc(l.faqTitle)}</h2>
      </div>
      <div class="grid two">${faq(l)}</div>
    </section>

    <section id="lead" class="wrap">
      <div class="grid two">
        <div class="section-head">
          <h2>${esc(l.form.title)}</h2>
          <p>${esc(l.form.sub)}</p>
          <p class="micro">${esc(l.form.privacy)}</p>
        </div>
        <div class="formbox">
          <form id="leadForm">
            <label>${esc(l.form.fields[0])}<input name="name" required autocomplete="name"></label>
            <label>${esc(l.form.fields[1])}<input name="email" type="email" required autocomplete="email"></label>
            <label>${esc(l.form.fields[2])}<input name="contact" required></label>
            <label>${esc(l.form.fields[3])}<input name="company" autocomplete="organization"></label>
            <label>${esc(l.form.fields[4])}<input name="website" type="url" placeholder="https://"></label>
            <label>${esc(l.form.fields[5])}<select name="teamSize"><option>1-2</option><option>3-5</option><option>6-15</option><option>15+</option></select></label>
            <label>${esc(l.form.fields[6])}<select name="tier">${auditOptions}</select></label>
            <label>${esc(l.form.fields[7])}<textarea name="pain"></textarea></label>
            <label>${esc(l.form.fields[8])}<textarea name="data"></textarea></label>
            <input type="hidden" name="dataFormat" value="audio/transcripts/folder">
            <input type="hidden" name="source" value="static-${esc(lang)}-landing">
            <input type="hidden" name="language" value="${esc(lang)}">
            <button class="btn green" type="submit">${esc(l.form.send)}</button>
            <div id="leadSuccess" class="success">${esc(l.form.ok)}</div>
            <div id="leadError" class="error">${esc(l.form.error)}</div>
          </form>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="footer-inner">
      <strong>CallControl AI</strong>
      <span>${esc(l.footer)}</span>
      <a href="/legacy-demo.html">${esc(l.ui.legacy)}</a>
    </div>
  </footer>

  <script>
    const form = document.getElementById("leadForm");
    const success = document.getElementById("leadSuccess");
    const error = document.getElementById("leadError");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      success.style.display = "none";
      error.style.display = "none";
      const payload = Object.fromEntries(new FormData(form).entries());
      try {
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("lead failed");
        form.reset();
        success.style.display = "block";
      } catch (err) {
        error.style.display = "block";
      }
    });
  </script>
</body>
</html>`;
}

function generate() {
  for (const lang of Object.keys(locales)) {
    const dir = path.join(outDir, lang);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), render(lang));
  }
  fs.writeFileSync(
    path.join(outDir, "index.html"),
    '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/ru/"><script>location.replace("/ru/")</script></head><body><a href="/ru/">RU</a></body></html>'
  );
}

module.exports = generate;

if (require.main === module) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  generate();
  console.log("Static landing generated");
}
