const fs = require("fs");

function once(html, from, to) {
  return html.includes(from) ? html.replace(from, to) : html;
}

function patchI18nNormalize(indexPath) {
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, "utf8");

  if (!html.includes("i18n-normalize-layer")) {
    html = once(
      html,
      "      function translateAttributes(root = document.body) {",
      `      /* i18n-normalize-layer */
      const normalizedRu = {
        "Dashboard": "Дашборд",
        "Dashboard руководителя": "Дашборд руководителя",
        "Owner Dashboard": "Кабинет руководителя",
        "Weekly Report": "Недельный отчет",
        "Monday action plan": "План действий на понедельник",
        "Sample Report": "Пример отчета",
        "Sample Mini-Audit Preview": "Пример mini-audit отчета",
        "Use Cases": "Сценарии использования",
        "Action items": "Действия",
        "Support Lead": "Руководитель поддержки",
        "Service / Call Center": "Сервис / колл-центр",
        "Quick scan": "Быстрая проверка",
        "Pattern search": "Поиск паттернов",
        "Custom audit / implementation": "Индивидуальный аудит / внедрение",
        "Call Detail": "Разбор звонка",
        "Checklist": "Чек-лист",
        "Checklists": "Чек-листы",
        "Integrations": "Интеграции",
        "Roadmap": "Roadmap",
        "Manager coaching": "Коучинг менеджеров",
        "Lead risk": "Риск потери лида",
        "Free mini-audit": "Бесплатный mini-audit",
        "$10 quick scan": "$10 быстрая проверка",
        "$50 pattern search": "$50 поиск паттернов",
        "Client MVP": "Кабинет клиента",
        "PDF Export": "PDF-экспорт",
        "Weekly Report · mini-audit": "Недельный отчет · mini-audit",
        "Dashboard, Call Detail, Heatmap, Coaching, Weekly Report, Checklists, Lead Form.": "Дашборд, разбор звонка, карта навыков, коучинг, недельный отчет, чек-листы и форма заявки.",
        "Weekly Report: кого учить, какие звонки переслушать и где деньги под риском.": "Недельный отчет: кого учить, какие звонки переслушать и где деньги под риском.",
        "Sample Report: пример результата после мини-аудита": "Пример отчета: результат после мини-аудита",
        "AI-аудит звонков для продаж, поддержки и клиент-сервиса": "AI-аудит звонков для продаж, поддержки и клиент-сервиса"
      };

      const normalizedTranslations = {
        uk: {
          "Дашборд": "Дашборд",
          "Дашборд руководителя": "Дашборд керівника",
          "Кабинет руководителя": "Кабінет керівника",
          "Недельный отчет": "Тижневий звіт",
          "План действий на понедельник": "План дій на понеділок",
          "Пример отчета": "Приклад звіту",
          "Пример mini-audit отчета": "Приклад mini-audit звіту",
          "Сценарии использования": "Сценарії використання",
          "Действия": "Дії",
          "Руководитель поддержки": "Керівник підтримки",
          "Сервис / колл-центр": "Сервіс / кол-центр",
          "Быстрая проверка": "Швидка перевірка",
          "Поиск паттернов": "Пошук патернів",
          "Индивидуальный аудит / внедрение": "Індивідуальний аудит / впровадження",
          "Разбор звонка": "Розбір дзвінка",
          "Чек-лист": "Чек-лист",
          "Чек-листы": "Чек-листи",
          "Интеграции": "Інтеграції",
          "Коучинг менеджеров": "Коучинг менеджерів",
          "Риск потери лида": "Ризик втрати ліда",
          "Бесплатный mini-audit": "Безкоштовний mini-audit",
          "$10 быстрая проверка": "$10 швидка перевірка",
          "$50 поиск паттернов": "$50 пошук патернів",
          "Кабинет клиента": "Кабінет клієнта",
          "PDF-экспорт": "PDF-експорт",
          "Недельный отчет · mini-audit": "Тижневий звіт · mini-audit",
          "Дашборд, разбор звонка, карта навыков, коучинг, недельный отчет, чек-листы и форма заявки.": "Дашборд, розбір дзвінка, карта навичок, коучинг, тижневий звіт, чек-листи та форма заявки.",
          "Недельный отчет: кого учить, какие звонки переслушать и где деньги под риском.": "Тижневий звіт: кого навчати, які дзвінки переслухати і де гроші під ризиком.",
          "Пример отчета: результат после мини-аудита": "Приклад звіту: результат після міні-аудиту",
          "AI-аудит звонков для продаж, поддержки и клиент-сервиса": "AI-аудит дзвінків для продажів, підтримки та клієнт-сервісу"
        },
        en: {
          "Дашборд": "Dashboard",
          "Дашборд руководителя": "Leadership dashboard",
          "Кабинет руководителя": "Owner Dashboard",
          "Недельный отчет": "Weekly Report",
          "План действий на понедельник": "Monday action plan",
          "Пример отчета": "Sample Report",
          "Пример mini-audit отчета": "Sample Mini-Audit Preview",
          "Сценарии использования": "Use Cases",
          "Действия": "Action items",
          "Руководитель поддержки": "Support Lead",
          "Сервис / колл-центр": "Service / Call Center",
          "Быстрая проверка": "Quick scan",
          "Поиск паттернов": "Pattern search",
          "Индивидуальный аудит / внедрение": "Custom audit / implementation",
          "Разбор звонка": "Call Detail",
          "Чек-лист": "Checklist",
          "Чек-листы": "Checklists",
          "Интеграции": "Integrations",
          "Коучинг менеджеров": "Manager coaching",
          "Риск потери лида": "Lead risk",
          "Бесплатный mini-audit": "Free mini-audit",
          "$10 быстрая проверка": "$10 quick scan",
          "$50 поиск паттернов": "$50 pattern search",
          "Кабинет клиента": "Client MVP",
          "PDF-экспорт": "PDF Export",
          "Недельный отчет · mini-audit": "Weekly Report · mini-audit",
          "Дашборд, разбор звонка, карта навыков, коучинг, недельный отчет, чек-листы и форма заявки.": "Dashboard, Call Detail, Heatmap, Coaching, Weekly Report, Checklists, Lead Form.",
          "Недельный отчет: кого учить, какие звонки переслушать и где деньги под риском.": "Weekly Report: who to coach, which calls to replay, and where revenue is at risk.",
          "Пример отчета: результат после мини-аудита": "Sample Report: result after mini-audit",
          "AI-аудит звонков для продаж, поддержки и клиент-сервиса": "AI call audit for sales, support, and customer service"
        }
      };

      Object.assign(textTranslations.uk, normalizedTranslations.uk);
      Object.assign(textTranslations.en, normalizedTranslations.en);

      function translateValue(value, dictionary = textTranslations[currentLanguage] || {}) {
        if (!value || typeof value !== "string") return value;
        const normalized = normalizedRu[value] || value;
        if (currentLanguage === "ru") return normalized;
        return dictionary[normalized] || normalizedTranslations[currentLanguage]?.[normalized] || dictionary[value] || normalizedTranslations[currentLanguage]?.[value] || normalized;
      }

      window.applyI18n = function applyI18n(root = document.body) {
        translateTextNodes(root);
      };

      function translateAttributes(root = document.body) {`
    );

    html = once(
      html,
      `            element.setAttribute(attr, currentLanguage === "ru" ? base : dictionary[base] || base);`,
      `            element.setAttribute(attr, translateValue(base, dictionary));`
    );

    html = once(
      html,
      `          if (currentLanguage === "ru") {
            node.nodeValue = base;
            return;
          }
          if (!dictionary[trimmed]) return;
          node.nodeValue = base.replace(trimmed, dictionary[trimmed]);`,
      `          const translated = translateValue(trimmed, dictionary);
          node.nodeValue = base.replace(trimmed, translated);`
    );

    html = once(
      html,
      `        document.querySelector("#topTitle").textContent = titleTranslations[currentLanguage][currentScreen] || titleTranslations.ru[currentScreen];`,
      `        const rawTitle = titleTranslations[currentLanguage][currentScreen] || titleTranslations.ru[currentScreen];
        document.querySelector("#topTitle").textContent = translateValue(rawTitle, dictionary);`
    );

    html = once(
      html,
      `      document.querySelector("#languageSelect").addEventListener("change", (event) => {
        currentLanguage = event.target.value;
        translateTextNodes();
      });`,
      `      document.querySelector("#languageSelect").addEventListener("change", (event) => {
        currentLanguage = event.target.value;
        translateTextNodes();
        window.setTimeout(() => window.applyI18n?.(document.body), 0);
      });`
    );
  }

  fs.writeFileSync(indexPath, html);
}

module.exports = patchI18nNormalize;
