// ===== สลับหน้า (หน้ารายชื่อ <-> หน้ารายละเอียดแมว) =====
// เปิดหน้าแมวแต่ละครั้งจะจดลงประวัติของเบราว์เซอร์ (history)
// ปุ่มย้อนกลับของมือถือ/ปัดขอบจอ จึงกลับมาหน้ารายชื่อได้ แทนที่จะออกจากแอป

// กลับไปหน้ารายชื่อแมว
function goToCatListPage() {
  // ถ้ามาจากหน้ารายชื่อในแอปนี้ ให้ย้อนประวัติ (popstate จะวาดหน้ารายชื่อให้เอง)
  if (history.state?.catId) return history.back();
  showCatListPage();
}

// เปิดหน้ารายละเอียดของแมวตัวที่เลือก
function goToCatDetailPage(id) {
  // เปิดตัวเดิมซ้ำ (เช่น กดเบิ้ล) ไม่ต้องจดประวัติเพิ่ม จะได้กดย้อนกลับครั้งเดียวถึงหน้ารายชื่อ
  if (history.state?.catId === id) history.replaceState({ catId: id }, "");
  else history.pushState({ catId: id }, "");
  showCatDetailPage(id);
}

// วาดหน้ารายชื่อ (ไม่ยุ่งกับประวัติเบราว์เซอร์)
function showCatListPage() {
  currentId = null;
  showOnly("listView");
  $("backBtn").hidden = true;
  $("topTitle").textContent = "🐱 HomeCat";
  $("topSubtitle").hidden = false;
  drawCatCards();
}

// วาดหน้ารายละเอียดของแมว (ไม่ยุ่งกับประวัติเบราว์เซอร์)
function showCatDetailPage(id) {
  currentId = id;
  showOnly("detailView");
  $("backBtn").hidden = false;
  $("topSubtitle").hidden = true;
  $("timelineFilter").value = "all"; // เปิดแมวตัวใหม่ -> โชว์ประวัติทุกประเภท
  drawCatDetail();
  window.scrollTo(0, 0); // เลื่อนกลับไปบนสุด
}

// วาดหน้ารายละเอียดทั้งหน้า: ประกอบจาก component โปรไฟล์ + ไทม์ไลน์ + กราฟน้ำหนัก
function drawCatDetail() {
  const c = findCurrentCat();
  if (!c) return goToCatListPage(); // หาแมวไม่เจอ ให้กลับหน้ารายชื่อ
  $("topTitle").textContent = c.name; // แถบบนโชว์ชื่อแมว เลื่อนลงก็ยังรู้ว่าดูตัวไหนอยู่
  drawCatProfile(c);
  drawTimeline(c);
  drawHealthSummary(c);
  drawWeightChart(c);
}

// กดย้อนกลับ/ไปข้างหน้าของเบราว์เซอร์ -> ปิดหน้าต่างที่เปิดค้าง แล้ววาดหน้าตามประวัติ
function setupPages() {
  $("backBtn").onclick = goToCatListPage;
  window.onpopstate = () => {
    if (!householdId) return; // ยังไม่ได้ล็อกอิน/เลือกบ้าน
    document.querySelectorAll("dialog[open]").forEach((d) => d.close());
    const id = history.state?.catId;
    id && cats.some((c) => c.id === id) ? showCatDetailPage(id) : showCatListPage();
  };
}

// เปิดแอปครั้งแรก (หรือรีโหลด) -> กลับไปหน้าที่เปิดค้างไว้
function showStartPage() {
  const id = history.state?.catId;
  id && cats.some((c) => c.id === id) ? showCatDetailPage(id) : showCatListPage();
}
