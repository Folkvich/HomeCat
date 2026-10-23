// ===== Component: ข้อความแจ้งเตือนเล็ก ๆ ด้านล่างจอ (เช่น "บันทึกแล้ว") =====
// ใช้ popover ให้ลอยอยู่ชั้นบนสุด (top layer) จะได้ไม่จมอยู่ใต้หน้าต่าง popup ที่เปิดค้างอยู่

let toastTimer = null;

// โชว์ข้อความสักครู่แล้วซ่อนเอง (ค่าเริ่มต้น 2.5 วินาที เรื่องสำคัญส่งเวลานานขึ้นได้)
function showToast(message, ms = 2500) {
  const t = $("toast");
  t.textContent = message;
  t.hidden = false;
  if (t.showPopover) {
    // ปิดแล้วเปิดใหม่ ให้ขึ้นมาอยู่เหนือหน้าต่างที่เพิ่งเปิดทีหลังด้วย
    if (t.matches(":popover-open")) t.hidePopover();
    t.showPopover();
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (t.matches?.(":popover-open")) t.hidePopover();
    t.hidden = true;
  }, ms);
}
