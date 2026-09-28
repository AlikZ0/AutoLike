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

  const results = await sendCommand(
    tiktokTabId,
    'tiktok',
    'perform',
    { actions: task.actions, cfg, label: task.typeLabel },
    { timeout: cfg.timeouts.command }
  );

  // Даём TikTok время отправить запрос на сервер, а сайту — «засчитать» визит.
  await ctx.sleep(cfg.delays.afterAction);
  return results;
}
