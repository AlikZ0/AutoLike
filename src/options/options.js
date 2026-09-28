import { DEFAULT_CONFIG, getConfig, saveConfigOverrides, resetConfig, diffFromDefaults, deepMerge, isTikTokUrl } from '../background/config.js';
import { SECTIONS, getPath, setPath } from './schema.js';

const $ = (id) => document.getElementById(id);
const form = $('form');
const ADV_KEY = 'autolike-options-advanced';

let working = null; // редактируемая копия конфига
let saved = null; // последняя сохранённая версия (для «несохранённых изменений»)
const controls = new Map(); // path → { field, row, render() }

// ---------- утилиты ----------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.filter(Boolean));
  return node;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const round = (n) => Math.round(n * 100) / 100;

function say(text, kind = '') {
  $('msg').textContent = text;
  $('msg').className = kind;
}

function validSelector(sel) {
  try {
    document.createDocumentFragment().querySelector(sel);
    return true;
  } catch {
    return false;
  }
}

// Принимает "/.../флаги" или просто слова через «|» (тогда добавляется флаг i).
function normalizeRegex(text) {
  const t = text.trim();
  if (!t) return { error: 'Шаблон не может быть пустым' };
  const m = t.match(/^\/(.*)\/([a-z]*)$/s);
  const body = m ? m[1] : t;
  const flags = m ? m[2] : 'i';
  try {
    new RegExp(body, flags);
  } catch (e) {
    return { error: `Ошибка в шаблоне: ${e.message}` };
  }
  return { value: `/${body}/${flags}` };
}

// "/(выполнено|засчитано|\\bdone\\b)/i" → "выполнено, засчитано, done"
function humanRegex(value) {
  const m = String(value).match(/^\/(.*)\/[a-z]*$/s);
  let body = m ? m[1] : String(value);
  if (body.startsWith("(") && body.endsWith(")")) body = body.slice(1, -1);
  const human = body
    .replace(/\\b/g, '')
    .replace(/\\s\*/g, ' ')
    .replace(/\\s/g, ' ')
    .replace(/\^|\$/g, '')
    .replace(/\\(.)/g, '$1');
  return human.split('|').map((x) => x.trim()).filter(Boolean).join(', ');
}

function describeDefault(field, value) {
  switch (field.type) {
    case 'toggle':
      return value ? 'включено' : 'выключено';
    case 'seconds':
      return `${round(value / 1000)} сек`;
    case 'range':
      return `${round(value[0] / 1000)}–${round(value[1] / 1000)} сек`;
    case 'select':
      return (field.options.find((o) => same(o.value, value)) || {}).label || String(value);
    case 'list':
      return value.length ? value.join('   ') : '(пусто)';
    case 'int':
      return `${value}${field.unit ? ' ' + field.unit : ''}`;
    case 'regex':
      return humanRegex(value);
    default:
      return String(value);
  }
}

// ---------- построение контролов ----------

