// Single source of every user-facing string, in three locales sharing ONE
// key tree: uk (default), ru, en.
//
// Architecture choice — live-switchable Proxy, documented here on purpose:
// every component keeps importing { copy } and reading copy.section.key at
// render time, exactly as before the i18n pass. `copy` is a thin Proxy whose
// property reads resolve against the dictionary of the CURRENT locale, so no
// component changed for i18n. Correct re-rendering is App's job: App calls
// useLocale() (hooks.js, useSyncExternalStore over subscribeLocale below), so
// a locale switch re-renders the root and cascades through the whole mounted
// tree — nothing memoizes copy strings, so nothing goes stale. This keeps the
// diff minimal versus threading a getCopy(locale) accessor through ~15 files.
//
// Rules that keep this working:
// - NEVER read copy at module scope (the value would freeze at import time);
//   read it inside components / functions only.
// - Plural leaves are word arrays: [one, few, many] for uk/ru, [one, other]
//   for en — format.js pluralRu() picks by array length.
// - The selected locale persists in localStorage "cc:locale"; default "uk".

export const LOCALES = ["uk", "ru", "en"];

const STORAGE_KEY = "cc:locale";
const DEFAULT_LOCALE = "uk";

// ---------------------------------------------------------------------------
// uk — default locale
// ---------------------------------------------------------------------------
const uk = {
  common: {
    appName: "CallControl AI",
    docTitle: "CallControl AI — кабінет",
    loading: "Завантажуємо…",
    retry: "Повторити",
    cancel: "Скасувати",
    close: "Закрити",
    signOut: "Вийти",
    language: "Мова",
    dash: "—",
    orgFallback: "Організація"
  },

  password: {
    title: "Змінити пароль",
    change: "Змінити пароль",
    newLabel: "Новий пароль",
    repeatLabel: "Ще раз",
    submit: "Зберегти",
    done: "Пароль оновлено. Під час наступного входу використовуйте новий.",
    tooShort: "Мінімум 8 символів.",
    mismatch: "Паролі не збігаються.",
    samePassword: "Новий пароль збігається зі старим."
  },

  plurals: {
    calls: ["дзвінок", "дзвінки", "дзвінків"]
  },

  login: {
    title: "Вхід до кабінету",
    subtitle: "Контроль якості дзвінків відділу продажів",
    tabSignIn: "Увійти",
    tabInvite: "За запрошенням",
    tabRegister: "Нова компанія",
    email: "Email",
    emailPlaceholder: "you@company.com",
    password: "Пароль",
    passwordHint: "Мінімум 8 символів.",
    fullName: "Ім’я",
    fullNamePlaceholder: "Ім’я та прізвище",
    submit: "Увійти",
    submitting: "Входимо…",
    orDivider: "або",
    google: "Увійти через Google",
    googleNotEnabled: "Вхід через Google ще не підключено.",
    errorInvalid: "Неправильний email або пароль. Перевірте і спробуйте ще раз.",
    errorGeneric: "Не вдалося увійти. Спробуйте ще раз за хвилину.",

    invite: {
      code: "Код запрошення",
      codePlaceholder: "Код із листа або посилання",
      submit: "Приєднатися",
      submitting: "Перевіряємо…",
      invalid: "Запрошення не знайдено, воно прострочене або виписане на іншу пошту.",
      emailExists:
        "Акаунт уже є — увійдіть і введіть код запрошення на екрані «Немає доступу»."
    },

    register: {
      signupCode: "Код реєстрації",
      signupCodeHint: "Пілотний код — запитайте в нас, якщо його ще немає.",
      orgName: "Назва компанії",
      orgNamePlaceholder: "ТОВ «Ромашка»",
      submit: "Створити компанію",
      submitting: "Створюємо…",
      badCode: "Неправильний код реєстрації.",
      closed: "Реєстрацію зараз закрито.",
      emailExists:
        "Акаунт із цією поштою вже є — увійдіть і створіть компанію " +
        "на екрані «Немає доступу».",
      rateLimited:
        "Поштовий ліміт Supabase вичерпано — спробуйте за годину. " +
        "(На пілоті листи надсилає вбудована пошта з лімітом ~2 на годину.)",
      confirmSent:
        "Компанію створено. Ми надіслали лист для підтвердження пошти — " +
        "перейдіть за посиланням із нього та увійдіть."
    }
  },

  join: {
    title: "Запрошення до організації",
    checking: "Приймаємо запрошення…",
    alreadyMember: "Ви вже перебуваєте в цій організації.",
    open: "Відкрити кабінет"
  },

  noAccess: {
    title: "Немає доступу",
    text:
      "Ваш акаунт не прив’язаний до жодної організації. " +
      "Введіть код запрошення, створіть компанію або зверніться " +
      "до власника кабінету вашої компанії.",
    inviteTitle: "У мене є код запрошення",
    inviteCode: "Код запрошення",
    inviteCodePlaceholder: "Код із листа або посилання",
    inviteSubmit: "Приєднатися",
    inviteSubmitting: "Перевіряємо…",
    createTitle: "Створити компанію",
    orgName: "Назва компанії",
    signupCode: "Код реєстрації",
    signupCodeHint: "Пілотний код — запитайте в нас, якщо його ще немає.",
    createSubmit: "Створити",
    createSubmitting: "Створюємо…"
  },

  profile: {
    title: "Профіль",
    identityTitle: "Особисті дані",
    securityTitle: "Пошта і пароль",
    save: "Зберегти",
    saving: "Зберігаємо…",
    saved: "Збережено.",
    nameTitle: "Ім’я",
    nameLabel: "Ім’я",
    nameNote:
      "Це ім’я бачите ви у своєму кабінеті. Роль та ім’я в команді " +
      "змінює власник кабінету.",
    photoTitle: "Фото",
    photoNote: "Фото зменшиться до 128 пікселів і з’явиться в меню кабінету.",
    photoUpload: "Завантажити фото",
    photoRemove: "Прибрати фото",
    photoSaved: "Фото оновлено.",
    photoRemoved: "Фото прибрано.",
    photoTooBig:
      "Фото вийшло надто важким навіть після стиснення — " +
      "виберіть простішу картинку.",
    photoBadFile: "Не вдалося прочитати файл — виберіть зображення (JPG або PNG).",
    emailTitle: "Пошта",
    emailCurrent: "Зараз:",
    emailLabel: "Нова пошта",
    emailNote:
      "Ми надішлемо листи-підтвердження на стару і нову пошту. " +
      "Зміна завершиться після підтвердження.",
    emailSent:
      "Листи надіслано — підтвердьте зміну за посиланнями на старій і новій пошті.",
    passwordTitle: "Пароль",
    passwordNote: "Пароль змінюється одразу, підтвердження поштою не потрібне."
  },

  errorScreen: {
    title: "Не вдалося завантажити кабінет"
  },

  nav: {
    dashboard: "Дашборд",
    calls: "Дзвінки",
    checklists: "Чеклісти",
    usage: "Використання",
    settings: "Налаштування",
    platform: "Платформа",
    profile: "Профіль"
  },

  shell: {
    orgLabel: "Організація"
  },

  roles: {
    owner: "Власник",
    admin: "Адміністратор",
    lead: "Керівник відділу",
    manager: "Менеджер",
    viewer: "Спостерігач"
  },

  statuses: {
    pending: "У черзі",
    transcribed: "Чекає на аналіз",
    analyzing: "Аналізуємо…",
    analyzed: "Розібраний",
    failed: "Помилка",
    awaitingRecording: "очікує на запис…",
    transcribedAnalyzing: "розшифрований, аналіз…"
  },

  directions: {
    inbound: "Вхідний",
    outbound: "Вихідний",
    unknown: "Напрямок невідомий"
  },

  severity: {
    low: "низька",
    medium: "середня",
    high: "висока"
  },

  dashboard: {
    title: "Дашборд",
    statAnalyzed: "Дзвінків розібрано",
    statAvgScore: "Середній бал",
    statNoNext: "Без наступного кроку",
    statQueued: "У черзі",
    statAvgDuration: "Сер. тривалість розмови",
    statScoreTrend: "Динаміка балу",
    trendVsPrev: "до минулого періоду",
    periods: {
      "7d": "7 днів",
      "30d": "30 днів",
      all: "Увесь час"
    },
    periodEmpty: "За вибраний період дзвінків немає — переключіть період або завантажте нові.",
    moneyTitle: "Гроші під ризиком",
    moneyCurrency: "грн",
    moneyApprox: "≈",
    moneyHighLabel: "Критичні витоки",
    moneyMediumLabel: "Середні витоки",
    moneyTimesHigh: "× 0,5",
    moneyTimesMedium: "× 0,25",
    moneyFormulaNote: "Оцінка: відкрита формула, не магія.",
    moneyFormula:
      "дзвінки з критичними витоками × середній чек × 0,5 + " +
      "дзвінки із середніми витоками × середній чек × 0,25",
    moneyNone: "У цьому періоді витоків із ризиком для угод не знайдено.",
    moneyNoAvg: "Вкажіть середній чек угоди — покажемо, скільки грошей під ризиком.",
    moneySetCta: "Вказати середній чек",
    moneyAskOwner: "Середній чек задає власник кабінету в налаштуваннях.",
    goldTitle: "Еталонні дзвінки",
    goldNote: "Найкращі дзвінки періоду — ставте їх команді за приклад.",
    goldFallbackNote: "Поки ніхто не набрав 85+ — показуємо три найкращі дзвінки періоду.",
    mvsTitle: "Маркетинг vs Продажі",
    mvsLeads: "Ліди (маркетинг)",
    mvsSales: "Продажі",
    mvsExplainer:
      "Ліворуч — частка дзвінків із нецільовими лідами (питання до маркетингу). " +
      "Праворуч — частка слабких дзвінків (бал нижче 70) за цільовими лідами " +
      "(питання до відділу продажів). Дзвінки без оцінки ліда не враховуються.",
    leaksTitle: "Де втрачаються гроші",
    leaksEmpty: "Витоків не знайдено. Розберіть більше дзвінків — картина стане точнішою.",
    managersTitle: "Менеджери",
    managersEmpty: "Поки немає розібраних дзвінків, закріплених за менеджерами.",
    recentTitle: "Останні дзвінки",
    recentAll: "Усі дзвінки",
    avgLabel: "середній бал",
    emptyTitle: "Завантажте перший дзвінок",
    emptyText:
      "Завантажте запис або вставте транскрипт розмови — за кілька хвилин " +
      "побачите бал, витоки виручки та конкретний план коучингу для менеджера.",
    emptyCta: "Новий дзвінок"
  },

  calls: {
    title: "Дзвінки",
    newCall: "Новий дзвінок",
    filterAll: "Усі",
    filterQueued: "У черзі",
    filterAnalyzed: "Розібрані",
    filterFailed: "З помилкою",
    thDate: "Дата",
    thClient: "Клієнт",
    thManager: "Менеджер",
    thDuration: "Тривалість",
    thScore: "Бал",
    empty: "Дзвінків поки немає. Почніть із кнопки «Новий дзвінок».",
    emptyFiltered: "Під цей фільтр дзвінків не потрапило.",
    unassigned: "Не призначено",
    noPhone: "без номера"
  },

  newCall: {
    title: "Новий дзвінок",
    explainer:
      "Сервіс сам розшифрує запис (українська/російська, розділення за ролями). " +
      "Якщо розшифровка вже є — вставте текст.",
    tabAudio: "Запис дзвінка",
    tabText: "Текст розшифровки",
    fileLabel: "Файл запису",
    filePick: "Вибрати файл",
    fileHint: "MP3, WAV, M4A або OGG, до 15 МБ.",
    fileNone: "Виберіть файл запису.",
    fileTooBig: "Файл більший за 15 МБ. Стисніть запис у MP3 або завантажте коротший фрагмент.",
    fileBadType: "Такий формат не підтримується — потрібен MP3, WAV, M4A або OGG.",
    mbUnit: "МБ",
    stageUpload: "Завантажуємо запис…",
    stageTranscribe: "Розшифровуємо…",
    stageAnalyze: "Аналізуємо…",
    audioWaitNote: "Зазвичай займає 1–3 хвилини, не закривайте вікно.",
    audioSubmit: "Розшифрувати та розібрати",
    transcript: "Транскрипт розмови",
    transcriptPlaceholder:
      "Менеджер: Доброго дня, компанія…\nКлієнт: Вітаю, мені потрібно…",
    transcriptHint: "Мінімум 40 символів — вставте повний текст розмови.",
    tooShort: "Занадто коротко: потрібен повний текст розмови, мінімум 40 символів.",
    direction: "Напрямок",
    manager: "Менеджер",
    unassigned: "Без менеджера",
    submit: "Розібрати дзвінок",
    submitting: "Аналізуємо…",
    waitNote: "Аналіз займає 5–15 секунд, не закривайте вікно.",
    failedTitle: "Аналіз не вдався",
    failedNote: "Дзвінок збережено, він видимий у списку зі статусом «Помилка».",
    openCall: "Відкрити дзвінок"
  },

  call: {
    back: "До списку дзвінків",
    scoreLabel: "бал дзвінка",
    summary: "Зведення",
    checklist: "Чек-лист",
    weight: "вага",
    leaks: "Витоки виручки",
    coaching: "Коучинг",
    nextStep: "Наступний крок",
    nextYes: "Зафіксований",
    nextNo: "Не зафіксований",
    transcript: "Транскрипт",
    reanalyze: "Розібрати заново",
    reanalyzing: "Аналізуємо…",
    reanalyzeConfirm:
      "Розібрати дзвінок заново? Поточний розбір буде замінено новим, це витратить токени.",
    notFound: "Дзвінок не знайдено або у вас немає до нього доступу.",
    pendingTitle: "Дзвінок ще не розібрано",
    pendingText: "Він у черзі на аналіз — оновіть сторінку за хвилину.",
    failedTitle: "Аналіз не вдався"
  },

  settings: {
    invite: {
      title: "Запросити за посиланням",
      hint: "Посилання прив’язане до пошти: увійти за ним зможе лише той, на кого воно виписане.",
      emailPlaceholder: "пошта@компанії.com",
      submit: "Створити посилання",
      copy: "Копіювати",
      copied: "Скопійовано",
      badEmail: "Вкажіть пошту запрошуваного.",
      expires: "Діє 14 днів, одноразове."
    },
    title: "Налаштування",

    aiKey: {
      title: "AI-ключ",
      intro:
        "Організація працює на власному ключі: ви платите провайдеру напряму, " +
        "ми не бачимо суму й не зберігаємо ключ у відкритому вигляді.",
      currentNone: "Ключ ще не додано.",
      currentLabel: "Зараз",
      keyWord: "ключ",
      lastOk: "перевірений",
      lastOkNever: "ще не перевірявся",
      lastErrorLabel: "остання помилка",
      provider: "Провайдер",
      model: "Модель",
      modelPlaceholder: "за замовчуванням",
      key: "API-ключ",
      keyPlaceholder: "Вставте ключ провайдера",
      save: "Зберегти ключ",
      saving: "Зберігаємо…",
      saved: "Ключ збережено:",
      warning:
        "На безкоштовному тарифі Google AI Studio дані можуть використовуватися " +
        "для навчання моделей — не завантажуйте чутливі дзвінки або " +
        "використовуйте платний тариф."
    },

    team: {
      title: "Команда",
      thName: "Ім’я",
      thRole: "Роль",
      thExtension: "Внутрішній номер",
      thStatus: "Статус",
      statusActive: "активний",
      statusSuspended: "вимкнений",
      noName: "Без імені",
      extPlaceholder: "напр. 102",
      extSave: "ОК",
      extConflict: "Цей внутрішній номер уже зайнято.",
      empty: "У команді поки нікого немає.",
      addTitle: "Додати співробітника",
      email: "Email",
      password: "Пароль",
      name: "Ім’я",
      role: "Роль",
      extension: "Внутрішній номер",
      submit: "Додати",
      submitting: "Додаємо…",
      added: "Співробітника додано."
    },

    telephony: {
      title: "Телефонія",
      intro:
        "Підключіть вашу АТС — дзвінки потраплятимуть у розбір автоматично, " +
        "без ручного завантаження.",
      hint: "Вставте цей URL у налаштування вебхуків вашої АТС.",
      copy: "Копіювати",
      copied: "Скопійовано",
      noEvents: "подій ще не було",
      lastEvent: "остання подія:",
      statusConnected: "підключена",
      statusSoon: "скоро",
      statusMigration: "чекає на міграцію",
      webhookLabel: "Webhook URL",
      credsTitle: "Дані підключення",
      credsConfigured:
        "Дані збережено. Значення не показуємо — введіть заново, щоб замінити.",
      credsNone: "Ключі ще не збережено.",
      credsNoFields: "Для підключення достатньо вебхука — окремі ключі не потрібні.",
      credsSave: "Зберегти дані",
      credsSaving: "Зберігаємо…",
      credsSaved: "Дані підключення збережено.",
      soonNote:
        "Підключення з’явиться після оновлення бази (міграція 0004). " +
        "Напишіть нам, якщо ця АТС потрібна раніше.",
      mappingFallback:
        "Відповідальний в АТС = внутрішній номер співробітника в розділі «Команда».",
      rotate: "Оновити адресу",
      rotateConfirm:
        "Оновити webhook-адресу? Старий адрес перестане працювати — доведеться прописати новий у кабінеті АТС.",
      rotating: "Оновлюємо…",
      rotated: "Готово. Новий шлях:",
      rotateHint:
        "Якщо старий URL міг витекти — оновіть його. Одразу після цього пропишіть новий у налаштуваннях вебхуків АТС.",
      kinds: {
        ringostat: "Ringostat",
        binotel: "Binotel"
      }
    },

    telegram: {
      title: "Telegram",
      intro:
        "Звіти в Telegram: розбір кожного дзвінка одразу після аналізу та " +
        "вечірній дайджест за підсумками дня. Вкажіть, у які чати що надсилати.",
      empty: "Отримувачів поки немає — додайте першого.",
      chatId: "Chat ID",
      chatIdPlaceholder: "123456789 або -1001234567890",
      labelField: "Підпис",
      labelPlaceholder: "напр. керівник Ольга",
      kindField: "Що надсилати",
      kinds: {
        per_call: "Розбір кожного дзвінка",
        daily: "Вечірній дайджест"
      },
      remove: "Прибрати",
      add: "Додати отримувача",
      maxNote: "Не більше 10 отримувачів.",
      save: "Зберегти",
      saving: "Зберігаємо…",
      saved: "Збережено.",
      badChatId:
        "Chat ID «{value}» не схожий на справжній: це число з 5–20 цифр, " +
        "у групових чатів зі знаком «мінус» на початку.",
      emptyChatId: "Заповніть chat ID у кожного отримувача або приберіть порожній рядок.",
      helpTitle: "Як дізнатися chat ID",
      helpPersonal:
        "Особистий чат: напишіть нашому боту будь-яке повідомлення (без цього " +
        "Telegram не дозволяє боту писати вам першим), потім запитайте свій " +
        "chat ID у @userinfobot — він надішле число.",
      helpGroup:
        "Спільний чат відділу: додайте бота в групу — chat ID групи починається " +
        "зі знака «мінус», його теж підкаже @userinfobot.",
      helpToken:
        "Токен бота зберігається на сервері; на пілоті бот спільний для всіх " +
        "організацій — окремо нічого налаштовувати не потрібно."
    },

    orgSettings: {
      title: "Параметри організації",
      avgDealLabel: "Середній чек угоди",
      avgDealHint:
        "Використовується в оцінці «Гроші під ризиком» на дашборді. Формула відкрита: " +
        "дзвінки з критичними витоками × 0,5 + із середніми × 0,25 від середнього чека.",
      avgDealPlaceholder: "напр. 25000",
      badAmount: "Введіть невід’ємне число.",
      save: "Зберегти",
      saving: "Зберігаємо…",
      saved: "Збережено.",
      migrationRequired: "Стане доступно після оновлення бази (міграція 0004)."
    }
  },

  // Manifest i18n subtree: dot-paths resolved by copyGet() against the manifest
  // labelKey/placeholderKey/titleKey/mappingHintKey. Values mirror the Russian
  // literals kept as fallbacks in saas/worker/telephony.js.
  providers: {
    ringostat: {
      title: "Ringostat",
      mappingHint:
        "Вихідні: співробітник визначається за staffid із вебхука — вкажіть його в полі «Внутрішній номер» учасника. Вхідні: додайте у вебхук параметр із внутрішнім номером того, хто відповів. Радимо також увімкнути у вебхук calldate_timestamp_micros — час дзвінка перестане залежати від часового поясу.",
      fields: {
        apiKey: {
          label: "API-ключ (необов’язково)",
          placeholder: "Потрібен лише для вивантаження через REST API"
        }
      }
    },
    binotel: {
      title: "Binotel",
      mappingHint:
        "Співробітник визначається за internalNumber із вебхука — вкажіть його в полі «Внутрішній номер» учасника. Під час переведень береться учасник historyData з disposition=ANSWER; запасний варіант — e-mail із employeeData.",
      fields: {
        apiKey: { label: "API-ключ", placeholder: "Видає support@binotel.ua" },
        apiSecret: { label: "API-секрет", placeholder: "Видає support@binotel.ua" }
      }
    },
    phonet: {
      title: "Phonet",
      mappingHint:
        "Співробітник визначається за внутрішнім номером (leg.ext, напр. «001») — вкажіть його в полі «Внутрішній номер» учасника. Для груп та IVR дивиться історія переведень; запасний варіант — e-mail співробітника з /rest/users.",
      fields: {
        accountDomain: { label: "Домен АТС", placeholder: "mycompany.phonet.com.ua" },
        apiKey: { label: "API-ключ", placeholder: "Ключ із кабінету Phonet" }
      }
    },
    unitalk: {
      title: "UniTalk (ex-Nextel)",
      mappingHint:
        "Вхідні: співробітник визначається за внутрішньою лінією з call.to — вкажіть її в полі «Внутрішній номер» учасника. Вихідні: лінія оператора очікується в call.from (не підтверджено документацією — перевірте на перших дзвінках).",
      fields: {
        apiKey: {
          label: "API-ключ (необов’язково)",
          placeholder: "Сторінка «API» в кабінеті UniTalk"
        }
      }
    },
    streamtele: {
      title: "Stream Telecom",
      mappingHint:
        "Вхідні: to = внутрішня лінія співробітника — вкажіть її в полі «Внутрішній номер» учасника. Вихідні: from = внутрішня лінія. Номери ліній — у «Адміністрування → Співробітники»; імені співробітника у вебхуку немає.",
      fields: {
        apiKey: { label: "API-ключ", placeholder: "crm.streamtele.com → Профіль компанії" }
      }
    }
  },

  checklists: {
    title: "Чеклісти оцінки",
    explainer: "Етапи та ваги, за якими AI оцінює дзвінок.",
    create: "Новий чекліст",
    thName: "Назва",
    thItems: "Пунктів",
    thWeight: "Сума ваг",
    thDefault: "За замовчуванням",
    defaultBadge: "за замовчуванням",
    makeDefault: "Зробити основним",
    edit: "Редагувати",
    remove: "Видалити",
    deleteConfirm: "Видалити цей чекліст? Дію не можна скасувати.",
    defaultLockHint: "Спочатку призначте основним інший чекліст.",
    itemsUnit: ["пункт", "пункти", "пунктів"],
    empty: "Чеклістів ще немає.",
    emptyHint: "Створіть перший чекліст — за ним AI оцінюватиме дзвінки.",
    loadError: "Не вдалося завантажити чеклісти.",
    unavailable: "Чеклісти стануть доступні після оновлення сервера.",
    editorNew: "Новий чекліст",
    editorEdit: "Редагування чекліста",
    nameLabel: "Назва чекліста",
    namePlaceholder: "напр. Вхідний дзвінок — продаж",
    itemsTitle: "Пункти оцінки",
    colKey: "Ключ",
    colLabel: "Пункт",
    colWeight: "Вага",
    colHint: "Підказка для AI",
    keyPlaceholder: "greeting",
    labelPlaceholder: "напр. Привітання та назвав ім’я",
    hintPlaceholder: "Що саме перевіряти в цьому пункті",
    addRow: "Додати пункт",
    weightSum: "Сума ваг: {sum} / 100",
    weightHelper: "Ваги мають у сумі давати рівно 100.",
    save: "Зберегти",
    saving: "Зберігаємо…",
    saved: "Збережено.",
    cancel: "Скасувати",
    needName: "Вкажіть назву чекліста.",
    needItems: "Додайте хоча б один пункт.",
    needWeight: "Сума ваг має дорівнювати 100."
  },

  usage: {
    title: "Використання",
    explainer: "Скільки дзвінків розібрано і скільки токенів витрачено за розрахунковими періодами.",
    currentPeriod: "Поточний період",
    statCalls: "Дзвінків розібрано",
    statTokensIn: "Токенів на вхід",
    statTokensOut: "Токенів на вихід",
    statCost: "Оцінка вартості",
    costFootnote:
      "Оцінка: приблизна вартість за усередненими тарифами. Реальний рахунок виставляє ваш AI-провайдер.",
    historyTitle: "Історія за 6 місяців",
    thPeriod: "Період",
    thCalls: "Дзвінки",
    thTokensIn: "Токени (вхід)",
    thTokensOut: "Токени (вихід)",
    thCost: "Оцінка вартості",
    empty: "Поки що немає даних про використання.",
    loadError: "Не вдалося завантажити статистику використання.",
    unavailable: "Статистика використання стане доступна після оновлення сервера."
  },

  platform: {
    title: "Платформа",
    subtitle: "Погляд суперадміністратора на всі організації. Тільки для читання.",
    godNote: "Режим суперадміністратора — лише перегляд.",
    totalsOrgs: "Організацій",
    totalsMembers: "Користувачів",
    totalsCalls: "Дзвінків",
    totalsAnalyses: "Аналізів",
    totalsTokens: "Токенів усього",
    thOrg: "Організація",
    thPlan: "Тариф",
    thMembers: "Користувачів",
    thCalls: "Дзвінків",
    thCreated: "Створена",
    open: "Відкрити",
    empty: "Організацій ще немає.",
    loadError: "Не вдалося завантажити дані платформи.",
    unavailable: "Панель платформи стане доступна після оновлення сервера.",
    backToList: "← До списку організацій",
    detailInfo: "Інформація",
    detailMembers: "Користувачі",
    detailUsage: "Використання",
    detailIntegrations: "Інтеграції",
    detailRecentCalls: "Останні дзвінки",
    infoPlan: "Тариф",
    infoCreated: "Створена",
    infoAvgDeal: "Середній чек",
    infoCalls: "Усього дзвінків",
    memName: "Ім’я",
    memRole: "Роль",
    memStatus: "Статус",
    intKind: "АТС",
    intStatus: "Статус",
    intEnabled: "увімкнена",
    intDisabled: "вимкнена",
    intLastEvent: "Остання подія",
    callDate: "Дата",
    callDirection: "Напрямок",
    callStatus: "Статус",
    callScore: "Бал",
    noMembers: "Користувачів немає.",
    noIntegrations: "Інтеграцій немає.",
    noCalls: "Дзвінків немає."
  },

  errors: {
    network: "Немає з’єднання із сервером. Перевірте інтернет і спробуйте ще раз.",
    unauthorized: "Сесія закінчилася — увійдіть заново.",
    forbidden: "Недостатньо прав для цієї дії.",
    not_found: "Не знайдено.",
    quota: "Місячну квоту аналізів вичерпано. Напишіть нам, щоб підняти ліміт.",
    no_ai_key: "AI-ключ не налаштовано. Власник кабінету може додати його в Налаштуваннях.",
    ai_key_missing: "AI-ключ не налаштовано. Власник кабінету може додати його в Налаштуваннях.",
    transcript_too_short: "Транскрипт закороткий для аналізу.",
    transcript_missing: "У дзвінка немає транскрипта.",
    migration_required: "Стане доступно після оновлення бази (міграція 0004).",
    payload_too_large: "Файл завеликий для завантаження — стисніть запис.",
    audio_too_large: "Файл завеликий для завантаження — стисніть запис.",
    bad_audio: "Не вдалося прочитати аудіофайл — перевірте формат запису.",
    bad_mime: "Такий формат не підтримується — потрібен MP3, WAV, M4A або OGG.",
    analysis_failed:
      "Розшифровка готова, але аналіз не вдався. Відкрийте дзвінок і запустіть розбір заново.",
    stt_failed:
      "Не вдалося розшифрувати запис. Спробуйте ще раз або вставте текст вручну.",
    transcription_failed:
      "Не вдалося розшифрувати запис. Спробуйте ще раз або вставте текст вручну.",
    bad_chat_id:
      "Неправильний chat ID — потрібне число з 5–20 цифр, у групових чатів " +
      "зі знаком «мінус» на початку.",
    bad_kind: "Неправильний тип звіту — виберіть значення зі списку.",
    bad_recipients:
      "Не вдалося прочитати список отримувачів — оновіть сторінку і спробуйте ще раз.",
    too_many_recipients: "Забагато отримувачів — не більше 10.",
    email_exists: "Такий email уже є.",
    conflict: "Такий запис уже існує.",
    invite_invalid: "Запрошення не знайдено, воно прострочене або виписане на іншу пошту.",
    already_member: "Ви вже перебуваєте в цій організації.",
    bad_signup_code: "Неправильний код реєстрації.",
    signup_closed: "Реєстрацію зараз закрито.",
    weak_password: "Пароль закороткий — мінімум 8 символів.",
    providerHttp: "Провайдер AI повернув помилку ({code}). Перевірте ключ і модель у Налаштуваннях.",
    generic: "Щось пішло не так{code}. Спробуйте ще раз."
  }
};

