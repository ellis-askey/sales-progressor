// Service worker for portal push notifications

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Sales Progressor", body: event.data.text() };
  }

  const { title = "Sales Progressor", body = "You have a new update.", url = "/" } = payload;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url },
        vibrate: [200, 100, 200],
      }),
      // Set the home screen badge (red dot)
      navigator.setAppBadge ? navigator.setAppBadge() : Promise.resolve(),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    Promise.all([
      // Clear the badge when the user taps the notification
      navigator.clearAppBadge ? navigator.clearAppBadge() : Promise.resolve(),
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      }),
    ])
  );
});
