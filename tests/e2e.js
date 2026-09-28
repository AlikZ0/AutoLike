// E2E-тест: Chromium с расширением + мок-сайт заданий и мок-страницы TikTok (через перехват запросов).
// Запуск: npm install && npm run test:e2e
const { chromium } = require('playwright');
const path = require('path');
const EXT = path.resolve(__dirname, '..');

const state = { balance: 10, liked: new Set(), followed: new Set(), skipped: new Set(), checks: {} };
const TASKS = [
  { id: 't1', text: 'Поставьте лайк на видео', url: 'https://www.tiktok.com/@bob/video/111', need: () => state.liked.has('111') },
  { id: 't2', text: 'Подпишитесь на аккаунт @alice', url: 'https://www.tiktok.com/@alice', need: () => state.followed.has('alice') },
  { id: 't3', text: 'Поставьте лайк (сломанное видео)', url: 'https://www.tiktok.com/@bad/video/666', need: () => state.liked.has('666') },
  // Сайт засчитывает только со 2-й проверки (эмуляция задержки TikTok)
  { id: 't4', text: 'Лайк на видео 222', url: 'https://www.tiktok.com/@carl/video/222', need: () => state.liked.has('222') && (state.checks.t4 || 0) >= 2 },
];
const done = new Set();

const TASK_PAGE = `<!doctype html><html><head><meta charset=utf-8><title>Tasks</title></head><body>
<header>Баланс: <span class="balance" id="bal"></span> ₽</header><div id="list">Загрузка…</div>
<script>
async function load(){ const r = await fetch('/api/state'); const s = await r.json();
  document.getElementById('bal').textContent = s.balance.toFixed(2);
  const list = document.getElementById('list'); list.innerHTML='';
  for (const t of s.tasks) { const d=document.createElement('div'); d.className='task-item'; d.dataset.taskId=t.id;
    d.innerHTML='<p>'+t.text+'</p><a class="lnk" href="'+t.url+'" target="_blank">'+t.url+'</a> <button class="go">Выполнить</button> <button class="check">Проверить</button> <button class="skip">Пропустить</button><div class="result"></div>';
    d.querySelector('.go').onclick=()=>window.open(t.url,'_blank');
    d.querySelector('.check').onclick=async (e)=>{ e.target.disabled=true; d.querySelector('.result').textContent='Проверяем…';
      await new Promise(r=>setTimeout(r,800)); const r=await (await fetch('/api/check?id='+t.id)).json();
      d.querySelector('.result').textContent = r.ok ? 'Задание выполнено! +2 ₽' : 'Задание не выполнено, попробуйте ещё раз';
      e.target.disabled=false;
      if (r.ok) setTimeout(load, 2500); };
    d.querySelector('.skip').onclick=async ()=>{ if(!confirm('Пропустить?')) return; await fetch('/api/skip?id='+t.id); load(); };
    list.appendChild(d); } }
setTimeout(load, 700);
</script></body></html>`;

const VIDEO_PAGE = (vid) => `<!doctype html><html><head><meta charset=utf-8></head><body>
<h1>TikTok mock video ${vid}</h1><p>${'lorem ipsum '.repeat(10)}</p>
<div id="root"></div>
<script>setTimeout(()=>{ document.getElementById('root').innerHTML='<button aria-pressed="false" id="lb"><span data-e2e="like-icon">♥</span></button><strong data-e2e="like-count">5</strong>';
 document.getElementById('lb').onclick=async function(){ if ('${vid}'==='666') return; await fetch('https://tasks.example/api/like?vid=${vid}',{method:'POST'}); this.setAttribute('aria-pressed', this.getAttribute('aria-pressed')==='true'?'false':'true'); };
}, 1500);</script></body></html>`;

const PROFILE_PAGE = (user) => `<!doctype html><html><head><meta charset=utf-8></head><body>
<h1>@${user}</h1><p>${'profile text '.repeat(10)}</p>
<button data-e2e="follow-button" id="fb">Follow</button>
<script>document.getElementById('fb').onclick=async function(){ await fetch('https://tasks.example/api/follow?u=${user}',{method:'POST'}); this.textContent='Following'; };</script></body></html>`;

