const fs = require("fs");
const path = require("path");

const root = __dirname;
const outDir = path.join(root, "variant-previews");

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => {
  fs.writeFileSync(path.join(outDir, file), content);
};

const oldHtml = read("index.html");
const newHtml = read("dist/ru/index.html");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const basePreviewCss = `
  .variant-badge {
    position: fixed;
    z-index: 99999;
    right: 18px;
    bottom: 18px;
    max-width: min(360px, calc(100vw - 36px));
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(15, 23, 42, .9);
    color: #fff;
    font: 600 12px/1.35 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    box-shadow: 0 12px 30px rgba(15, 23, 42, .2);
  }
  .variant-badge small {
    display: block;
    margin-top: 3px;
    color: rgba(255,255,255,.68);
    font-weight: 400;
  }
  .variant-lab-panel {
    margin: 0 0 22px;
    padding: clamp(22px, 4vw, 42px);
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, .26);
    background: linear-gradient(135deg, #0f172a 0%, #111827 52%, #172554 100%);
    color: #f8fafc;
    overflow: hidden;
    position: relative;
  }
  .variant-lab-panel:before {
    content: "";
    position: absolute;
    inset: -35% -20% auto auto;
    width: 420px;
    height: 420px;
    background: radial-gradient(circle, rgba(79, 70, 229, .28), transparent 62%);
    pointer-events: none;
  }
  .variant-lab-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(300px, .95fr);
    gap: clamp(18px, 3vw, 34px);
    align-items: center;
    position: relative;
  }
  .variant-kicker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 999px;
    background: rgba(255,255,255,.09);
    color: #c7d2fe;
    font: 600 12px/1.2 "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: .02em;
    text-transform: uppercase;
  }
  .variant-lab-panel h1 {
    margin: 18px 0 12px;
    max-width: 800px;
    color: #fff;
    font-size: clamp(38px, 6vw, 78px);
    line-height: .96;
    letter-spacing: -.055em;
  }
  .variant-lab-panel p {
    max-width: 690px;
    color: rgba(248, 250, 252, .75);
    font-size: clamp(16px, 1.8vw, 20px);
    line-height: 1.55;
  }
  .variant-lab-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 22px;
  }
  .variant-lab-actions a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 16px;
    border-radius: 10px;
    color: #fff;
    text-decoration: none;
    border: 1px solid rgba(255,255,255,.16);
    background: rgba(255,255,255,.08);
  }
  .variant-lab-actions a:first-child {
    color: #0f172a;
    background: #fff;
  }
  .variant-proof-card {
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,.14);
    background: rgba(255,255,255,.08);
    backdrop-filter: blur(16px);
    padding: 18px;
    box-shadow: 0 24px 80px rgba(0,0,0,.25);
  }
  .variant-proof-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    padding: 13px 0;
    border-bottom: 1px solid rgba(255,255,255,.12);
  }
  .variant-proof-row:last-child { border-bottom: 0; }
  .variant-proof-row b { color: #fff; }
  .variant-proof-row span {
    color: rgba(248,250,252,.62);
    font-size: 13px;
  }
  .variant-proof-row strong {
    color: #86efac;
    font: 600 14px/1 "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .variant-proof-row strong.risk { color: #fca5a5; }
  .variant-proof-modules {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin: 18px 0 28px;
  }
  .variant-proof-module {
    padding: 16px;
    border: 1px solid rgba(148, 163, 184, .22);
    border-radius: 12px;
    background: rgba(255,255,255,.82);
    color: #0f172a;
  }
  .variant-proof-module small {
    display: block;
    margin-bottom: 10px;
    color: #64748b;
    font: 600 11px/1.2 "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    text-transform: uppercase;
  }
  .variant-proof-module b {
    display: block;
    margin-bottom: 8px;
    font-size: 16px;
  }
  .variant-proof-module p {
    margin: 0;
    color: #475569;
    font-size: 13px;
    line-height: 1.45;
  }
  @media (max-width: 900px) {
    .variant-lab-grid,
    .variant-proof-modules { grid-template-columns: 1fr; }
  }
`;

