// Действия на сайте с заданиями: открыть цель, нажать «Проверить» и
// распознать результат, пропустить задание.
(() => {
  const NS = globalThis.AutoLike;
  if (NS.checker) return;
  const { dom, scanner } = NS;
  const root = document.documentElement;

  // Все текстовые фрагменты внутри элемента (без нашего toast'а).
  function segments(el) {
    const out = [];
    if (!el) return out;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent.replace(/\s+/g, ' ').trim();
      if (t && !scanner.isOwnNode(node.parentElement)) out.push(t);
    }
    return out;
  }

  // Следит за изменениями страницы после клика «Проверить» и ищет в НОВОМ
  // тексте (в карточке, во всплывающих уведомлениях, в alert) признаки результата.
  function createResultWatcher(taskId, cfg, card) {
    const success = dom.toRegex(cfg.patterns.success);
    const failure = dom.toRegex(cfg.patterns.failure);
    const notifsBefore = dom.queryAll(cfg.selectors.notifications);
    const before = new Set([...segments(card), ...notifsBefore.flatMap(segments)]);
    // Окна, которые были скрыты до клика: если такое окно откроется, его текст считаем новым целиком
    // (сайт может показать тот же текст, что и в прошлой попытке).
    const hiddenBefore = new Set(notifsBefore.filter((n) => !dom.isVisible(n)));
    const added = [];
    let current = card;
    let lastSeen = '';

    root.removeAttribute('data-autolike-alert');
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData') {
          const t = (m.target.textContent || '').trim();
          if (t && !scanner.isOwnNode(m.target.parentElement)) added.push(t);
          continue;
        }
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1 && scanner.isOwnNode(n)) return;
          const t = (n.nodeType === 3 ? n.textContent : n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim();
          if (t) added.push(t.slice(0, 500));
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    function excerpt(text, re) {
      const i = text.search(re);
      return text.slice(Math.max(0, i - 40), i + 80).trim();
    }

    return {
      evaluate() {
        if (!current.isConnected) current = scanner.findCard(taskId, cfg) || current;
        const fresh = [];
        if (current.isConnected) fresh.push(...segments(current).filter((t) => !before.has(t)));
        for (const n of dom.queryAll(cfg.selectors.notifications)) {
          if (!dom.isVisible(n)) continue;
          const segs = segments(n);
          fresh.push(...(hiddenBefore.has(n) ? segs : segs.filter((t) => !before.has(t))));
        }
        const alertText = root.getAttribute('data-autolike-alert');
        if (alertText) fresh.push(alertText);
        fresh.push(...added.slice(-50).filter((t) => !before.has(t)));

        const joined = fresh.join(' | ');
        lastSeen = joined;
        if (failure && failure.test(joined)) return { status: 'fail', message: excerpt(joined, failure) };
        if (success && success.test(joined)) return { status: 'success', message: excerpt(joined, success) };
        if (!current.isConnected) return { status: 'removed', message: 'Задание исчезло со страницы после проверки' };
        return null;
      },
      stop() {
        observer.disconnect();
      },
      lastSeen: () => lastSeen.slice(0, 300)
    };
  }

  async function openTarget({ taskId, cfg }) {
    await closeDialogs(cfg);
    const card = await dom.waitFor(() => scanner.findCard(taskId, cfg), { timeout: cfg.timeouts.element });
    if (!card) throw dom.fail('task_not_found');
    root.removeAttribute('data-autolike-opened');
    const btn = await dom.waitFor(
      () => {
        const c = scanner.findCard(taskId, cfg) || card;
        return (
          scanner.findButton(c, cfg.selectors.openButton, cfg, { requireClickable: true }) ||
          dom.queryAll(cfg.selectors.targetLink, c).find(dom.isClickable)
        );
      },
      { timeout: Math.min(cfg.timeouts.element, 8000) }
    );
    if (!btn) return { clicked: false };
    await dom.humanClick(btn);
    return { clicked: true };
  }

  function getOpenedUrl() {
    return root.getAttribute('data-autolike-opened') || null;
  }

  async function checkTask({ taskId, cfg }) {
    await closeDialogs(cfg);
    let card = await dom.waitFor(() => scanner.findCard(taskId, cfg), { timeout: cfg.timeouts.element });
    const balanceBefore = scanner.readBalance(cfg);
    if (!card) return { status: 'missing', message: 'Задание не найдено на странице', balanceBefore };

    // Не нажимаем кнопку, пока она не появилась и не стала активной.
    const btn = await dom.waitFor(
      () => {
        card = scanner.findCard(taskId, cfg) || card;
        return scanner.findButton(card, cfg.selectors.checkButton, cfg, { requireClickable: true });
      },
      { timeout: cfg.timeouts.checkButton }
    );
    if (!btn) throw dom.fail('check_button_not_found');

    const watcher = createResultWatcher(taskId, cfg, card);
    const buttonText = dom.labelOf(btn).slice(0, 40);
    try {
      await dom.humanClick(btn);
      const result = await dom.waitFor(() => watcher.evaluate(), { timeout: cfg.timeouts.checkResult, interval: 400 });
      // Даём окну/уведомлению дорисоваться, затем закрываем его, чтобы не мешало следующей попытке.
      await dom.sleep(600);
      await closeDialogs(cfg);
      return {
        ...(result || { status: 'unknown', message: 'Сайт не показал результат проверки' }),
        balanceBefore,
        debug: { buttonText, siteText: watcher.lastSeen() }
      };
    } finally {
      watcher.stop();
    }
  }

  async function closeDialogs(cfg) {
    for (const btn of dom.queryAll(cfg.selectors.dialogClose || []).filter(dom.isVisible)) {
      await dom.humanClick(btn).catch(() => {});
    }
  }

  async function skipTask({ taskId, cfg }) {
    const card = scanner.findCard(taskId, cfg);
    if (!card) return { skipped: false, reason: 'not_found' };
    const btn = scanner.findButton(card, cfg.selectors.skipButton, cfg, { requireClickable: true });
    if (!btn) return { skipped: false, reason: 'no_button' };
    root.setAttribute('data-autolike-autoconfirm', '1');
    try {
      await dom.humanClick(btn);
      // Возможный диалог подтверждения — ищем кнопку только внутри диалогов.
      const confirmBtn = await dom.waitFor(
        () => {
          for (const d of dom.queryAll(cfg.selectors.dialogs).filter(dom.isVisible)) {
            const b = scanner.findButton(d, cfg.selectors.confirmButton, cfg, { requireClickable: true });
            if (b) return b;
          }
          return null;
        },
        { timeout: 3000 }
      );
      if (confirmBtn) await dom.humanClick(confirmBtn);
      return { skipped: true };
    } finally {
      setTimeout(() => root.removeAttribute('data-autolike-autoconfirm'), 2000);
    }
  }

  NS.checker = { openTarget, getOpenedUrl, checkTask, skipTask };
})();
