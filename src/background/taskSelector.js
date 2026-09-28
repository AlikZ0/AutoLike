// Поиск следующего доступного задания на странице.
import { sendCommand } from './tabs.js';
import { classifyTask } from './taskTypes.js';

export async function scanPage(ctx) {
  const { taskTabId } = ctx.s;
  return sendCommand(taskTabId, 'taskSite', 'listTasks', { cfg: ctx.cfg }, { timeout: ctx.cfg.timeouts.element + 5000 });
}

// Возвращает { task, balance, total, ignored }.
// Пропускает уже выполненные в этом запуске, проваленные ранее и неподдерживаемые задания.
export async function pickNextTask(ctx) {
  const { tasks, balance } = await scanPage(ctx);
  const s = ctx.s;
  const skip = new Set([...s.doneIds, ...s.ignoredIds, ...s.failedTasks.map((f) => f.id)]);
  const ignored = [];

  for (const raw of tasks) {
    if (skip.has(raw.id)) continue;
    const task = classifyTask(raw, ctx.cfg);
    if (!task) {
      ignored.push(raw.id);
      continue;
    }
    return { task, balance, total: tasks.length, ignored };
  }
  return { task: null, balance, total: tasks.length, ignored };
}

export async function readBalance(ctx) {
  try {
    return await sendCommand(ctx.s.taskTabId, 'taskSite', 'readBalance', { cfg: ctx.cfg }, { timeout: 10000 });
  } catch {
    return null;
  }
}
