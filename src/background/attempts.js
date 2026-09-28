// Политика попыток: успех → следующее задание; неудача → повтор (до maxAttempts),
// затем задание помечается проваленным, и мы переходим к следующему.
import { PHASE } from './phases.js';
import * as store from './state.js';
import * as notify from './notify.js';
import { closeTikTokTab } from './navigation.js';
import { sendCommand } from './tabs.js';

function taskRecord(task, extra = {}) {
  return {
    id: task.id,
    type: task.type,
    label: task.typeLabel,
    url: task.targetUrl || task.url || null,
    text: (task.text || '').slice(0, 140),
    t: Date.now(),
    ...extra
  };
}

export async function onSuccess(ctx, info = {}) {
  const task = ctx.s.currentTask;
  const deltaText = info.delta ? ` (+${Math.round(info.delta * 1000) / 1000})` : '';
  await notify.toast(ctx, `✓ Задание выполнено${deltaText}`, 'success');
  await ctx.update((s) => ({
    stats: { ...s.stats, success: s.stats.success + 1 },
    doneIds: [...s.doneIds, task.id],
    balance: info.balance ?? s.balance,
    currentTask: null,
    attempt: 0,
    lastError: null,
    tiktokTabId: null,
    phase: PHASE.SELECT,
    status: 'Задание выполнено, переходим к следующему',
    log: store.appendLog(s, `✓ ${task.typeLabel}: выполнено${deltaText}`, 'success')
  }));
  await ctx.sleep(ctx.cfg.delays.betweenTasks);
}

// reason — текст причины; final=true — не повторять (например, видео удалено).
export async function onFailure(ctx, reason, { final = false } = {}) {
  const { cfg } = ctx;
  const { attempt, maxAttempts, currentTask: task } = ctx.s;

  if (!task) {
    await ctx.patch({ phase: PHASE.SELECT });
    return;
  }

  if (!final && attempt < maxAttempts) {
    const next = attempt + 1;
    await notify.toast(ctx, `↻ Задание не подтверждено. Повторная попытка ${next}/${maxAttempts}`, 'retry');
    await ctx.update((s) => ({
      attempt: next,
      lastError: reason,
      phase: PHASE.OPEN,
      status: `Задание ещё не выполнено, повторяем… Попытка ${next} из ${maxAttempts}`,
      log: store.appendLog(s, `↻ ${reason}. Попытка ${next}/${maxAttempts}`, 'retry')
    }));
    await ctx.sleep(cfg.delays.betweenSteps);
    return;
  }

  const msg = final
    ? `✕ Задание невозможно выполнить: ${reason}. Переходим к следующему.`
    : `✕ Не удалось выполнить задание после ${maxAttempts} попыток. Переходим к следующему.`;
  await notify.toast(ctx, msg, 'error', { duration: 6000 });

  // Корректно закрываем задание: вкладку TikTok и (если есть) кнопку «Пропустить» на сайте.
  await closeTikTokTab(ctx);
  if (cfg.behavior.skipFailedOnSite) {
    await sendCommand(ctx.s.taskTabId, 'taskSite', 'skipTask', { taskId: task.id, cfg }, { timeout: 15000 }).catch(() => null);
  }

  await ctx.update((s) => ({
    stats: { ...s.stats, failed: s.stats.failed + 1 },
    failedTasks: [...s.failedTasks, taskRecord(task, { reason, attempts: attempt })],
    currentTask: null,
    attempt: 0,
    lastError: reason,
    tiktokTabId: null,
    phase: PHASE.SELECT,
    status: 'Задание не выполнено, переходим к следующему',
    log: store.appendLog(s, `✕ ${task.typeLabel}: ${reason}`, 'error')
  }));
  await ctx.sleep(cfg.delays.betweenTasks);
}
