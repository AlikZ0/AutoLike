// Выполнение целевого действия на странице TikTok.
import { AutoLikeError } from './errors.js';
import { getTab, waitForTabComplete, sendCommand, sleep, randomDelay } from './tabs.js';

export async function performOnTikTok(ctx) {
  const { cfg } = ctx;
  const { tiktokTabId, currentTask: task } = ctx.s;
  if (!(await getTab(tiktokTabId))) throw new AutoLikeError('tiktok_tab_lost');

  // Медленная загрузка TikTok: сначала ждём загрузку вкладки,
  // затем content-скрипт сам ждёт нужные элементы (timeouts.tiktokElement).
  await waitForTabComplete(tiktokTabId, cfg.timeouts.pageLoad);
  await sleep(randomDelay(cfg.delays.betweenSteps));
  await ctx.assertActive();

  // Вкладка может ещё идти по редиректам (m.tiktok.com → www.tiktok.com) или
  // перезагрузиться — тогда подключение к странице повторяем.
  let results;
  for (let i = 1; ; i++) {
    try {
      results = await sendCommand(
        tiktokTabId,
        'tiktok',
        'perform',
        { actions: task.actions, cfg, label: task.typeLabel },
        { timeout: cfg.timeouts.command }
      );
      break;
    } catch (e) {
      const transient = e.code === 'no_receiver' || /error page|cannot access|frame/i.test(e.message || '');
      if (!transient || i >= 3) throw e;
      await sleep(2000 * i);
      await ctx.assertActive();
      await waitForTabComplete(tiktokTabId, cfg.timeouts.pageLoad);
    }
  }

  // Даём TikTok время отправить запрос на сервер, а сайту — «засчитать» визит.
  await ctx.sleep(cfg.delays.afterAction);
  return results;
}
