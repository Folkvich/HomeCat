// ===== เริ่มทำงานเมื่อเปิดหน้าเว็บ =====

// ผูกปุ่มของทุก component
setupTheme(); // สวิตช์โหมดสว่าง/มืด
setupReminders();
setupCatList();
setupBackup();
setupCatProfile();
setupTimeline();
setupCatForm();
setupEventForm();
setupDateHints();
setupDialogs(); // ปิดด้วย ✕/แตะพื้นหลัง/ปัดลง, หลบคีย์บอร์ด
setupPages(); // ปุ่ม "กลับ" + ปุ่มย้อนกลับของมือถือ
setupAccount();

// ความรู้สึกตอนกดปุ่ม
// iPhone: Safari จะไม่โชว์สถานะ :active (ปุ่มยุบ) ถ้าหน้าเว็บไม่ได้ฟัง touchstart ไว้
document.addEventListener("touchstart", () => {}, { passive: true });
// Android: สั่นเบา ๆ ตอนแตะปุ่ม (iPhone ไม่รองรับ จะข้ามไปเอง)
document.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch" && e.target.closest("button:not(:disabled), label.button, .cat-card, .reminders li")) navigator.vibrate?.(8);
}, { passive: true });

// หมุนจอ/ย่อขยายหน้าต่าง -> วาดกราฟใหม่ให้พอดีความกว้าง
window.onresize = () => { if (currentId) drawWeightChart(findCurrentCat()); };

// เช็กการล็อกอิน -> เลือกบ้าน -> วาดหน้าแรก
startApp();

// เก็บไฟล์เว็บไว้ในเครื่อง ให้เปิดแบบแอปได้แม้ไม่มีเน็ต (ใช้ได้เฉพาะ https หรือ localhost)
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
