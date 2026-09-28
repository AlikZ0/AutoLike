// RPC между background и content-скриптом. Каждый драйвер (taskSite / tiktok)
// регистрирует свои команды; ответ: { ok, result } или { ok:false, code, error }.
(() => {
  const NS = (globalThis.AutoLike = globalThis.AutoLike || {});
  if (NS.bridge) return;

  const drivers = {};

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const handlers = msg && drivers[msg.driver];
    if (!handlers) return false;
    const handler = handlers[msg.cmd];
    if (!handler) {
      sendResponse({ ok: false, code: 'unknown_command', error: `Неизвестная команда ${msg.cmd}` });
      return false;
    }
    Promise.resolve()
      .then(() => handler(msg.payload || {}))
      .then(
        (result) => sendResponse({ ok: true, result }),
        (err) => sendResponse({ ok: false, code: err?.code || 'content_error', error: err?.message || String(err) })
      );
    return true;
  });

  NS.bridge = {
    register(driver, handlers) {
      drivers[driver] = {
        ping: () => ({ driver, url: location.href }),
        toast: ({ text, kind, duration }) => NS.toast.show(text, kind, duration),
        ...handlers
      };
    }
  };
})();
