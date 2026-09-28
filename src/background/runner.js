// Оркестратор: конечный автомат по фазам из phases.js.
// Каждая фаза — отдельная функция, которая выполняет свой шаг и
// записывает в state следующую фазу. Цикл читает фазу из storage,
// поэтому после перезапуска service worker'а выполнение продолжается.
import { PHASE } from './phases.js';
import * as store from './state.js';
import { getConfig, isTikTokUrl } from './config.js';
import { createContext } from './context.js';
import { FATAL_CODES, NO_RETRY_CODES, describeError } from './errors.js';
import * as notify from './notify.js';
import * as navigation from './navigation.js';
import * as taskSelector from './taskSelector.js';
import * as actions from './actions.js';
import * as verification from './verification.js';
import * as attempts from './attempts.js';
import { getTab, closeTab } from './tabs.js';

const KEEPALIVE_ALARM = 'autolike-keepalive';

// ---------- Фазы ----------

async function phaseSelect(ctx) {
  const { cfg } = ctx;
  if (cfg.limits.maxTasksPerRun && ctx.s.tasksThisRun >= cfg.limits.maxTasksPerRun) {
    await stop(`Достигнут лимит заданий за запуск (${cfg.limits.maxTasksPerRun})`);
    return;
  }

  await notify.status(ctx, 'Ищем доступное задание…');
  await navigation.ensureTaskPage(ctx);
  const { task, balance, ignored } = await taskSelector.pickNextTask(ctx);

  await ctx.update((s) => ({
    balance: balance ?? s.balance,
    ignoredIds: ignored.length ? [...new Set([...s.ignoredIds, ...ignored])] : s.ignoredIds
  }));

  if (!task) {
    const emptyScans = ctx.s.emptyScans + 1;
    if (emptyScans > cfg.limits.maxEmptyScans) {
      await notify.toast(ctx, 'Доступных заданий больше нет', 'info');
      await stop('Нет доступных заданий');
      return;
    }
    await ctx.patch({ emptyScans });
    await notify.status(ctx, `Задания не найдены, обновляем страницу (${emptyScans}/${cfg.limits.maxEmptyScans})…`);
    await ctx.sleep(cfg.delays.emptyScanReload);
    await navigation.reloadTaskPage(ctx);
    return;
  }

  await ctx.update((s) => ({
    currentTask: task,
    attempt: 1,
    maxAttempts: cfg.maxAttempts,
    emptyScans: 0,
    tasksThisRun: s.tasksThisRun + 1,
    balanceAtStart: balance ?? s.balance,
    lastError: null,
    phase: PHASE.OPEN,
    log: store.appendLog(s, `Новое задание: ${task.typeLabel}${task.targetUrl ? ' — ' + task.targetUrl : ''}`)
  }));
  await notify.toast(ctx, `Задание: ${task.typeLabel}`, 'info');
}

async function phaseOpen(ctx) {
  const { attempt, maxAttempts, currentTask } = ctx.s;
  await notify.status(ctx, `Попытка ${attempt} из ${maxAttempts}: открываем TikTok…`);
  const { tiktokTabId, openedByUs } = await navigation.openTarget(ctx);
  try {
    await ctx.patch({ tiktokTabId, tiktokTabOpenedByUs: openedByUs, phase: PHASE.PERFORM });
  } catch (e) {
    // Stop нажали, пока открывалась вкладка — не оставляем её висеть.
    if (tiktokTabId !== ctx.s.taskTabId) await closeTab(tiktokTabId);
    throw e;
  }
  await notify.toastTab(tiktokTabId, 'tiktok', `AutoLike: ${currentTask.typeLabel} · Attempt ${attempt}/${maxAttempts}`);
}

async function phasePerform(ctx) {
  const { currentTask } = ctx.s;
  await notify.status(ctx, `Выполняем действие на TikTok: ${currentTask.typeLabel}…`);
  const results = await actions.performOnTikTok(ctx);
  const already = Array.isArray(results) && results.every((r) => r?.alreadyDone);
  await ctx.update((s) => ({
    phase: PHASE.RETURN,
    log: store.appendLog(s, already ? 'Действие уже было выполнено ранее' : `Действие выполнено: ${currentTask.typeLabel}`)
  }));
}

async function phaseReturn(ctx) {
  await notify.status(ctx, 'Возвращаемся на сайт с заданиями…');
  await navigation.returnToTaskSite(ctx);
  await ctx.patch({ tiktokTabId: null, phase: PHASE.CHECK });
  await ctx.sleep(ctx.cfg.delays.betweenSteps);
}

async function phaseCheck(ctx) {
  const { attempt, maxAttempts } = ctx.s;
  await notify.status(ctx, `Проверяем выполнение… (Attempt ${attempt}/${maxAttempts})`);
  await notify.toast(ctx, `Проверяем выполнение… Попытка ${attempt} из ${maxAttempts}`, 'info');

  const result = await verification.clickCheck(ctx);
  if (result.balanceBefore != null) await ctx.patch({ balance: result.balanceBefore });

  const passed = result.status === 'success' || result.status === 'removed';
  const missingButPaid = result.status === 'missing' && ctx.s.balanceAtStart != null;

  if (passed || missingButPaid) {
    const before = result.balanceBefore ?? ctx.s.balanceAtStart;
    const confirm = await verification.confirmByBalance(ctx, before);
    if (confirm.balance != null) await ctx.patch({ balance: confirm.balance });
    if (confirm.ok) return attempts.onSuccess(ctx, confirm);
    return attempts.onFailure(ctx, confirm.reason);
  }

  return attempts.onFailure(ctx, result.message || 'Проверка не подтвердила выполнение');
}

