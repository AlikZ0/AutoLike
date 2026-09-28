// Конфигурация по умолчанию. Всё, что зависит от конкретного сайта с заданиями,
// вынесено сюда и может быть переопределено на странице настроек (options).
// Шаблоны текста задаются строками вида "/regex/flags" — так их можно передавать
// в content-скрипты через chrome.tabs.sendMessage (RegExp не сериализуется).

export const DEFAULT_CONFIG = {
  // Максимум попыток на одно задание (требование: 3–4).
  maxAttempts: 4,

  selectors: {
    // Карточка задания. Если ни один селектор не найден — включается эвристика
    // (поиск ссылок на TikTok / кнопок «Проверить» и подъём до общего контейнера).
    taskCard: [
      '[data-task-id]',
      '[data-task]',
      '.task-item',
      '.task-card',
      '.tasks__item',
      '.task',
      '.order-item',
      '.job-item'
    ],
    // Ссылка на цель задания внутри карточки.
    targetLink: ['a[href*="tiktok.com"]'],
    // Кнопки: сначала ищем по селекторам, затем по тексту среди clickableCandidates.
    checkButton: {
      selectors: ['[data-action="check"]', '.btn-check', '.check-btn', '.js-check'],
      text: '/^\\s*(проверить|check|verify)/i'
    },
    openButton: {
      selectors: ['[data-action="open"]', '[data-action="start"]', '.btn-open', '.open-btn', '.js-open'],
      text: '/(выполнить|перейти|открыть|начать|\\bgo\\b|\\bopen\\b|\\bstart\\b)/i'
    },
    skipButton: {
      selectors: ['[data-action="skip"]', '[data-action="hide"]', '.btn-skip', '.skip-btn'],
      text: '/(пропустить|скрыть|отказаться|\\bskip\\b|\\bhide\\b)/i'
    },
    // Кнопка подтверждения в диалоге (например, «Вы уверены, что хотите пропустить?»).
    confirmButton: {
      selectors: ['.swal2-confirm'],
      text: '/^\\s*(да|ok|ок|yes|подтвердить|confirm)\\s*$/i'
    },
    dialogs: ['[role="dialog"]', '.modal.show', '.modal', '.swal2-popup', '[class*="modal" i]', '[class*="dialog" i]'],
    clickableCandidates:
      'button, a, [role="button"], input[type="button"], input[type="submit"], .btn, [class*="btn"], [class*="button"]',
    // Баланс пользователя.
    balance: ['[data-balance]', '#balance', '.balance', '.user-balance', '[class*="balance" i]', '[id*="balance" i]'],
    balanceLabel: '/(баланс|balance|счёт|счет)/i',
    // Контейнеры всплывающих сообщений сайта, где может появиться результат проверки.
    notifications: [
      '[role="alert"]',
      '[role="status"]',
      '.toast',
      '.alert',
      '.notification',
      '.notify',
      '.swal2-popup',
      '.modal.show',
      '[class*="toast" i]',
      '[class*="notif" i]',
      '[class*="message" i]'
    ]
  },

  // Как понять результат проверки. Отрицательный шаблон проверяется ПЕРВЫМ,
  // иначе «не выполнено» совпало бы с «выполнено».
  patterns: {
    failure:
      '/(не\\s*выполн|не\\s*найден|не\\s*подтвержд|не\\s*засчитан|не\\s*обнаружен|ошибка|попробуйте|повторите|not\\s*(completed|found|confirmed|done|detected)|\\bfail|\\berror\\b|try again)/i',
    success:
      '/(выполнено|засчитано|успешно|начислен|подтверждено|награда|\\bsuccess|\\bcompleted\\b|\\bdone\\b|\\bapproved\\b|\\breward)/i'
  },

  tiktok: {
    urlPattern: '/^https?:\\/\\/([a-z0-9-]+\\.)*tiktok\\.com\\//i',
    likeButton: [
      '[data-e2e="like-icon"]',
      '[data-e2e="browse-like-icon"]',
      'button[aria-label*="like" i]',
      'button[aria-label*="нрав" i]'
    ],
    likedColor: '254, 44, 85',
    followButton: [
      '[data-e2e="follow-button"]',
      '[data-e2e="browse-follow"]',
      '[data-e2e="feed-follow"]',
      'button[data-e2e*="follow"]'
    ],
    followText: '/^\\s*(follow|follow back|подписаться|подписаться в ответ)\\s*$/i',
    followingText: '/(following|friends|подписки|вы подписаны|друзья|отписаться|unfollow|message|сообщени)/i',
    // Окно входа, которое TikTok показывает при клике без авторизации.
    loginModal: ['[data-e2e="login-modal"]', '#login-modal', '[class*="LoginModal"]'],
    captcha: ['#captcha-verify-container', '.captcha_verify_container', '[id*="captcha" i]', '[class*="captcha" i]'],
    unavailableText:
      "/(video (is )?(currently )?unavailable|видео недоступно|couldn't find this account|не удалось найти этот аккаунт|this account is private|это закрытый аккаунт)/i",
    viewSeconds: 6
  },

  timeouts: {
    pageLoad: 30000, // ожидание загрузки вкладки
    element: 20000, // ожидание элементов на сайте заданий
    tiktokElement: 30000, // TikTok грузится медленно
    newTab: 8000, // ожидание открытия вкладки TikTok сайтом
    checkButton: 15000,
    checkResult: 20000,
    balanceUpdate: 15000,
    captcha: 90000, // сколько ждать, пока пользователь решит капчу
    command: 120000 // общий лимит на одну команду content-скрипту
  },

  // Задержки в мс: [min, max] — случайная пауза в диапазоне.
  delays: {
    betweenSteps: [800, 1800],
    afterAction: [2000, 3500],
    betweenTasks: [2000, 4000],
    balancePoll: 2000,
    emptyScanReload: 5000
  },

  behavior: {
    useSiteOpenButton: true, // кликать кнопку «Выполнить» на сайте (сайт часто отслеживает этот клик)
    closeTikTokTab: true, // закрывать вкладку TikTok после действия
    requireBalanceChange: true, // без роста баланса задание не считается выполненным (если баланс виден)
    reloadForBalance: true, // перезагрузить страницу, если баланс не обновился сам
    skipFailedOnSite: true, // нажимать «Пропустить» у задания, которое не удалось выполнить
    unknownTaskAction: null // действие для заданий неизвестного типа (например "view"); null — пропускать
  },

  limits: {
    maxEmptyScans: 3, // сколько раз перезагружать страницу, если заданий нет
    maxTasksPerRun: 0 // 0 — без ограничения
  }
};

const CONFIG_KEY = 'autolikeConfig';

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Глубокое слияние: объекты сливаются, массивы и примитивы заменяются.
export function deepMerge(base, override) {
  if (!isPlainObject(override)) return structuredClone(base);
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    out[key] = isPlainObject(value) && isPlainObject(out[key]) ? deepMerge(out[key], value) : value;
  }
  return out;
}

export async function getConfig() {
  const { [CONFIG_KEY]: overrides } = await chrome.storage.local.get(CONFIG_KEY);
  return deepMerge(DEFAULT_CONFIG, overrides || {});
}

export async function saveConfigOverrides(overrides) {
  await chrome.storage.local.set({ [CONFIG_KEY]: overrides });
}

export async function resetConfig() {
  await chrome.storage.local.remove(CONFIG_KEY);
}

export function toRegExp(pattern) {
  if (pattern instanceof RegExp) return pattern;
  const m = typeof pattern === 'string' && pattern.match(/^\/(.*)\/([a-z]*)$/s);
  if (m) return new RegExp(m[1], m[2]);
  return new RegExp(String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

export function isTikTokUrl(url, cfg) {
  return !!url && toRegExp(cfg.tiktok.urlPattern).test(url);
}
