// Описание всех настроек для страницы options: из этой схемы строится форма.
// Типы полей:
//   int      — целое число;             seconds — время (хранится в мс, показывается в секундах);
//   range    — диапазон [мин, макс] в секундах (случайная пауза);
//   toggle   — переключатель;           select  — выбор из списка;
//   list     — список CSS-селекторов, по одному в строке;
//   selector — одна строка CSS-селекторов через запятую;
//   regex    — шаблон текста "/.../i";   text    — произвольная строка.
// advanced: true — поле показывается только при включённом «Показать расширенные».

export const SECTIONS = [
  {
    id: 'main',
    title: 'Основное',
    description: 'Как расширение ведёт себя в целом: сколько раз пытаться, когда останавливаться, что делать с неудачными заданиями.',
    fields: [
      {
        path: 'maxAttempts',
        type: 'int',
        min: 1,
        max: 10,
        label: 'Попыток на одно задание',
        help: 'Сколько раз повторять действие и «Проверить», если сайт не засчитал задание. Потом задание пропускается и попадает в список «Не удалось». Рекомендуется 3–4.'
      },
      {
        path: 'limits.maxTasksPerRun',
        type: 'int',
        min: 0,
        max: 10000,
        label: 'Лимит заданий за один запуск',
        help: 'После стольких заданий расширение само остановится. 0 — без ограничения.'
      },
      {
        path: 'limits.maxEmptyScans',
        type: 'int',
        min: 0,
        max: 100,
        label: 'Сколько раз обновлять страницу, если заданий нет',
        help: 'Если на странице нет доступных заданий, страница перезагружается указанное число раз. Потом расширение останавливается с сообщением «Нет доступных заданий».'
      },
      {
        path: 'behavior.skipFailedOnSite',
        type: 'toggle',
        label: 'Скрывать проваленное задание на сайте',
        help: 'После последней неудачной попытки нажимать у задания кнопку «×» / «Пропустить», чтобы сайт выдал следующее.'
      },
      {
        path: 'behavior.unknownTaskAction',
        type: 'select',
        label: 'Задания непонятного типа',
        help: 'Что делать, если по тексту задания не удалось понять, лайк это или подписка.',
        options: [
          { value: null, label: 'Пропускать' },
          { value: 'view', label: 'Просто открыть TikTok (просмотр)' },
          { value: 'like', label: 'Поставить лайк' },
          { value: 'follow', label: 'Подписаться' }
        ]
      }
    ]
  },
  {
    id: 'check',
    title: 'Проверка и баланс',
    description: 'Как расширение решает, что задание действительно выполнено.',
    fields: [
      {
        path: 'behavior.requireBalanceChange',
        type: 'toggle',
        label: 'Засчитывать задание только при росте баланса',
        help: 'Если баланс виден на странице, а после «Проверить» он не вырос, задание не считается выполненным, и делается повторная попытка. Выключите, если сайт начисляет монеты с задержкой в несколько минут.'
      },
      {
        path: 'behavior.reloadForBalance',
        type: 'toggle',
        label: 'Обновлять страницу, если баланс не изменился',
        help: 'Некоторые сайты показывают новый баланс только после перезагрузки страницы.'
      },
      {
        path: 'timeouts.balanceUpdate',
        type: 'seconds',
        min: 1,
        max: 300,
        label: 'Сколько ждать обновления баланса',
        help: 'Сколько секунд после успешной проверки ждать роста баланса (до перезагрузки страницы).'
      },
      {
        path: 'timeouts.checkResult',
        type: 'seconds',
        min: 2,
        max: 300,
        label: 'Сколько ждать ответа на «Проверить»',
        help: 'Если за это время сайт ничего не показал, попытка считается неудачной.'
      },
      {
        path: 'patterns.success',
        type: 'regex',
        label: 'Слова успешной проверки',
        help: 'Если после «Проверить» на странице появился такой текст, задание выполнено. Варианты разделяются «|».'
      },
      {
        path: 'patterns.failure',
        type: 'regex',
        label: 'Слова неудачной проверки',
        help: 'Такой текст означает, что сайт не засчитал задание. Проверяется раньше успешных слов, чтобы «не выполнено» не спутать с «выполнено».'
      }
    ]
  },
  {
    id: 'speed',
    title: 'Скорость и паузы',
    description: 'Паузы между действиями. Каждый раз берётся случайное значение из диапазона, чтобы действия были похожи на человеческие. Слишком маленькие паузы повышают риск, что TikTok или сайт заметят автоматизацию.',
    fields: [
      {
        path: 'delays.betweenSteps',
        type: 'range',
        label: 'Пауза между шагами',
        help: 'Между переходами и кликами (открыть TikTok → вернуться → «Проверить»).'
      },
      {
        path: 'delays.afterAction',
        type: 'range',
        label: 'Побыть на TikTok после действия',
        help: 'Сколько оставаться на странице TikTok после лайка или подписки, чтобы TikTok успел сохранить действие.'
      },
      {
        path: 'delays.betweenTasks',
        type: 'range',
        label: 'Пауза между заданиями',
        help: 'Отдых после завершения задания перед следующим.'
      },
      {
        path: 'tiktok.viewSeconds',
        type: 'int',
        min: 1,
        max: 600,
        unit: 'сек',
        label: 'Длительность «просмотра»',
        help: 'Сколько секунд смотреть видео в заданиях на просмотр.'
      },
      {
        path: 'delays.balancePoll',
        type: 'seconds',
        min: 0.5,
        max: 30,
        label: 'Как часто перечитывать баланс',
        advanced: true,
        help: 'Интервал проверки баланса во время ожидания начисления.'
      },
      {
        path: 'delays.emptyScanReload',
        type: 'seconds',
        min: 1,
        max: 600,
        label: 'Пауза перед обновлением пустой страницы',
        advanced: true,
        help: 'Сколько ждать, прежде чем обновить страницу, на которой нет заданий.'
      }
    ]
  },
  {
    id: 'timeouts',
    title: 'Ожидание загрузки',
    description: 'Сколько ждать загрузки страниц и появления кнопок. Увеличьте, если у вас медленный интернет и расширение пишет «не найдено» или «не появилась».',
    fields: [
      {
        path: 'timeouts.pageLoad',
        type: 'seconds',
        min: 5,
        max: 300,
        label: 'Загрузка страницы',
        help: 'Максимальное ожидание загрузки вкладки (сайта или TikTok).'
      },
      {
        path: 'timeouts.tiktokElement',
        type: 'seconds',
        min: 5,
        max: 300,
        label: 'Появление кнопок на TikTok',
        help: 'Сколько ждать кнопку «Нравится» или «Подписаться». TikTok часто грузится медленно.'
      },
      {
        path: 'timeouts.element',
        type: 'seconds',
        min: 2,
        max: 300,
        label: 'Появление заданий на сайте',
        help: 'Сколько ждать, пока на странице с заданиями появится задание или кнопка.'
      },
      {
        path: 'timeouts.checkButton',
        type: 'seconds',
        min: 2,
        max: 300,
        label: 'Появление кнопки «Проверить»',
        help: 'Расширение не нажимает кнопку, пока она не появилась и не стала активной.'
      },
      {
        path: 'timeouts.newTab',
        type: 'seconds',
        min: 1,
        max: 60,
        label: 'Открытие TikTok сайтом',
        help: 'Сколько ждать, что сайт сам откроет TikTok после клика «Выполнить». Если вкладка не открылась, расширение откроет ссылку само.'
      },
      {
        path: 'timeouts.captcha',
        type: 'seconds',
        min: 10,
        max: 1800,
        label: 'Ожидание решения капчи',
        help: 'Если TikTok показал капчу, расширение ждёт, пока вы её решите вручную.'
      },
      {
        path: 'timeouts.command',
        type: 'seconds',
        min: 30,
        max: 1800,
        label: 'Общий лимит на действие',
        advanced: true,
        help: 'Максимальное время одного действия на TikTok целиком.'
      }
    ]
  },
  {
    id: 'tabs',
    title: 'Вкладки',
    description: 'Как открывать и закрывать TikTok.',
    fields: [
      {
        path: 'behavior.useSiteOpenButton',
        type: 'toggle',
        label: 'Открывать TikTok кнопкой сайта',
        help: 'Нажимать на сайте «Выполнить» / «Через браузер». Сайт часто засчитывает задание, только если был этот клик. Если выключить, расширение откроет ссылку само.'
      },
      {
        path: 'behavior.closeTikTokTab',
        type: 'toggle',
        label: 'Закрывать вкладку TikTok после действия',
        help: 'Иначе вкладки TikTok будут накапливаться.'
      }
    ]
  },
  {
    id: 'site',
    title: 'Элементы сайта с заданиями',
    description:
      'Где на сайте находятся задания и кнопки. Для tiktop-free.com всё уже настроено. Меняйте, только если сайт изменил вёрстку или вы используете другой сайт. Это CSS-селекторы, по одному в строке: расширение берёт первый подходящий. Кнопки ищутся сначала по селекторам, потом по тексту. Нажмите «Проверить на странице» внизу, чтобы увидеть, что находится.',
    fields: [
      { path: 'selectors.taskCard', type: 'list', label: 'Карточка задания', help: 'Блок, в котором находится одно задание (текст, ссылка, кнопки).' },
      { path: 'selectors.taskIdInput', type: 'list', label: 'Поле с номером задания', help: 'Скрытое поле внутри карточки с id задания. По нему расширение узнаёт задание после возврата с TikTok.' },
      { path: 'selectors.targetLink', type: 'list', label: 'Ссылка на TikTok', help: 'Ссылка внутри карточки, которую открывать. Используется первая найденная.' },
      { path: 'selectors.openButton.selectors', type: 'list', label: 'Кнопка «Выполнить» — селекторы' },
      { path: 'selectors.openButton.text', type: 'regex', label: 'Кнопка «Выполнить» — текст', help: 'Если по селекторам не нашлась, ищется кнопка с таким текстом.' },
      { path: 'selectors.checkButton.selectors', type: 'list', label: 'Кнопка «Проверить» — селекторы' },
      { path: 'selectors.checkButton.text', type: 'regex', label: 'Кнопка «Проверить» — текст' },
      { path: 'selectors.skipButton.selectors', type: 'list', label: 'Кнопка «Пропустить / ×» — селекторы' },
      { path: 'selectors.skipButton.text', type: 'regex', label: 'Кнопка «Пропустить» — текст' },
      { path: 'selectors.balance', type: 'list', label: 'Баланс', help: 'Элемент с числом баланса. Если не найден, ищется текст «Баланс: 12.5».' },
      { path: 'selectors.balanceLabel', type: 'regex', label: 'Подпись баланса', advanced: true },
      { path: 'selectors.notifications', type: 'list', label: 'Где сайт показывает ответ проверки', help: 'Всплывающие окна и уведомления, в которых ищутся слова успешной и неудачной проверки.', advanced: true },
      { path: 'selectors.dialogClose', type: 'list', label: 'Кнопки закрытия окон', help: 'Закрыть окно с результатом проверки перед следующей попыткой.', advanced: true },
      { path: 'selectors.dialogs', type: 'list', label: 'Диалоговые окна', advanced: true },
      { path: 'selectors.confirmButton.selectors', type: 'list', label: 'Кнопка подтверждения в диалоге — селекторы', advanced: true },
      { path: 'selectors.confirmButton.text', type: 'regex', label: 'Кнопка подтверждения — текст', advanced: true },
      { path: 'selectors.clickableCandidates', type: 'selector', label: 'Что считать кнопкой', help: 'Среди каких элементов искать кнопки по тексту.', advanced: true }
    ]
  },
  {
    id: 'tiktok',
    title: 'Элементы TikTok',
    description: 'Кнопки на страницах TikTok. Меняйте, только если TikTok изменил вёрстку и расширение пишет «Кнопка Like не найдена».',
    advanced: true,
    fields: [
      { path: 'tiktok.likeButton', type: 'list', label: 'Кнопка «Нравится»' },
      { path: 'tiktok.likedColor', type: 'text', label: 'Цвет поставленного лайка (RGB)', help: 'По красному цвету сердца расширение понимает, что лайк уже стоит, и не снимает его повторным кликом.' },
      { path: 'tiktok.followButton', type: 'list', label: 'Кнопка «Подписаться»' },
      { path: 'tiktok.followText', type: 'regex', label: 'Текст кнопки «Подписаться»' },
      { path: 'tiktok.followingText', type: 'regex', label: 'Текст «Вы уже подписаны»', help: 'Если на кнопке такой текст, подписка уже есть, и повторно не кликаем (иначе будет отписка и штраф).' },
      { path: 'tiktok.loginModal', type: 'list', label: 'Окно входа TikTok', help: 'Если оно появилось, вы не вошли в TikTok, и выполнение остановится.' },
      { path: 'tiktok.captcha', type: 'list', label: 'Капча TikTok' },
      { path: 'tiktok.unavailableText', type: 'regex', label: 'Текст «видео недоступно»', help: 'Такое задание пропускается сразу, без повторов.' },
      { path: 'tiktok.urlPattern', type: 'regex', label: 'Адреса TikTok' }
    ]
  }
];

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  o[keys[keys.length - 1]] = value;
}