// ---------------------------------------------------------------------------
// ru — the original dictionary, strings kept as they were
// ---------------------------------------------------------------------------
const ru = {
  common: {
    appName: "CallControl AI",
    docTitle: "CallControl AI — кабинет",
    loading: "Загружаем…",
    retry: "Повторить",
    cancel: "Отмена",
    close: "Закрыть",
    signOut: "Выйти",
    language: "Язык",
    dash: "—",
    orgFallback: "Организация"
  },

  password: {
    title: "Сменить пароль",
    change: "Сменить пароль",
    newLabel: "Новый пароль",
    repeatLabel: "Ещё раз",
    submit: "Сохранить",
    done: "Пароль обновлён. При следующем входе используйте новый.",
    tooShort: "Минимум 8 символов.",
    mismatch: "Пароли не совпадают.",
    samePassword: "Новый пароль совпадает со старым."
  },

  plurals: {
    calls: ["звонок", "звонка", "звонков"]
  },

  login: {
    title: "Вход в кабинет",
    subtitle: "Контроль качества звонков отдела продаж",
    tabSignIn: "Войти",
    tabInvite: "По приглашению",
    tabRegister: "Новая компания",
    email: "Email",
    emailPlaceholder: "you@company.com",
    password: "Пароль",
    passwordHint: "Минимум 8 символов.",
    fullName: "Имя",
    fullNamePlaceholder: "Имя и фамилия",
    submit: "Войти",
    submitting: "Входим…",
    orDivider: "или",
    google: "Войти через Google",
    googleNotEnabled: "Вход через Google ещё не подключён.",
    errorInvalid: "Неверный email или пароль. Проверьте и попробуйте ещё раз.",
    errorGeneric: "Не получилось войти. Попробуйте ещё раз через минуту.",

    invite: {
      code: "Код приглашения",
      codePlaceholder: "Код из письма или ссылки",
      submit: "Присоединиться",
      submitting: "Проверяем…",
      invalid: "Приглашение не найдено, истекло или выписано на другую почту.",
      emailExists:
        "Аккаунт уже есть — войдите и введите код приглашения на экране «Нет доступа»."
    },

    register: {
      signupCode: "Код регистрации",
      signupCodeHint: "Пилотный код — запросите у нас, если его ещё нет.",
      orgName: "Название компании",
      orgNamePlaceholder: "ООО «Ромашка»",
      submit: "Создать компанию",
      submitting: "Создаём…",
      badCode: "Неверный код регистрации.",
      closed: "Регистрация сейчас закрыта.",
      emailExists:
        "Аккаунт с этой почтой уже есть — войдите и создайте компанию " +
        "на экране «Нет доступа».",
      rateLimited:
        "Почтовый лимит Supabase исчерпан — попробуйте через час. " +
        "(На пилоте письма шлёт встроенная почта с лимитом ~2 в час.)",
      confirmSent:
        "Компания создана. Мы отправили письмо для подтверждения почты — " +
        "перейдите по ссылке из него и войдите."
    }
  },

  join: {
    title: "Приглашение в организацию",
    checking: "Принимаем приглашение…",
    alreadyMember: "Вы уже состоите в этой организации.",
    open: "Открыть кабинет"
  },

  noAccess: {
    title: "Нет доступа",
    text:
      "Ваш аккаунт не привязан ни к одной организации. " +
      "Введите код приглашения, создайте компанию или обратитесь " +
      "к владельцу кабинета вашей компании.",
    inviteTitle: "У меня есть код приглашения",
    inviteCode: "Код приглашения",
    inviteCodePlaceholder: "Код из письма или ссылки",
    inviteSubmit: "Присоединиться",
    inviteSubmitting: "Проверяем…",
    createTitle: "Создать компанию",
    orgName: "Название компании",
    signupCode: "Код регистрации",
    signupCodeHint: "Пилотный код — запросите у нас, если его ещё нет.",
    createSubmit: "Создать",
    createSubmitting: "Создаём…"
  },

  profile: {
    title: "Профиль",
    identityTitle: "Личные данные",
    securityTitle: "Почта и пароль",
    save: "Сохранить",
    saving: "Сохраняем…",
    saved: "Сохранено.",
    nameTitle: "Имя",
    nameLabel: "Имя",
    nameNote:
      "Это имя видите вы в своём кабинете. Роль и имя в команде " +
      "меняет владелец кабинета.",
    photoTitle: "Фото",
    photoNote: "Фото уменьшится до 128 пикселей и появится в меню кабинета.",
    photoUpload: "Загрузить фото",
    photoRemove: "Убрать фото",
    photoSaved: "Фото обновлено.",
    photoRemoved: "Фото убрано.",
    photoTooBig:
      "Фото получилось слишком тяжёлым даже после сжатия — " +
      "выберите картинку попроще.",
    photoBadFile: "Не получилось прочитать файл — выберите изображение (JPG или PNG).",
    emailTitle: "Почта",
    emailCurrent: "Сейчас:",
    emailLabel: "Новая почта",
    emailNote:
      "Мы отправим письма-подтверждения на старую и новую почту. " +
      "Смена завершится после подтверждения.",
    emailSent:
      "Письма отправлены — подтвердите смену по ссылкам на старой и новой почте.",
    passwordTitle: "Пароль",
    passwordNote: "Пароль меняется сразу, подтверждение по почте не нужно."
  },

  errorScreen: {
    title: "Не удалось загрузить кабинет"
  },

  nav: {
    dashboard: "Дашборд",
    calls: "Звонки",
    checklists: "Чек-листы",
    usage: "Использование",
    settings: "Настройки",
    platform: "Платформа",
    profile: "Профиль"
  },

  shell: {
    orgLabel: "Организация"
  },

  roles: {
    owner: "Владелец",
    admin: "Администратор",
    lead: "РОП",
    manager: "Менеджер",
    viewer: "Наблюдатель"
  },

  statuses: {
    pending: "В очереди",
    transcribed: "Ждёт анализа",
    analyzing: "Анализируем…",
    analyzed: "Разобран",
    failed: "Ошибка",
    awaitingRecording: "ожидает записи…",
    transcribedAnalyzing: "расшифрован, анализ…"
  },

  directions: {
    inbound: "Входящий",
    outbound: "Исходящий",
    unknown: "Направление неизвестно"
  },

  severity: {
    low: "низкая",
    medium: "средняя",
    high: "высокая"
  },

  dashboard: {
    title: "Дашборд",
    statAnalyzed: "Звонков разобрано",
    statAvgScore: "Средний балл",
    statNoNext: "Без следующего шага",
    statQueued: "В очереди",
    statAvgDuration: "Ср. длительность разговора",
    statScoreTrend: "Динамика балла",
    trendVsPrev: "к прошлому периоду",
    periods: {
      "7d": "7 дней",
      "30d": "30 дней",
      all: "Всё время"
    },
    periodEmpty: "За выбранный период звонков нет — переключите период или загрузите новые.",
    moneyTitle: "Деньги под риском",
    moneyCurrency: "грн",
    moneyApprox: "≈",
    moneyHighLabel: "Критичные утечки",
    moneyMediumLabel: "Средние утечки",
    moneyTimesHigh: "× 0,5",
    moneyTimesMedium: "× 0,25",
    moneyFormulaNote: "Оценка: открытая формула, не магия.",
    moneyFormula:
      "звонки с критичными утечками × средний чек × 0,5 + " +
      "звонки со средними утечками × средний чек × 0,25",
    moneyNone: "В этом периоде утечек с риском для сделок не найдено.",
    moneyNoAvg: "Укажите средний чек сделки — покажем, сколько денег под риском.",
    moneySetCta: "Указать средний чек",
    moneyAskOwner: "Средний чек задаёт владелец кабинета в настройках.",
    goldTitle: "Эталонные звонки",
    goldNote: "Лучшие звонки периода — ставьте их команде в пример.",
    goldFallbackNote: "Пока никто не набрал 85+ — показываем три лучших звонка периода.",
    mvsTitle: "Маркетинг vs Продажи",
    mvsLeads: "Лиды (маркетинг)",
    mvsSales: "Продажи",
    mvsExplainer:
      "Слева — доля звонков с нецелевыми лидами (вопрос к маркетингу). " +
      "Справа — доля слабых звонков (балл ниже 70) по целевым лидам " +
      "(вопрос к отделу продаж). Звонки без оценки лида не участвуют.",
    leaksTitle: "Где теряются деньги",
    leaksEmpty: "Утечек не найдено. Разберите больше звонков — картина станет точнее.",
    managersTitle: "Менеджеры",
    managersEmpty: "Пока нет разобранных звонков, закреплённых за менеджерами.",
    recentTitle: "Последние звонки",
    recentAll: "Все звонки",
    avgLabel: "средний балл",
    emptyTitle: "Загрузите первый звонок",
    emptyText:
      "Загрузите запись или вставьте транскрипт разговора — через пару минут " +
      "увидите балл, утечки выручки и конкретный план коучинга для менеджера.",
    emptyCta: "Новый звонок"
  },

  calls: {
    title: "Звонки",
    newCall: "Новый звонок",
    filterAll: "Все",
    filterQueued: "В очереди",
    filterAnalyzed: "Разобранные",
    filterFailed: "С ошибкой",
    thDate: "Дата",
    thClient: "Клиент",
    thManager: "Менеджер",
    thDuration: "Длительность",
    thScore: "Балл",
    empty: "Звонков пока нет. Начните с кнопки «Новый звонок».",
    emptyFiltered: "Под этот фильтр звонков не попало.",
    unassigned: "Не назначен",
    noPhone: "без номера"
  },

  newCall: {
    title: "Новый звонок",
    explainer:
      "Сервис сам расшифрует запись (украинский/русский, разделение по ролям). " +
      "Если расшифровка уже есть — вставьте текст.",
    tabAudio: "Запись звонка",
    tabText: "Текст расшифровки",
    fileLabel: "Файл записи",
    filePick: "Выбрать файл",
    fileHint: "MP3, WAV, M4A или OGG, до 15 МБ.",
    fileNone: "Выберите файл записи.",
    fileTooBig: "Файл больше 15 МБ. Сожмите запись в MP3 или загрузите фрагмент короче.",
    fileBadType: "Такой формат не поддерживается — нужен MP3, WAV, M4A или OGG.",
    mbUnit: "МБ",
    stageUpload: "Загружаем запись…",
    stageTranscribe: "Расшифровываем…",
    stageAnalyze: "Анализируем…",
    audioWaitNote: "Обычно занимает 1–3 минуты, не закрывайте окно.",
    audioSubmit: "Расшифровать и разобрать",
    transcript: "Транскрипт разговора",
    transcriptPlaceholder:
      "Менеджер: Добрый день, компания…\nКлиент: Здравствуйте, мне нужно…",
    transcriptHint: "Минимум 40 символов — вставьте полный текст разговора.",
    tooShort: "Слишком коротко: нужен полный текст разговора, минимум 40 символов.",
    direction: "Направление",
    manager: "Менеджер",
    unassigned: "Без менеджера",
    submit: "Разобрать звонок",
    submitting: "Анализируем…",
    waitNote: "Анализ занимает 5–15 секунд, не закрывайте окно.",
    failedTitle: "Анализ не удался",
    failedNote: "Звонок сохранён и виден в списке со статусом «Ошибка».",
    openCall: "Открыть звонок"
  },

  call: {
    back: "К списку звонков",
    scoreLabel: "балл звонка",
    summary: "Сводка",
    checklist: "Чек-лист",
    weight: "вес",
    leaks: "Утечки выручки",
    coaching: "Коучинг",
    nextStep: "Следующий шаг",
    nextYes: "Зафиксирован",
    nextNo: "Не зафиксирован",
    transcript: "Транскрипт",
    reanalyze: "Разобрать заново",
    reanalyzing: "Анализируем…",
    reanalyzeConfirm:
      "Разобрать звонок заново? Текущий разбор будет заменён новым, это потратит токены.",
    notFound: "Звонок не найден или у вас нет к нему доступа.",
    pendingTitle: "Звонок ещё не разобран",
    pendingText: "Он в очереди на анализ — обновите страницу через минуту.",
    failedTitle: "Анализ не удался"
  },

  settings: {
    invite: {
      title: "Пригласить по ссылке",
      hint: "Ссылка привязана к почте: войти по ней сможет только тот, на кого выписана.",
      emailPlaceholder: "почта@компании.com",
      submit: "Создать ссылку",
      copy: "Копировать",
      copied: "Скопировано",
      badEmail: "Укажите почту приглашаемого.",
      expires: "Действует 14 дней, одноразовая."
    },
    title: "Настройки",

    aiKey: {
      title: "AI-ключ",
      intro:
        "Организация работает на собственном ключе: вы платите провайдеру напрямую, " +
        "мы не видим сумму и не храним ключ в открытом виде.",
      currentNone: "Ключ ещё не добавлен.",
      currentLabel: "Сейчас",
      keyWord: "ключ",
      lastOk: "проверен",
      lastOkNever: "ещё не проверялся",
      lastErrorLabel: "последняя ошибка",
      provider: "Провайдер",
      model: "Модель",
      modelPlaceholder: "по умолчанию",
      key: "API-ключ",
      keyPlaceholder: "Вставьте ключ провайдера",
      save: "Сохранить ключ",
      saving: "Сохраняем…",
      saved: "Ключ сохранён:",
      warning:
        "На бесплатном тарифе Google AI Studio данные могут использоваться для " +
        "обучения моделей — не включайте чувствительные звонки, либо используйте " +
        "платный тариф."
    },

    team: {
      title: "Команда",
      thName: "Имя",
      thRole: "Роль",
      thExtension: "Внутренний номер",
      thStatus: "Статус",
      statusActive: "активен",
      statusSuspended: "отключён",
      noName: "Без имени",
      extPlaceholder: "напр. 102",
      extSave: "ОК",
      extConflict: "Этот внутренний номер уже занят.",
      empty: "В команде пока никого нет.",
      addTitle: "Добавить сотрудника",
      email: "Email",
      password: "Пароль",
      name: "Имя",
      role: "Роль",
      extension: "Внутренний номер",
      submit: "Добавить",
      submitting: "Добавляем…",
      added: "Сотрудник добавлен."
    },

    telephony: {
      title: "Телефония",
      intro:
        "Подключите вашу АТС — звонки будут попадать в разбор автоматически, " +
        "без ручной загрузки.",
      hint: "Вставьте этот URL в настройки вебхуков вашей АТС.",
      copy: "Копировать",
      copied: "Скопировано",
      noEvents: "событий ещё не было",
      lastEvent: "последнее событие:",
      statusConnected: "подключена",
      statusSoon: "скоро",
      statusMigration: "ждёт миграции",
      webhookLabel: "Webhook URL",
      credsTitle: "Данные подключения",
      credsConfigured:
        "Данные сохранены. Значения не показываем — введите заново, чтобы заменить.",
      credsNone: "Ключи ещё не сохранены.",
      credsNoFields: "Для подключения достаточно вебхука — отдельные ключи не нужны.",
      credsSave: "Сохранить данные",
      credsSaving: "Сохраняем…",
      credsSaved: "Данные подключения сохранены.",
      soonNote:
        "Подключение появится после обновления базы (миграция 0004). " +
        "Напишите нам, если эта АТС нужна раньше.",
      mappingFallback:
        "Ответственный в АТС = внутренний номер сотрудника в разделе «Команда».",
      rotate: "Обновить адрес",
      rotateConfirm:
        "Обновить webhook-адрес? Старый адрес перестанет работать — придётся прописать новый в кабинете АТС.",
      rotating: "Обновляем…",
      rotated: "Готово. Новый путь:",
      rotateHint:
        "Если старый URL мог утечь — обновите его. Сразу после этого пропишите новый в настройках вебхуков АТС.",
      kinds: {
        ringostat: "Ringostat",
        binotel: "Binotel"
      }
    },

    telegram: {
      title: "Telegram",
      intro:
        "Отчёты в Telegram: разбор каждого звонка сразу после анализа и " +
        "вечерний дайджест по итогам дня. Укажите, в какие чаты что присылать.",
      empty: "Получателей пока нет — добавьте первого.",
      chatId: "Chat ID",
      chatIdPlaceholder: "123456789 или -1001234567890",
      labelField: "Подпись",
      labelPlaceholder: "напр. РОП Ольга",
      kindField: "Что присылать",
      kinds: {
        per_call: "Разбор каждого звонка",
        daily: "Вечерний дайджест"
      },
      remove: "Убрать",
      add: "Добавить получателя",
      maxNote: "Не больше 10 получателей.",
      save: "Сохранить",
      saving: "Сохраняем…",
      saved: "Сохранено.",
      badChatId:
        "Chat ID «{value}» не похож на настоящий: это число из 5–20 цифр, " +
        "у групповых чатов со знаком «минус» в начале.",
      emptyChatId: "Заполните chat ID у каждого получателя или уберите пустую строку.",
      helpTitle: "Как узнать chat ID",
      helpPersonal:
        "Личный чат: напишите нашему боту любое сообщение (без этого Telegram " +
        "не разрешает боту писать вам первым), затем спросите свой chat ID у " +
        "@userinfobot — он пришлёт число.",
      helpGroup:
        "Общий чат отдела: добавьте бота в группу — chat ID группы начинается " +
        "со знака «минус», его тоже подскажет @userinfobot.",
      helpToken:
        "Токен бота хранится на сервере; на пилоте бот общий для всех " +
        "организаций — отдельно ничего настраивать не нужно."
    },

    orgSettings: {
      title: "Параметры организации",
      avgDealLabel: "Средний чек сделки",
      avgDealHint:
        "Используется в оценке «Деньги под риском» на дашборде. Формула открытая: " +
        "звонки с критичными утечками × 0,5 + со средними × 0,25 от среднего чека.",
      avgDealPlaceholder: "напр. 25000",
      badAmount: "Введите неотрицательное число.",
      save: "Сохранить",
      saving: "Сохраняем…",
      saved: "Сохранено.",
      migrationRequired: "Станет доступно после обновления базы (миграция 0004)."
    }
  },

  // Manifest i18n subtree — the original Russian literals from
  // saas/worker/telephony.js, resolved by copyGet() from the manifest key-paths.
  providers: {
    ringostat: {
      title: "Ringostat",
      mappingHint:
        "Исходящие: сотрудник определяется по staffid из вебхука — укажите его в поле «Внутренний номер» участника. Входящие: добавьте в вебхук параметр с внутренним номером ответившего. Рекомендуем также включить в вебхук calldate_timestamp_micros — время звонка перестанет зависеть от часового пояса.",
      fields: {
        apiKey: {
          label: "API-ключ (необязательно)",
          placeholder: "Нужен только для выгрузки через REST API"
        }
      }
    },
    binotel: {
      title: "Binotel",
      mappingHint:
        "Сотрудник определяется по internalNumber из вебхука — укажите его в поле «Внутренний номер» участника. При переводах берётся участник historyData с disposition=ANSWER; запасной вариант — e-mail из employeeData.",
      fields: {
        apiKey: { label: "API-ключ", placeholder: "Выдаёт support@binotel.ua" },
        apiSecret: { label: "API-секрет", placeholder: "Выдаёт support@binotel.ua" }
      }
    },
    phonet: {
      title: "Phonet",
      mappingHint:
        "Сотрудник определяется по внутреннему номеру (leg.ext, напр. «001») — укажите его в поле «Внутренний номер» участника. Для групп и IVR смотрится история переводов; запасной вариант — e-mail сотрудника из /rest/users.",
      fields: {
        accountDomain: { label: "Домен АТС", placeholder: "mycompany.phonet.com.ua" },
        apiKey: { label: "API-ключ", placeholder: "Ключ из кабинета Phonet" }
      }
    },
    unitalk: {
      title: "UniTalk (ex-Nextel)",
      mappingHint:
        "Входящие: сотрудник определяется по внутренней линии из call.to — укажите её в поле «Внутренний номер» участника. Исходящие: линия оператора ожидается в call.from (не подтверждено документацией — проверьте на первых звонках).",
      fields: {
        apiKey: {
          label: "API-ключ (необязательно)",
          placeholder: "Страница «API» в кабинете UniTalk"
        }
      }
    },
    streamtele: {
      title: "Stream Telecom",
      mappingHint:
        "Входящие: to = внутренняя линия сотрудника — укажите её в поле «Внутренний номер» участника. Исходящие: from = внутренняя линия. Номера линий — в «Администрирование → Сотрудники»; имени сотрудника в вебхуке нет.",
      fields: {
        apiKey: { label: "API-ключ", placeholder: "crm.streamtele.com → Профиль компании" }
      }
    }
  },

  checklists: {
    title: "Чек-листы оценки",
    explainer: "Этапы и веса, по которым AI оценивает звонок.",
    create: "Новый чек-лист",
    thName: "Название",
    thItems: "Пунктов",
    thWeight: "Сумма весов",
    thDefault: "По умолчанию",
    defaultBadge: "по умолчанию",
    makeDefault: "Сделать основным",
    edit: "Редактировать",
    remove: "Удалить",
    deleteConfirm: "Удалить этот чек-лист? Действие необратимо.",
    defaultLockHint: "Сначала назначьте основным другой чек-лист.",
    itemsUnit: ["пункт", "пункта", "пунктов"],
    empty: "Чек-листов пока нет.",
    emptyHint: "Создайте первый чек-лист — по нему AI будет оценивать звонки.",
    loadError: "Не удалось загрузить чек-листы.",
    unavailable: "Чек-листы станут доступны после обновления сервера.",
    editorNew: "Новый чек-лист",
    editorEdit: "Редактирование чек-листа",
    nameLabel: "Название чек-листа",
    namePlaceholder: "напр. Входящий звонок — продажа",
    itemsTitle: "Пункты оценки",
    colKey: "Ключ",
    colLabel: "Пункт",
    colWeight: "Вес",
    colHint: "Подсказка для AI",
    keyPlaceholder: "greeting",
    labelPlaceholder: "напр. Поздоровался и назвал имя",
    hintPlaceholder: "Что именно проверять в этом пункте",
    addRow: "Добавить пункт",
    weightSum: "Сумма весов: {sum} / 100",
    weightHelper: "Веса должны в сумме давать ровно 100.",
    save: "Сохранить",
    saving: "Сохраняем…",
    saved: "Сохранено.",
    cancel: "Отмена",
    needName: "Укажите название чек-листа.",
    needItems: "Добавьте хотя бы один пункт.",
    needWeight: "Сумма весов должна равняться 100."
  },

  usage: {
    title: "Использование",
    explainer: "Сколько звонков разобрано и сколько токенов израсходовано по расчётным периодам.",
    currentPeriod: "Текущий период",
    statCalls: "Звонков разобрано",
    statTokensIn: "Токенов на вход",
    statTokensOut: "Токенов на выход",
    statCost: "Оценка стоимости",
    costFootnote:
      "Оценка: приблизительная стоимость по усреднённым тарифам. Реальный счёт выставляет ваш AI-провайдер.",
    historyTitle: "История за 6 месяцев",
    thPeriod: "Период",
    thCalls: "Звонки",
    thTokensIn: "Токены (вход)",
    thTokensOut: "Токены (выход)",
    thCost: "Оценка стоимости",
    empty: "Пока нет данных об использовании.",
    loadError: "Не удалось загрузить статистику использования.",
    unavailable: "Статистика использования станет доступна после обновления сервера."
  },

  platform: {
    title: "Платформа",
    subtitle: "Взгляд суперадминистратора на все организации. Только чтение.",
    godNote: "Режим суперадминистратора — только просмотр.",
    totalsOrgs: "Организаций",
    totalsMembers: "Пользователей",
    totalsCalls: "Звонков",
    totalsAnalyses: "Анализов",
    totalsTokens: "Токенов всего",
    thOrg: "Организация",
    thPlan: "Тариф",
    thMembers: "Пользователей",
    thCalls: "Звонков",
    thCreated: "Создана",
    open: "Открыть",
    empty: "Организаций пока нет.",
    loadError: "Не удалось загрузить данные платформы.",
    unavailable: "Панель платформы станет доступна после обновления сервера.",
    backToList: "← К списку организаций",
    detailInfo: "Информация",
    detailMembers: "Пользователи",
    detailUsage: "Использование",
    detailIntegrations: "Интеграции",
    detailRecentCalls: "Последние звонки",
    infoPlan: "Тариф",
    infoCreated: "Создана",
    infoAvgDeal: "Средний чек",
    infoCalls: "Всего звонков",
    memName: "Имя",
    memRole: "Роль",
    memStatus: "Статус",
    intKind: "АТС",
    intStatus: "Статус",
    intEnabled: "включена",
    intDisabled: "выключена",
    intLastEvent: "Последнее событие",
    callDate: "Дата",
    callDirection: "Направление",
    callStatus: "Статус",
    callScore: "Балл",
    noMembers: "Пользователей нет.",
    noIntegrations: "Интеграций нет.",
    noCalls: "Звонков нет."
  },

  // API / database error codes -> human text. Keys match what the Worker and
  // saas/worker/ai.js throw; anything unknown falls through to `generic`.
  errors: {
    network: "Нет соединения с сервером. Проверьте интернет и попробуйте ещё раз.",
    unauthorized: "Сессия истекла — войдите заново.",
    forbidden: "Недостаточно прав для этого действия.",
    not_found: "Не найдено.",
    quota: "Месячная квота анализов исчерпана. Напишите нам, чтобы поднять лимит.",
    no_ai_key: "AI-ключ не настроен. Владелец кабинета может добавить его в Настройках.",
    ai_key_missing: "AI-ключ не настроен. Владелец кабинета может добавить его в Настройках.",
    transcript_too_short: "Транскрипт слишком короткий для анализа.",
    transcript_missing: "У звонка нет транскрипта.",
    migration_required: "Станет доступно после обновления базы (миграция 0004).",
    payload_too_large: "Файл слишком большой для загрузки — сожмите запись.",
    audio_too_large: "Файл слишком большой для загрузки — сожмите запись.",
    bad_audio: "Не получилось прочитать аудиофайл — проверьте формат записи.",
    bad_mime: "Такой формат не поддерживается — нужен MP3, WAV, M4A или OGG.",
    analysis_failed:
      "Расшифровка готова, но анализ не удался. Откройте звонок и запустите разбор заново.",
    stt_failed:
      "Не получилось расшифровать запись. Попробуйте ещё раз или вставьте текст вручную.",
    transcription_failed:
      "Не получилось расшифровать запись. Попробуйте ещё раз или вставьте текст вручную.",
    bad_chat_id:
      "Неверный chat ID — нужно число из 5–20 цифр, у групповых чатов " +
      "со знаком «минус» в начале.",
    bad_kind: "Неверный тип отчёта — выберите значение из списка.",
    bad_recipients:
      "Не получилось прочитать список получателей — обновите страницу и попробуйте ещё раз.",
    too_many_recipients: "Слишком много получателей — не больше 10.",
    email_exists: "Такой email уже есть.",
    conflict: "Такая запись уже существует.",
    invite_invalid: "Приглашение не найдено, истекло или выписано на другую почту.",
    already_member: "Вы уже состоите в этой организации.",
    bad_signup_code: "Неверный код регистрации.",
    signup_closed: "Регистрация сейчас закрыта.",
    weak_password: "Пароль слишком короткий — минимум 8 символов.",
    providerHttp: "Провайдер AI вернул ошибку ({code}). Проверьте ключ и модель в Настройках.",
    generic: "Что-то пошло не так{code}. Попробуйте ещё раз."
  }
};

