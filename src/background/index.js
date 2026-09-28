// Точка входа service worker'а: сообщения от popup, события вкладок,
// keepalive и восстановление после перезапуска.
import * as runner from './runner.js';
import * as store from './state.js';
import { PHASE } from './phases.js';
import { toastTab } from './notify.js';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg?.type) return false;
  (async () => {
    switch (msg.type) {
      case 'start':
        await runner.start(msg.tabId);
        return { ok: true };
      case 'stop':
        await runner.stop();
        return { ok: true };
      case 'resetStats':
        await runner.resetStats();
        return { ok: true };
      case 'getState':
        return { ok: true, state: await store.get() };
      default:
        return { ok: false, error: `Неизвестная команда ${msg.type}` };
    }
  })().then(sendResponse, (e) => sendResponse({ ok: false, error: e.message }));
  return true;
});

// Keepalive: MV3 service worker может быть выгружен. Будильник раз в 30 с
// будит его и продолжает цикл с сохранённой фазы.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== runner.KEEPALIVE_ALARM) return;
  const s = await store.get();
  if (s.running) await resumeIfValid();
  else chrome.alarms.clear(runner.KEEPALIVE_ALARM);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const s = await store.get();
  if (s.running && tabId === s.taskTabId) await runner.stop('Вкладка с заданиями закрыта');
});

// Вкладка с заданиями перезагрузилась — продолжаем с сохранённого шага
// и показываем пользователю, что выполнение продолжается.
chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== 'complete') return;
  const s = await store.get();
  if (!s.running || tabId !== s.taskTabId) return;
  await resumeIfValid();
  if (s.currentTask) {
    await toastTab(tabId, 'taskSite', `AutoLike: ${s.currentTask.typeLabel} · Attempt ${s.attempt}/${s.maxAttempts} · ${s.status}`);
  }
});

// Service worker поднят заново (после выгрузки) — восстанавливаем выполнение.
// chrome.storage.session очищается при перезапуске браузера: если метки запуска
// там нет, id вкладок устарели и продолжать нельзя.
async function resumeIfValid() {
  const s = await store.get();
  if (!s.running) return;
  if (runner.isLoopActive()) return;
  const { autolikeRunId } = await chrome.storage.session.get('autolikeRunId');
  if (autolikeRunId !== s.runId) {
    await store.patch({ running: false, phase: PHASE.IDLE, status: 'Остановлено: браузер был перезапущен' });
    await chrome.alarms.clear(runner.KEEPALIVE_ALARM);
    return;
  }
  const tab = await chrome.tabs.get(s.taskTabId).catch(() => null);
  if (tab) runner.kick();
  else await runner.stop('Вкладка с заданиями закрыта');
}

resumeIfValid();
