// All Bulgarian UI strings live here (CLAUDE.md). One section per feature keeps merge conflicts small.
// To add English later, add en.ts with the same shape.

// Error messages keyed by the error codes in src/lib/error-codes.ts.
const errors: Record<string, string> = {
  // complete-signup (Phase 1)
  invalid_username:
    'Потребителското име трябва да е 3–20 знака, да започва с латинска буква и да съдържа само латински букви, цифри, „_“ и „.“.',
  invalid_date: 'Въведи валидна дата на раждане.',
  under_18: 'iHodim е само за хора на 18 и повече години. Профилът ти не беше създаден.',
  username_taken: 'Това потребителско име е заето. Опитай с друго.',
  already_completed: 'Профилът ти вече е създаден.',
  generic: 'Нещо се обърка. Опитай отново.',
};

export const bg = {
  appTitle: 'iHodim',
  tagline: 'Кой излиза довечера?',

  home: {
    soon: 'Скоро тук: план за вечерта с приятели, кой идва и чек-ин в клуба.',
    signedInAs: 'Влязъл си като',
    signOut: 'Изход',
    friends: 'Приятели',
    settings: 'Настройки',
    venues: 'Заведения',
    /** screen-reader text after the badge number */
    newRequests: 'нови заявки',
  },

  friends: {
    title: 'Приятели',
    back: 'Назад',
    you: 'Твоето име',
    copy: 'Копирай',
    copied: 'Копирано',
    shareHint: 'Изпрати го на приятелите си, за да те намерят.',
    searchLabel: 'Намери приятел',
    searchHint: 'Въведи точното потребителско име. Частично име не намира никого.',
    search: 'Търси',
    searching: 'Търся…',
    notFound: 'Няма потребител с това име.',
    open: 'Виж',
    incoming: 'Заявки към теб',
    outgoing: 'Изпратени заявки',
    list: 'Твоите приятели',
    noFriends: 'Още нямаш приятели тук. Намери някого по точното му потребителско име.',
    accept: 'Приеми',
    decline: 'Откажи',
    cancel: 'Оттегли',
    loadFailed: 'Не успях да заредя приятелите. Опитай отново.',
    retry: 'Опитай пак',

    errors: {
      not_member: 'Първо завърши регистрацията.',
      request_not_allowed: 'Не може да се изпрати заявка.',
      no_pending_request: 'Тази заявка вече не е активна.',
      not_friends: 'Вече не сте приятели.',
      block_not_allowed: 'Не може да блокираш този потребител.',
      not_blocked: 'Този потребител вече не е блокиран.',
      generic: 'Нещо се обърка. Опитай отново.',
    },
  },

  profile: {
    notFound: 'Няма потребител с това име.',
    self: 'Това си ти.',
    add: 'Добави приятел',
    requested: 'Заявката е изпратена.',
    cancel: 'Оттегли заявката',
    incoming: 'Иска да сте приятели.',
    accept: 'Приеми',
    decline: 'Откажи',
    areFriends: 'Приятели сте.',
    unfriend: 'Премахни от приятели',
    unfriendConfirm: 'Да премахна ли приятелството? И двамата ще изчезнете от списъците си.',
    block: 'Блокирай',
    blockConfirm:
      'Блокирането прекратява приятелството. Няма да може да те намира и да ти праща заявки, и няма да разбере, че е блокиран.',
    blocked: 'Блокиран е.',
    unblockIn: 'Отблокиране в Настройки',
    confirm: 'Да',
    keep: 'Не',
  },

  settings: {
    title: 'Настройки',
    blocked: 'Блокирани',
    blockedHint: 'Блокираните не могат да те намерят и да ти пращат заявки.',
    noBlocked: 'Не си блокирал никого.',
    unblock: 'Отблокирай',
    loadFailed: 'Не успях да заредя списъка. Опитай отново.',
  },

  venues: {
    title: 'Заведения',
    none: 'Още няма добавени заведения.',
    notFound: 'Няма такова заведение.',
    loadFailed: 'Не успях да заредя заведенията. Опитай отново.',
    map: 'Покажи на картата',
    call: 'Обади се',
    upcoming: 'Предстоящи събития',
    noEvents: 'Няма предстоящи събития.',
    add: 'Ново заведение',
    edit: 'Редактирай',
    addEvent: 'Добави събитие',
  },

  admin: {
    newVenue: 'Ново заведение',
    editVenue: 'Редактирай заведение',
    newEvent: 'Ново събитие',
    editEvent: 'Редактирай събитие',
    name: 'Име',
    address: 'Адрес',
    phone: 'Телефон',
    location: 'Местоположение',
    useMyLocation: 'Използвай текущото ми местоположение',
    gpsBusy: 'Търся те…',
    locationPlaceholder: 'Линк от Google Maps или 42.0116, 23.0950',
    locationHint:
      'Ако си в заведението, натисни бутона. Иначе в Google Maps задръж пръст върху мястото, копирай числата, които се появяват в търсачката, и ги постави тук.',
    found: 'Намерено:',
    checkOnMap: 'Провери на картата',
    approximate:
      'Това е центърът на картата, не точката на мястото. Провери го или постави числата на самото място.',
    gpsInaccurate: (m: number) =>
      `GPS е точен само до ±${m} м. Излез пред входа и натисни бутона пак, за да е по-точно.`,
    gpsDenied:
      'Няма достъп до местоположението. Разреши го в настройките на браузъра или постави числата ръчно.',
    gpsFailed: 'Не успях да намеря местоположението. Опитай пак или постави числата ръчно.',
    locationErrors: {
      invalid:
        'Не намирам координати тук. Постави числата, напр. 42.0116, 23.0950, или пълен линк от Google Maps.',
      short_link:
        'Кратките линкове (maps.app.goo.gl) не съдържат координати. В Google Maps задръж пръст върху мястото и копирай числата.',
      far: 'Това място е извън Благоевград. Провери дали числата не са разменени.',
    },
    radius: 'Радиус за чек-ин (м)',
    windowStart: 'Чек-ин от',
    windowEnd: 'Чек-ин до',
    windowHint: 'Ако краят е преди началото (напр. 22:00–04:00), прозорецът свършва на следващия ден.',
    performer: 'Изпълнител',
    date: 'Дата',
    promo: 'Промоции (по желание)',
    save: 'Запази',
    saving: 'Записвам…',
    saveFailed: 'Не успях да запиша. Провери полетата и опитай отново.',
  },

  auth: {
    google: 'Вход с Google',
    or: 'или с имейл',
    emailLabel: 'Имейл',
    emailPlaceholder: 'ime@primer.bg',
    sendLink: 'Изпрати линк за вход',
    sending: 'Изпращам…',
    sentTitle: 'Провери пощата си',
    sentBody: 'Изпратихме линк за вход на',
    sentAgain: 'Друг имейл',
    adultsOnly: 'Само за 18+.',
    failed: 'Входът не стана. Опитай отново.',
    notConfigured: 'Приложението още не е свързано със сървъра.',
  },

  onboarding: {
    title: 'Преди да влезеш',
    intro: 'Избери име, с което приятелите ще те намират, и потвърди, че си на 18+.',
    usernameLabel: 'Потребителско име',
    usernameHint: '3–20 знака: латински букви, цифри, „_“ и „.“. Започва с буква.',
    dobLabel: 'Дата на раждане',
    dobHint: 'Не се показва на никого. Не може да се променя после.',
    submit: 'Влез',
    submitting: 'Проверявам…',
    signOut: 'Откажи и излез',
  },

  errors,
} as const;

