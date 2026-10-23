// ===== Component: หน้าต่างถามยืนยัน (ใช้แทน confirm() ของเบราว์เซอร์ ที่ดูหลุดจากแอปบนมือถือ) =====

// ถามผู้ใช้ แล้วรอคำตอบ: true = กดตกลง, false = ยกเลิก/ปิดหน้าต่าง
// ตัวอย่าง: if (!(await askConfirm("ลบ?", "ลบ"))) return;
function askConfirm(message, okText = "ตกลง", danger = true) {
  const d = $("confirmDialog");
  $("confirmMessage").textContent = message;
  $("confirmOkBtn").textContent = okText;
  $("confirmOkBtn").classList.toggle("danger-fill", danger);
  d.returnValue = "";
  d.showModal();
  return new Promise((resolve) => {
    const stop = new AbortController();
    const finish = (answer) => { stop.abort(); resolve(answer); };
    // กดปุ่ม -> ได้คำตอบทันที (ไม่ต้องรอ event "close" ที่บางเครื่องมาช้า)
    d.querySelector("form").addEventListener("submit", (e) => finish(e.submitter?.value === "ok"), { signal: stop.signal });
    // ปิดด้วยวิธีอื่น (Esc, ปุ่มย้อนกลับ, แตะพื้นหลัง) = ยกเลิก
    d.addEventListener("close", () => finish(d.returnValue === "ok"), { signal: stop.signal });
  });
}
