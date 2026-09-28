// Уведомления в нижней части страницы. Рисуются в Shadow DOM, чтобы стили
// сайта не ломали их, а их текст не попадал в анализ результата проверки.
(() => {
  const NS = (globalThis.AutoLike = globalThis.AutoLike || {});
  if (NS.toast) return;

  const HOST_ID = 'autolike-toast-host';
  const COLORS = {
    success: '#1f9d55',
    error: '#d64545',
    retry: '#d98a0b',
    info: '#2f3a4a'
  };

  function getRoot() {
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; left: 0; right: 0; bottom: 16px; pointer-events: none;';
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          .stack { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 0 16px; }
          .toast {
            pointer-events: auto; max-width: min(560px, 100%); box-sizing: border-box;
            font: 500 14px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #fff;
            padding: 10px 16px; border-radius: 10px; box-shadow: 0 6px 20px rgba(0,0,0,.25);
            opacity: 0; transform: translateY(12px); transition: opacity .2s ease, transform .2s ease;
          }
          .toast.show { opacity: 1; transform: none; }
          .brand { opacity: .7; font-weight: 600; margin-right: 6px; }
        </style>
        <div class="stack"></div>`;
      (document.body || document.documentElement).appendChild(host);
    }
    return host.shadowRoot.querySelector('.stack');
  }

  function show(text, kind = 'info', duration = 4000) {
    const stack = getRoot();
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.background = COLORS[kind] || COLORS.info;
    el.textContent = text;
    stack.appendChild(el);
    while (stack.children.length > 4) stack.firstElementChild.remove();
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    }, duration);
  }

  NS.toast = { show, HOST_ID };
})();
