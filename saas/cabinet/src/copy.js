// Single source of every user-facing string, grouped by screen.
//
// Components never hardcode text: a future uk/en dictionary is this exact
// object shape with translated leaves plus a language switch — nothing in the
// components changes. Plural forms are word-triples for the Russian
// one/few/many rule (see pluralRu in format.js).
export const copy = {
  common: {
    appName: "CallControl AI",
    loading: "Загружаем…",
    retry: "Повторить",
    cancel: "Отмена",
    close: "Закрыть",
    signOut: "Выйти",
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
    settings: "Настройки",
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
    failed: "Ошибка"
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
    leaksTitle: "Где теряются деньги",
    leaksEmpty: "Утечек не найдено. Разберите больше звонков — картина станет точнее.",
    managersTitle: "Менеджеры",
    managersEmpty: "Пока нет разобранных звонков, закреплённых за менеджерами.",
    recentTitle: "Последние звонки",
    recentAll: "Все звонки",
    avgLabel: "средний балл",
    emptyTitle: "Загрузите первый звонок",
    emptyText:
      "Вставьте транскрипт разговора — через полминуты увидите балл, " +
      "утечки выручки и конкретный план коучинга для менеджера.",
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
      hint: "Вставьте этот URL в настройки вебхуков вашей АТС.",
      copy: "Копировать",
      copied: "Скопировано",
      noEvents: "событий ещё не было",
      lastEvent: "последнее событие:",
      empty: "Интеграции ещё не подключены. Напишите нам — включим Ringostat или Binotel.",
      kinds: {
        ringostat: "Ringostat",
        binotel: "Binotel"
      }
    }
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
