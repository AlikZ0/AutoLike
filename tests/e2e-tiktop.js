// E2E-тест на макете tiktop-free.com (разметка карточки взята с реального сайта):
// одно задание на экране, форма UserPerformTask с submit-кнопками check/hide,
// сайт определяет нажатую кнопку по document.activeElement, ошибка — в модальном окне
// Materialize (#popup-task-error_message.open), успех — toast + следующее задание.
// Запуск: npm install && node tests/e2e-tiktop.js
const { chromium } = require('playwright');
const path = require('path');
const EXT = path.resolve(__dirname, '..');

const state = { balance: 4.2, liked: new Set(), followed: new Set(), started: new Set(), hidden: new Set(), done: new Set(), checks: {}, badActions: [] };
const TASKS = [
  { id: '101', title: 'Поставить лайк', vid: '7000000000000000111' },
  { id: '102', title: 'Подписаться', user: 'alice', needChecks: 2 },
  { id: '103', title: 'Поставить лайк', vid: '7000000000000000666' }, // лайк не ставится → 4 попытки → скрыть
  { id: '104', title: 'Поставить лайк', vid: '7000000000000000222' },
];
const isDone = (t) => (t.vid ? state.liked.has(t.vid) : state.followed.has(t.user));
const current = () => TASKS.find((t) => !state.done.has(t.id) && !state.hidden.has(t.id));

function cardHtml(t) {
  if (!t) return '<p>Заданий нет</p>';
  const main = t.vid ? `https://m.tiktok.com/v/${t.vid}.html` : `https://m.tiktok.com/h5/share/usr/${t.user}.html`;
  const browser = t.vid ? `https://www.tiktok.com/@username/video/${t.vid}` : `https://www.tiktok.com/@${t.user}`;
  return `<div class="col list-item--wrapper task-item--wrapper"><div class="card-panel list-item task-item">
  <form name="UserPerformTask" onsubmit="event.preventDefault(); return false;">
    <input type="hidden" name="UserPerformTask[id]" value="${t.id}">
    <input type="hidden" name="UserPerformTask[task_execution_id]" value="${Math.floor(Math.random() * 1e9)}">
    <button class="btn waves-effect btn--close" type="submit" name="UserPerformTask[submit]" value="hide">×</button>
    <div class="list-item--header task-item--header"><div class="list-item--title task-item--title">${t.title}</div></div>
    <div class="task-item--buttons">
      <a class="btn btn-block waves-effect btn--complete" href="${main}" target="_blank"><span class="left">Выполнить</span><span class="right text-green">+ 0.25</span></a>
      <a class="btn btn-block waves-effect btn--complete2" href="${browser}" target="_blank"><span class="left">Через браузер</span><span class="right text-green">+ 0.25</span></a>
      <a class="btn btn-block waves-effect btn--complete2" href="" target="_blank"><span class="left">Через телефон</span><span class="right text-green">+ 0.25</span></a>
      <div class="row"><div class="col s10"><button class="btn btn-block btn--purple waves-effect btn--check" type="submit" name="UserPerformTask[submit]" value="check">Проверить</button></div>
      <div class="col s2"><button class="btn btn-block btn--purple waves-effect" type="submit" name="UserPerformTask[submit]" value="hide">×</button></div></div>
    </div>
  </form></div></div>`;
}

