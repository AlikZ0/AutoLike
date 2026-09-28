// Общие DOM-утилиты для content-скриптов: ожидание элементов, поиск по тексту,
// проверка видимости и «человеческий» клик. Файлы content-скриптов внедряются
// программно как обычные скрипты, поэтому общаются через globalThis.AutoLike.
(() => {
  const NS = (globalThis.AutoLike = globalThis.AutoLike || {});
  if (NS.dom) return;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const jitter = (min, max) => sleep(Math.round(min + Math.random() * (max - min)));

  function toRegex(pattern) {
    if (pattern instanceof RegExp) return pattern;
    if (!pattern) return null;
    const m = String(pattern).match(/^\/(.*)\/([a-z]*)$/s);
    if (m) return new RegExp(m[1], m[2]);
    return new RegExp(String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  function textOf(el) {
    if (!el) return '';
    const raw = el.innerText ?? el.textContent ?? '';
    return String(raw).replace(/\s+/g, ' ').trim();
  }

  // Текст элемента + value/aria-label/title — для кнопок-иконок и input'ов.
  function labelOf(el) {
    return [textOf(el), el.value, el.getAttribute?.('aria-label'), el.getAttribute?.('title')]
      .filter((x) => typeof x === 'string' && x.trim())
      .join(' ')
      .trim();
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) !== 0;
  }

  function isClickable(el) {
    if (!isVisible(el)) return false;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
    const cls = typeof el.className === 'string' ? el.className : '';
    if (/(^|\s)disabled(\s|$)/.test(cls)) return false;
    return getComputedStyle(el).pointerEvents !== 'none';
  }

  function queryAll(selectors, root = document) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    const out = [];
    for (const sel of list) {
      if (!sel) continue;
      try {
        root.querySelectorAll(sel).forEach((el) => {
          if (!out.includes(el)) out.push(el);
        });
      } catch (e) {
        console.warn('[AutoLike] invalid selector', sel);
      }
    }
    return out;
  }

  function firstVisible(selectors, root = document) {
    return queryAll(selectors, root).find(isVisible) || null;
  }

  // Ищет среди candidates видимый элемент, чей текст совпадает с pattern.
  // Предпочитает самый «глубокий» подходящий элемент (кнопку, а не её контейнер).
  function findByText(root, candidates, pattern) {
    const re = toRegex(pattern);
    if (!re) return null;
    const matched = queryAll(candidates, root).filter((el) => isVisible(el) && re.test(labelOf(el)));
    return matched.find((el) => !matched.some((other) => other !== el && el.contains(other))) || null;
  }

  // Периодически вызывает fn, пока она не вернёт truthy-значение, или до таймаута.
  async function waitFor(fn, { timeout = 15000, interval = 300 } = {}) {
    const end = Date.now() + timeout;
    while (true) {
      let value = null;
      try {
        value = fn();
        if (value instanceof Promise) value = await value;
      } catch (e) {
        value = null;
      }
      if (value) return value;
      if (Date.now() >= end) return null;
      await sleep(interval);
    }
  }

  async function humanClick(el) {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    await jitter(300, 700);
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2 + (Math.random() * 4 - 2);
    const y = rect.top + rect.height / 2 + (Math.random() * 4 - 2);
    const opts = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0 };
    el.dispatchEvent(new PointerEvent('pointerover', opts));
    el.dispatchEvent(new MouseEvent('mouseover', opts));
    el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerType: 'mouse', isPrimary: true }));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    await jitter(40, 120);
    el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerType: 'mouse', isPrimary: true }));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.click();
  }

  function parseNumber(text) {
    const m = String(text || '').match(/-?\d[\d\s ]*(?:[.,]\d+)?/);
    if (!m) return null;
    const n = Number(m[0].replace(/[\s ]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function fail(code, message) {
    const err = new Error(message || code);
    err.code = code;
    return err;
  }

  NS.dom = {
    sleep,
    jitter,
    toRegex,
    textOf,
    labelOf,
    isVisible,
    isClickable,
    queryAll,
    firstVisible,
    findByText,
    waitFor,
    humanClick,
    parseNumber,
    hash,
    fail
  };
})();