const strictCss = `
  @import url("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap");
  :root {
    --variant-bg: #f8fafc;
    --variant-panel: #ffffff;
    --variant-text: #0f172a;
    --variant-muted: #64748b;
    --variant-border: #e2e8f0;
    --variant-primary: #4f46e5;
    --variant-profit: #00684a;
    --variant-risk: #dc2626;
  }
  html, body {
    background: var(--variant-bg) !important;
    color: var(--variant-text) !important;
    font-family: "Geist", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  }
  h1, h2, h3, h4, .title, .brand, .screen-title {
    font-family: "Geist", Inter, system-ui, sans-serif !important;
    letter-spacing: -.035em !important;
    font-weight: 600 !important;
  }
  p, li, label, input, textarea, select, button, a {
    font-family: "Geist", Inter, system-ui, sans-serif !important;
  }
  .metric strong, .score, .number, .stat-value, .mono, code, pre,
  .hero-demo strong, .variant-proof-row strong {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace !important;
  }
  .app, .main, main, .content, .wrap {
    background: var(--variant-bg) !important;
  }
  .sidebar {
    background: #0f172a !important;
    border-right: 1px solid #1e293b !important;
  }
  .sidebar *, .sidebar a, .sidebar button {
    color: rgba(248,250,252,.82) !important;
  }
  .card, .feature-card, .metric, .panel, .hero-panel, .hero-demo,
  .price-card, .tier-card, .form-card, .faq details, .report-card,
  .stat, .module, .glass, .demo-card, .call-card, .mini-card,
  section .grid > *, .proof-card {
    border-radius: 10px !important;
    border: 1px solid var(--variant-border) !important;
    box-shadow: 0 0 0 1px rgba(15, 23, 42, .025), 0 2px 4px rgba(15, 23, 42, .06) !important;
  }
  .primary, .btn-primary, button[type="submit"], .cta-primary, .button-primary {
    background: var(--variant-primary) !important;
    color: #fff !important;
    border-color: var(--variant-primary) !important;
  }
  .badge, .pill, .tag {
    border-radius: 999px !important;
  }
  .risk, .danger, [class*="risk"] {
    color: var(--variant-risk);
  }
  .profit, .success, [class*="profit"] {
    color: var(--variant-profit);
  }
`;

const glassCss = `
  @import url("https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap");
  html, body {
    min-height: 100%;
    color: #f8fafc !important;
    background:
      radial-gradient(circle at 18% 8%, rgba(79, 70, 229, .32), transparent 32%),
      radial-gradient(circle at 82% 18%, rgba(14, 165, 233, .22), transparent 28%),
      linear-gradient(135deg, #020617 0%, #0f172a 55%, #111827 100%) !important;
    font-family: "Geist", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
  }
  h1, h2, h3, h4, .title, .brand, .screen-title {
    color: #fff !important;
    letter-spacing: -.04em !important;
    font-family: "Geist", Inter, system-ui, sans-serif !important;
  }
  p, li, label, .muted, .subtle {
    color: rgba(226, 232, 240, .74) !important;
  }
  .app, .main, main, .content, .wrap {
    background: transparent !important;
  }
  .sidebar, nav {
    background: rgba(2, 6, 23, .72) !important;
    border-color: rgba(255,255,255,.1) !important;
    backdrop-filter: blur(16px);
  }
  .card, .feature-card, .metric, .panel, .hero-panel, .hero-demo,
  .price-card, .tier-card, .form-card, .faq details, .report-card,
  .stat, .module, .glass, .demo-card, .call-card, .mini-card,
  section .grid > *, .proof-card, input, textarea, select {
    background: rgba(255,255,255,.08) !important;
    border: 1px solid rgba(255,255,255,.14) !important;
    color: #f8fafc !important;
    border-radius: 14px !important;
    box-shadow: 0 20px 70px rgba(0,0,0,.24) !important;
    backdrop-filter: blur(16px);
  }
  input::placeholder, textarea::placeholder {
    color: rgba(226,232,240,.52) !important;
  }
  .primary, .btn-primary, button[type="submit"], .cta-primary, .button-primary {
    background: #38bdf8 !important;
    color: #020617 !important;
    border-color: #38bdf8 !important;
  }
  .metric strong, .score, .number, .stat-value, .mono, code, pre {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace !important;
  }
`;

const hybridPanel = `
  <section class="variant-lab-panel">
    <div class="variant-lab-grid">
      <div>
        <span class="variant-kicker">Revenue Intelligence Lab</span>
        <h1>Покажем, где отдел продаж теряет деньги после лида</h1>
        <p>Это гибридный вариант: оставляем ощущение полноценной платформы, но продаём понятный первый продукт — AI-аудит звонков, PDF-отчёт и план действий для РОПа.</p>
        <div class="variant-lab-actions">
          <a href="#lead">Получить бесплатный аудит 5 звонков</a>
          <a href="#screen-report">Посмотреть пример отчёта</a>
        </div>
      </div>
      <div class="variant-proof-card">
        <div class="variant-proof-row"><div><b>Value at Risk</b><span>упущенная выручка в тёплых лидах</span></div><strong class="risk">$8,400</strong></div>
        <div class="variant-proof-row"><div><b>Marketing verdict</b><span>спор продаж и маркетинга</span></div><strong>62%</strong></div>
        <div class="variant-proof-row"><div><b>Next step errors</b><span>звонки без конкретной договорённости</span></div><strong class="risk">14</strong></div>
        <div class="variant-proof-row"><div><b>Manager coaching</b><span>кого и чему тренировать</span></div><strong>3 темы</strong></div>
      </div>
    </div>
  </section>
  <div class="variant-proof-modules">
    <div class="variant-proof-module"><small>01</small><b>Revenue Leak</b><p>Где ломается воронка: маркетинг, оффер, скрипт, следующий шаг.</p></div>
    <div class="variant-proof-module"><small>02</small><b>Разбор звонка</b><p>Цитата, риск, причина и формулировка, как сказать лучше.</p></div>
    <div class="variant-proof-module"><small>03</small><b>Marketing vs Sales</b><p>Отдельный verdict: лид слабый или продажа плохо обработала.</p></div>
    <div class="variant-proof-module"><small>04</small><b>Soon-платформа</b><p>Личный кабинет, роли, чек-листы, интеграции и weekly reports без дат.</p></div>
  </div>
`;

