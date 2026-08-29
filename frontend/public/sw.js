// Divine Yoga Studio - Service Worker for Web Push & PWA Notifications (iOS 16.4+ & Android)

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "Divine Yoga Studio", body: event.data.text() };
    }
  }

  const title = data.title || "🔔 Divine Yoga Studio";
  const options = {
    body: data.body || "You have an update regarding client memberships.",
    icon: data.icon || "/logo192.png",
    badge: data.badge || "/favicon.png",
    vibrate: [200, 100, 200],
    tag: "divine-yoga-expiry",
    renotify: true,
    data: data.data || { url: "/reminders" },
  };

  // Update App Badge on iPhone and Android Home Screen if available
  if ("setAppBadge" in navigator && data.data && typeof data.data.badgeCount === "number") {
    if (data.data.badgeCount > 0) {
      navigator.setAppBadge(data.data.badgeCount).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  // Focus existing open dashboard tab or open new window
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if (client.url.includes(targetUrl)) {
            return client.focus();
          }
          return client.navigate(targetUrl).then((c) => c.focus());
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
