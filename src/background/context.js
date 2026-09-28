// Контекст одного шага: снимок состояния + конфиг + хелперы, которые
// гарантируют, что шаг не продолжит работу после Stop.
import * as store from './state.js';
import { AutoLikeError } from './errors.js';
import { sleep, randomDelay } from './tabs.js';

export function createContext(state, cfg) {
  const runId = state.runId;
  const ctx = {
    s: state,
    cfg,
    runId,

    async assertActive() {
      const cur = await store.get();
      if (!cur.running || cur.runId !== runId) throw new AutoLikeError('aborted');
      ctx.s = cur;
      return cur;
    },

    // Пауза с проверкой, что запуск не остановлен.
    async sleep(range) {
      await sleep(randomDelay(range));
      return ctx.assertActive();
    },

    async patch(partial) {
      const next = await store.updateIfRun(runId, () => partial);
      if (!next.running || next.runId !== runId) throw new AutoLikeError('aborted');
      ctx.s = next;
      return next;
    },

    async update(fn) {
      const next = await store.updateIfRun(runId, fn);
      if (!next.running || next.runId !== runId) throw new AutoLikeError('aborted');
      ctx.s = next;
      return next;
    }
  };
  return ctx;
}