const newHybridBand = `
  <section class="wrap variant-lab-panel">
    <div class="variant-lab-grid">
      <div>
        <span class="variant-kicker">Hybrid Product Proof</span>
        <h1>Не просто лендинг услуги, а витрина будущей платформы</h1>
        <p>На этой версии белый service landing усиливается “мясом” старой демки: revenue leak, менеджеры, маркетинг против продаж, чек-листы и soon-блок SaaS.</p>
        <div class="variant-lab-actions">
          <a href="#lead">Оставить заявку</a>
          <a href="#report">Посмотреть отчёт</a>
        </div>
      </div>
      <div class="variant-proof-card">
        <div class="variant-proof-row"><div><b>PDF-аудит</b><span>короткий вход в продукт</span></div><strong>5 дней</strong></div>
        <div class="variant-proof-row"><div><b>Дашборд</b><span>доказательство платформы</span></div><strong>soon</strong></div>
        <div class="variant-proof-row"><div><b>Lead quality</b><span>для маркетинга и продаж</span></div><strong>verdict</strong></div>
      </div>
    </div>
  </section>
`;

const soonPage = `
  <!doctype html>
  <html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CallControl AI — Soon platform</title>
    <style>${basePreviewCss}${strictCss}
      body { margin: 0; }
      .soon-wrap { max-width: 1180px; margin: 0 auto; padding: 42px 22px 70px; }
      .soon-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 18px; }
      .soon-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; }
      .soon-card small { color: #64748b; font-family: "JetBrains Mono", monospace; }
      .soon-card h3 { margin: 12px 0 8px; }
      .soon-card p { color: #475569; line-height: 1.55; }
      @media (max-width: 900px) { .soon-grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main class="soon-wrap">
      ${hybridPanel}
      <h2>Отдельная страница “Soon”, без дат и процентов</h2>
      <p style="max-width:760px;color:#475569;line-height:1.6">Эта версия показывает, как можно вынести будущие SaaS-возможности на отдельную страницу: не обещать сроки, но показать направление продукта и собрать ранний интерес.</p>
      <div class="soon-grid">
        <div class="soon-card"><small>ACCESS</small><h3>Google OAuth и роли</h3><p>Owner, РОП, менеджер и наблюдатель. Нужно для контроля бесплатных разборов и будущих кабинетов.</p></div>
        <div class="soon-card"><small>INTEGRATIONS</small><h3>Binotel / Ringostat / Zadarma</h3><p>Звонки смогут попадать в аудит автоматически после завершения разговора.</p></div>
        <div class="soon-card"><small>WORKFLOW</small><h3>Очередь обработки</h3><p>Файлы не висят на странице: система показывает прогресс и возвращает отчёт после анализа.</p></div>
        <div class="soon-card"><small>CRM</small><h3>CRM summary export</h3><p>AI-саммари и next step можно будет отправлять в CRM как заметку.</p></div>
        <div class="soon-card"><small>QUALITY</small><h3>Scorecard builder</h3><p>Чек-листы под нишу, отдел, продукт и стиль продаж.</p></div>
        <div class="soon-card"><small>REPORTS</small><h3>Weekly reports</h3><p>Регулярный отчёт РОПу: риски, менеджеры, темы планёрки и действия на неделю.</p></div>
      </div>
    </main>
  </body>
  </html>
`;

function badge(title, note = "локальный вариант для сравнения, не продакшен") {
  return `<div class="variant-badge">${title}<small>${note}</small></div>`;
}

function withInjectedStyle(html, title, css, options = {}) {
  let next = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  next = next.replace(/<\/head>/i, `<style>${basePreviewCss}${css}</style></head>`);
  next = next.replace(/<body[^>]*>/i, (match) => `${match}${badge(title, options.note || undefined)}`);
  return next;
}

