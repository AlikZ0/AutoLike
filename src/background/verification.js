// Проверка задания на сайте: клик «Проверить», ожидание результата,
// подтверждение по изменению баланса.
import { sendCommand, sleep } from './tabs.js';
import { readBalance } from './taskSelector.js';
import { reloadTaskPage } from './navigation.js';
import * as notify from './notify.js';

// Возвращает { status: 'success'|'fail'|'unknown'|'removed'|'missing', message, balanceBefore }.
export async function clickCheck(ctx) {
  const { cfg } = ctx;
  const { taskTabId, currentTask } = ctx.s;
  const timeout = cfg.timeouts.element + cfg.timeouts.checkButton + cfg.timeouts.checkResult + 5000;
  return sendCommand(taskTabId, 'taskSite', 'checkTask', { taskId: currentTask.id, cfg }, { timeout });
}

function increased(before, after) {
  return before != null && after != null && after > before + 1e-9;
}

async function pollBalance(ctx, before, duration) {
  const end = Date.now() + duration;
  let current = null;
  while (Date.now() < end) {
    await ctx.assertActive();
    current = await readBalance(ctx);
    if (increased(before, current)) return { changed: true, balance: current };
    await sleep(ctx.cfg.delays.balancePoll);
  }
  return { changed: false, balance: current };
}

// Баланс как дополнительное подтверждение успешной проверки.
// Если баланс не изменился сразу — ждём, перечитываем, при необходимости обновляем страницу.
export async function confirmByBalance(ctx, before) {
  const { cfg } = ctx;
  if (before == null) {
    // Баланс на странице не найден — опираемся только на ответ проверки.
    return { ok: true, balance: await readBalance(ctx), verified: false };
  }

  await notify.status(ctx, 'Проверка пройдена, ждём обновления баланса…');
  let res = await pollBalance(ctx, before, cfg.timeouts.balanceUpdate);
  if (res.changed) return { ok: true, balance: res.balance, delta: res.balance - before, verified: true };

  if (cfg.behavior.reloadForBalance) {
    await notify.status(ctx, 'Баланс не изменился, обновляем страницу…');
    await reloadTaskPage(ctx);
    res = await pollBalance(ctx, before, Math.max(6000, cfg.timeouts.balanceUpdate / 2));
    if (res.changed) return { ok: true, balance: res.balance, delta: res.balance - before, verified: true };
  }

  if (!cfg.behavior.requireBalanceChange) return { ok: true, balance: res.balance, verified: false };
  return { ok: false, balance: res.balance, reason: 'Баланс не обновился после проверки' };
}
