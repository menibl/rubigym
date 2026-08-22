const notificationIcon = `${import.meta.env.BASE_URL}icons/baly-icon-192.png`;

export async function showBrowserNotification(
  title: string,
  options: NotificationOptions = {},
): Promise<boolean> {
  if (
    !('Notification' in window) ||
    Notification.permission !== 'granted' ||
    !('serviceWorker' in navigator)
  ) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      icon: notificationIcon,
      badge: notificationIcon,
      ...options,
    });
    return true;
  } catch (error) {
    // Notification support varies between mobile browsers. A notification
    // failure must never interrupt the authenticated application experience.
    console.warn('Unable to display browser notification', error);
    return false;
  }
}

export function hasNotificationMarker(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

export function saveNotificationMarker(key: string): void {
  try {
    localStorage.setItem(key, new Date().toISOString());
  } catch {
    // Private browsing and restricted storage must not affect app usage.
  }
}
