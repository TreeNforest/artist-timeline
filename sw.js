/* 應援色 · 追星時間軸 — service worker
   改版時把 VERSION 加一，舊快取會自動清掉 */
const VERSION = "v5";
const SHELL = "shell-" + VERSION;
const RUNTIME = "runtime-" + VERSION;

/* 自身檔案：安裝時就抓下來，離線一定要有 */
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  /* Firestore 一律直接走網路，不能快取，否則會拿到過期資料 */
  if (url.hostname.includes("firestore.googleapis.com") ||
      url.hostname.includes("firebaseio.com") ||
      url.hostname.includes("googleapis.com") && url.pathname.includes("/google.firestore")) {
    return;
  }

  /* 頁面導覽：優先網路，離線時退回快取的 index.html */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match("./index.html"))
    );
    return;
  }

  /* 其他（含字型、Phosphor、esm.sh、gstatic 的 firebase SDK）：
     先回快取讓開啟變快，同時背景更新 */
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
