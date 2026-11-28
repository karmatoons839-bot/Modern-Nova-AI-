// Minimal worker used only to show phone notifications (no caching, no fetch handling).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate && c.url !== url && c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
