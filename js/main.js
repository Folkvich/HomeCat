// ===== เริ่มทำงานเมื่อเปิดหน้าเว็บ =====

// ผูกปุ่มของทุก component
setupReminders();
setupCatList();
setupBackup();
setupCatProfile();
setupTimeline();
setupCatForm();
setupEventForm();
setupDateHints();
setupPages(); // ปุ่ม "กลับ" + ปุ่มย้อนกลับของมือถือ
setupAccount();

// หมุนจอ/ย่อขยายหน้าต่าง -> วาดกราฟใหม่ให้พอดีความกว้าง
window.onresize = () => { if (currentId) drawWeightChart(findCurrentCat()); };

// เช็กการล็อกอิน -> เลือกบ้าน -> วาดหน้าแรก
startApp();

// เก็บไฟล์เว็บไว้ในเครื่อง ให้เปิดแบบแอปได้แม้ไม่มีเน็ต (ใช้ได้เฉพาะ https หรือ localhost)
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