// Каждый тип возвращает { node, read(): {value}|{error}, write(value) }.
const BUILDERS = {
  int(field) {
    const input = el('input', { type: 'number', step: 1, min: field.min, max: field.max });
    const node = field.unit ? el('div', { class: 'unit' }, input, field.unit) : input;
    return {
      node,
      write: (v) => (input.value = v),
      read() {
        const n = Number(input.value);
        if (input.value === '' || !Number.isInteger(n)) return { error: 'Введите целое число' };
        if (field.min != null && n < field.min) return { error: `Не меньше ${field.min}` };
        if (field.max != null && n > field.max) return { error: `Не больше ${field.max}` };
        return { value: n };
      }
    };
  },

  seconds(field) {
    const input = el('input', { type: 'number', step: 0.5, min: field.min, max: field.max });
    return {
      node: el('div', { class: 'unit' }, input, 'сек'),
      write: (v) => (input.value = round(v / 1000)),
      read() {
        const n = Number(input.value);
        if (input.value === '' || !Number.isFinite(n)) return { error: 'Введите число секунд' };
        if (field.min != null && n < field.min) return { error: `Не меньше ${field.min} сек` };
        if (field.max != null && n > field.max) return { error: `Не больше ${field.max} сек` };
        return { value: Math.round(n * 1000) };
      }
    };
  },

  range() {
    const a = el('input', { type: 'number', step: 0.5, min: 0 });
    const b = el('input', { type: 'number', step: 0.5, min: 0 });
    return {
      node: el('div', { class: 'range' }, 'от', a, 'до', b, 'сек'),
      write: (v) => {
        a.value = round(v[0] / 1000);
        b.value = round(v[1] / 1000);
      },
      read() {
        const x = Number(a.value);
        const y = Number(b.value);
        if (a.value === '' || b.value === '' || !Number.isFinite(x) || !Number.isFinite(y)) return { error: 'Введите оба значения' };
        if (x < 0 || y < 0) return { error: 'Значения не могут быть отрицательными' };
        if (x > y) return { error: '«От» должно быть не больше «до»' };
        return { value: [Math.round(x * 1000), Math.round(y * 1000)] };
      }
    };
  },

  toggle() {
    const input = el('input', { type: 'checkbox' });
    return {
      node: el('label', { class: 'switch' }, input, el('span')),
      write: (v) => (input.checked = !!v),
      read: () => ({ value: input.checked })
    };
  },

  select(field) {
    const select = el('select');
    field.options.forEach((o, i) => select.append(el('option', { value: i, text: o.label })));
    return {
      node: select,
      write: (v) => (select.value = Math.max(0, field.options.findIndex((o) => same(o.value, v)))),
      read: () => ({ value: field.options[Number(select.value)].value })
    };
  },

  list() {
    const area = el('textarea', { spellcheck: 'false', rows: 4, placeholder: 'по одному селектору в строке' });
    return {
      node: area,
      wide: true,
      write: (v) => {
        area.value = (v || []).join('\n');
        area.rows = Math.min(10, Math.max(3, (v || []).length));
      },
      read() {
        const lines = area.value.split('\n').map((l) => l.trim()).filter(Boolean);
        const bad = lines.filter((l) => !validSelector(l));
        if (bad.length) return { error: `Неверный селектор: ${bad[0]}` };
        return { value: lines };
      }
    };
  },

  selector() {
    const input = el('input', { type: 'text', class: 'mono', spellcheck: 'false' });
    return {
      node: input,
      wide: true,
      write: (v) => (input.value = v),
      read: () => (validSelector(input.value) ? { value: input.value.trim() } : { error: 'Неверный CSS-селектор' })
    };
  },

  regex() {
    const input = el('input', { type: 'text', class: 'mono', spellcheck: 'false', placeholder: 'слово1|слово2' });
    return {
      node: input,
      wide: true,
      write: (v) => (input.value = v),
      read: () => normalizeRegex(input.value)
    };
  },

  text() {
    const input = el('input', { type: 'text', spellcheck: 'false' });
    return { node: input, write: (v) => (input.value = v ?? ''), read: () => ({ value: input.value.trim() }) };
  }
};

