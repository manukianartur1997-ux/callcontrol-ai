const fs = require("fs");

function patchExtraConversion(indexPath) {
  if (!fs.existsSync(indexPath)) return;

  let html = fs.readFileSync(indexPath, "utf8");

  if (!html.includes(".persona-grid")) {
    html = html.replace(
      "</style>",
      `      .persona-grid,
      .sample-audit-grid,
      .before-after-grid,
      .offer-grid {
        display: grid;
        gap: 10px;
      }

      .persona-grid,
      .offer-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .sample-audit-grid,
      .before-after-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }

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

      .persona-card strong,
      .sample-audit-item strong,
      .before-after-item strong,
      .offer-card strong { display: block; margin-bottom: 5px; }

      .persona-card p,
      .sample-audit-item p,
      .before-after-item p,
      .offer-card p { margin: 0; font-size: 12px; }

      @media (max-width: 1120px) {
        .persona-grid,
        .sample-audit-grid,
        .before-after-grid,
        .offer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }

      @media (max-width: 760px) {
        .persona-grid,
        .sample-audit-grid,
        .before-after-grid,
        .offer-grid { grid-template-columns: 1fr; }
      }
</style>`
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
                <button class="primary" data-jump="lead">Получить бесплатный mini-audit</button>
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

module.exports = patchExtraConversion;