const PHASE_HANDLERS = {
  [PHASE.SELECT]: phaseSelect,
  [PHASE.OPEN]: phaseOpen,
  [PHASE.PERFORM]: phasePerform,
  [PHASE.RETURN]: phaseReturn,
  [PHASE.CHECK]: phaseCheck
};

// ---------- Обработка ошибок шага ----------

async function handleStepError(ctx, err) {
  if (err?.code === 'aborted') return;
  const reason = describeError(err);
  console.warn('[AutoLike] step error', ctx.s.phase, err);

  if (FATAL_CODES.has(err?.code)) {
    await notify.toast(ctx, `✕ ${reason}. Выполнение остановлено.`, 'error', { duration: 8000 }).catch(() => {});
    await stop(reason);
    return;
  }

  try {
    if (!ctx.s.currentTask) {
      // Ошибка при поиске задания: считаем как пустой проход, чтобы не зациклиться.
      const emptyScans = ctx.s.emptyScans + 1;
      if (emptyScans > ctx.cfg.limits.maxEmptyScans) {
        await stop(`Не удалось получить список заданий: ${reason}`);
        return;
      }
      await ctx.patch({ emptyScans, phase: PHASE.SELECT, lastError: reason });
      await ctx.sleep(ctx.cfg.delays.emptyScanReload);
      return;
    }
    await attempts.onFailure(ctx, reason, { final: NO_RETRY_CODES.has(err?.code) });
  } catch (e) {
    if (e?.code !== 'aborted') {
      console.error('[AutoLike] failure handler error', e);
      await stop(`Внутренняя ошибка: ${describeError(e)}`);
    }
  }
}

// ---------- Цикл ----------

let loopPromise = null;

async function runLoop() {
  let s = await store.get();
  if (!s.running) return;
  const runId = s.runId;

  while (true) {
    s = await store.get();
    if (!s.running || s.runId !== runId) return;
    const cfg = await getConfig();
    const ctx = createContext(s, cfg);
    const handler = PHASE_HANDLERS[s.phase];
    if (!handler) {
      await store.updateIfRun(runId, () => ({ phase: PHASE.SELECT }));
      continue;
    }
    try {
      await handler(ctx);
    } catch (err) {
      await handleStepError(ctx, err);
    }
  }
}

// Запускает цикл, если он ещё не идёт в этом экземпляре service worker'а.
export function kick() {
  if (!loopPromise) {
    loopPromise = runLoop()
      .catch((e) => console.error('[AutoLike] loop crashed', e))
      .finally(() => {
        loopPromise = null;
      });
  }
  return loopPromise;
}

export function isLoopActive() {
  return !!loopPromise;
}

// ---------- Управление ----------

export async function start(tabId) {
  const cfg = await getConfig();
  const tab = await getTab(tabId);
  if (!tab || !/^https?:/i.test(tab.url || '')) throw new Error('Откройте сайт с заданиями и запустите расширение на нём');
  if (isTikTokUrl(tab.url, cfg)) throw new Error('Запускать нужно на сайте с заданиями, а не на TikTok');

  const origin = new URL(tab.url).origin;
  await store.update((s) => ({
    running: true,
    runId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    phase: PHASE.SELECT,
    status: 'Запуск…',
    taskTabId: tabId,
    taskPageUrl: tab.url,
    taskOrigin: origin,
    tiktokTabId: null,
    currentTask: null,
    attempt: 0,
    maxAttempts: cfg.maxAttempts,
    doneIds: [],
    ignoredIds: [],
    emptyScans: 0,
    tasksThisRun: 0,
    lastError: null,
    log: store.appendLog(s, `▶ Старт на ${origin}`)
  }));
  const { runId } = await store.get();
  await chrome.storage.session.set({ autolikeRunId: runId });
  await chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
  kick();
}

export async function stop(reason = 'Остановлено пользователем') {
  const cfg = await getConfig();
  const s = await store.get();
  if (s.tiktokTabId != null && s.tiktokTabId !== s.taskTabId && s.running && cfg.behavior.closeTikTokTab) {
    await closeTab(s.tiktokTabId);
  }
  await store.update((cur) => ({
    running: false,
    phase: PHASE.IDLE,
    status: reason,
    tiktokTabId: null,
    log: store.appendLog(cur, `■ ${reason}`)
  }));
  await chrome.alarms.clear(KEEPALIVE_ALARM);
  if (s.taskTabId != null) await notify.toastTab(s.taskTabId, 'taskSite', `AutoLike: ${reason}`, 'info');
}

export async function resetStats() {
  await store.update(() => ({ stats: { success: 0, failed: 0 }, failedTasks: [], doneIds: [], ignoredIds: [], log: [] }));
}

export { KEEPALIVE_ALARM };
