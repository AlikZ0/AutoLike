// Драйвер сайта с заданиями: регистрирует команды для background.
(() => {
  const NS = globalThis.AutoLike;
  if (NS.taskSiteReady) return;
  NS.taskSiteReady = true;
  const { scanner, checker } = NS;

  NS.bridge.register('taskSite', {
    // Ждём появления заданий: сайт может подгружать их асинхронно.
    listTasks: async ({ cfg }) => {
      const tasks =
        (await NS.dom.waitFor(
          () => {
            const list = scanner.listTasks(cfg);
            return list.length ? list : null;
          },
          { timeout: cfg.timeouts.element, interval: 500 }
        )) || [];
      return { tasks, balance: scanner.readBalance(cfg) };
    },
    readBalance: ({ cfg }) => scanner.readBalance(cfg),
    // Для страницы настроек: что расширение видит на странице (ничего не нажимает).
    diagnose: ({ cfg }) => ({
      url: location.href,
      bySelectors: NS.dom.queryAll(cfg.selectors.taskCard).filter(NS.dom.isVisible).length,
      tasks: scanner.listTasks(cfg),
      balance: scanner.readBalance(cfg)
    }),
    openTarget: (p) => checker.openTarget(p),
    getOpenedUrl: () => checker.getOpenedUrl(),
    checkTask: (p) => checker.checkTask(p),
    skipTask: (p) => checker.skipTask(p)
  });
})();