function injectOldHybrid(html, title, css) {
  return withInjectedStyle(
    html.replace(
      '<div class="screen active" id="screen-dashboard">',
      `<div class="screen active" id="screen-dashboard">${hybridPanel}`,
    ),
    title,
    css,
    { note: "гибрид: старое мясо + новый оффер + product proof" },
  );
}

function injectNewHybrid(html, title, css) {
  return withInjectedStyle(
    html.replace(/<\/section>/i, `</section>${newHybridBand}`),
    title,
    css,
    { note: "гибрид: новый лендинг + продуктовые блоки" },
  );
}

const variants = [
  {
    file: "01-old-original.html",
    title: "01 Старый богатый demo-room",
    html: oldHtml,
    note: "Исходная старая платформа без правок",
  },
  {
    file: "02-new-white.html",
    title: "02 Новый белый service landing",
    html: newHtml,
    note: "Текущая новая RU-страница без оверлея",
  },
  {
    file: "03-old-strict.html",
    title: "03 Старый demo-room + Strict B2B",
    html: withInjectedStyle(oldHtml, "03 Старый demo-room + Strict B2B", strictCss),
  },
  {
    file: "04-new-strict.html",
    title: "04 Новый landing + Strict B2B",
    html: withInjectedStyle(newHtml, "04 Новый landing + Strict B2B", strictCss),
  },
  {
    file: "05-old-glass.html",
    title: "05 Старый demo-room + Glass Prism",
    html: withInjectedStyle(oldHtml, "05 Старый demo-room + Glass Prism", glassCss),
  },
  {
    file: "06-new-glass.html",
    title: "06 Новый landing + Glass Prism",
    html: withInjectedStyle(newHtml, "06 Новый landing + Glass Prism", glassCss),
  },
  {
    file: "07-hybrid-old-strict.html",
    title: "07 Гибрид на старой платформе",
    html: injectOldHybrid(oldHtml, "07 Гибрид на старой платформе", strictCss),
  },
  {
    file: "08-hybrid-new-product.html",
    title: "08 Гибрид на новом лендинге",
    html: injectNewHybrid(newHtml, "08 Гибрид на новом лендинге", strictCss),
  },
  {
    file: "09-soon-platform-page.html",
    title: "09 Отдельная Soon-страница",
    html: soonPage,
  },
];

for (const variant of variants) {
  const html =
    variant.file === "01-old-original.html" || variant.file === "02-new-white.html"
      ? withInjectedStyle(variant.html, variant.title, "", { note: variant.note })
      : variant.html;
  write(variant.file, html);
}

const index = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CallControl AI — Variant previews</title>
  <style>
    ${basePreviewCss}
    ${strictCss}
    body { margin: 0; }
    .menu {
      max-width: 1120px;
      margin: 0 auto;
      padding: 48px 22px 70px;
    }
    .menu h1 {
      margin: 0 0 10px;
      font-size: clamp(34px, 5vw, 64px);
      line-height: 1;
    }
    .menu > p {
      margin: 0 0 28px;
      color: #475569;
      max-width: 760px;
      line-height: 1.6;
    }
    .variant-list {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .variant-link {
      display: block;
      min-height: 132px;
      padding: 18px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #fff;
      color: #0f172a;
      text-decoration: none;
      box-shadow: 0 0 0 1px rgba(15,23,42,.02), 0 2px 4px rgba(15,23,42,.05);
    }
    .variant-link small {
      display: block;
      margin-bottom: 18px;
      color: #64748b;
      font-family: "JetBrains Mono", ui-monospace, monospace;
    }
    .variant-link b {
      display: block;
      margin-bottom: 8px;
      letter-spacing: -.02em;
    }
    .variant-link span {
      color: #64748b;
      font-size: 14px;
      line-height: 1.45;
    }
    @media (max-width: 900px) { .variant-list { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main class="menu">
    <h1>CallControl AI: локальные варианты</h1>
    <p>Это черновая витрина для сравнения направлений. Тут не выбираем “идеальную финалку”, а быстро смотрим глазами, куда двигаться: старое мясо, новый service landing, строгий B2B, glass/prism и гибриды.</p>
    <div class="variant-list">
      ${variants
        .map(
          (variant, index) => `<a class="variant-link" href="./${variant.file}">
            <small>${String(index + 1).padStart(2, "0")}</small>
            <b>${variant.title.replace(/^\d+\s*/, "")}</b>
            <span>${variant.note || "Визуальный прототип для сравнения."}</span>
          </a>`,
        )
        .join("\n")}
    </div>
  </main>
</body>
</html>`;

write("index.html", index);

console.log(`Generated ${variants.length} previews in ${outDir}`);
