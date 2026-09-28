// Фазы конечного автомата выполнения задания. Текущая фаза хранится в
// chrome.storage, поэтому после перезапуска service worker'а или перезагрузки
// вкладки выполнение продолжается с того же шага.
export const PHASE = Object.freeze({
  IDLE: 'idle',
  SELECT: 'select', // найти следующее доступное задание
  OPEN: 'open', // открыть цель (TikTok)
  PERFORM: 'perform', // выполнить действие на TikTok
  RETURN: 'return', // вернуться на сайт с заданиями
  CHECK: 'check' // нажать «Проверить», дождаться результата и баланса
});

export const PHASE_LABELS = {
  idle: 'Остановлено',
  select: 'Поиск задания',
  open: 'Открытие TikTok',
  perform: 'Действие на TikTok',
  return: 'Возврат на сайт',
  check: 'Проверка'
};