// Throwaway Phase 0 spike page (src/pages/Spike.tsx). A separate export so production builds,
// where the spike is compiled out, don't ship these strings either. Delete with the spike.
export const bgSpike = {
  link: 'Тест на камера и GPS',
  title: 'Тест: камера и GPS',
  intro: 'Временна страница за проверка на телефона. Няма да остане в приложението.',
  back: 'Към началото',
  mode: 'Отворено като',
  modeBrowser: 'страница в браузъра',
  modeInstalled: 'инсталирано приложение',
  secureContext: 'Защитена връзка (HTTPS)',
  yes: 'да',
  no: 'не',
  device: 'Устройство',

  camera: {
    title: 'Камера',
    start: 'Включи камерата',
    stop: 'Спри камерата',
    facing: 'Посока',
    facingRear: 'задна',
    facingFront: 'предна',
    facingUnknown: 'неизвестна',
    resolution: 'Резолюция',
    unsupported: 'Този браузър не дава достъп до камерата.',
    insecure: 'Камерата работи само през HTTPS.',
    denied: 'Достъпът до камерата е отказан. Разреши го от настройките на браузъра.',
    notFound: 'Не е намерена камера.',
    busy: 'Камерата се използва от друго приложение.',
    failed: 'Камерата не се включи',
  },

  gps: {
    title: 'Местоположение',
    start: 'Започни GPS',
    stop: 'Спри GPS',
    waiting: 'Чакам първо отчитане…',
    lat: 'Ширина',
    lng: 'Дължина',
    accuracy: 'Точност',
    best: 'Най-добра точност',
    fixes: 'Отчитания',
    lastAt: 'Последно',
    meters: 'м',
    unsupported: 'Този браузър не дава достъп до местоположението.',
    denied: 'Достъпът до местоположението е отказан. Разреши го от настройките.',
    unavailable: 'Местоположението не е налично в момента.',
    timeout: 'GPS не отговори навреме. Опитай пак на открито.',
    failed: 'GPS не се включи',
  },
} as const;
