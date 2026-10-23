// ===== Component: ข้อความแจ้งเตือนเล็ก ๆ ด้านล่างจอ (เช่น "บันทึกแล้ว") =====

let toastTimer = null;

// โชว์ข้อความสักครู่แล้วซ่อนเอง (ค่าเริ่มต้น 2.5 วินาที เรื่องสำคัญส่งเวลานานขึ้นได้)
function showToast(message, ms = 2500) {
  const t = $("toast");
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
