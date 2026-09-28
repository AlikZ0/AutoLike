// Коды ошибок, общие для background и content-скриптов.
export class AutoLikeError extends Error {
  constructor(code, message) {
    super(message || ERROR_MESSAGES[code] || code);
    this.code = code;
  }
}

export const ERROR_MESSAGES = {
  aborted: 'Выполнение остановлено',
  task_tab_closed: 'Вкладка с заданиями закрыта',
  task_not_found: 'Задание не найдено на странице',
  check_button_not_found: 'Кнопка «Проверить» не появилась',
  no_target_url: 'Не удалось определить ссылку на TikTok',
  tiktok_tab_lost: 'Вкладка TikTok закрылась',
  like_button_not_found: 'Кнопка Like не найдена на TikTok',
  like_not_confirmed: 'TikTok не подтвердил Like',
  follow_button_not_found: 'Кнопка «Подписаться» не найдена на TikTok',
  follow_not_confirmed: 'TikTok не подтвердил подписку',
  not_logged_in: 'Требуется вход в аккаунт TikTok',
  captcha: 'TikTok показал капчу, она не была решена',
  target_unavailable: 'Видео или аккаунт на TikTok недоступны',
  unknown_action: 'Неизвестный тип действия',
  command_timeout: 'Страница не ответила вовремя',
  no_receiver: 'Страница не отвечает (не удалось подключить скрипт)'
};

// Ошибки, при которых продолжать бессмысленно — останавливаем весь запуск.
export const FATAL_CODES = new Set(['task_tab_closed', 'not_logged_in']);

// Ошибки, при которых повторять это задание бессмысленно — сразу переходим к следующему.
export const NO_RETRY_CODES = new Set(['target_unavailable', 'unknown_action', 'no_target_url']);

export function describeError(err) {
  if (!err) return 'Неизвестная ошибка';
  return ERROR_MESSAGES[err.code] || err.message || String(err);
}
