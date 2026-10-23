// ===== Component: แจ้งเตือนนัดบนโทรศัพท์ (Web Push) =====
// เปิดแล้ว เซิร์ฟเวอร์ (Edge Function daily-reminders) จะส่งสรุปนัดของบ้านทุกเช้า 08:00
// iPhone/iPad: ต้องเพิ่มแอปลงหน้าจอโฮมก่อน (iOS 16.4 ขึ้นไป) Safari ปกติรับแจ้งเตือนเว็บไม่ได้

const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalledApp = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// กุญแจสาธารณะ (base64url) -> Uint8Array ที่ pushManager ต้องการ
function vapidKeyBytes(base64url) {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((base64url.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// รอ service worker พร้อม (ไม่เกิน 4 วินาที เช่น เปิดผ่าน http ในวง Wi-Fi จะไม่มี service worker)
async function readyWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 4000))]);
}

async function currentPushSubscription() {
  const reg = await readyWorker();
  return reg ? reg.pushManager.getSubscription() : null;
}

// วาดส่วน "แจ้งเตือนนัด" ในหน้าต่างบ้าน ตามสถานะของเครื่องนี้
async function drawPushBox() {
  const box = $("pushBox");
  if (!pushSupported()) {
    box.innerHTML = isIOS && !isInstalledApp()
      ? `<p class="muted small">บน iPhone ต้อง<b>เพิ่ม HomeCat ลงหน้าจอโฮม</b>ก่อน (Safari → ปุ่มแชร์ → เพิ่มไปยังหน้าจอโฮม) แล้วเปิดจากไอคอนนั้น จึงจะเปิดแจ้งเตือนได้</p>`
      : `<p class="muted small">เบราว์เซอร์นี้รับแจ้งเตือนไม่ได้ ลองเปิดด้วย Chrome หรือ Safari รุ่นใหม่</p>`;
    return;
  }
  if (Notification.permission === "denied") {
    box.innerHTML = `<p class="muted small">เครื่องนี้ปิดการแจ้งเตือนของ HomeCat ไว้ เปิดได้ที่การตั้งค่าของเครื่อง/เบราว์เซอร์ → การแจ้งเตือน</p>`;
    return;
  }
  const sub = await currentPushSubscription();
  box.innerHTML = sub
    ? `<p class="small">✅ เครื่องนี้เปิดแจ้งเตือนอยู่ ทุกเช้า 08:00 จะสรุปนัดวันนี้ พรุ่งนี้ และที่เลยกำหนด</p>
       <div class="row"><button type="button" id="testPushBtn">ส่งทดสอบ</button><button type="button" id="pushOffBtn" class="link">ปิดแจ้งเตือน</button></div>`
    : `<p class="muted small">เตือนนัดวัคซีน ถ่ายพยาธิ และการรักษาของแมวทุกตัวในบ้าน ทุกเช้า 08:00</p>
       <button type="button" id="pushOnBtn" class="primary">🔔 เปิดแจ้งเตือนบนเครื่องนี้</button>`;
  if (sub) {
    $("testPushBtn").onclick = testPush;
    $("pushOffBtn").onclick = async () => { await disablePushOnThisDevice(); showToast("ปิดแจ้งเตือนบนเครื่องนี้แล้ว"); drawPushBox(); };
  } else {
    $("pushOnBtn").onclick = enablePush;
  }
}

async function enablePush() {
  const btn = $("pushOnBtn");
  btn.disabled = true;
  try {
    if ((await Notification.requestPermission()) !== "granted") return drawPushBox();
    const reg = await readyWorker();
    if (!reg) return showToast("⚠️ ต้องเปิดผ่าน https (เว็บจริง) ถึงจะรับแจ้งเตือนได้", 5000);
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(VAPID_PUBLIC_KEY) });
    const { p256dh, auth } = sub.toJSON().keys;
    const { error } = await db.rpc("save_push_subscription", { p_endpoint: sub.endpoint, p_p256dh: p256dh, p_auth: auth });
    if (error) { await sub.unsubscribe(); throw error; }
    showToast("เปิดแจ้งเตือนแล้ว ลองกด \"ส่งทดสอบ\" ได้เลย", 4000);
  } catch (err) {
    console.error(err);
    showToast(`⚠️ เปิดแจ้งเตือนไม่สำเร็จ: ${err.message || err}`, 5000);
  } finally {
    drawPushBox();
  }
}

// เลิกรับแจ้งเตือนบนเครื่องนี้ (ใช้ตอนกดปิด และตอนออกจากเครื่อง)
async function disablePushOnThisDevice() {
  try {
    const sub = pushSupported() && (await currentPushSubscription());
    if (!sub) return;
    await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch (err) { console.error(err); }
}

async function testPush() {
  $("testPushBtn").disabled = true;
  const { data, error } = await db.functions.invoke("daily-reminders", { body: { mode: "test" } });
  $("testPushBtn").disabled = false;
  if (error) return showToast(`⚠️ ส่งทดสอบไม่สำเร็จ: ${error.message}`, 5000);
  showToast(data.sent ? "ส่งแล้ว รอแจ้งเตือนเด้งสักครู่" : "⚠️ ไม่พบเครื่องที่เปิดแจ้งเตือนไว้ ลองปิดแล้วเปิดใหม่", 4000);
}
