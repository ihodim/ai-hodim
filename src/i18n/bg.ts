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