// ---------------------------------------------------------------------------
// en — business English
// ---------------------------------------------------------------------------
const en = {
  common: {
    appName: "CallControl AI",
    docTitle: "CallControl AI — Workspace",
    loading: "Loading…",
    retry: "Retry",
    cancel: "Cancel",
    close: "Close",
    signOut: "Sign out",
    language: "Language",
    dash: "—",
    orgFallback: "Organization"
  },

  password: {
    title: "Change password",
    change: "Change password",
    newLabel: "New password",
    repeatLabel: "Repeat password",
    submit: "Save",
    done: "Password updated. Use the new one next time you sign in.",
    tooShort: "At least 8 characters.",
    mismatch: "Passwords do not match.",
    samePassword: "The new password matches the old one."
  },

  plurals: {
    calls: ["call", "calls"]
  },

  login: {
    title: "Sign in",
    subtitle: "Sales call quality control",
    tabSignIn: "Sign in",
    tabInvite: "With an invite",
    tabRegister: "New company",
    email: "Email",
    emailPlaceholder: "you@company.com",
    password: "Password",
    passwordHint: "At least 8 characters.",
    fullName: "Name",
    fullNamePlaceholder: "First and last name",
    submit: "Sign in",
    submitting: "Signing in…",
    orDivider: "or",
    google: "Sign in with Google",
    googleNotEnabled: "Google sign-in is not enabled yet.",
    errorInvalid: "Wrong email or password. Check and try again.",
    errorGeneric: "Could not sign in. Try again in a minute.",

    invite: {
      code: "Invite code",
      codePlaceholder: "Code from the email or link",
      submit: "Join",
      submitting: "Checking…",
      invalid: "The invite was not found, has expired, or was issued for a different email.",
      emailExists:
        "This account already exists — sign in and enter the invite code on the “No access” screen."
    },

    register: {
      signupCode: "Signup code",
      signupCodeHint: "Pilot code — ask us for one if you don't have it yet.",
      orgName: "Company name",
      orgNamePlaceholder: "Acme LLC",
      submit: "Create company",
      submitting: "Creating…",
      badCode: "Invalid signup code.",
      closed: "Registration is currently closed.",
      emailExists:
        "An account with this email already exists — sign in and create " +
        "the company on the “No access” screen.",
      rateLimited:
        "The Supabase email limit is exhausted — try again in an hour. " +
        "(During the pilot, emails go through the built-in mailer, ~2 per hour.)",
      confirmSent:
        "Company created. We sent a confirmation email — " +
        "follow the link in it and sign in."
    }
  },

  join: {
    title: "Organization invite",
    checking: "Accepting the invite…",
    alreadyMember: "You are already a member of this organization.",
    open: "Open the workspace"
  },

  noAccess: {
    title: "No access",
    text:
      "Your account is not linked to any organization. " +
      "Enter an invite code, create a company, or contact " +
      "your company's workspace owner.",
    inviteTitle: "I have an invite code",
    inviteCode: "Invite code",
    inviteCodePlaceholder: "Code from the email or link",
    inviteSubmit: "Join",
    inviteSubmitting: "Checking…",
    createTitle: "Create a company",
    orgName: "Company name",
    signupCode: "Signup code",
    signupCodeHint: "Pilot code — ask us for one if you don't have it yet.",
    createSubmit: "Create",
    createSubmitting: "Creating…"
  },

  profile: {
    title: "Profile",
    identityTitle: "Personal details",
    securityTitle: "Email and password",
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    nameTitle: "Name",
    nameLabel: "Name",
    nameNote:
      "This is the name you see in your own workspace. Your team role " +
      "and name are managed by the workspace owner.",
    photoTitle: "Photo",
    photoNote: "The photo is resized to 128 pixels and appears in the workspace menu.",
    photoUpload: "Upload photo",
    photoRemove: "Remove photo",
    photoSaved: "Photo updated.",
    photoRemoved: "Photo removed.",
    photoTooBig:
      "The photo is too heavy even after compression — pick a simpler image.",
    photoBadFile: "Could not read the file — pick an image (JPG or PNG).",
    emailTitle: "Email",
    emailCurrent: "Current:",
    emailLabel: "New email",
    emailNote:
      "We will send confirmation emails to both the old and the new address. " +
      "The change completes after confirmation.",
    emailSent:
      "Emails sent — confirm the change via the links sent to the old and new address.",
    passwordTitle: "Password",
    passwordNote: "The password changes immediately, no email confirmation needed."
  },

  errorScreen: {
    title: "Could not load the workspace"
  },

  nav: {
    dashboard: "Dashboard",
    calls: "Calls",
    checklists: "Checklists",
    usage: "Usage",
    settings: "Settings",
    platform: "Platform",
    profile: "Profile"
  },

  shell: {
    orgLabel: "Organization"
  },

  roles: {
    owner: "Owner",
    admin: "Administrator",
    lead: "Sales lead",
    manager: "Manager",
    viewer: "Viewer"
  },

  statuses: {
    pending: "Queued",
    transcribed: "Awaiting analysis",
    analyzing: "Analyzing…",
    analyzed: "Analyzed",
    failed: "Failed",
    awaitingRecording: "awaiting recording…",
    transcribedAnalyzing: "transcribed, analyzing…"
  },

  directions: {
    inbound: "Inbound",
    outbound: "Outbound",
    unknown: "Unknown direction"
  },

  severity: {
    low: "low",
    medium: "medium",
    high: "high"
  },

  dashboard: {
    title: "Dashboard",
    statAnalyzed: "Calls analyzed",
    statAvgScore: "Average score",
    statNoNext: "No next step",
    statQueued: "Queued",
    statAvgDuration: "Avg. call duration",
    statScoreTrend: "Score trend",
    trendVsPrev: "vs previous period",
    periods: {
      "7d": "7 days",
      "30d": "30 days",
      all: "All time"
    },
    periodEmpty: "No calls in the selected period — switch the period or upload new ones.",
    moneyTitle: "Money at risk",
    moneyCurrency: "UAH",
    moneyApprox: "≈",
    moneyHighLabel: "Critical leaks",
    moneyMediumLabel: "Medium leaks",
    moneyTimesHigh: "× 0.5",
    moneyTimesMedium: "× 0.25",
    moneyFormulaNote: "An estimate with an open formula, not magic.",
    moneyFormula:
      "calls with critical leaks × average deal × 0.5 + " +
      "calls with medium leaks × average deal × 0.25",
    moneyNone: "No deal-threatening leaks found in this period.",
    moneyNoAvg: "Set the average deal amount — we'll show how much money is at risk.",
    moneySetCta: "Set average deal",
    moneyAskOwner: "The average deal amount is set by the workspace owner in Settings.",
    goldTitle: "Reference calls",
    goldNote: "The period's best calls — hold them up as the example for your team.",
    goldFallbackNote: "Nobody has hit 85+ yet — showing the period's top three calls.",
    mvsTitle: "Marketing vs Sales",
    mvsLeads: "Leads (marketing)",
    mvsSales: "Sales",
    mvsExplainer:
      "Left — the share of calls with unqualified leads (a marketing question). " +
      "Right — the share of weak calls (score below 70) on qualified leads " +
      "(a sales question). Calls without a lead grade are not counted.",
    leaksTitle: "Where money is lost",
    leaksEmpty: "No leaks found. Analyze more calls for a sharper picture.",
    managersTitle: "Managers",
    managersEmpty: "No analyzed calls assigned to managers yet.",
    recentTitle: "Recent calls",
    recentAll: "All calls",
    avgLabel: "average score",
    emptyTitle: "Upload your first call",
    emptyText:
      "Upload a recording or paste a call transcript — in a couple of minutes " +
      "you'll see the score, revenue leaks, and a concrete coaching plan for the manager.",
    emptyCta: "New call"
  },

  calls: {
    title: "Calls",
    newCall: "New call",
    filterAll: "All",
    filterQueued: "Queued",
    filterAnalyzed: "Analyzed",
    filterFailed: "Failed",
    thDate: "Date",
    thClient: "Client",
    thManager: "Manager",
    thDuration: "Duration",
    thScore: "Score",
    empty: "No calls yet. Start with the “New call” button.",
    emptyFiltered: "No calls match this filter.",
    unassigned: "Unassigned",
    noPhone: "no number"
  },

  newCall: {
    title: "New call",
    explainer:
      "The service transcribes the recording itself (Ukrainian/Russian, " +
      "speaker separation). If you already have a transcript — paste the text.",
    tabAudio: "Call recording",
    tabText: "Transcript text",
    fileLabel: "Recording file",
    filePick: "Choose file",
    fileHint: "MP3, WAV, M4A, or OGG, up to 15 MB.",
    fileNone: "Choose a recording file.",
    fileTooBig: "The file is over 15 MB. Compress the recording to MP3 or upload a shorter fragment.",
    fileBadType: "This format is not supported — use MP3, WAV, M4A, or OGG.",
    mbUnit: "MB",
    stageUpload: "Uploading the recording…",
    stageTranscribe: "Transcribing…",
    stageAnalyze: "Analyzing…",
    audioWaitNote: "Usually takes 1–3 minutes, keep this window open.",
    audioSubmit: "Transcribe and analyze",
    transcript: "Call transcript",
    transcriptPlaceholder:
      "Manager: Good afternoon, this is…\nClient: Hello, I need…",
    transcriptHint: "At least 40 characters — paste the full conversation.",
    tooShort: "Too short: the full conversation text is required, at least 40 characters.",
    direction: "Direction",
    manager: "Manager",
    unassigned: "No manager",
    submit: "Analyze call",
    submitting: "Analyzing…",
    waitNote: "Analysis takes 5–15 seconds, keep this window open.",
    failedTitle: "Analysis failed",
    failedNote: "The call is saved and visible in the list with the “Failed” status.",
    openCall: "Open call"
  },

  call: {
    back: "Back to calls",
    scoreLabel: "call score",
    summary: "Summary",
    checklist: "Checklist",
    weight: "weight",
    leaks: "Revenue leaks",
    coaching: "Coaching",
    nextStep: "Next step",
    nextYes: "Secured",
    nextNo: "Not secured",
    transcript: "Transcript",
    reanalyze: "Re-analyze",
    reanalyzing: "Analyzing…",
    reanalyzeConfirm:
      "Re-analyze this call? The current analysis will be replaced, and this will spend tokens.",
    notFound: "The call was not found, or you don't have access to it.",
    pendingTitle: "The call is not analyzed yet",
    pendingText: "It is queued for analysis — refresh the page in a minute.",
    failedTitle: "Analysis failed"
  },

  settings: {
    invite: {
      title: "Invite by link",
      hint: "The link is tied to the email: only the person it was issued for can sign in with it.",
      emailPlaceholder: "email@company.com",
      submit: "Create link",
      copy: "Copy",
      copied: "Copied",
      badEmail: "Enter the invitee's email.",
      expires: "Valid for 14 days, single-use."
    },
    title: "Settings",

    aiKey: {
      title: "AI key",
      intro:
        "The organization runs on its own key: you pay the provider directly, " +
        "we don't see the amount and never store the key in plain text.",
      currentNone: "No key added yet.",
      currentLabel: "Current",
      keyWord: "key",
      lastOk: "verified",
      lastOkNever: "not verified yet",
      lastErrorLabel: "last error",
      provider: "Provider",
      model: "Model",
      modelPlaceholder: "default",
      key: "API key",
      keyPlaceholder: "Paste the provider key",
      save: "Save key",
      saving: "Saving…",
      saved: "Key saved:",
      warning:
        "On the free Google AI Studio tier your data may be used for model " +
        "training — don't upload sensitive calls, or use a paid tier."
    },

    team: {
      title: "Team",
      thName: "Name",
      thRole: "Role",
      thExtension: "Extension",
      thStatus: "Status",
      statusActive: "active",
      statusSuspended: "suspended",
      noName: "No name",
      extPlaceholder: "e.g. 102",
      extSave: "OK",
      extConflict: "This extension is already taken.",
      empty: "Nobody on the team yet.",
      addTitle: "Add a team member",
      email: "Email",
      password: "Password",
      name: "Name",
      role: "Role",
      extension: "Extension",
      submit: "Add",
      submitting: "Adding…",
      added: "Team member added."
    },

    telephony: {
      title: "Telephony",
      intro:
        "Connect your PBX — calls will land in analysis automatically, " +
        "with no manual uploads.",
      hint: "Paste this URL into your PBX webhook settings.",
      copy: "Copy",
      copied: "Copied",
      noEvents: "no events yet",
      lastEvent: "last event:",
      statusConnected: "connected",
      statusSoon: "soon",
      statusMigration: "awaiting migration",
      webhookLabel: "Webhook URL",
      credsTitle: "Connection credentials",
      credsConfigured:
        "Credentials saved. Values are hidden — enter them again to replace.",
      credsNone: "No keys saved yet.",
      credsNoFields: "The webhook is enough for this connection — no separate keys needed.",
      credsSave: "Save credentials",
      credsSaving: "Saving…",
      credsSaved: "Connection credentials saved.",
      soonNote:
        "This connection becomes available after the database update " +
        "(migration 0004). Contact us if you need this PBX sooner.",
      mappingFallback:
        "The responsible person in the PBX = the employee's extension in the “Team” section.",
      rotate: "Rotate URL",
      rotateConfirm:
        "Rotate the webhook URL? The old address will stop working — you'll need to set the new one in the PBX cabinet.",
      rotating: "Rotating…",
      rotated: "Done. New path:",
      rotateHint:
        "If the old URL might have leaked, rotate it. Right after, set the new one in your PBX webhook settings.",
      kinds: {
        ringostat: "Ringostat",
        binotel: "Binotel"
      }
    },

    telegram: {
      title: "Telegram",
      intro:
        "Telegram reports: a breakdown of every call right after analysis and " +
        "an evening digest at the end of the day. Choose which chats get what.",
      empty: "No recipients yet — add the first one.",
      chatId: "Chat ID",
      chatIdPlaceholder: "123456789 or -1001234567890",
      labelField: "Label",
      labelPlaceholder: "e.g. Sales lead Olha",
      kindField: "What to send",
      kinds: {
        per_call: "Every call breakdown",
        daily: "Evening digest"
      },
      remove: "Remove",
      add: "Add recipient",
      maxNote: "No more than 10 recipients.",
      save: "Save",
      saving: "Saving…",
      saved: "Saved.",
      badChatId:
        "Chat ID “{value}” doesn't look real: it's a 5–20 digit number, " +
        "with a leading minus for group chats.",
      emptyChatId: "Fill in the chat ID for every recipient or remove the empty row.",
      helpTitle: "How to find a chat ID",
      helpPersonal:
        "Personal chat: send our bot any message first (without it Telegram " +
        "won't let the bot message you), then ask @userinfobot for your " +
        "chat ID — it replies with the number.",
      helpGroup:
        "Team group chat: add the bot to the group — the group's chat ID " +
        "starts with a minus; @userinfobot will tell you this one too.",
      helpToken:
        "The bot token lives on the server; during the pilot one bot is " +
        "shared by all organizations — nothing extra to configure."
    },

    orgSettings: {
      title: "Organization parameters",
      avgDealLabel: "Average deal amount",
      avgDealHint:
        "Used in the “Money at risk” estimate on the dashboard. The formula is open: " +
        "calls with critical leaks × 0.5 + medium × 0.25 of the average deal.",
      avgDealPlaceholder: "e.g. 25000",
      badAmount: "Enter a non-negative number.",
      save: "Save",
      saving: "Saving…",
      saved: "Saved.",
      migrationRequired: "Available after the database update (migration 0004)."
    }
  },

  // Manifest i18n subtree in business English, resolved by copyGet() from the
  // manifest key-paths; the Russian manifest literals stay as fallbacks.
  providers: {
    ringostat: {
      title: "Ringostat",
      mappingHint:
        "Outbound: the employee is resolved by the webhook's staffid — set it as the member's “Extension”. Inbound: add the answering agent's extension to the webhook. We also recommend enabling calldate_timestamp_micros in the webhook so call time no longer depends on the time zone.",
      fields: {
        apiKey: {
          label: "API key (optional)",
          placeholder: "Only needed for REST API pulls"
        }
      }
    },
    binotel: {
      title: "Binotel",
      mappingHint:
        "The employee is resolved by the webhook's internalNumber — set it as the member's “Extension”. On transfers the historyData participant with disposition=ANSWER is used; the fallback is the email from employeeData.",
      fields: {
        apiKey: { label: "API key", placeholder: "Issued by support@binotel.ua" },
        apiSecret: { label: "API secret", placeholder: "Issued by support@binotel.ua" }
      }
    },
    phonet: {
      title: "Phonet",
      mappingHint:
        "The employee is resolved by the extension (leg.ext, e.g. “001”) — set it as the member's “Extension”. For groups and IVR the transfer history is used; the fallback is the employee email from /rest/users.",
      fields: {
        accountDomain: { label: "PBX domain", placeholder: "mycompany.phonet.com.ua" },
        apiKey: { label: "API key", placeholder: "Key from the Phonet cabinet" }
      }
    },
    unitalk: {
      title: "UniTalk (ex-Nextel)",
      mappingHint:
        "Inbound: the employee is resolved by the internal line in call.to — set it as the member's “Extension”. Outbound: the operator's line is expected in call.from (not confirmed by the docs — verify on the first calls).",
      fields: {
        apiKey: {
          label: "API key (optional)",
          placeholder: "The “API” page in the UniTalk cabinet"
        }
      }
    },
    streamtele: {
      title: "Stream Telecom",
      mappingHint:
        "Inbound: to = the employee's internal line — set it as the member's “Extension”. Outbound: from = the internal line. Line numbers are under “Administration → Employees”; the webhook carries no employee name.",
      fields: {
        apiKey: { label: "API key", placeholder: "crm.streamtele.com → Company profile" }
      }
    }
  },

  checklists: {
    title: "Scoring checklists",
    explainer: "The stages and weights the AI uses to score a call.",
    create: "New checklist",
    thName: "Name",
    thItems: "Items",
    thWeight: "Weight sum",
    thDefault: "Default",
    defaultBadge: "default",
    makeDefault: "Make default",
    edit: "Edit",
    remove: "Delete",
    deleteConfirm: "Delete this checklist? This cannot be undone.",
    defaultLockHint: "Make another checklist the default first.",
    itemsUnit: ["item", "items"],
    empty: "No checklists yet.",
    emptyHint: "Create the first checklist — the AI will score calls against it.",
    loadError: "Could not load checklists.",
    unavailable: "Checklists become available after the server update.",
    editorNew: "New checklist",
    editorEdit: "Edit checklist",
    nameLabel: "Checklist name",
    namePlaceholder: "e.g. Inbound call — sales",
    itemsTitle: "Scoring items",
    colKey: "Key",
    colLabel: "Item",
    colWeight: "Weight",
    colHint: "AI hint",
    keyPlaceholder: "greeting",
    labelPlaceholder: "e.g. Greeted and gave their name",
    hintPlaceholder: "What exactly to check for this item",
    addRow: "Add item",
    weightSum: "Weight sum: {sum} / 100",
    weightHelper: "Weights must add up to exactly 100.",
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    cancel: "Cancel",
    needName: "Enter a checklist name.",
    needItems: "Add at least one item.",
    needWeight: "Weights must add up to 100."
  },

  usage: {
    title: "Usage",
    explainer: "How many calls were analyzed and how many tokens were spent per billing period.",
    currentPeriod: "Current period",
    statCalls: "Calls analyzed",
    statTokensIn: "Input tokens",
    statTokensOut: "Output tokens",
    statCost: "Cost estimate",
    costFootnote:
      "Estimate: approximate cost at average rates. Your AI provider issues the actual bill.",
    historyTitle: "6-month history",
    thPeriod: "Period",
    thCalls: "Calls",
    thTokensIn: "Tokens (in)",
    thTokensOut: "Tokens (out)",
    thCost: "Cost estimate",
    empty: "No usage data yet.",
    loadError: "Could not load usage statistics.",
    unavailable: "Usage statistics become available after the server update."
  },

  platform: {
    title: "Platform",
    subtitle: "A super-admin view of every organization. Read-only.",
    godNote: "Super-admin mode — read-only.",
    totalsOrgs: "Organizations",
    totalsMembers: "Users",
    totalsCalls: "Calls",
    totalsAnalyses: "Analyses",
    totalsTokens: "Total tokens",
    thOrg: "Organization",
    thPlan: "Plan",
    thMembers: "Users",
    thCalls: "Calls",
    thCreated: "Created",
    open: "Open",
    empty: "No organizations yet.",
    loadError: "Could not load platform data.",
    unavailable: "The platform panel becomes available after the server update.",
    backToList: "← Back to organizations",
    detailInfo: "Info",
    detailMembers: "Users",
    detailUsage: "Usage",
    detailIntegrations: "Integrations",
    detailRecentCalls: "Recent calls",
    infoPlan: "Plan",
    infoCreated: "Created",
    infoAvgDeal: "Average deal",
    infoCalls: "Total calls",
    memName: "Name",
    memRole: "Role",
    memStatus: "Status",
    intKind: "PBX",
    intStatus: "Status",
    intEnabled: "enabled",
    intDisabled: "disabled",
    intLastEvent: "Last event",
    callDate: "Date",
    callDirection: "Direction",
    callStatus: "Status",
    callScore: "Score",
    noMembers: "No users.",
    noIntegrations: "No integrations.",
    noCalls: "No calls."
  },

  errors: {
    network: "No connection to the server. Check your internet and try again.",
    unauthorized: "The session has expired — sign in again.",
    forbidden: "You don't have permission for this action.",
    not_found: "Not found.",
    quota: "The monthly analysis quota is exhausted. Contact us to raise the limit.",
    no_ai_key: "The AI key is not configured. The workspace owner can add it in Settings.",
    ai_key_missing: "The AI key is not configured. The workspace owner can add it in Settings.",
    transcript_too_short: "The transcript is too short to analyze.",
    transcript_missing: "This call has no transcript.",
    migration_required: "Available after the database update (migration 0004).",
    payload_too_large: "The file is too large to upload — compress the recording.",
    audio_too_large: "The file is too large to upload — compress the recording.",
    bad_audio: "Could not read the audio file — check the recording format.",
    bad_mime: "This format is not supported — use MP3, WAV, M4A, or OGG.",
    analysis_failed:
      "The transcript is ready, but the analysis failed. Open the call and run the analysis again.",
    stt_failed:
      "Could not transcribe the recording. Try again or paste the text manually.",
    transcription_failed:
      "Could not transcribe the recording. Try again or paste the text manually.",
    bad_chat_id:
      "Invalid chat ID — it must be a 5–20 digit number, " +
      "with a leading minus for group chats.",
    bad_kind: "Invalid report type — pick a value from the list.",
    bad_recipients:
      "Could not read the recipient list — refresh the page and try again.",
    too_many_recipients: "Too many recipients — no more than 10.",
    email_exists: "This email is already registered.",
    conflict: "This record already exists.",
    invite_invalid: "The invite was not found, has expired, or was issued for a different email.",
    already_member: "You are already a member of this organization.",
    bad_signup_code: "Invalid signup code.",
    signup_closed: "Registration is currently closed.",
    weak_password: "The password is too short — at least 8 characters.",
    providerHttp: "The AI provider returned an error ({code}). Check the key and model in Settings.",
    generic: "Something went wrong{code}. Please try again."
  }
};

