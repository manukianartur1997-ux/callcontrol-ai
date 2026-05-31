window.MOCK = {
  workspace: {
    name: "VortexSales LLC",
    industry: "B2B SaaS · ERP solutions",
    teamSize: 5,
    period: "30d"
  },
  metrics: {
    valueAtRisk: 147400,
    trend: 32100,
    verdict: "sales_problem",
    verdictConfidence: 84,
    verdictText: "67% потерянных денег — целевые лиды, провалены менеджерами",
    callsAudited: 247,
    callsTrend: 18,
    avgQuality: 6.8
  },
  risks: [
    {
      id: "price",
      label: "Возражения по цене не отработаны",
      short: "Цена не отработана",
      calls: 18,
      value: 54200,
      avg: 3011,
      managers: ["m2", "m3", "m4", "m5"],
      severity: "critical",
      recommendation: "Внедрить скрипт обработки возражения 'дорого'. Потенциал восстановления: $32,000/мес.",
      quotes: ["c001", "c004"]
    },
    {
      id: "discovery",
      label: "Не выявлена потребность",
      short: "Discovery пропущен",
      calls: 12,
      value: 38000,
      avg: 3166,
      managers: ["m4", "m5"],
      severity: "critical",
      recommendation: "Mandatory discovery checklist на первые 8 минут звонка.",
      quotes: ["c003"]
    },
    {
      id: "next-step",
      label: "Не назначен следующий шаг",
      short: "Нет next step",
      calls: 22,
      value: 28400,
      avg: 1290,
      managers: ["m1", "m2", "m3", "m4", "m5"],
      severity: "warning",
      recommendation: "Каждый звонок заканчивать конкретным временем следующего касания.",
      quotes: ["c001", "c004"]
    },
    {
      id: "qualification",
      label: "Ошибки квалификации",
      short: "Квалификация",
      calls: 9,
      value: 26800,
      avg: 2977,
      managers: ["m3", "m4"],
      severity: "warning",
      recommendation: "Разделить bad-fit lead и weak discovery в CRM notes.",
      quotes: ["c003"]
    }
  ],
  managers: [
    {
      id: "m1",
      name: "Сергей Ковальчук",
      avatar: "SK",
      role: "Senior Sales Manager",
      calls: 64,
      score: 8.1,
      trend: 0.2,
      conversion: 34,
      avgDeal: 8400,
      risk: 8200,
      saved: 24600,
      strength: "Discovery",
      weakness: "Closing timing",
      status: "top_performer"
    },
    {
      id: "m2",
      name: "Мария Петренко",
      avatar: "MP",
      role: "Sales Manager",
      calls: 51,
      score: 7.4,
      trend: 0.4,
      conversion: 28,
      avgDeal: 6200,
      risk: 18400,
      saved: 12800,
      strength: "Price handling",
      weakness: "Next step",
      status: "rising_star"
    },
    {
      id: "m3",
      name: "Алексей Иванов",
      avatar: "AI",
      role: "Sales Manager",
      calls: 47,
      score: 6.5,
      trend: -0.3,
      conversion: 19,
      avgDeal: 4800,
      risk: 42100,
      saved: 4200,
      strength: "Tone",
      weakness: "Price objection",
      status: "needs_coaching"
    },
    {
      id: "m4",
      name: "Виктор Сидоренко",
      avatar: "VS",
      role: "Sales Manager",
      calls: 39,
      score: 5.8,
      trend: 0.1,
      conversion: 14,
      avgDeal: 3900,
      risk: 38900,
      saved: 1800,
      strength: "Fast response",
      weakness: "Discovery depth",
      status: "onboarding"
    },
    {
      id: "m5",
      name: "Олена Бондар",
      avatar: "OB",
      role: "Sales Manager",
      calls: 46,
      score: 6.9,
      trend: -0.5,
      conversion: 22,
      avgDeal: 5600,
      risk: 39800,
      saved: 8400,
      strength: "Urgency",
      weakness: "Qualification",
      status: "underperforming"
    }
  ],
  calls: [
    {
      id: "c001",
      managerId: "m3",
      client: "ABC Corp",
      industry: "Manufacturing",
      date: "2026-05-27 10:32",
      duration: "18:44",
      source: "Facebook Ads",
      stage: "Discovery",
      dealValue: 12400,
      score: 5.4,
      verdict: "sales_failure",
      risk: 12400,
      tags: ["price-objection", "no-next-step"],
      summary: "Менеджер не отработал возражение по цене и завершил звонок без конкретного следующего шага.",
      strengths: ["Тёплый тон, быстрый контакт с клиентом"],
      weaknesses: [
        "04:23 — возражение по цене принято без попытки вернуть ценность",
        "10:14 — звонок завершён без даты и времени следующего касания"
      ],
      transcript: [
        ["00:12", "Менеджер", "Добрый день, Алексей, вижу заявку по ERP для производства. Расскажите, что сейчас хотите улучшить?"],
        ["00:48", "Клиент", "У нас хаос с заявками, продажи не видят статусы по складу."],
        ["02:10", "Менеджер", "Понял, у нас как раз есть модуль склада и CRM, обычно быстро внедряем."],
        ["04:23", "Клиент", "Звучит интересно, но честно — дорого, не уверен, что сейчас потянем."],
        ["04:31", "Менеджер", "Ну тогда подумайте, наберёте если что."],
        ["06:14", "Клиент", "Мы сейчас смотрим ещё SalesIQ, там вроде дешевле."],
        ["06:22", "Менеджер", "Да, понимаю. У всех разные цены."],
        ["10:14", "Менеджер", "Окей, ну всё, до связи."],
        ["10:18", "Клиент", "До связи, спасибо."]
      ],
      highlights: {
        "04:31": "critical",
        "06:22": "warning",
        "10:14": "critical"
      }
    },
    {
      id: "c002",
      managerId: "m1",
      client: "TechFlow Industries",
      industry: "Software",
      date: "2026-05-26 14:18",
      duration: "30:40",
      source: "Recommendation",
      stage: "Negotiation",
      dealValue: 24000,
      score: 9.1,
      verdict: "success",
      risk: 0,
      tags: ["gold-call", "strong-discovery"],
      summary: "Менеджер вернул клиента к исходной боли и назначил конкретный следующий шаг.",
      strengths: ["Сильный discovery", "Отработка 'я подумаю' через бизнес-ценность", "Конкретный next step"],
      weaknesses: [],
      transcript: [
        ["00:18", "Менеджер", "Перед ценой хочу вернуться к тому, что вы сказали про потери на ручной сверке."],
        ["04:40", "Клиент", "Да, это реально съедает время команды."],
        ["12:34", "Менеджер", "Если ничего не менять, эти 18 часов в неделю останутся. Поэтому предлагаю считать не цену, а возврат времени."],
        ["17:42", "Менеджер", "Давайте во вторник в 11:00 покажу это вашему операционному директору на ваших данных."]
      ],
      highlights: {
        "12:34": "good",
        "17:42": "good"
      }
    },
    {
      id: "c003",
      managerId: "m4",
      client: "Digital Wave",
      industry: "Marketing Agency",
      date: "2026-05-26 11:05",
      duration: "08:07",
      source: "Google Ads",
      stage: "Discovery",
      dealValue: 4800,
      score: 4.2,
      verdict: "sales_failure",
      risk: 4800,
      tags: ["no-discovery", "wrong-qualification"],
      summary: "Менеджер перешёл к презентации до понимания ситуации клиента и преждевременно дисквалифицировал лид.",
      strengths: ["Быстро ответил на запрос"],
      weaknesses: ["01:48 — pitch до discovery", "06:12 — дисквалификация без вопроса о бюджете"],
      transcript: [
        ["00:20", "Клиент", "Мы ищем систему, чтобы агентство лучше вело клиентов."],
        ["01:48", "Менеджер", "Смотрите, у нас есть три тарифа и автоматические отчёты."],
        ["03:30", "Клиент", "А можно сначала понять, подойдёт ли нам по процессу?"],
        ["06:12", "Менеджер", "Думаю, наш продукт вам не подойдёт по бюджету."],
        ["06:19", "Клиент", "Мы бюджет вообще ещё не обсуждали."]
      ],
      highlights: {
        "01:48": "warning",
        "06:12": "critical"
      }
    },
    {
      id: "c004",
      managerId: "m2",
      client: "RetailPro",
      industry: "E-commerce",
      date: "2026-05-25 16:42",
      duration: "22:00",
      source: "LinkedIn",
      stage: "Demo scheduled",
      dealValue: 9200,
      score: 7.8,
      verdict: "in_progress",
      risk: 2400,
      tags: ["strong-rapport", "weak-next-step"],
      summary: "Хороший разговор, но следующий шаг сформулирован слишком мягко.",
      strengths: ["Хороший rapport", "Понятная презентация"],
      weaknesses: ["19:30 — next step без конкретного времени"],
      transcript: [
        ["00:15", "Менеджер", "Расскажите, где сейчас больше всего ручной работы?"],
        ["04:12", "Клиент", "В возвратах и синхронизации склада."],
        ["13:08", "Менеджер", "Тогда покажу сценарий именно по возвратам, не общий тур."],
        ["19:30", "Менеджер", "Я вам напишу как будет удобно."],
        ["20:14", "Менеджер", "Лучше так: завтра в 15:00 отправлю вам короткий план и забронирую демо на пятницу."]
      ],
      highlights: {
        "13:08": "good",
        "19:30": "warning",
        "20:14": "good"
      }
    }
  ]
};
