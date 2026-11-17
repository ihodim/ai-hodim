// All Bulgarian UI strings live here (CLAUDE.md). One section per feature keeps merge conflicts small.
// To add English later, add en.ts with the same shape.

// Error messages keyed by the error codes in src/lib/error-codes.ts (filled from Phase 1 on).
const errors: Record<string, string> = {};

export const bg = {
  appTitle: 'iHodim',
  tagline: 'Кой излиза довечера?',

  home: {
    soon: 'Скоро тук: план за вечерта с приятели, кой идва и чек-ин в клуба.',
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
