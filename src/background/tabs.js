// Низкоуровневая работа со вкладками: ожидание загрузки, внедрение
// content-скриптов («драйверов») и RPC-вызовы к ним.
import { AutoLikeError } from './errors.js';

const COMMON = ['src/content/common/dom.js', 'src/content/common/toast.js', 'src/content/common/bridge.js'];

export const DRIVERS = {
  taskSite: [...COMMON, 'src/content/taskSite/scanner.js', 'src/content/taskSite/checker.js', 'src/content/taskSite/index.js'],
  tiktok: [...COMMON, 'src/content/tiktok/actions.js', 'src/content/tiktok/index.js']
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function randomDelay(range) {
  if (typeof range === 'number') return range;
  const [min, max] = range;
  return Math.round(min + Math.random() * (max - min));
}

export async function getTab(tabId) {
  if (tabId == null) return null;
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
}

// Ждём status === 'complete'. Не бросает ошибку по таймауту: SPA (TikTok)
// может долго держать 'loading', дальше элементы всё равно ждутся в content-скрипте.
export async function waitForTabComplete(tabId, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const tab = await getTab(tabId);
    if (!tab) throw new AutoLikeError('tiktok_tab_lost', 'Вкладка закрыта во время загрузки');
    if (tab.status === 'complete') return tab;
    await sleep(400);
  }
  return getTab(tabId);
}

// Перехват window.open / alert / confirm в контексте страницы (MAIN world):
// - window.open: запоминаем URL, если браузер заблокирует всплывающее окно;
// - alert: не блокируем поток страницы, а сохраняем текст (часто там результат проверки);
// - confirm: автоматически подтверждаем (например, «Пропустить задание?»).
function pageHooks() {
  if (window.__autolikeHooks) return;
  window.__autolikeHooks = true;
  const root = document.documentElement;
  const origOpen = window.open;
  window.open = function (url, ...rest) {
    try {
      if (url) root.setAttribute('data-autolike-opened', new URL(url, location.href).href);
    } catch (e) {
      /* ignore */
    }
    return origOpen.call(this, url, ...rest);
  };
  window.alert = function (msg) {
    root.setAttribute('data-autolike-alert', String(msg ?? ''));
  };
  const origConfirm = window.confirm;
  window.confirm = function (msg) {
    if (root.hasAttribute('data-autolike-autoconfirm')) {
      root.setAttribute('data-autolike-alert', String(msg ?? ''));
      return true;
    }
    return origConfirm.call(this, msg);
  };
}

async function ping(tabId, driver) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { driver, cmd: 'ping' });
    return res?.ok && res.result?.driver === driver;
  } catch {
    return false;
  }
}

export async function ensureDriver(tabId, driver) {
  if (!(await getTab(tabId))) throw new AutoLikeError('tiktok_tab_lost', 'Вкладка недоступна');
  if (driver === 'taskSite') {
    await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: pageHooks }).catch(() => {});
  }
  if (await ping(tabId, driver)) return;
  await chrome.scripting.executeScript({ target: { tabId }, files: DRIVERS[driver] });
  if (!(await ping(tabId, driver))) throw new AutoLikeError('no_receiver');
}

// RPC к content-скрипту. Content-скрипт отвечает { ok, result } или { ok:false, code, error }.
export async function sendCommand(tabId, driver, cmd, payload = {}, { timeout = 60000 } = {}) {
  await ensureDriver(tabId, driver);
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new AutoLikeError('command_timeout')), timeout);
  });
  try {
    const res = await Promise.race([chrome.tabs.sendMessage(tabId, { driver, cmd, payload }), timeoutPromise]);
    if (!res) throw new AutoLikeError('no_receiver');
    if (!res.ok) throw new AutoLikeError(res.code || 'content_error', res.error);
    return res.result;
  } catch (e) {
    if (e instanceof AutoLikeError) throw e;
    // Страница перезагрузилась / ушла во время команды.
    throw new AutoLikeError('no_receiver', e.message);
  } finally {
    clearTimeout(timer);
  }
}

export async function focusTab(tabId) {
  const tab = await getTab(tabId);
  if (!tab) return;
  await chrome.tabs.update(tabId, { active: true }).catch(() => {});
  await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
}

export async function closeTab(tabId) {
  if (tabId == null) return;
  await chrome.tabs.remove(tabId).catch(() => {});
}
