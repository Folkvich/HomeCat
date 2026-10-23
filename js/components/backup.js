// ===== Component: สำรอง/นำเข้าข้อมูล =====
// ข้อมูลหลักอยู่บน Supabase แล้ว ไฟล์สำรองมีไว้เก็บสำเนาเอง หรือย้ายแมวจากที่อื่นเข้าบ้านนี้

// ดาวน์โหลดข้อมูลแมวทั้งหมดเป็นไฟล์ .json
function exportData() {
  const blob = new Blob([JSON.stringify(cats, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `homecat-backup-${todayString()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("ดาวน์โหลดไฟล์สำรองแล้ว");
}

// อ่านไฟล์ที่เลือก แล้วเพิ่มแมวเข้าบ้านนี้ (แมวที่มีอยู่แล้วจะถูกอัปเดตตามไฟล์ ไม่ลบตัวอื่น)
async function importData(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { data = null; }
  // ไฟล์ต้องเป็นรายการแมวที่มีชื่อและประวัติ
  if (!Array.isArray(data) || !data.every((c) => c.id && c.name && Array.isArray(c.events))) {
    return showToast("⚠️ ไฟล์นี้ไม่ใช่ไฟล์สำรองของ HomeCat", 4000);
  }
  if (!(await askConfirm(`นำเข้าแมว ${data.length} ตัวเข้าบ้าน "${household.name}"? แมวที่มีอยู่แล้วจะถูกอัปเดตตามไฟล์`, "นำเข้า", false))) return;
  importCats(data);
  goToCatListPage();
  showToast("นำเข้าข้อมูลเรียบร้อย");
}

// ผูกปุ่มสำรอง/นำเข้า
function setupBackup() {
  $("exportBtn").onclick = exportData;
  $("importFile").onchange = (e) => {
    importData(e.target.files[0]);
    e.target.value = ""; // ล้างค่า จะได้เลือกไฟล์เดิมซ้ำได้
  };
}
