// The one-page offer PDF — the thing that gets attached to a cold email or
// dropped in a chat after an intro call.
//
// Until now this existed only as markdown in a Downloads folder, which meant
// every send was a manual copy-paste into some editor. The copy lives here
// instead, so it is version-controlled, reviewable in a diff, and rebuilt by
// `npm run build` alongside everything else.
//
// One page is a hard constraint, not a preference: a second page turns a
// scannable offer into a document nobody reads. renderOnePagerPdf() asserts it.

const fs = require("fs");
const path = require("path");
const { FONTS, COLORS, renderToBuffer, contentWidth } = require("./lib/pdf-theme.cjs");

// Copy per locale. `blocks` are lead-in + body pairs: the lead-in is what the
// eye lands on when skimming, so it carries the meaning ("Что вы получаете"),
// never a filler label ("Описание").
const ONE_PAGERS = {
  uk: {
    brand: "CallControl AI",
    title: "Де ваша онлайн-школа втрачає виручку в дзвінках продажів",
    lead:
      "За 5 робочих днів покажемо це в грошах — з реальними цитатами з ваших дзвінків, " +
      "сумою під ризиком (Value at Risk) і планом фіксів. Під ключ, без впровадження софту.",
    blocks: [
      [
        "Для кого",
        "Онлайн-школи з відділом продажів — IT, professional, English, НМТ/дистанційні — де є дзвінок або консультація перед оплатою."
      ],
      [
        "Проблема, яку вирішуємо",
        "Ви платите за трафік, ліди приходять, а конверсія в оплату нижча, ніж могла б. Незрозуміло головне: це ліди погані (маркетинг) чи менеджери зливають угоди (продажі). Відповідь — у ваших дзвінках, але РОП фізично встигає послухати лише кілька на тиждень."
      ],
      [
        "Що ми робимо",
        "Аналізуємо 20–50 ваших дзвінків по етапах воронки, знаходимо повторювані помилки, розділяємо втрати на «маркетинг» і «продажі» та рахуємо суму під ризиком консервативно і прозоро — з відкритою формулою, а не «AI так вирішив»."
      ],
      [
        "Що ви отримуєте",
        "Звіт із Value at Risk у грошах і топ-5 точок втрати; цитати з реальних дзвінків як докази (знеособлені); розбивку по кожному менеджеру — кого і по чому коучити; 2–3 еталонні Gold Calls для навчання команди; план фіксів на 30 днів і чітку відповідь, що чинити першим."
      ],
      [
        "Формат і терміни",
        "Повний Team Audit — 5 робочих днів, $1500. Глибший Department Audit (кілька команд, кастомний скоркард) — від $3000."
      ],
      [
        "Без зайвого ризику для вас",
        "Працюємо за NDA, цитати у звіті знеособлені, записи видаляються після здачі. За потреби починаємо знайомство з розбору 2–3 ваших дзвінків."
      ]
    ],
    ctaLabel: "Наступний крок",
    cta: "Забронюйте 15 хв intro — або запросіть приклад звіту, щоб побачити, як виглядає результат.",
    footer: "CallControl AI · аудит дзвінків відділу продажів"
  },

  ru: {
    brand: "CallControl AI",
    title: "Где ваша онлайн-школа теряет выручку в звонках продаж",
    lead:
      "За 5 рабочих дней покажем это в деньгах — с реальными цитатами из ваших звонков, " +
      "суммой под риском (Value at Risk) и планом фиксов. Под ключ, без внедрения софта.",
    blocks: [
      [
        "Для кого",
        "Онлайн-школы с отделом продаж — IT, professional, English, НМТ/дистанционные — где есть звонок или консультация перед оплатой."
      ],
      [
        "Проблема, которую решаем",
        "Вы платите за трафик, лиды приходят, а конверсия в оплату ниже возможной. Непонятно главное: это лиды плохие (маркетинг) или менеджеры сливают сделки (продажи). Ответ — в ваших звонках, но РОП успевает послушать лишь несколько в неделю."
      ],
      [
        "Что мы делаем",
        "Анализируем 20–50 ваших звонков по этапам воронки, находим повторяющиеся ошибки, разделяем потери на «маркетинг» и «продажи» и считаем сумму под риском консервативно и прозрачно — с открытой формулой, а не «AI так решил»."
      ],
      [
        "Что вы получаете",
        "Отчёт с Value at Risk в деньгах и топ-5 точек потери; цитаты из реальных звонков как доказательства (обезличенные); разбивку по каждому менеджеру — кого и по чему коучить; 2–3 эталонных Gold Calls для обучения команды; план фиксов на 30 дней и чёткий ответ, что чинить первым."
      ],
      [
        "Формат и сроки",
        "Полный Team Audit — 5 рабочих дней, $1500. Более глубокий Department Audit (несколько команд, кастомный скоркард) — от $3000."
      ],
      [
        "Без лишнего риска для вас",
        "Работаем по NDA, цитаты в отчёте обезличены, записи удаляются после сдачи. При необходимости начинаем знакомство с разбора 2–3 ваших звонков."
      ]
    ],
    ctaLabel: "Следующий шаг",
    cta: "Забронируйте 15 мин intro — или запросите пример отчёта, чтобы увидеть, как выглядит результат.",
    footer: "CallControl AI · аудит звонков отдела продаж"
  },

  en: {
    brand: "CallControl AI",
    title: "Where your online school loses revenue on sales calls",
    lead:
      "In 5 business days we show it in dollars — with real quotes from your calls, " +
      "a Value at Risk figure, and a fix plan. Done-for-you, no software to adopt.",
    blocks: [
      [
        "Who it's for",
        "Online schools with a sales team and a call or consultation before purchase (IT, professional, English, exam prep)."
      ],
      [
        "The problem",
        "You pay for traffic, leads arrive, conversion underperforms — and you can't tell whether it's lead quality (marketing) or reps losing deals (sales). The answer is in your calls, but nobody has time to listen to all of them."
      ],
      [
        "What we do",
        "We analyse 20–50 of your calls across the funnel, surface recurring mistakes, split losses into marketing vs sales, and calculate Value at Risk conservatively and transparently — with an open formula."
      ],
      [
        "What you get",
        "A dollar Value at Risk report and top-5 leaks; real anonymised call quotes as evidence; a per-manager coaching breakdown; 2–3 Gold Calls; and a 30-day action plan with a clear first move."
      ],
      [
        "Format",
        "Team Audit — 5 business days, $1,500. Department Audit (multi-team, custom scorecard) — from $3,000."
      ],
      [
        "Low risk for you",
        "NDA, anonymised quotes, recordings deleted after delivery. We can start with a review of 2–3 of your calls."
      ]
    ],
    ctaLabel: "Next step",
    cta: "Book a 15-minute intro — or request a report example to see what the output looks like.",
    footer: "CallControl AI · sales call audits"
  }
};