const PAGE = () => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Все задания</title>
<style>.modal{display:none}.modal.open{display:block}.hide-on-large-only{display:none}</style></head><body>
<div class="user-sidebar_menu--header hide-on-large-only"><p class="user-balance--wrapper"><span class="user-balance">${state.balance}</span></p></div>
<aside><p class="user-balance--wrapper"> Баланс: <span class="user-balance">${state.balance}</span></p></aside>
<div class="do_tasks-rules">Выполняйте задания. Если Вы снимите лайк, то получите штраф. Порядок выполнения заданий.</div>
<div class="tasks-list_block"><div class="list"><div class="row" id="row"></div></div></div>
<div id="popup-task-error_message" class="modal modal-middle"><div class="modal-close waves-effect">×</div><div class="modal-wrapper"><div class="modal-content"></div></div></div>
<div id="toast-container"></div>
<script>
function bind(){
  const form = document.querySelector('form[name=UserPerformTask]'); if(!form) return;
  form.querySelectorAll('.btn--complete, .btn--complete2').forEach(a => a.addEventListener('click', () => {
    fetch('/api/start?id=' + form.querySelector('[name="UserPerformTask[id]"]').value);
  }));
  form.addEventListener('submit', async (e) => {
    // Как на многих сайтах: нажатую кнопку определяем по фокусу.
    const action = document.activeElement && document.activeElement.value;
    const id = form.querySelector('[name="UserPerformTask[id]"]').value;
    const r = await (await fetch('/api/perform?id=' + id + '&action=' + action)).json();
    await new Promise(r => setTimeout(r, 700));
    if (r.error) {
      const m = document.getElementById('popup-task-error_message');
      m.querySelector('.modal-content').textContent = r.error;
      m.classList.add('open');
      return;
    }
    if (r.success) { const t = document.createElement('div'); t.className='toast ttf_msg_success'; t.textContent = r.success;
      document.getElementById('toast-container').appendChild(t); setTimeout(() => t.remove(), 3000); }
    document.querySelectorAll('.user-balance').forEach(b => b.textContent = r.balance);
    document.getElementById('row').innerHTML = r.next; bind();
  });
}
document.querySelector('.modal-close').onclick = () => document.getElementById('popup-task-error_message').classList.remove('open');
setTimeout(() => { document.getElementById('row').innerHTML = ${JSON.stringify(cardHtml(current()))}; bind(); }, 800);
</script></body></html>`;

const VIDEO_PAGE = (vid) => `<!doctype html><html><head><meta charset=utf-8></head><body>
<h1>TikTok mock video ${vid}</h1><p>${'lorem ipsum '.repeat(10)}</p><div id="root"></div>
<script>setTimeout(()=>{ document.getElementById('root').innerHTML='<button aria-pressed="false" id="lb"><span data-e2e="like-icon">♥</span></button>';
 document.getElementById('lb').onclick=async function(){ if ('${vid}'.endsWith('666')) return; await fetch('https://tiktop-free.com/api/like?vid=${vid}'); this.setAttribute('aria-pressed','true'); };
}, 1500);</script></body></html>`;
const PROFILE_PAGE = (user) => `<!doctype html><html><head><meta charset=utf-8></head><body><h1>@${user}</h1><p>${'profile '.repeat(20)}</p>
<button data-e2e="follow-button" id="fb">Подписаться</button>
<script>document.getElementById('fb').onclick=async function(){ await fetch('https://tiktop-free.com/api/follow?u=${user}'); this.textContent='Подписки'; };</script></body></html>`;

(async () => {
  const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`] });
  const json = (route, obj) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(obj) });
  await ctx.route('https://tiktop-free.com/**', (route) => {
    const u = new URL(route.request().url());
    const q = (k) => u.searchParams.get(k);
    if (u.pathname === '/tasks/') return route.fulfill({ status: 200, contentType: 'text/html', body: PAGE() });
    if (u.pathname === '/api/start') { state.started.add(q('id')); return json(route, {}); }
    if (u.pathname === '/api/like') { state.liked.add(q('vid')); return json(route, {}); }
    if (u.pathname === '/api/follow') { state.followed.add(q('u')); return json(route, {}); }
    if (u.pathname === '/api/perform') {
      const t = TASKS.find((x) => x.id === q('id'));
      const action = q('action');
      if (action === 'hide') { state.hidden.add(t.id); return json(route, { balance: state.balance, next: cardHtml(current()) }); }
      if (action !== 'check') { state.badActions.push(action); return json(route, { error: 'Неизвестное действие' }); }
      state.checks[t.id] = (state.checks[t.id] || 0) + 1;
      console.log(`[site] check ${t.id} #${state.checks[t.id]} started=${state.started.has(t.id)} done=${isDone(t)}`);
      if (!state.started.has(t.id)) return json(route, { error: 'Сначала нажмите «Выполнить»' });
      if (!isDone(t) || state.checks[t.id] < (t.needChecks || 1)) return json(route, { error: t.vid ? 'Вы не поставили лайк' : 'Вы не подписались на аккаунт' });
      state.done.add(t.id); state.balance = Math.round((state.balance + 0.25) * 100) / 100;
      return json(route, { success: 'Задание выполнено', balance: state.balance, next: cardHtml(current()) });
    }
    return route.fulfill({ status: 404, body: 'nf' });
  });
  await ctx.route(/https:\/\/(www|m)\.tiktok\.com\/.*/, (route) => {
    const u = new URL(route.request().url());
    let m;
    if ((m = u.pathname.match(/^\/v\/(\d+)\.html/))) return route.fulfill({ status: 302, headers: { location: `https://www.tiktok.com/@username/video/${m[1]}` } });
    if ((m = u.pathname.match(/^\/h5\/share\/usr\/([^.]+)\.html/))) return route.fulfill({ status: 302, headers: { location: `https://www.tiktok.com/@${m[1]}` } });
    if ((m = u.pathname.match(/^\/@[^/]+\/video\/(\d+)/))) return route.fulfill({ status: 200, contentType: 'text/html', body: VIDEO_PAGE(m[1]) });
    if ((m = u.pathname.match(/^\/@([^/]+)/))) return route.fulfill({ status: 200, contentType: 'text/html', body: PROFILE_PAGE(m[1]) });
    return route.fulfill({ status: 404, body: 'nf' });
  });

  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = new URL(sw.url()).host;
  const page = await ctx.newPage();
  await page.goto('https://tiktop-free.com/tasks/?test=test');
  const ctl = await ctx.newPage();
  await ctl.goto(`chrome-extension://${extId}/src/options/options.html`);
  // Имитируем конфиг, сохранённый старой версией целиком (проверка миграции).
  await ctl.evaluate(async () => {
    const legacy = JSON.parse(document.getElementById('json').value || '{}');
    legacy.selectors.checkButton.selectors = ['.old-selector'];
    legacy.delays = { betweenSteps: [200, 400], afterAction: [500, 800], betweenTasks: [300, 500], balancePoll: 700, emptyScanReload: 1000 };
    legacy.timeouts = { ...legacy.timeouts, checkResult: 8000, balanceUpdate: 5000, element: 8000, newTab: 4000, tiktokElement: 8000 };
    legacy.limits = { maxEmptyScans: 1, maxTasksPerRun: 0 };
    delete legacy._v;
    await chrome.storage.local.set({ autolikeConfig: legacy });
  });
  await page.bringToFront();
  console.log('start:', await ctl.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://tiktop-free.com/*' });
    return chrome.runtime.sendMessage({ type: 'start', tabId: tab.id });
  }));

  let last = '', final = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 300000) {
    const s = await ctl.evaluate(async () => (await chrome.storage.local.get('autolikeState')).autolikeState);
    const line = `${s.running ? 'RUN' : 'STOP'} ${s.phase} ${s.attempt}/${s.maxAttempts} ok=${s.stats.success} fail=${s.stats.failed} bal=${s.balance} | ${s.status}`;
    if (line !== last) { console.log(line); last = line; }
    if (!s.running) { final = s; break; }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log('FAILED:', JSON.stringify(final.failedTasks.map(f => [f.id, f.reason])));
  console.log('LOG:\n' + final.log.filter((e) => e.kind === 'debug').map((e) => '  ' + e.text).join('\n'));
  console.log('SERVER:', JSON.stringify({ balance: state.balance, started: [...state.started], hidden: [...state.hidden], done: [...state.done], checks: state.checks, badActions: state.badActions }));
  await ctx.close();

  const ok = final.stats.success === 3 && final.stats.failed === 1 && state.hidden.has('103') && state.checks['102'] === 2 &&
    final.failedTasks[0]?.attempts === 4 && !state.checks['103'] && state.badActions.length === 0 && Math.abs(final.balance - 4.95) < 1e-6;
  console.log(ok ? 'E2E PASSED' : 'E2E FAILED');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
