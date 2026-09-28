// Драйвер TikTok: регистрирует команды для background.
(() => {
  const NS = globalThis.AutoLike;
  if (NS.tiktokReady) return;
  NS.tiktokReady = true;

  NS.bridge.register('tiktok', {
    perform: (p) => NS.tiktokActions.perform(p)
  });
})();
