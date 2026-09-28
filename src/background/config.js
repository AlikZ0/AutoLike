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
    // Скрытое поле с id задания внутри карточки (tiktop-free: UserPerformTask[id]).
    taskIdInput: ['input[type="hidden"][name$="[id]"]', 'input[type="hidden"][name="task_id"]'],
    // Ссылка на цель задания внутри карточки. Первая найденная — основная
    // (tiktop-free: «Через браузер» даёт обычную ссылку www.tiktok.com).
    targetLink: ['a.btn--complete2[href*="tiktok.com"]', 'a[href*="tiktok.com"]'],
    // Кнопки: сначала ищем по селекторам, затем по тексту среди clickableCandidates.
    checkButton: {
      selectors: ['button[value="check"]', '.btn--check', '[data-action="check"]', '.btn-check', '.check-btn', '.js-check'],
      text: '/^\\s*(проверить|check|verify)/i'
    },
    openButton: {
      // tiktop-free: «Через браузер» (прямая ссылка www.tiktok.com), затем «Выполнить» (мобильная m.tiktok.com).
      selectors: ['a.btn--complete2[href*="tiktok.com"]', 'a.btn--complete[href*="tiktok.com"]', '[data-action="open"]', '[data-action="start"]', '.btn-open', '.open-btn', '.js-open'],
      text: '/(выполнить|перейти|открыть|начать|\\bgo\\b|\\bopen\\b|\\bstart\\b)/i'
    },
    skipButton: {
      selectors: ['button[value="hide"]', '[data-action="skip"]', '[data-action="hide"]', '.btn-skip', '.skip-btn'],
      text: '/(пропустить|скрыть|отказаться|\\bskip\\b|\\bhide\\b)/i'
    },
    // Кнопка подтверждения в диалоге (например, «Вы уверены, что хотите пропустить?»).
    confirmButton: {
      selectors: ['.swal2-confirm'],
      text: '/^\\s*(да|ok|ок|yes|подтвердить|confirm)\\s*$/i'
    },
    dialogs: ['[role="dialog"]', '.modal.open', '.modal.show', '.modal', '.swal2-popup', '[class*="modal" i]', '[class*="dialog" i]'],
    // Кнопки закрытия окна с результатом проверки (чтобы оно не мешало следующей попытке).
    dialogClose: ['.modal.open .modal-close', '.modal.show .close', '.modal.show [data-dismiss="modal"]', '.swal2-confirm'],
    clickableCandidates:
      'button, a, [role="button"], input[type="button"], input[type="submit"], .btn, [class*="btn"], [class*="button"]',
    // Баланс пользователя.
    balance: ['.user-balance', '[data-balance]', '#balance', '.balance', '[class*="balance" i]', '[id*="balance" i]'],
    balanceLabel: '/(баланс|balance|счёт|счет)/i',
    // Контейнеры всплывающих сообщений сайта, где может появиться результат проверки.
    notifications: [
      '#toast-container',
      '.modal.open',
      '[id*="message" i]',
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
      '/(не\\s*выполн|не\\s*найден|не\\s*постав|не\\s*подпис|вы\\s*не\\s|не\\s*удалось|отсутству|не\\s*подтвержд|не\\s*засчитан|не\\s*обнаружен|ошибка|попробуйте|повторите|not\\s*(completed|found|confirmed|done|detected)|\\bfail|\\berror\\b|try again)/i',
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

const CONFIG_VERSION = 2;

// Версия 1 сохраняла конфиг целиком, и старые селекторы перекрывали новые значения
// по умолчанию. При миграции оставляем только реальные отличия, а selectors/patterns
// берём из новых значений по умолчанию.
function migrate(overrides) {
  if (!overrides || overrides._v === CONFIG_VERSION) return overrides;
  const { selectors, patterns, _v, ...rest } = overrides;
  return { ...(diffFromDefaults(rest) || {}), _v: CONFIG_VERSION };
}

export async function getConfig() {
  const { [CONFIG_KEY]: stored } = await chrome.storage.local.get(CONFIG_KEY);
  const overrides = migrate(stored);
  if (overrides !== stored) await chrome.storage.local.set({ [CONFIG_KEY]: overrides });
  const { _v, ...clean } = overrides || {};
  return deepMerge(DEFAULT_CONFIG, clean);
}

// Разница между конфигом и значениями по умолчанию — сохраняем только её,
// чтобы обновления расширения (новые селекторы по умолчанию) применялись автоматически.
export function diffFromDefaults(value, base = DEFAULT_CONFIG) {
  if (isPlainObject(value) && isPlainObject(base)) {
    const out = {};
    for (const [key, v] of Object.entries(value)) {
      if (!(key in base)) {
        out[key] = v;
        continue;
      }
      const d = diffFromDefaults(v, base[key]);
      if (d !== undefined) out[key] = d;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return JSON.stringify(value) === JSON.stringify(base) ? undefined : value;
}

export async function saveConfigOverrides(overrides) {
  await chrome.storage.local.set({ [CONFIG_KEY]: { ...overrides, _v: CONFIG_VERSION } });
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
