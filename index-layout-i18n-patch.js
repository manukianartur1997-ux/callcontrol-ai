const fs = require("fs");

function once(html, from, to) {
  return html.includes(from) ? html.replace(from, to) : html;
}

function patchLayoutI18n(indexPath) {
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, "utf8");

  if (!html.includes("layout-i18n-polish")) {
    html = once(
      html,
      "</style>",
      `      /* layout-i18n-polish */
      html,
      body,
      .shell,
      .main {
        min-height: 100dvh;
      }

      .shell {
        align-items: stretch;
      }

      .sidebar {
        min-height: 100dvh;
        overflow: hidden;
      }

      .nav {
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(148, 163, 184, 0.35) transparent;
      }

      .sidebar-cta {
        margin-top: auto;
        background: linear-gradient(180deg, rgba(11,17,24,0.1), rgba(11,17,24,0.96));
      }

      body[data-theme="light"] .sidebar-cta {
        background: linear-gradient(180deg, rgba(213,229,240,0.1), rgba(213,229,240,0.96));
      }

      body[data-theme="light"] .card,
      body[data-theme="light"] .persona-card,
      body[data-theme="light"] .sample-audit-item,
      body[data-theme="light"] .before-after-item,
      body[data-theme="light"] .offer-card {
        background: rgba(255, 255, 255, 0.62);
      }

      body[data-theme="light"] .chip,
      body[data-theme="light"] .badge,
      body[data-theme="light"] .tag {
        color: var(--text);
      }

      @media (min-width: 761px) {
        .sidebar {
          position: sticky;
          top: 0;
          max-height: 100dvh;
        }
      }

      @media (max-width: 760px) {
        .shell,
        .main,
        .sidebar {
          min-height: auto;
        }
      }
</style>`
    );
  }

  if (!html.includes("layoutI18nExtraTranslations")) {
    html = once(
      html,
      "      function translateTextNodes(root = document.body) {",
      `      const layoutI18nExtraTranslations = {
        uk: {
          "Кабинет руководителя": "Кабінет керівника",
          "Руководитель": "Керівник",
          "Use Cases": "Сценарії",
          "Sample Report": "Приклад звіту",
          "Внедрение": "Впровадження",
          "Dark": "Темна",
          "Light": "Світла",
          "Язык интерфейса": "Мова інтерфейсу",
          "Свернуть меню": "Згорнути меню",
          "Боль:": "Біль:",
          "AI покажет:": "AI покаже:",
          "Результат:": "Результат:",
          "лиды оплачены, но непонятно, где теряются деньги.": "ліди оплачені, але незрозуміло, де губляться гроші.",
          "риск, цитату и этап потери.": "ризик, цитату й етап втрати.",
          "что чинить в воронке завтра.": "що лагодити у воронці завтра.",
          "невозможно слушать все звонки вручную.": "неможливо слухати всі дзвінки вручну.",
          "кого обучать и по какому навыку.": "кого навчати і за якою навичкою.",
          "план планерки и coaching focus.": "план планірки і coaching focus.",
          "сложно найти токсичность, слабый тон и повторные обращения.": "складно знайти токсичність, слабкий тон і повторні звернення.",
          "проблемные фразы и паттерны.": "проблемні фрази й патерни.",
          "темы для QA-разбора.": "теми для QA-розбору.",
          "большой поток звонков и мало контроля качества.": "великий потік дзвінків і мало контролю якості.",
          "какие звонки слушать первыми.": "які дзвінки слухати першими.",
          "приоритеты для супервайзера.": "пріоритети для супервайзера.",
          "Выборка показывает слабое закрытие разговора и потерю контроля над следующим шагом.": "Вибірка показує слабке закриття розмови й втрату контролю над наступним кроком.",
          "Клиент уходит “подумать”, а менеджер не фиксирует дату, канал и ответственность.": "Клієнт іде “подумати”, а менеджер не фіксує дату, канал і відповідальність.",
          "Добавить блок next step, уточнение бюджета и развилку по дате следующего контакта.": "Додати блок next step, уточнення бюджету й розвилку за датою наступного контакту.",
          "Разобрать на планерке финал звонка и переписать 3 слабые фразы.": "Розібрати на планірці фінал дзвінка й переписати 3 слабкі фрази.",
          "Менеджер отдает инициативу клиенту, не фиксирует следующий шаг и теряет контроль над теплой заявкой.": "Менеджер віддає ініціативу клієнту, не фіксує наступний крок і втрачає контроль над теплою заявкою.",
          "Можно начать с маленькой проверки без обязательств, а затем расширить аудит на команду или процесс.": "Можна почати з маленької перевірки без зобов'язань, а потім розширити аудит на команду або процес.",
          "Быстрая проверка до 5 звонков с фокусом на самые дорогие ошибки.": "Швидка перевірка до 5 дзвінків з фокусом на найдорожчі помилки.",
          "Поиск повторяющихся ошибок в выборке до 20 звонков.": "Пошук повторюваних помилок у вибірці до 20 дзвінків.",
          "Индивидуальный аудит, чек-листы, регулярный контроль и внедрение процесса.": "Індивідуальний аудит, чек-листи, регулярний контроль і впровадження процесу.",
          "Как к вам обращаться": "Як до вас звертатися",
          "@username или номер": "@username або номер",
          "Название компании": "Назва компанії",
          "Например: менеджеры сливают цену, не закрывают на следующий шаг, не перезванивают": "Наприклад: менеджери зливають ціну, не закривають на наступний крок, не передзвонюють",
          "Google Drive / Dropbox / текст транскрипта. До 5 звонков, до 15 минут каждый.": "Google Drive / Dropbox / текст транскрипту. До 5 дзвінків, до 15 хвилин кожен.",
          "Отправляем...": "Надсилаємо...",
          "Заявка не отправилась. Проверьте обязательные поля или попробуйте еще раз.": "Заявка не надіслалася. Перевірте обов'язкові поля або спробуйте ще раз."
        },
        en: {
          "Кабинет руководителя": "Executive workspace",
          "Руководитель": "Leader",
          "Use Cases": "Use Cases",
          "Sample Report": "Sample Report",
          "Внедрение": "Implementation",
          "Dark": "Dark",
          "Light": "Light",
          "Язык интерфейса": "Interface language",
          "Свернуть меню": "Collapse menu",
          "Боль:": "Pain:",
          "AI покажет:": "AI shows:",
          "Результат:": "Result:",
          "лиды оплачены, но непонятно, где теряются деньги.": "leads are paid for, but it is unclear where money is lost.",
          "риск, цитату и этап потери.": "risk, quote, and the exact loss stage.",
          "что чинить в воронке завтра.": "what to fix in the funnel tomorrow.",
          "невозможно слушать все звонки вручную.": "it is impossible to listen to every call manually.",
          "кого обучать и по какому навыку.": "who to coach and which skill to train.",
          "план планерки и coaching focus.": "team meeting plan and coaching focus.",
          "сложно найти токсичность, слабый тон и повторные обращения.": "it is hard to spot toxicity, weak tone, and repeat requests.",
          "проблемные фразы и паттерны.": "problem phrases and patterns.",
          "темы для QA-разбора.": "topics for QA review.",
          "большой поток звонков и мало контроля качества.": "high call volume with little quality control.",
          "какие звонки слушать первыми.": "which calls to review first.",
          "приоритеты для супервайзера.": "priorities for the supervisor.",
          "Выборка показывает слабое закрытие разговора и потерю контроля над следующим шагом.": "The sample shows weak call closing and loss of control over the next step.",
          "Клиент уходит “подумать”, а менеджер не фиксирует дату, канал и ответственность.": "The client leaves to “think”, while the manager does not lock a date, channel, or responsibility.",
          "Добавить блок next step, уточнение бюджета и развилку по дате следующего контакта.": "Add a next-step block, budget qualification, and a clear next-contact date.",
          "Разобрать на планерке финал звонка и переписать 3 слабые фразы.": "Review the call ending in the team meeting and rewrite 3 weak phrases.",
          "Менеджер отдает инициативу клиенту, не фиксирует следующий шаг и теряет контроль над теплой заявкой.": "The manager gives initiative to the client, skips the next step, and loses control over a warm lead.",
          "Можно начать с маленькой проверки без обязательств, а затем расширить аудит на команду или процесс.": "Start with a small no-obligation check, then expand the audit to the team or process.",
          "Быстрая проверка до 5 звонков с фокусом на самые дорогие ошибки.": "A quick check of up to 5 calls focused on the most expensive mistakes.",
          "Поиск повторяющихся ошибок в выборке до 20 звонков.": "Find repeated mistakes in a sample of up to 20 calls.",
          "Индивидуальный аудит, чек-листы, регулярный контроль и внедрение процесса.": "Custom audit, checklists, recurring QA, and process implementation.",
          "Как к вам обращаться": "How should we address you?",
          "@username или номер": "@username or phone number",
          "Название компании": "Company name",
          "Например: менеджеры сливают цену, не закрывают на следующий шаг, не перезванивают": "For example: managers drop the price, do not close the next step, do not call back",
          "Google Drive / Dropbox / текст транскрипта. До 5 звонков, до 15 минут каждый.": "Google Drive / Dropbox / transcript text. Up to 5 calls, 15 minutes each.",
          "Отправляем...": "Sending...",
          "Заявка не отправилась. Проверьте обязательные поля или попробуйте еще раз.": "The request was not sent. Check required fields or try again."
        }
      };

      Object.assign(textTranslations.uk, layoutI18nExtraTranslations.uk);
      Object.assign(textTranslations.en, layoutI18nExtraTranslations.en);

      const attributeTranslationBase = new WeakMap();
      function translateAttributes(root = document.body) {
        const dictionary = textTranslations[currentLanguage] || {};
        const attrs = ["placeholder", "title", "aria-label"];
        root.querySelectorAll("[placeholder], [title], [aria-label]").forEach((element) => {
          attrs.forEach((attr) => {
            if (!element.hasAttribute(attr)) return;
            if (!attributeTranslationBase.has(element)) attributeTranslationBase.set(element, {});
            const baseMap = attributeTranslationBase.get(element);
            if (!baseMap[attr]) baseMap[attr] = element.getAttribute(attr);
            const base = baseMap[attr];
            element.setAttribute(attr, currentLanguage === "ru" ? base : dictionary[base] || base);
          });
        });
      }

      function translateTextNodes(root = document.body) {`
    );

    html = once(
      html,
      `        document.querySelector("#topTitle").textContent = titleTranslations[currentLanguage][currentScreen] || titleTranslations.ru[currentScreen];
      }`,
      `        document.querySelector("#topTitle").textContent = titleTranslations[currentLanguage][currentScreen] || titleTranslations.ru[currentScreen];
        translateAttributes(root);
      }`
    );

    html = once(html, `          submitButton.textContent = "Отправляем...";`, `          submitButton.textContent = (textTranslations[currentLanguage] || {})["Отправляем..."] || "Отправляем...";`);
    html = once(html, `          submitButton.textContent = "Отправить заявку";`, `          submitButton.textContent = (textTranslations[currentLanguage] || {})["Отправить заявку"] || "Отправить заявку";`);
    html = once(html, `            alert("Заявка не отправилась. Проверьте обязательные поля или попробуйте еще раз.");`, `            alert((textTranslations[currentLanguage] || {})["Заявка не отправилась. Проверьте обязательные поля или попробуйте еще раз."] || "Заявка не отправилась. Проверьте обязательные поля или попробуйте еще раз.");`);
  }

  fs.writeFileSync(indexPath, html);
}

module.exports = patchLayoutI18n;
