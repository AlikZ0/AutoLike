// Персистентное состояние выполнения. Хранится в chrome.storage.local, чтобы
// прогресс (текущее задание, номер попытки, фаза) переживал переходы между
// страницами, перезагрузку вкладки и остановку service worker'а.
import { PHASE } from './phases.js';

export const STATE_KEY = 'autolikeState';
const MAX_LOG = 60;
const MAX_FAILED = 200;

export function initialState() {
  return {
    running: false,
    runId: null,
    phase: PHASE.IDLE,
    status: 'Остановлено',
    taskTabId: null,
    taskPageUrl: null,
    taskOrigin: null,
    tiktokTabId: null,
    tiktokTabOpenedByUs: false,
    currentTask: null,
    attempt: 0,
    maxAttempts: 4,
    balance: null,
    balanceAtStart: null,
    stats: { success: 0, failed: 0 },
    doneIds: [], // выполненные в текущем запуске
    ignoredIds: [], // неподдерживаемые типы заданий
    failedTasks: [], // не удалось выполнить (сохраняется между запусками)
    emptyScans: 0,
    tasksThisRun: 0,
    lastError: null,
    log: [],
    updatedAt: Date.now()
  };
}

// Все записи проходят через очередь, чтобы параллельные обновления
// (например, из onUpdated и из основного цикла) не затирали друг друга.
let queue = Promise.resolve();

function enqueue(fn) {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}

async function read() {
  const { [STATE_KEY]: stored } = await chrome.storage.local.get(STATE_KEY);
  return { ...initialState(), ...(stored || {}) };
}

export function get() {
  return enqueue(read);
}

// updater: (state) => partial | null. Возвращает новое состояние.
export function update(updater) {
  return enqueue(async () => {
    const current = await read();
    const partial = await updater(current);
    if (!partial) return current;
    const next = { ...current, ...partial, updatedAt: Date.now() };
    if (next.log.length > MAX_LOG) next.log = next.log.slice(-MAX_LOG);
    if (next.failedTasks.length > MAX_FAILED) next.failedTasks = next.failedTasks.slice(-MAX_FAILED);
    await chrome.storage.local.set({ [STATE_KEY]: next });
    return next;
  });
}

export function patch(partial) {
  return update(() => partial);
}

// Обновление только если запуск с этим runId всё ещё активен —
// защищает от того, что «старый» шаг перезапишет состояние после Stop.
export function updateIfRun(runId, updater) {
  return update((s) => (s.running && s.runId === runId ? updater(s) : null));
}

export function appendLog(state, text, kind = 'info') {
  return [...state.log, { t: Date.now(), text, kind }];
}
