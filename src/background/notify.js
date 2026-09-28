// Статус в popup + уведомления внизу страницы.
import * as store from './state.js';
import { sendCommand } from './tabs.js';

export async function status(ctx, text, kind = 'info') {
  await ctx.update((s) => ({ status: text, log: store.appendLog(s, text, kind) }));
}

// Показывает уведомление внизу страницы с заданиями (и, опционально, на вкладке TikTok).
// Ошибки показа никогда не должны ломать основной сценарий.
export async function toast(ctx, text, kind = 'info', { alsoTikTok = false, duration } = {}) {
  const { taskTabId, tiktokTabId } = ctx.s;
  const payload = { text, kind, duration };
  const jobs = [];
  if (taskTabId != null) jobs.push(sendCommand(taskTabId, 'taskSite', 'toast', payload, { timeout: 5000 }));
  if (alsoTikTok && tiktokTabId != null && tiktokTabId !== taskTabId) {
    jobs.push(sendCommand(tiktokTabId, 'tiktok', 'toast', payload, { timeout: 5000 }));
  }
  await Promise.allSettled(jobs);
}

export async function toastTab(tabId, driver, text, kind = 'info') {
  if (tabId == null) return;
  await sendCommand(tabId, driver, 'toast', { text, kind }, { timeout: 5000 }).catch(() => {});
}