function buildField(field) {
  const ctl = BUILDERS[field.type](field);
  const defValue = getPath(DEFAULT_CONFIG, field.path);
  const err = el('div', { class: 'err', hidden: true });
  const resetBtn = el('button', { type: 'button', class: 'reset', title: 'Вернуть значение по умолчанию', text: '↺' });
  const hint = field.type === 'regex' ? ' Можно писать просто слова через «|», например: выполнено|засчитано.' : '';

  const info = el(
    'div',
    {},
    el('div', { class: 'label' }, el('span', { class: 'dot', title: 'Изменено' }), field.label, field.advanced ? el('span', { class: 'badge-adv', text: 'расширенное' }) : null),
    field.help || hint ? el('div', { class: 'help', text: (field.help || '') + hint }) : null,
    el('div', { class: 'def' }, 'По умолчанию: ', el('code', { text: describeDefault(field, defValue) }))
  );
  const row = el('div', { class: `field${ctl.wide ? ' wide' : ''}`, 'data-path': field.path }, info, el('div', {}, el('div', { class: 'control' }, el('div', { class: 'main' }, ctl.node), resetBtn), err));

  const refreshMark = () => {
    row.classList.toggle('changed', !same(getPath(working, field.path), defValue));
    applyVisibility();
  };

  const onChange = () => {
    const res = ctl.read();
    row.classList.toggle('invalid', !!res.error);
    err.hidden = !res.error;
    err.textContent = res.error || '';
    if (!res.error) setPath(working, field.path, res.value);
    refreshMark();
    syncJson();
    markDirty();
  };
  row.addEventListener('input', onChange);
  row.addEventListener('change', onChange);

  resetBtn.addEventListener('click', () => {
    setPath(working, field.path, structuredClone(defValue));
    render();
    onChange();
  });

  const render = () => {
    ctl.write(getPath(working, field.path));
    row.classList.remove('invalid');
    err.hidden = true;
    refreshMark();
  };

  controls.set(field.path, { field, row, render, isInvalid: () => row.classList.contains('invalid') });
  return row;
}

function buildForm() {
  form.replaceChildren();
  $('toc').replaceChildren();
  for (const section of SECTIONS) {
    const card = el(
      'section',
      { class: 'card', id: `sec-${section.id}`, 'data-advanced': section.advanced ? '1' : '' },
      el('h2', { text: section.title }),
      el('p', { class: 'desc', text: section.description })
    );
    section.fields.forEach((f) => card.append(buildField(f)));
    form.append(card);
    $('toc').append(el('a', { href: `#sec-${section.id}`, text: section.title, 'data-sec': section.id }));
  }
  $('toc').append(el('a', { href: '#diagnose', text: 'Проверить на странице' }));
}

function renderAll() {
  controls.forEach((c) => c.render());
  syncJson();
}

// Расширенные поля скрыты, если не включён переключатель, но изменённые показываем всегда.
function applyVisibility() {
  const showAdv = $('showAdvanced').checked;
  controls.forEach(({ field, row }) => {
    row.classList.toggle('hidden', !!field.advanced && !showAdv && !row.classList.contains('changed'));
  });
  for (const section of SECTIONS) {
    const card = $(`sec-${section.id}`);
    if (!card) continue;
    const anyVisible = [...card.querySelectorAll('.field')].some((r) => !r.classList.contains('hidden'));
    const hide = (section.advanced && !showAdv && !card.querySelector('.field.changed')) || !anyVisible;
    card.classList.toggle('hidden', hide);
    document.querySelector(`.toc a[data-sec="${section.id}"]`)?.classList.toggle('hidden', hide);
  }
}

function syncJson() {
  $('json').value = JSON.stringify(working, null, 2);
}

function markDirty() {
  if (!same(working, saved)) say('Есть несохранённые изменения');
  else say('');
}

// ---------- сохранение ----------

async function save() {
  const invalid = [...controls.values()].find((c) => c.isInvalid());
  if (invalid) {
    invalid.row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    say(`Исправьте поле «${invalid.field.label}»`, 'err');
    return;
  }
  await saveConfigOverrides(diffFromDefaults(working) || {});
  saved = structuredClone(working);
  say('✓ Сохранено. Применится со следующего шага.', 'ok');
}

async function load() {
  const cfg = await getConfig();
  working = structuredClone(cfg);
  saved = structuredClone(cfg);
  renderAll();
  say('');
}

// ---------- проверка на странице ----------