(async () => {
  const ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  const json = (route, obj) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(obj) });
  await ctx.route('https://tasks.example/**', async (route) => {
    const u = new URL(route.request().url());
    const id = u.searchParams.get('id');
    if (u.pathname === '/tasks') return route.fulfill({ status: 200, contentType: 'text/html', body: TASK_PAGE });
    if (u.pathname === '/api/state') return json(route, { balance: state.balance, tasks: TASKS.filter(t => !done.has(t.id) && !state.skipped.has(t.id)).map(({ need, ...t }) => t) });
    if (u.pathname === '/api/like') { state.liked.add(u.searchParams.get('vid')); return json(route, { ok: true }); }
    if (u.pathname === '/api/follow') { state.followed.add(u.searchParams.get('u')); return json(route, { ok: true }); }
    if (u.pathname === '/api/skip') { state.skipped.add(id); return json(route, { ok: true }); }
    if (u.pathname === '/api/check') {
      state.checks[id] = (state.checks[id] || 0) + 1;
      const t = TASKS.find(x => x.id === id); const ok = t && t.need();
      if (ok && !done.has(id)) { done.add(id); setTimeout(() => { state.balance += 2; }, 1000); }
      console.log(`[site] check ${id} #${state.checks[id]} -> ${ok}`);
      return json(route, { ok });
    }
    return route.fulfill({ status: 404, body: 'nf' });
  });
  await ctx.route('https://www.tiktok.com/**', (route) => {
    const u = new URL(route.request().url());
    const m = u.pathname.match(/^\/@([^/]+)(?:\/video\/(\d+))?/);
    if (!m) return route.fulfill({ status: 404, body: 'nf' });
    return route.fulfill({ status: 200, contentType: 'text/html', body: m[2] ? VIDEO_PAGE(m[2]) : PROFILE_PAGE(m[1]) });
  });

  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = new URL(sw.url()).host;
  sw.on('console', m => console.log('[sw]', m.text()));

  const page = await ctx.newPage();
  await page.goto('https://tasks.example/tasks');

  const ctl = await ctx.newPage();
  await ctl.goto(`chrome-extension://${extId}/src/options/options.html`);
  await ctl.evaluate(async () => {
    await chrome.storage.local.set({ autolikeConfig: {
      delays: { betweenSteps: [200, 400], afterAction: [500, 800], betweenTasks: [300, 500], balancePoll: 700, emptyScanReload: 1000 },
      timeouts: { checkResult: 8000, balanceUpdate: 5000, element: 8000, newTab: 4000, tiktokElement: 8000 },
      limits: { maxEmptyScans: 1, maxTasksPerRun: 0 },
    }});
  });
  await page.bringToFront();
  const res = await ctl.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://tasks.example/*' });
    return chrome.runtime.sendMessage({ type: 'start', tabId: tab.id });
  });
  console.log('start:', res);

  const toasts = new Set();
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < 240000) {
    const s = await ctl.evaluate(async () => (await chrome.storage.local.get('autolikeState')).autolikeState);
    const line = `${s.running ? 'RUN' : 'STOP'} phase=${s.phase} attempt=${s.attempt}/${s.maxAttempts} ok=${s.stats.success} fail=${s.stats.failed} bal=${s.balance} | ${s.status}`;
    if (line !== last) { console.log(line); last = line; }
    try {
      const txt = await page.evaluate(() => { const h = document.getElementById('autolike-toast-host'); return h ? [...h.shadowRoot.querySelectorAll('.toast')].map(t => t.textContent) : []; });
      txt.forEach(t => toasts.add(t));
    } catch {}
    if (!s.running) { globalThis.final = s; console.log('FINAL', JSON.stringify({ stats: s.stats, failed: s.failedTasks.map(f => [f.id, f.reason, f.attempts]), balance: s.balance })); break; }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('TOASTS:', [...toasts]);
  console.log('SERVER:', JSON.stringify({ balance: state.balance, liked: [...state.liked], followed: [...state.followed], skipped: [...state.skipped], checks: state.checks }));
  const pop = await ctx.newPage(); await pop.setViewportSize({width:370,height:640});
  const errs=[]; pop.on('pageerror', e=>errs.push(e.message));
  await pop.goto(`chrome-extension://${extId}/src/popup/popup.html`); await pop.waitForTimeout(800);
  await pop.evaluate(()=>{document.querySelectorAll('details').forEach(d=>d.open=true)});
  await pop.screenshot({path: path.join(__dirname, 'popup.png')}); console.log('popup errors:', errs);
  console.log('pages open:', ctx.pages().map(p => p.url()));
  await ctx.close();

  // Ожидаем: t1, t2, t4 выполнены (t4 — со 2-й попытки), t3 провален после 4 попыток и пропущен.
  const f = globalThis.final;
  const okRun = f && f.stats.success === 3 && f.stats.failed === 1 && state.balance === 16 &&
    state.checks.t4 === 2 && state.skipped.has('t3') && f.failedTasks[0]?.attempts === 4;
  console.log(okRun ? 'E2E PASSED' : 'E2E FAILED');
  process.exit(okRun ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
