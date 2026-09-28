// Действия на TikTok. Каждое действие идемпотентно: сначала проверяем текущее
// состояние (лайк уже стоит / уже подписаны), и только потом кликаем —
// повторная попытка не снимет лайк и не отпишет.
//
// Новое действие: добавьте функцию в ACTIONS (ключ = имя действия из taskTypes.js).
// Функция получает cfg и возвращает { action, done?, alreadyDone? } или бросает dom.fail(code).
(() => {
  const NS = globalThis.AutoLike;
  if (NS.tiktokActions) return;
  const { dom } = NS;

  function loginModalShown(cfg) {
    return !!dom.firstVisible(cfg.tiktok.loginModal);
  }

  // --- Like ---

  function likeButton(cfg) {
    const icon = dom.firstVisible(cfg.tiktok.likeButton);
    return icon ? icon.closest('button') || icon : null;
  }

  function isLiked(btn, cfg) {
    if (!btn) return false;
    if (btn.getAttribute('aria-pressed') === 'true') return true;
    const color = cfg.tiktok.likedColor;
    const nodes = [btn, ...btn.querySelectorAll('svg, path, span, div')];
    return nodes.some((n) => {
      const cs = getComputedStyle(n);
      return (cs.color && cs.color.includes(color)) || (cs.fill && cs.fill.includes(color));
    });
  }

  async function like(cfg) {
    const btn = await dom.waitFor(() => likeButton(cfg), { timeout: cfg.timeouts.tiktokElement });
    if (!btn) throw dom.fail('like_button_not_found');
    await dom.jitter(600, 1400);
    if (isLiked(likeButton(cfg) || btn, cfg)) return { action: 'like', alreadyDone: true };

    await dom.humanClick(btn);
    // Кнопка может перерисоваться — каждый раз ищем её заново.
    const ok = await dom.waitFor(() => isLiked(likeButton(cfg), cfg) || (loginModalShown(cfg) ? 'login' : null), {
      timeout: 7000
    });
    if (ok === 'login') throw dom.fail('not_logged_in');
    if (!ok) throw dom.fail('like_not_confirmed');
    return { action: 'like', done: true };
  }

  // --- Follow ---

  function followButton(cfg) {
    return (
      dom.firstVisible(cfg.tiktok.followButton) ||
      dom.findByText(document, 'button, [role="button"]', cfg.tiktok.followText)
    );
  }

  function isFollowing(btn, cfg) {
    if (!btn) return false;
    return dom.toRegex(cfg.tiktok.followingText).test(dom.labelOf(btn));
  }

  async function follow(cfg) {
    const btn = await dom.waitFor(() => followButton(cfg), { timeout: cfg.timeouts.tiktokElement });
    if (!btn) throw dom.fail('follow_button_not_found');
    await dom.jitter(600, 1400);
    const current = followButton(cfg) || btn;
    if (isFollowing(current, cfg)) return { action: 'follow', alreadyDone: true };

    await dom.humanClick(current);
    const ok = await dom.waitFor(
      () => {
        if (loginModalShown(cfg)) return 'login';
        if (current.isConnected && dom.isVisible(current)) return isFollowing(current, cfg);
        // Кнопка перерисовалась или исчезла (на странице видео TikTok скрывает её после подписки).
        const b = followButton(cfg);
        return !b || isFollowing(b, cfg);
      },
      { timeout: 7000 }
    );
    if (ok === 'login') throw dom.fail('not_logged_in');
    if (!ok) throw dom.fail('follow_not_confirmed');
    return { action: 'follow', done: true };
  }

  // --- View (просто открыть и побыть на странице) ---

  async function view(cfg) {
    const seconds = Number(cfg.tiktok.viewSeconds) || 5;
    const video = await dom.waitFor(() => document.querySelector('video'), { timeout: 10000 });
    if (video && video.paused) video.play?.().catch(() => {});
    await dom.sleep(seconds * 1000);
    return { action: 'view', done: true };
  }

  const ACTIONS = { like, follow, view };

  // --- Общие проверки страницы ---

  function pageUnavailable(cfg) {
    const re = dom.toRegex(cfg.tiktok.unavailableText);
    return re ? re.test(dom.textOf(document.body).slice(0, 5000)) : false;
  }

  // Если TikTok показал капчу — ждём, пока пользователь её решит.
  async function waitCaptcha(cfg) {
    if (!dom.firstVisible(cfg.tiktok.captcha)) return;
    NS.toast.show('AutoLike: решите капчу TikTok — выполнение продолжится автоматически', 'retry', 10000);
    const solved = await dom.waitFor(() => !dom.firstVisible(cfg.tiktok.captcha), { timeout: cfg.timeouts.captcha, interval: 1000 });
    if (!solved) throw dom.fail('captcha');
    await dom.sleep(1500);
  }

  async function perform({ actions, cfg, label }) {
    NS.toast.show(`AutoLike: выполняем «${label || actions.join(' + ')}»`, 'info', 3000);
    // Ждём, пока страница хоть что-то отрисует (медленная загрузка TikTok).
    await dom.waitFor(() => document.body && dom.textOf(document.body).length > 50, { timeout: cfg.timeouts.tiktokElement });
    await waitCaptcha(cfg);
    if (pageUnavailable(cfg)) throw dom.fail('target_unavailable');

    const results = [];
    for (const name of actions) {
      const fn = ACTIONS[name];
      if (!fn) throw dom.fail('unknown_action', `Неизвестное действие: ${name}`);
      await waitCaptcha(cfg);
      results.push(await fn(cfg));
      await dom.jitter(800, 1600);
    }
    NS.toast.show('✓ Действие на TikTok выполнено, возвращаемся к заданию', 'success', 2500);
    return results;
  }

  NS.tiktokActions = { ACTIONS, perform };
})();
