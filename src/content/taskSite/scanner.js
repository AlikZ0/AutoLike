// Поиск заданий, кнопок и баланса на странице сайта с заданиями.
(() => {
  const NS = globalThis.AutoLike;
  if (NS.scanner) return;
  const dom = NS.dom;

  const TIKTOK_URL_RE = /https?:\/\/(?:[a-z0-9-]+\.)*tiktok\.com\/[^\s"'<>\\)]*/i;
  const USERNAME_RE = /(?:^|[\s(«"':,])@([A-Za-z0-9._]{2,24})(?![A-Za-z0-9._])/;
  const ID_ATTRS = ['data-task-id', 'data-id', 'data-task', 'data-order-id', 'data-key'];

  function isOwnNode(el) {
    return el.closest?.(`#${NS.toast.HOST_ID}`);
  }

  // Кнопка по спецификации { selectors, text }: сначала селекторы, потом текст.
  function findButton(root, spec, cfg, { requireClickable = false } = {}) {
    if (!root || !spec) return null;
    let el = dom.queryAll(spec.selectors || [], root).find(dom.isVisible) || null;
    if (!el && spec.text) el = dom.findByText(root, cfg.selectors.clickableCandidates, spec.text);
    if (!el) return null;
    const clickTarget = el.closest('button, a, [role="button"], input') || el;
    if (requireClickable && !dom.isClickable(clickTarget)) return null;
    return clickTarget;
  }

  function linkKey(el) {
    return el.href ? el.href.split('#')[0] : el;
  }

  // Эвристика: берём «якоря» (ссылки на TikTok или кнопки «Проверить») и поднимаемся
  // вверх по DOM до самого крупного контейнера, в котором только один такой якорь.
  function heuristicCards(cfg) {
    let anchors = dom.queryAll(cfg.selectors.targetLink).filter((a) => !isOwnNode(a));
    if (!anchors.length) {
      const re = dom.toRegex(cfg.selectors.checkButton.text);
      anchors = dom
        .queryAll(cfg.selectors.clickableCandidates)
        .filter((el) => dom.isVisible(el) && re && re.test(dom.labelOf(el)));
      anchors = anchors.filter((el) => !anchors.some((o) => o !== el && o.contains(el)));
    }
    const cards = [];
    for (const anchor of anchors) {
      let best = anchor;
      let el = anchor;
      while (el.parentElement && el.parentElement !== document.body && el.parentElement !== document.documentElement) {
        const parent = el.parentElement;
        const keys = new Set(anchors.filter((a) => parent.contains(a)).map(linkKey));
        if (keys.size > 1) break;
        best = parent;
        el = parent;
      }
      if (!cards.includes(best)) cards.push(best);
    }
    return cards;
  }

  function detectCards(cfg) {
    let cards = dom.queryAll(cfg.selectors.taskCard).filter((c) => dom.isVisible(c) && !isOwnNode(c));
    // Вложенные совпадения (например, .task внутри .task-item) — оставляем внешние.
    cards = cards.filter((c) => !cards.some((o) => o !== c && o.contains(c)));
    if (!cards.length) cards = heuristicCards(cfg).filter(dom.isVisible);
    return cards;
  }

  function findTargetUrl(card, cfg) {
    const link = dom.queryAll(cfg.selectors.targetLink, card)[0];
    if (link?.href) return link.href;
    for (const el of [card, ...card.querySelectorAll('[data-url],[data-href],[data-link],[data-target]')]) {
      for (const attr of ['data-url', 'data-href', 'data-link', 'data-target']) {
        const v = el.getAttribute?.(attr);
        if (v && TIKTOK_URL_RE.test(v)) return v.match(TIKTOK_URL_RE)[0];
      }
    }
    // Ссылка может быть в onclick="window.open('...')" или в тексте.
    const m = card.innerHTML.replace(/&amp;/g, '&').match(TIKTOK_URL_RE);
    return m ? m[0] : null;
  }

  function findIdAttr(card, cfg) {
    // Скрытое поле формы с id задания (например, UserPerformTask[id]) — самый надёжный вариант.
    const input = dom.queryAll(cfg.selectors.taskIdInput || [], card).find((i) => i.value);
    if (input) return input.value;
    for (const attr of ID_ATTRS) {
      const v = card.getAttribute(attr);
      if (v) return v;
    }
    if (card.id) return card.id;
    const inner = card.querySelector(ID_ATTRS.map((a) => `[${a}]`).join(','));
    if (inner) for (const attr of ID_ATTRS) if (inner.getAttribute(attr)) return inner.getAttribute(attr);
    return null;
  }

  function extractTask(card, cfg, index) {
    const text = dom.textOf(card).slice(0, 400);
    const url = findTargetUrl(card, cfg);
    const username = (url && (url.match(/tiktok\.com\/@([^/?#]+)/i) || [])[1]) || (text.match(USERNAME_RE) || [])[1] || null;
    const idAttr = findIdAttr(card, cfg);
    // Идентификатор должен быть стабильным, чтобы после возврата на сайт
    // (и после перезагрузки) найти то же самое задание.
    const baseId = idAttr
      ? `id:${idAttr}`
      : url
        ? `url:${url.split('?')[0]}`
        : `txt:${dom.hash(text.replace(/\d+/g, '#').slice(0, 120))}`;
    return {
      baseId,
      url,
      username,
      text,
      index,
      hasCheckButton: !!findButton(card, cfg.selectors.checkButton, cfg),
      hasOpenButton: !!findButton(card, cfg.selectors.openButton, cfg),
      hasSkipButton: !!findButton(card, cfg.selectors.skipButton, cfg)
    };
  }

  // Возвращает [{ task, card }]. Одинаковые baseId получают суффикс #2, #3…
  function scan(cfg) {
    const seen = {};
    return detectCards(cfg).map((card, i) => {
      const task = extractTask(card, cfg, i);
      seen[task.baseId] = (seen[task.baseId] || 0) + 1;
      task.id = seen[task.baseId] > 1 ? `${task.baseId}#${seen[task.baseId]}` : task.baseId;
      delete task.baseId;
      return { task, card };
    });
  }

  function listTasks(cfg) {
    return scan(cfg).map((x) => x.task);
  }

  function findCard(taskId, cfg) {
    const hit = scan(cfg).find((x) => x.task.id === taskId);
    return hit ? hit.card : null;
  }

  function readBalance(cfg) {
    // 1) по селекторам — берём самый «короткий» элемент с числом (сам счётчик, а не блок).
    const candidates = dom
      .queryAll(cfg.selectors.balance)
      .filter((el) => dom.isVisible(el) && !isOwnNode(el))
      .map((el) => ({ el, text: dom.textOf(el) }))
      .filter((x) => x.text && x.text.length < 60 && dom.parseNumber(x.text) != null)
      .sort((a, b) => a.text.length - b.text.length);
    if (candidates.length) return dom.parseNumber(candidates[0].text);

    // 2) по подписи «Баланс: 12.5».
    const label = dom.toRegex(cfg.selectors.balanceLabel);
    if (!label) return null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!label.test(node.textContent)) continue;
      const el = node.parentElement;
      if (!el || isOwnNode(el) || !dom.isVisible(el)) continue;
      for (const scope of [el, el.parentElement]) {
        const t = dom.textOf(scope);
        if (t.length > 80) continue;
        const after = t.slice(t.search(label));
        const n = dom.parseNumber(after);
        if (n != null) return n;
      }
    }
    return null;
  }

  NS.scanner = { findButton, detectCards, listTasks, findCard, readBalance, isOwnNode };
})();
