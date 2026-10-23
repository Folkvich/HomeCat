// ===== Component: กล่อง "นัดที่ใกล้ถึง" บนหน้ารายชื่อ =====

const REMINDER_LIMIT = 3;   // โชว์แค่กี่นัดก่อนกด "ดูทั้งหมด" (กล่องจะได้ไม่ดันรายชื่อแมวลงไปไกล)
let showAllReminders = false;

// หานัดของแมวหนึ่งตัว
// ดูเฉพาะบันทึกล่าสุดของแต่ละประเภท (เช่น ฉีดวัคซีนรอบใหม่แล้ว นัดของรอบเก่าก็ไม่ต้องเตือนอีก)
function findCatReminders(c) {
  const latestByType = {};
  for (const e of c.events) {
    if (!latestByType[e.type] || e.date > latestByType[e.type].date) latestByType[e.type] = e;
  }
  return Object.values(latestByType).filter((e) => e.next)
    .map((e) => ({ cat: c, event: e, days: daysUntil(e.next) }));
}

// หานัดของแมวทุกตัว เรียงจากนัดที่ใกล้ที่สุด (หรือเลยมาแล้ว) ก่อน
function findReminders() {
  return cats.flatMap(findCatReminders).sort((a, b) => a.days - b.days);
}

// วาดกล่องนัด (ซ่อนไว้ถ้าไม่มีนัดเลย)
function drawReminders() {
  const list = findReminders();
  const shown = showAllReminders ? list : list.slice(0, REMINDER_LIMIT);
  const more = list.length > REMINDER_LIMIT
    ? `<button class="link more" id="moreReminders">${showAllReminders ? "ย่อลง" : `ดูทั้งหมด (${list.length})`}</button>` : "";
  $("reminders").hidden = list.length === 0;
  $("reminders").innerHTML = `
    <h2>📅 นัดที่ใกล้ถึง</h2>
    <ul>${shown.map(reminderItemHtml).join("")}</ul>${more}`;
}

// สร้าง HTML นัด 1 รายการ (เลยกำหนด = สีแดง, ภายใน 7 วัน = สีส้ม)
function reminderItemHtml({ cat, event, days }) {
  return `
    <li class="${dueLevel(days)}" data-id="${cat.id}">
      <b>${makeTextSafe(cat.name)}</b> · ${TYPES[event.type]}
      <span class="due">${formatThaiDate(event.next)} (${dueText(days)})</span>
    </li>`;
}

// ป้ายเล็กบนการ์ดแมว บอกนัดที่ใกล้ที่สุดของตัวนั้น (โชว์เฉพาะที่เลยกำหนดหรือภายใน 7 วัน)
function catDueBadgeHtml(c) {
  const days = Math.min(...findCatReminders(c).map((r) => r.days));
  const level = dueLevel(days);
  if (!level) return "";
  return `<span class="badge ${level}">${days < 0 ? "เลยนัด" : `นัด${dueText(days)}`}</span>`;
}

// คลิกนัด -> เปิดหน้ารายละเอียดของแมวตัวนั้น, คลิก "ดูทั้งหมด" -> ขยาย/ย่อรายการ
function setupReminders() {
  $("reminders").onclick = (e) => {
    if (e.target.id === "moreReminders") { showAllReminders = !showAllReminders; return drawReminders(); }
    const item = e.target.closest("li[data-id]");
    if (item) goToCatDetailPage(item.dataset.id);
  };
}
