// ===== Component: ส่ง error จากเครื่องผู้ใช้เข้าฐานข้อมูล (ตาราง client_errors) =====
// แอปพังบนมือถือใคร เราจะเห็นได้โดยไม่ต้องรอภาพหน้าจอ (ดูได้ใน Supabase > Table Editor > client_errors)
// ส่งเฉพาะตอนล็อกอินแล้ว, ไม่ส่งซ้ำข้อความเดิม, รอบละไม่เกิน MAX_ERROR_REPORTS ครั้ง

const MAX_ERROR_REPORTS = 5;
const reportedErrors = new Set();

async function reportError(message, stack) {
  message = String(message || "unknown").slice(0, 2000);
  if (reportedErrors.has(message) || reportedErrors.size >= MAX_ERROR_REPORTS) return;
  if (!navigator.onLine || /fetch|network|Load failed/i.test(message)) return; // เน็ตหลุดไม่ใช่บั๊ก
  reportedErrors.add(message);
  try {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return;
    await db.from("client_errors").insert({
      message, stack: stack ? String(stack).slice(0, 8000) : null,
      url: location.href.slice(0, 500), user_agent: navigator.userAgent.slice(0, 500), app_version: APP_VERSION,
    });
  } catch { /* ส่งไม่ได้ก็ไม่เป็นไร ไม่ให้พังซ้อน */ }
}

function setupErrorReporting() {
  addEventListener("error", (e) => reportError(e.message, e.error?.stack));
  addEventListener("unhandledrejection", (e) => reportError(e.reason?.message || e.reason, e.reason?.stack));
}