function renderOnePagerPdf(copy, { requestUrl }) {
  return renderToBuffer((doc) => {
    const width = contentWidth(doc);

    doc.font(FONTS.bold).fontSize(9).fillColor(COLORS.blue)
      .text(copy.brand.toUpperCase(), { characterSpacing: 1.2 });
    doc.moveDown(0.4);

    doc.font(FONTS.bold).fontSize(21).fillColor(COLORS.ink).text(copy.title, { lineGap: 1 });
    doc.moveDown(0.35);

    doc.font(FONTS.regular).fontSize(11.5).fillColor(COLORS.muted).text(copy.lead, { lineGap: 2 });
    doc.moveDown(0.6);

    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .lineWidth(1.4).strokeColor(COLORS.ink).stroke();
    doc.moveDown(0.7);

    // Lead-in run-in with the body on the same line: keeps six blocks on one
    // page, and the bold phrase is what a skimming reader actually reads.
    for (const [leadIn, body] of copy.blocks) {
      doc.fontSize(11).fillColor(COLORS.ink).font(FONTS.bold)
        .text(`${leadIn}. `, { continued: true, lineGap: 2.5 })
        .font(FONTS.regular).fillColor(COLORS.muted)
        .text(body, { lineGap: 2.5 });
      doc.moveDown(0.55);
    }

    doc.moveDown(0.1);
    const ctaTop = doc.y;
    doc.roundedRect(doc.page.margins.left, ctaTop, width, 58, 6)
      .fillColor(COLORS.bg).fill();
    doc.roundedRect(doc.page.margins.left, ctaTop, width, 58, 6)
      .lineWidth(1).strokeColor(COLORS.line).stroke();

    doc.font(FONTS.bold).fontSize(10.5).fillColor(COLORS.ink)
      .text(copy.ctaLabel, doc.page.margins.left + 14, ctaTop + 10, { width: width - 28 });
    doc.font(FONTS.regular).fontSize(10.5).fillColor(COLORS.muted)
      .text(copy.cta, { width: width - 28, lineGap: 1 });

    doc.y = ctaTop + 58 + 16;
    doc.x = doc.page.margins.left;
    doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.muted).text(copy.footer);
    doc.moveDown(0.15);
    doc.font(FONTS.bold).fontSize(9).fillColor(COLORS.blue)
      .text(requestUrl, { link: requestUrl, underline: true });

    // One page is the whole point of a one-pager. pdfkit adds pages silently
    // when content overflows, so catch it at build time rather than shipping a
    // two-page "one-pager" to a prospect.
    if (doc.bufferedPageRange().count > 1) {
      throw new Error(
        `one-pager overflowed to ${doc.bufferedPageRange().count} pages — shorten the copy`
      );
    }
  });
}

// Writes dist/onepager/callcontrol-onepager-<locale>.pdf for every locale.
async function generateOnePagers(outDir, { siteOrigin }) {
  const dir = path.join(outDir, "onepager");
  fs.mkdirSync(dir, { recursive: true });

  const written = [];
  for (const [locale, copy] of Object.entries(ONE_PAGERS)) {
    const requestUrl = `${siteOrigin}/${locale}/#request`;
    const pdf = await renderOnePagerPdf(copy, { requestUrl });
    const file = path.join(dir, `callcontrol-onepager-${locale}.pdf`);
    fs.writeFileSync(file, pdf);
    written.push(file);
  }
  return written;
}

module.exports = { generateOnePagers, renderOnePagerPdf, ONE_PAGERS };
