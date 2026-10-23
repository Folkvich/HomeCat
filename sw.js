// ===== Service Worker: เก็บไฟล์ของเว็บไว้ในเครื่อง ให้เปิดได้แม้ไม่มีเน็ต =====
// แก้ไฟล์ในเว็บเมื่อไหร่ ให้เปลี่ยนเลขเวอร์ชันนี้ เครื่องผู้ใช้จะได้โหลดไฟล์ใหม่
const CACHE = "homecat-v14";

const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "css/base.css", "css/cat-card.css", "css/reminders.css", "css/cat-profile.css",
  "css/timeline.css", "css/weight-chart.css", "css/dialog.css", "css/toast.css",
  "js/config.js", "js/storage.js", "js/state.js", "js/helpers.js",
  "js/components/toast.js", "js/components/confirm-dialog.js", "js/components/dialogs.js", "js/components/account.js", "js/components/reminders.js", "js/components/cat-list.js",
  "js/components/backup.js", "js/components/cat-profile.js", "js/components/timeline.js",
  "js/components/weight-chart.js", "js/components/health-summary.js", "js/components/cat-form.js", "js/components/event-form.js",
  "js/pages.js", "js/main.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js",
];

// ติดตั้ง: โหลดไฟล์ทั้งหมดเก็บไว้
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

// เปิดใช้: ลบไฟล์ของเวอร์ชันเก่าทิ้ง
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// ขอไฟล์: ลองโหลดจากเน็ตก่อน (จะได้ของใหม่เสมอ) ถ้าไม่มีเน็ตค่อยใช้ของที่เก็บไว้
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // ข้อมูลจาก Supabase ไม่เก็บใน cache (เป็นข้อมูลส่วนตัว และแอปมีสำเนาของตัวเองอยู่แล้ว)
  if (new URL(e.request.url).hostname.endsWith(".supabase.co")) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
