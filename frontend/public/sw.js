/* Service worker for Web Push (OS-level notifications, even when the app/tab is closed). */

self.addEventListener("push", function (event) {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: "Newton AMS", body: event.data ? event.data.text() : "" }
  }
  const title = data.title || "Newton AMS"
  const options = {
    body: data.body || "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: { url: data.url || "/admin/notifications" },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", function (event) {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || "/admin/notifications"
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) return client.focus()
        }
        for (const client of clientList) {
          if ("focus" in client) {
            if ("navigate" in client) client.navigate(targetUrl)
            return client.focus()
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
      }),
  )
})
