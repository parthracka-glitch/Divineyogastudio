import api from "./api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getDeviceInfo() {
  const ua = navigator.userAgent || "";
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;

  let label = "Browser";
  if (isIos) label = isStandalone ? "iPhone Home Screen PWA" : "iPhone Safari";
  else if (isAndroid) label = isStandalone ? "Android Home Screen PWA" : "Android Chrome";
  else if (/Mac/i.test(ua)) label = "Mac Desktop";
  else if (/Win/i.test(ua)) label = "Windows PC";

  return { isIos, isAndroid, isStandalone, label };
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return reg;
  } catch (error) {
    console.warn("Service worker registration failed:", error);
    return null;
  }
}

export async function getExistingPushSubscription() {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch (e) {
    return null;
  }
}

export async function requestAndSubscribePush() {
  if (!isPushSupported()) {
    const dev = getDeviceInfo();
    if (dev.isIos && !dev.isStandalone) {
      throw new Error(
        "On iPhone, push notifications require the app to be added to your Home Screen. Please tap Share -> 'Add to Home Screen' and open from your Home Screen."
      );
    }
    throw new Error("Push notifications are not supported in this browser.");
  }

  // 1. Request permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notification permission was denied. Please enable notifications in your phone Settings -> Safari / Divine Yoga."
        : "Notification permission was not granted."
    );
  }

  // 2. Fetch VAPID key
  const reg = await navigator.serviceWorker.ready;
  const keyResponse = await api.get("/api/v1/admin/push/vapid-public-key");
  const vapidPublicKey = keyResponse.data.public_key;

  // 3. Subscribe with PushManager
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  // 4. Send to backend
  const subJson = subscription.toJSON();
  const devInfo = getDeviceInfo();
  await api.post("/api/v1/admin/push/subscribe", {
    endpoint: subJson.endpoint,
    keys: {
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
    },
    device_info: devInfo.label,
  });

  return subscription;
}

export async function unsubscribePush() {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      await api.post("/api/v1/admin/push/unsubscribe", { endpoint });
    }
  } catch (err) {
    console.warn("Unsubscribe push error:", err);
  }
}

export function updateAppBadge(count) {
  if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
    if (count > 0) {
      navigator.setAppBadge(count).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }
}
