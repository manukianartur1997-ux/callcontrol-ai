const fs = require("fs");

function replaceOnce(html, from, to) {
  return html.includes(from) ? html.replace(from, to) : html;
}

const primaryCta = "Получить бесплатный mini-audit";
const demoCta = "Посмотреть демо";

function patchIndex(indexPath) {
  if (!fs.existsSync(indexPath)) return;

  let html = fs.readFileSync(indexPath, "utf8");

  html = html.replaceAll("Получить аудит 5 звонков", primaryCta);
  html = replaceOnce(
    html,
    '<button class="ghost" data-jump="lead">Получить аудит</button>',
    `<button class="ghost" data-screen="call">${demoCta}</button>`
  );
  html = replaceOnce(
    html,
    '<button class="ghost" data-screen="faq">Как это работает?</button>',
    `<button class="ghost" data-screen="call">${demoCta}</button>`
  );
  html = replaceOnce(
    html,
    '<button class="ghost" data-screen="pricing">Посмотреть форматы разборов</button>',
    `<button class="ghost" data-screen="call">${demoCta}</button>`
  );
  html = replaceOnce(
    html,
    "Вы загружаете 5 звонков или транскриптов. AI проверяет диалоги по чек-листу, находит критические ошибки и показывает, что исправить в скрипте уже завтра.",
    "Вы загружаете 3-5 звонков или транскриптов. AI проверяет диалоги по чек-листу, находит критические ошибки и показывает, что исправить в скрипте уже завтра."
  );

  if (!html.includes(".audit-preview-grid")) {
    html = html.replace(
      `      .quick-audit .step {
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr);
        gap: 10px;
        align-items: start;
      }
`,
      `      .quick-audit .step {
        display: grid;
        grid-template-columns: 34px minmax(0, 1fr);
        gap: 10px;
        align-items: start;
      }

      .audit-preview-grid,
      .persona-grid,
      .sample-audit-grid,
      .before-after-grid,
      .offer-grid {
        display: grid;
        gap: 10px;
      }

      .audit-preview-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
      .persona-grid,
      .offer-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .sample-audit-grid,
      .before-after-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }

      .audit-preview-item,
      .persona-card,
      .sample-audit-item,
      .before-after-item,
      .offer-card {
        min-height: 118px;
        padding: 12px;
        border: 1px solid var(--line-soft);
        border-radius: 8px;
        background: rgba(255,255,255,0.018);
      }

      .audit-preview-item strong,
      .persona-card strong,
      .sample-audit-item strong,
      .before-after-item strong,
      .offer-card strong { display: block; margin-bottom: 5px; }

      .audit-preview-item p,
      .persona-card p,
      .sample-audit-item p,
      .before-after-item p,
      .offer-card p { margin: 0; font-size: 12px; }

      .compare-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .compare-list {
        display: grid;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .compare-list li {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.45;
      }

      .compare-list li::before {
        content: "";
        width: 7px;
        height: 7px;
        margin-top: 6px;
        border-radius: 999px;
        background: var(--faint);
        flex: 0 0 auto;
      }

      .compare-list.positive li::before { background: var(--green); }
      .compare-list.negative li::before { background: var(--red); }
`
    );

    html = html.replace(
      ".kpis, .four, .pricing { grid-template-columns: repeat(2, minmax(0, 1fr)); }",
      ".kpis, .four, .pricing, .audit-preview-grid, .persona-grid, .sample-audit-grid, .before-after-grid, .offer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }"
    );
    html = html.replace(
      ".feature-matrix, .roadmap, .pipeline, .security-grid, .crm-grid, .proof-grid, .faq-list { grid-template-columns: 1fr; }",
      ".feature-matrix, .roadmap, .pipeline, .security-grid, .crm-grid, .proof-grid, .faq-list, .audit-preview-grid, .compare-grid, .persona-grid, .sample-audit-grid, .before-after-grid, .offer-grid { grid-template-columns: 1fr; }"
    );
  }

  if (!html.includes("Что вы получите после 3-5 звонков")) {
    html = html.replace(
      `            <div class="grid kpis mb">`,
      `            <div class="card mt">
              <div class="section-head" style="margin-bottom:12px">
                <div>
                  <h2>Что вы получите после 3-5 звонков</h2>
                  <p>Мини-аудит не заставляет читать простыню текста. Он сразу показывает, где потерялась заявка, какой момент это доказывает и что сделать на следующей планерке.</p>
                </div>
                <button class="primary" data-jump="lead">Получить бесплатный mini-audit</button>
              </div>
              <div class="audit-preview-grid">
                <div class="audit-preview-item"><strong>Общий score</strong><p>Короткая оценка выборки: насколько звонки проходят базовый стандарт качества.</p></div>
                <div class="audit-preview-item"><strong>Главный риск</strong><p>Самая дорогая ошибка: цена, бюджет, следующий шаг, тон или уход к конкуренту.</p></div>
                <div class="audit-preview-item"><strong>2-3 цитаты</strong><p>Конкретные фразы из звонков, чтобы было видно доказательство, а не “мнение AI”.</p></div>
                <div class="audit-preview-item"><strong>Action items</strong><p>Что исправить в скрипте, вопросах или финале разговора уже завтра.</p></div>
                <div class="audit-preview-item"><strong>Рекомендация РОПу</strong><p>Кого обучать, какой навык просел и какой звонок взять как эталон.</p></div>
                <div class="audit-preview-item"><strong>Следующий аудит</strong><p>Что проверить дальше: 20 звонков, отдел целиком, поддержку или отдельную нишу.</p></div>
              </div>
            </div>

            <div class="compare-grid mt">
              <div class="card red">
                <h2>Обычный транскрипт</h2>
                <ul class="compare-list negative">
                  <li>Дает текст разговора, но не объясняет, где потерялась заявка.</li>
                  <li>РОП все равно читает вручную и тратит время на поиск смысла.</li>
                  <li>Не показывает приоритет: что чинить завтра, а что можно отложить.</li>
                  <li>Не превращается в задачу для менеджера или план планерки.</li>
                </ul>
              </div>
              <div class="card green">
                <h2>CallControl AI</h2>
                <ul class="compare-list positive">
                  <li>Показывает риск, цитату, причину ошибки и конкретное действие.</li>
                  <li>Собирает scorecard, чек-лист, coaching focus и вывод для РОПа.</li>
                  <li>Подходит не только продажам, но и поддержке, сервису, колл-центрам.</li>
                  <li>Помогает быстро решить: нужен полный аудит или гипотеза слабая.</li>
                </ul>
              </div>
            </div>

            <div class="grid kpis mb">`
    );
  }

  if (!html.includes("Sample Mini-Audit Preview")) {
    html = html.replace(
      `            <div class="grid kpis mb">`,
      `            <div class="card mt">
              <div class="section-head" style="margin-bottom:12px">
                <div>
                  <h2>Для кого подходит</h2>
                  <p>Один и тот же аудит дает разные управленческие ответы для собственника, РОПа, поддержки и сервиса.</p>
                </div>
                <button class="primary" data-jump="lead">${primaryCta}</button>
              </div>
              <div class="persona-grid">
                <div class="persona-card"><strong>Собственник</strong><p><b>Боль:</b> лиды оплачены, но непонятно, где теряются деньги.<br><b>AI покажет:</b> риск, цитату и этап потери.<br><b>Результат:</b> что чинить в воронке завтра.</p></div>
                <div class="persona-card"><strong>РОП</strong><p><b>Боль:</b> невозможно слушать все звонки вручную.<br><b>AI покажет:</b> кого обучать и по какому навыку.<br><b>Результат:</b> план планерки и coaching focus.</p></div>
                <div class="persona-card"><strong>Support Lead</strong><p><b>Боль:</b> сложно найти токсичность, слабый тон и повторные обращения.<br><b>AI покажет:</b> проблемные фразы и паттерны.<br><b>Результат:</b> темы для QA-разбора.</p></div>
                <div class="persona-card"><strong>Service / Call Center</strong><p><b>Боль:</b> большой поток звонков и мало контроля качества.<br><b>AI покажет:</b> какие звонки слушать первыми.<br><b>Результат:</b> приоритеты для супервайзера.</p></div>
              </div>
            </div>

            <div class="card mt">
              <div class="section-head" style="margin-bottom:12px">
                <div>
                  <h2>Sample Mini-Audit Preview</h2>
                  <p>Такой отчет можно получить после 3-5 звонков: не просто текст, а score, риск, цитаты и действия.</p>
                </div>
                <button class="primary" data-jump="lead">Хочу такой отчет по своим звонкам</button>
              </div>
              <div class="sample-audit-grid">
                <div class="sample-audit-item"><strong>Общий score: 42/100</strong><p>Выборка показывает слабое закрытие разговора и потерю контроля над следующим шагом.</p></div>
                <div class="sample-audit-item"><strong>Главный риск</strong><p>Клиент уходит “подумать”, а менеджер не фиксирует дату, канал и ответственность.</p></div>
                <div class="sample-audit-item"><strong>Цитаты</strong><p>“Ну подумайте, если что - напишите.”<br>“Цена примерно такая, дальше смотрите сами.”</p></div>
                <div class="sample-audit-item"><strong>Action items</strong><p>Добавить блок next step, уточнение бюджета и развилку по дате следующего контакта.</p></div>
                <div class="sample-audit-item"><strong>Рекомендация РОПу</strong><p>Разобрать на планерке финал звонка и переписать 3 слабые фразы.</p></div>
                <div class="sample-audit-item"><strong>Что проверить дальше</strong><p>20 звонков по разным менеджерам, отдельно возражения “дорого” и уход к конкуренту.</p></div>
              </div>
            </div>

            <div class="before-after-grid mt">
              <div class="card red"><h2>Плохая фраза</h2><p>“Ну подумайте, если что - напишите.”</p></div>
              <div class="card yellow"><h2>Почему это риск</h2><p>Менеджер отдает инициативу клиенту, не фиксирует следующий шаг и теряет контроль над теплой заявкой.</p></div>
              <div class="card green"><h2>Лучше так</h2><p>“Давайте зафиксируем следующий шаг: завтра в 12:00 я отправлю расчет и мы созвонимся на 10 минут. Вам удобнее Telegram или WhatsApp?”<br><br><b>Эффект:</b> выше шанс вернуть клиента в воронку.</p></div>
            </div>

            <div class="card mt">
              <div class="section-head" style="margin-bottom:12px">
                <div>
                  <h2>Форматы работы</h2>
                  <p>Можно начать с маленькой проверки без обязательств, а затем расширить аудит на команду или процесс.</p>
                </div>
              </div>
              <div class="offer-grid">
                <div class="offer-card"><strong>Free mini-audit</strong><p>3-5 звонков, общий score, главный риск, цитаты и action items.</p></div>
                <div class="offer-card"><strong>$10 quick scan</strong><p>Быстрая проверка до 5 звонков с фокусом на самые дорогие ошибки.</p></div>
                <div class="offer-card"><strong>$50 pattern search</strong><p>Поиск повторяющихся ошибок в выборке до 20 звонков.</p></div>
                <div class="offer-card"><strong>Custom audit / implementation</strong><p>Индивидуальный аудит, чек-листы, регулярный контроль и внедрение процесса.</p></div>
              </div>
            </div>

            <div class="grid kpis mb">`
    );
  }

  const faqBlock = `
            <details class="faq-item" open><summary>Безопасно ли отправлять записи?</summary><p>Записи используются только для аудита. Не передаем третьим лицам и не используем для обучения публичных моделей. Для чувствительных данных можно прислать обезличенные транскрипты.</p></details>
            <details class="faq-item"><summary>Можно ли загрузить транскрипты вместо аудио?</summary><p>Да. Для mini-audit достаточно аудио, транскрипта, ссылки на папку или CSV-экспорта.</p></details>
            <details class="faq-item"><summary>Какие языки поддерживаются?</summary><p>Для MVP фокус: русский, украинский и английский. Для других языков лучше сначала сделать тестовый mini-audit.</p></details>
            <details class="faq-item"><summary>Что если звонки плохого качества?</summary><p>Можно начать с транскриптов или выбрать звонки с более чистым звуком. В отчете отдельно помечаем, если качество записи мешает анализу.</p></details>
            <details class="faq-item"><summary>Чем отличается от Fireflies/Otter/обычной транскрибации?</summary><p>Транскрибаторы дают текст. CallControl AI показывает риск, цитату, причину ошибки, action items и рекомендацию для РОПа.</p></details>
            <details class="faq-item"><summary>Что входит в бесплатный mini-audit?</summary><p>3-5 звонков, общий score, главный риск, 2-3 цитаты, action items, рекомендация РОПу и что проверить дальше.</p></details>
            <details class="faq-item"><summary>Что происходит после заявки?</summary><p>Мы связываемся в Telegram/WhatsApp, уточняем формат данных, берем 3-5 звонков или транскриптов и возвращаем короткий отчет.</p></details>
`;

  if (!html.includes("Чем отличается от Fireflies")) {
    html = html.replace(`          <div class="faq-list">`, `          <div class="faq-list">${faqBlock}`);
  }

  if (!html.includes('select name="dataFormat"')) {
    html = html.replace(
      `<label>Размер отдела<select name="team" required><option>1-2</option><option>3-10</option><option>10-30</option><option>30+</option></select></label>`,
      `<label>Размер отдела<select name="team" required><option>1-2</option><option>3-10</option><option>10-30</option><option>30+</option></select></label>
                  <label>Ниша<select name="niche" required><option>Продажи</option><option>Клиент-сервис</option><option>Недвижимость</option><option>EdTech</option><option>Авто</option><option>Другое</option></select></label>
                  <label>Формат данных<select name="dataFormat" required><option>Аудио-файлы</option><option>Транскрипты</option><option>Ссылка на папку</option><option>CSV / экспорт</option></select></label>`
    );
  }

  if (!html.includes("Записи используются только для аудита")) {
    html = html.replace(
      `                  <div class="full" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">`,
      `                  <p class="small full">Записи используются только для аудита. Не передаем третьим лицам и не используем для обучения публичных моделей.</p>
                  <div class="full" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">`
    );
  }

  html = html.replace(
    '["SCRIPT", "STYLE", "OPTION"].includes(node.parentElement.tagName)',
    '["SCRIPT", "STYLE"].includes(node.parentElement.tagName)'
  );

  if (!html.includes("Recordings are used only for the audit")) {
    html = html.replace(
      `      function translateTextNodes(root = document.body) {`,
      `      Object.assign(textTranslations.uk, {
        "Получить бесплатный mini-audit": "Отримати безкоштовний mini-audit",
        "Посмотреть демо": "Подивитися демо",
        "Вы загружаете 3-5 звонков или транскриптов. AI проверяет диалоги по чек-листу, находит критические ошибки и показывает, что исправить в скрипте уже завтра.": "Ви завантажуєте 3-5 дзвінків або транскриптів. AI перевіряє діалоги за чек-листом, знаходить критичні помилки і показує, що виправити в скрипті вже завтра.",
        "Что вы получите после 3-5 звонков": "Що ви отримаєте після 3-5 дзвінків",
        "Мини-аудит не заставляет читать простыню текста. Он сразу показывает, где потерялась заявка, какой момент это доказывает и что сделать на следующей планерке.": "Міні-аудит не змушує читати полотно тексту. Він одразу показує, де загубилася заявка, який момент це доводить і що зробити на наступній планірці.",
        "Общий score": "Загальний score",
        "Главный риск": "Головний ризик",
        "2-3 цитаты": "2-3 цитати",
        "Рекомендация РОПу": "Рекомендація РОПу",
        "Следующий аудит": "Наступний аудит",
        "Обычный транскрипт": "Звичайний транскрипт",
        "Ниша": "Ніша",
        "Формат данных": "Формат даних",
        "Аудио-файлы": "Аудіо-файли",
        "Транскрипты": "Транскрипти",
        "Ссылка на папку": "Посилання на папку",
        "CSV / экспорт": "CSV / експорт",
        "Владелец": "Власник",
        "Другое": "Інше",
        "Записи используются только для аудита. Не передаем третьим лицам и не используем для обучения публичных моделей.": "Записи використовуються тільки для аудиту. Не передаємо третім особам і не використовуємо для навчання публічних моделей."
      });

      Object.assign(textTranslations.en, {
        "Получить бесплатный mini-audit": "Get a free mini-audit",
        "Посмотреть демо": "View demo",
        "Вы загружаете 3-5 звонков или транскриптов. AI проверяет диалоги по чек-листу, находит критические ошибки и показывает, что исправить в скрипте уже завтра.": "Upload 3-5 calls or transcripts. AI checks them against a checklist, finds critical mistakes, and shows what to fix in the script tomorrow.",
        "Что вы получите после 3-5 звонков": "What you get after 3-5 calls",
        "Мини-аудит не заставляет читать простыню текста. Он сразу показывает, где потерялась заявка, какой момент это доказывает и что сделать на следующей планерке.": "The mini-audit does not force you to read a wall of text. It shows where the lead was lost, which moment proves it, and what to discuss in the next team meeting.",
        "Общий score": "Overall score",
        "Главный риск": "Main risk",
        "2-3 цитаты": "2-3 quotes",
        "Рекомендация РОПу": "Sales lead recommendation",
        "Следующий аудит": "Next audit",
        "Обычный транскрипт": "Regular transcript",
        "Ниша": "Niche",
        "Формат данных": "Data format",
        "Аудио-файлы": "Audio files",
        "Транскрипты": "Transcripts",
        "Ссылка на папку": "Folder link",
        "CSV / экспорт": "CSV / export",
        "Владелец": "Owner",
        "Другое": "Other",
        "Записи используются только для аудита. Не передаем третьим лицам и не используем для обучения публичных моделей.": "Recordings are used only for the audit. We do not share them with third parties or use them to train public models."
      });

      function translateTextNodes(root = document.body) {`
    );
  }

  if (!html.includes("For whom it fits")) {
    html = html.replace(
      `      function translateTextNodes(root = document.body) {`,
      `      Object.assign(textTranslations.uk, {
        "Для кого подходит": "Для кого підходить",
        "Один и тот же аудит дает разные управленческие ответы для собственника, РОПа, поддержки и сервиса.": "Один і той самий аудит дає різні управлінські відповіді для власника, РОПа, підтримки та сервісу.",
        "Собственник": "Власник",
        "Sample Mini-Audit Preview": "Приклад Mini-Audit Preview",
        "Такой отчет можно получить после 3-5 звонков: не просто текст, а score, риск, цитаты и действия.": "Такий звіт можна отримати після 3-5 дзвінків: не просто текст, а score, ризик, цитати й дії.",
        "Хочу такой отчет по своим звонкам": "Хочу такий звіт по своїх дзвінках",
        "Плохая фраза": "Погана фраза",
        "Почему это риск": "Чому це ризик",
        "Лучше так": "Краще так",
        "Форматы работы": "Формати роботи",
        "Безопасно ли отправлять записи?": "Чи безпечно надсилати записи?",
        "Можно ли загрузить транскрипты вместо аудио?": "Чи можна завантажити транскрипти замість аудіо?",
        "Какие языки поддерживаются?": "Які мови підтримуються?",
        "Что если звонки плохого качества?": "Що якщо дзвінки поганої якості?",
        "Чем отличается от Fireflies/Otter/обычной транскрибации?": "Чим відрізняється від Fireflies/Otter/звичайної транскрибації?",
        "Что входит в бесплатный mini-audit?": "Що входить у безкоштовний mini-audit?",
        "Что происходит после заявки?": "Що відбувається після заявки?"
      });

      Object.assign(textTranslations.en, {
        "Для кого подходит": "For whom it fits",
        "Один и тот же аудит дает разные управленческие ответы для собственника, РОПа, поддержки и сервиса.": "The same audit gives different management answers for an owner, sales lead, support, and service teams.",
        "Собственник": "Owner",
        "Sample Mini-Audit Preview": "Sample Mini-Audit Preview",
        "Такой отчет можно получить после 3-5 звонков: не просто текст, а score, риск, цитаты и действия.": "This is the kind of report you can get after 3-5 calls: not just text, but a score, risk, quotes, and actions.",
        "Хочу такой отчет по своим звонкам": "I want this report for my calls",
        "Плохая фраза": "Weak phrase",
        "Почему это риск": "Why it is risky",
        "Лучше так": "Better version",
        "Форматы работы": "Work formats",
        "Безопасно ли отправлять записи?": "Is it safe to send recordings?",
        "Можно ли загрузить транскрипты вместо аудио?": "Can I upload transcripts instead of audio?",
        "Какие языки поддерживаются?": "Which languages are supported?",
        "Что если звонки плохого качества?": "What if call quality is poor?",
        "Чем отличается от Fireflies/Otter/обычной транскрибации?": "How is this different from Fireflies/Otter/transcription?",
        "Что входит в бесплатный mini-audit?": "What is included in the free mini-audit?",
        "Что происходит после заявки?": "What happens after I submit a request?"
      });

      function translateTextNodes(root = document.body) {`
    );
  }

  fs.writeFileSync(indexPath, html);
}

module.exports = patchIndex;
