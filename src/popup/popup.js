import { STATE_KEY } from '../background/state.js';

const $ = (id) => document.getElementById(id);

function send(type, extra = {}) {
  return chrome.runtime.sendMessage({ type, ...extra });
}

function showError(text) {
  const el = $('error');
  el.textContent = text || '';
  el.hidden = !text;
}

function time(t) {
  return new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatBalance(v) {
  return v == null ? '—' : String(Math.round(v * 1000) / 1000);
}

function renderTask(task) {
  const box = $('task');
  box.replaceChildren();
  if (!task) {
    box.textContent = '—';
    return;
  }
  const type = document.createElement('div');
  type.className = 'type';
  type.textContent = task.typeLabel || task.type;
  box.appendChild(type);
  if (task.targetUrl) {
    const a = document.createElement('a');
    a.href = task.targetUrl;
    a.target = '_blank';
    a.textContent = task.targetUrl;
    box.appendChild(a);
  }
  if (task.text) {
    const t = document.createElement('div');
    t.className = 'text';
    t.textContent = task.text.slice(0, 160);
    box.appendChild(t);
  }
}

function renderList(el, items, fmt) {
  el.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement('li');
      fmt(li, item);
      return li;
    })
  );
}

function render(s) {
  const running = !!s.running;
  const toggle = $('toggle');
  toggle.textContent = running ? 'Stop' : 'Start';
  toggle.classList.toggle('stop', running);
  $('runBadge').textContent = running ? 'Работает' : 'Остановлено';
  $('runBadge').classList.toggle('on', running);

  $('status').textContent = s.status || '—';
  $('attempt').textContent = s.currentTask && s.attempt ? `Attempt ${s.attempt}/${s.maxAttempts}` : '—';
  renderTask(s.currentTask);
  $('success').textContent = s.stats?.success ?? 0;
  $('failed').textContent = s.stats?.failed ?? 0;
  $('balance').textContent = formatBalance(s.balance);

  const failed = [...(s.failedTasks || [])].reverse();
  $('failedCount').textContent = failed.length;
  renderList($('failedList'), failed, (li, f) => {
    li.textContent = `${time(f.t)} · ${f.label || f.type}: ${f.reason}${f.url ? ' — ' + f.url : ''}`;
  });

  const log = [...(s.log || [])].reverse().slice(0, 30);
  renderList($('log'), log, (li, e) => {
    li.className = e.kind || '';
    const t = document.createElement('span');
    t.className = 'time';
    t.textContent = time(e.t);
    li.append(t, document.createTextNode(e.text));
  });
}

async function refresh() {
  const res = await send('getState');
  if (res?.ok) render(res.state);
}

$('toggle').addEventListener('click', async () => {
  showError('');
  const btn = $('toggle');
  btn.disabled = true;
  try {
    const { state } = await send('getState');
    let res;
    if (state.running) {
      res = await send('stop');
    } else {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      res = await send('start', { tabId: tab?.id });
    }
    if (!res?.ok) showError(res?.error || 'Ошибка');
  } finally {
    btn.disabled = false;
    refresh();
  }
});

$('reset').addEventListener('click', async () => {
  await send('resetStats');
  refresh();
});

$('copyLog').addEventListener('click', async () => {
  const { state } = await send('getState');
  const lines = [
    `status: ${state.status}`,
    `phase: ${state.phase}, attempt: ${state.attempt}/${state.maxAttempts}, balance: ${state.balance}`,
    `task: ${JSON.stringify(state.currentTask)}`,
    `lastError: ${state.lastError}`,
    '--- log ---',
    ...state.log.map((e) => `${time(e.t)} [${e.kind}] ${e.text}`),
    '--- failed ---',
    ...state.failedTasks.map((f) => `${time(f.t)} ${f.label} ${f.url || ''}: ${f.reason}`)
  ];
  await navigator.clipboard.writeText(lines.join('\n'));
  $('copyLog').textContent = 'Скопировано ✓';
  setTimeout(() => ($('copyLog').textContent = 'Копировать журнал'), 1500);
});

$('options').addEventListener('click', () => chrome.runtime.openOptionsPage());

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STATE_KEY]?.newValue) render(changes[STATE_KEY].newValue);
});

refresh();
