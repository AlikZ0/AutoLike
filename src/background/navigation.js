// Переходы: сайт с заданиями ⇄ TikTok.
import { AutoLikeError } from './errors.js';
import { isTikTokUrl } from './config.js';
import { getTab, waitForTabComplete, sendCommand, focusTab, closeTab, sleep } from './tabs.js';

function sameSite(url, origin) {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

// Убеждаемся, что вкладка с заданиями существует и открыта на исходном сайте.
export async function ensureTaskPage(ctx) {
  const { taskTabId, taskOrigin, taskPageUrl } = ctx.s;
  let tab = await getTab(taskTabId);
  if (!tab) throw new AutoLikeError('task_tab_closed');
  if (!sameSite(tab.url || tab.pendingUrl, taskOrigin)) {
    await chrome.tabs.update(taskTabId, { url: taskPageUrl });
    await sleep(500);
  }
  tab = await waitForTabComplete(taskTabId, ctx.cfg.timeouts.pageLoad).catch(() => null);
  if (!tab) throw new AutoLikeError('task_tab_closed');
  return tab;
}

export async function reloadTaskPage(ctx) {
  const { taskTabId } = ctx.s;
  if (!(await getTab(taskTabId))) throw new AutoLikeError('task_tab_closed');
  await chrome.tabs.reload(taskTabId);
  await sleep(700);
  await waitForTabComplete(taskTabId, ctx.cfg.timeouts.pageLoad).catch(() => {
    throw new AutoLikeError('task_tab_closed');
  });
}

// Ждём вкладку TikTok, открытую сайтом: новую вкладку или переход в текущей.
async function waitForTikTokTab(ctx, knownTabIds) {
  const { taskTabId } = ctx.s;
  const end = Date.now() + ctx.cfg.timeouts.newTab;
  while (Date.now() < end) {
    const tabs = await chrome.tabs.query({});
    const fresh = tabs.find((t) => !knownTabIds.has(t.id) && isTikTokUrl(t.pendingUrl || t.url, ctx.cfg));
    if (fresh) return fresh.id;
    const own = tabs.find((t) => t.id === taskTabId);
    if (own && isTikTokUrl(own.pendingUrl || own.url, ctx.cfg)) return taskTabId;
    await sleep(400);
  }
  return null;
}

// Закрывает вкладку TikTok от предыдущей попытки, если она осталась.
export async function closeTikTokTab(ctx) {
  const { tiktokTabId, taskTabId } = ctx.s;
  if (tiktokTabId != null && tiktokTabId !== taskTabId && ctx.cfg.behavior.closeTikTokTab) {
    await closeTab(tiktokTabId);
  }
}

// Открывает цель задания. Сначала пытаемся кликнуть кнопку сайта
// (сайт часто фиксирует этот клик), иначе открываем ссылку сами.
export async function openTarget(ctx) {
  const { cfg } = ctx;
  const task = ctx.s.currentTask;
  await closeTikTokTab(ctx);
  await ensureTaskPage(ctx);
  const taskTabId = ctx.s.taskTabId;

  const known = new Set((await chrome.tabs.query({})).map((t) => t.id));
  let tiktokTabId = null;
  let openedByUs = false;

  if (cfg.behavior.useSiteOpenButton) {
    const res = await sendCommand(taskTabId, 'taskSite', 'openTarget', { taskId: task.id, cfg }, { timeout: cfg.timeouts.element + 5000 });
    if (res?.clicked) tiktokTabId = await waitForTikTokTab(ctx, known);
  }

  if (tiktokTabId == null) {
    let url = task.targetUrl;
    if (!url) {
      // Возможно, сайт вызвал window.open, но браузер заблокировал всплывающее окно.
      url = await sendCommand(taskTabId, 'taskSite', 'getOpenedUrl', {}).catch(() => null);
    }
    if (!url || !isTikTokUrl(url, cfg)) throw new AutoLikeError('no_target_url');
    const tab = await chrome.tabs.create({ url, openerTabId: taskTabId, active: true });
    tiktokTabId = tab.id;
    openedByUs = true;
  }

  await focusTab(tiktokTabId);
  return { tiktokTabId, openedByUs };
}

// Возврат на сайт с заданиями после действия на TikTok.
export async function returnToTaskSite(ctx) {
  const { tiktokTabId, taskTabId, taskPageUrl } = ctx.s;
  if (tiktokTabId != null && tiktokTabId !== taskTabId) {
    if (ctx.cfg.behavior.closeTikTokTab) await closeTab(tiktokTabId);
  } else if (tiktokTabId === taskTabId) {
    // TikTok открылся в той же вкладке — возвращаемся на страницу заданий.
    await chrome.tabs.update(taskTabId, { url: taskPageUrl });
    await sleep(500);
  }
  await focusTab(taskTabId);
  await ensureTaskPage(ctx);
}