async function fillTabs() {
  const select = $('diagTab');
  const state = (await chrome.storage.local.get('autolikeState')).autolikeState || {};
  const tabs = (await chrome.tabs.query({})).filter((t) => /^https?:/i.test(t.url || '') && !isTikTokUrl(t.url, working || DEFAULT_CONFIG));
  select.replaceChildren(
    ...(tabs.length
      ? tabs.map((t) => el('option', { value: t.id, text: `${t.title || t.url} — ${new URL(t.url).host}` }))
      : [el('option', { value: '', text: 'Нет открытых вкладок с сайтами' })])
  );
  const preferred = tabs.find((t) => t.id === state.taskTabId) || tabs.find((t) => /task|задан/i.test(t.url + t.title));
  if (preferred) select.value = preferred.id;
}

function yesNo(v) {
  return el('span', { class: v ? 'yes' : 'no', text: v ? '✓ есть' : '✕ нет' });
}

async function diagnose() {
  const out = $('diagOut');
  const tabId = Number($('diagTab').value);
  if (!tabId) return;
  out.textContent = 'Проверяем…';
  const res = await chrome.runtime.sendMessage({ type: 'diagnose', tabId, cfg: working });
  if (!res?.ok) {
    out.replaceChildren(el('div', { class: 'no', text: `Ошибка: ${res?.error || 'нет ответа'}` }));
    return;
  }
  const r = res.result;
  const summary = el(
    'div',
    {},
    el('div', {}, 'Найдено заданий: ', el('b', { text: String(r.tasks.length) }), r.tasks.length && !r.bySelectors ? ' (по эвристике, селектор карточки не совпал)' : ''),
    el('div', {}, 'Баланс: ', r.balance == null ? el('span', { class: 'no', text: 'не найден' }) : el('b', { text: String(r.balance) }))
  );
  const table = el(
    'table',
    {},
    el('tr', {}, ...['Задание', 'Тип', 'Ссылка', '«Выполнить»', '«Проверить»', '«Пропустить»'].map((h) => el('th', { text: h })))
  );
  for (const t of r.tasks) {
    table.append(
      el(
        'tr',
        {},
        el('td', { text: `${t.text.slice(0, 80)} (id: ${t.id})` }),
        el('td', { class: 'nowrap' }, t.typeLabel ? el('span', { text: t.typeLabel }) : el('span', { class: 'no', text: 'не распознан' })),
        el('td', { class: 'url', text: t.url || '—' }),
        el('td', { class: 'nowrap' }, yesNo(t.hasOpenButton)),
        el('td', { class: 'nowrap' }, yesNo(t.hasCheckButton)),
        el('td', { class: 'nowrap' }, yesNo(t.hasSkipButton))
      )
    );
  }
  out.replaceChildren(summary, r.tasks.length ? table : el('div', { class: 'no', text: 'Задания не найдены — проверьте «Карточка задания».' }));
}

// ---------- события ----------

$('save').addEventListener('click', save);
$('resetAll').addEventListener('click', async () => {
  if (!confirm('Вернуть все настройки к значениям по умолчанию?')) return;
  await resetConfig();
  await load();
  say('Все настройки сброшены.', 'ok');
});
$('applyJson').addEventListener('click', () => {
  try {
    working = deepMerge(DEFAULT_CONFIG, JSON.parse($('json').value));
  } catch (e) {
    say(`Ошибка JSON: ${e.message}`, 'err');
    return;
  }
  renderAll();
  markDirty();
});
$('showAdvanced').addEventListener('change', () => {
  try {
    localStorage.setItem(ADV_KEY, $('showAdvanced').checked ? '1' : '');
  } catch {}
  applyVisibility();
});
$('diagRefresh').addEventListener('click', fillTabs);
$('diagRun').addEventListener('click', () => diagnose().catch((e) => ($('diagOut').textContent = `Ошибка: ${e.message}`)));
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    save();
  }
});
window.addEventListener('beforeunload', (e) => {
  if (working && saved && !same(working, saved)) e.preventDefault();
});

try {
  $('showAdvanced').checked = localStorage.getItem(ADV_KEY) === '1';
} catch {}
buildForm();
await load();
fillTabs();
