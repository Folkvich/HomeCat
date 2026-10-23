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
    d.addEventListener("close", () => resolve(d.returnValue === "ok"), { once: true });
  });
}