// ---------------------------------------------------------------------------
// Locale state: module-level current locale + a tiny subscription store.
// ---------------------------------------------------------------------------
const DICTS = { uk, ru, en };

function readStoredLocale() {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return LOCALES.includes(v) ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE; // storage blocked (private mode) — default silently
  }
}

let currentLocale = readStoredLocale();
const listeners = new Set();

export function getLocale() {
  return currentLocale;
}

export function setLocale(next) {
  if (!LOCALES.includes(next) || next === currentLocale) return;
  currentLocale = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // best effort only
  }
  applyDocumentLocale();
  listeners.forEach((fn) => fn());
}

// Subscription primitive shaped for useSyncExternalStore (see hooks.js
// useLocale): returns the unsubscribe function.
export function subscribeLocale(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Keep <html lang> and the document title in the active locale (index.html
// ships static uk-agnostic values; this wins as soon as the bundle boots).
function applyDocumentLocale() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = currentLocale;
  document.title = DICTS[currentLocale].common.docTitle;
}
applyDocumentLocale();

// The live dictionary: property reads resolve against the current locale at
// access time, so `copy.section.key` inside a render always returns the
// active language. Only the FIRST level is proxied — each `copy.section` is
// the plain object of the current dictionary.
export const copy = new Proxy(
  {},
  {
    get(_target, prop) {
      return DICTS[currentLocale][prop];
    },
    has(_target, prop) {
      return prop in DICTS[currentLocale];
    },
    ownKeys() {
      return Reflect.ownKeys(DICTS[currentLocale]);
    },
    getOwnPropertyDescriptor(_target, prop) {
      const desc = Object.getOwnPropertyDescriptor(DICTS[currentLocale], prop);
      return desc ? { ...desc, configurable: true } : undefined;
    }
  }
);

// Resolve a dot-path (e.g. "providers.phonet.fields.apiKey.label") against the
// ACTIVE locale dictionary and return the leaf string, or undefined if any
// segment is missing or the leaf is not a string. The manifest i18n contract
// (saas/worker/telephony.js) leans on this: the cabinet reads
// copyGet(field.labelKey) ?? field.label, so an absent path degrades to the
// manifest's own Russian fallback. Non-string input (undefined key) → undefined.
export function copyGet(path) {
  if (typeof path !== "string" || path === "") return undefined;
  let node = DICTS[currentLocale];
  for (const part of path.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}
