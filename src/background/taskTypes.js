// Реестр типов заданий. Чтобы добавить новый тип:
//   1) добавьте запись сюда (как распознать задание и какие действия выполнить);
//   2) если действие новое — реализуйте его в src/content/tiktok/actions.js
//      (объект ACTIONS, ключ = имя действия).
//
// match получает { text, url } задания и возвращает true, если тип подходит.
// actions — список действий, которые выполнит TikTok-драйвер по порядку.
// targetUrl (необязательно) — как построить URL цели из данных задания.

export const TASK_TYPES = [
  {
    id: 'follow',
    label: 'Подписка',
    match: ({ text }) => /(подпи[сш]|follow|subscri|фолл?о[вw])/i.test(text),
    actions: ['follow'],
    targetUrl: (task) => task.url || (task.username ? `https://www.tiktok.com/@${task.username}` : null)
  },
  {
    id: 'like',
    label: 'Like',
    match: ({ text }) => /(лайк|\blike|нрав|сердеч|heart)/i.test(text),
    actions: ['like']
  },
  {
    id: 'view',
    label: 'Просмотр',
    match: ({ text }) => /(просмотр|посмотр|\bview|\bwatch|посетит|\bvisit)/i.test(text),
    actions: ['view'],
    // «Просмотр» применяется только если нет более конкретного действия.
    fallbackOnly: true
  }
];

export function getType(id) {
  return TASK_TYPES.find((t) => t.id === id) || null;
}

function defaultTargetUrl(task) {
  if (task.url) return task.url;
  if (task.username) return `https://www.tiktok.com/@${task.username}`;
  return null;
}

// Определяет тип задания. Если в тексте несколько действий
// («поставьте лайк и подпишитесь») — объединяет их.
export function classifyTask(task, cfg) {
  const matched = TASK_TYPES.filter((t) => t.match(task));
  let types = matched.filter((t) => !t.fallbackOnly);
  if (!types.length) types = matched;

  if (!types.length) {
    const fallback = cfg.behavior.unknownTaskAction;
    if (!fallback) return null;
    const t = getType(fallback);
    types = t ? [t] : [{ id: fallback, label: fallback, actions: [fallback] }];
  }

  const primary = types[0];
  const actions = [...new Set(types.flatMap((t) => t.actions))];
  return {
    ...task,
    type: types.map((t) => t.id).join('+'),
    typeLabel: types.map((t) => t.label).join(' + '),
    actions,
    targetUrl: (primary.targetUrl || defaultTargetUrl)(task)
  };
}
