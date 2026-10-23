// ===== Component: กล่อง "นัดที่ใกล้ถึง" บนหน้ารายชื่อ =====

const REMINDER_LIMIT = 3;   // โชว์แค่กี่แถวก่อนกด "ดูทั้งหมด" (กล่องจะได้ไม่ดันรายชื่อแมวลงไปไกล)
const GROUP_NAMES_SHOWN = 3; // แถวที่รวมหลายตัว โชว์ชื่อแมวกี่ตัว ที่เหลือเป็น "+N ตัว"
let showAllReminders = false;
const openGroups = new Set(); // แถวที่กางรายชื่อแมวไว้

// หานัดของแมวหนึ่งตัว
// ดูเฉพาะบันทึกล่าสุดของแต่ละประเภท (เช่น ฉีดวัคซีนรอบใหม่แล้ว นัดของรอบเก่าก็ไม่ต้องเตือนอีก)
function findCatReminders(c) {
  const types = new Set(c.events.map((e) => e.type));
  return [...types].map((t) => latestOfType(c, t)).filter((e) => e.next)
    .map((e) => ({ cat: c, event: e, days: daysUntil(e.next) }));
}

// นัดของแมวทุกตัว รวมเป็นกลุ่มตาม "ประเภท + วันนัด" (เช่น พาแมว 10 ตัวไปฉีดวัคซีนวันเดียวกัน = 1 แถว)
// เรียงจากนัดที่ใกล้ที่สุด (หรือเลยมาแล้ว) ก่อน
function findReminderGroups() {
  const groups = new Map();
  for (const r of cats.flatMap(findCatReminders)) {
    const key = `${r.event.type}|${r.event.next}`;
    if (!groups.has(key)) groups.set(key, { key, type: r.event.type, next: r.event.next, days: r.days, cats: [] });
    groups.get(key).cats.push(r.cat);
  }
  return [...groups.values()].sort((a, b) => a.days - b.days);
}

// วาดกล่องนัด (ซ่อนไว้ถ้าไม่มีนัดเลย)
function drawReminders() {
  const groups = findReminderGroups();
  const shown = showAllReminders ? groups : groups.slice(0, REMINDER_LIMIT);
  const more = groups.length > REMINDER_LIMIT
    ? `<button class="link more" id="moreReminders">${showAllReminders ? "ย่อลง" : `ดูทั้งหมด (${groups.length})`}</button>` : "";
  $("reminders").hidden = groups.length === 0;
  $("reminders").innerHTML = `
    <h2>📅 นัดที่ใกล้ถึง</h2>
    <ul>${shown.map(reminderGroupHtml).join("")}</ul>${more}`;
}

// สร้าง HTML นัด 1 แถว (เลยกำหนด = สีแดง, ภายใน 7 วัน = สีส้ม)
// แมวตัวเดียว: แตะแล้วเข้าหน้าแมวเลย, หลายตัว: แตะแล้วกางรายชื่อให้เลือก
function reminderGroupHtml(g) {
  const single = g.cats.length === 1;
  const open = !single && openGroups.has(g.key);
  const names = g.cats.slice(0, GROUP_NAMES_SHOWN).map((c) => makeTextSafe(c.name)).join(", ");
  const rest = g.cats.length - GROUP_NAMES_SHOWN;
  return `
    <li class="${dueLevel(g.days)}${open ? " open" : ""}" ${single ? `data-id="${g.cats[0].id}"` : `data-group="${g.key}"`}>
      <div class="r-head">
        <span class="r-type">${TYPES[g.type]}${single ? "" : ` <span class="count">${g.cats.length} ตัว</span>`}</span>
        <span class="due">${formatThaiDate(g.next)} (${dueText(g.days)})</span>
      </div>
      <div class="r-cats"><span>${names}${rest > 0 ? ` +${rest} ตัว` : ""}</span><span class="chev">${single ? "›" : open ? "▴" : "▾"}</span></div>
      ${open ? `<div class="r-chips">${g.cats.map((c) =>
        `<button type="button" class="chip-btn" data-id="${c.id}">${makeTextSafe(c.name)} ›</button>`).join("")}</div>` : ""}
    </li>`;
}

// ป้ายเล็กบนการ์ดแมว บอกนัดที่ใกล้ที่สุดของตัวนั้น (โชว์เฉพาะที่เลยกำหนดหรือภายใน 7 วัน)
function catDueBadgeHtml(c) {
  const days = Math.min(...findCatReminders(c).map((r) => r.days));
  const level = dueLevel(days);
  if (!level) return "";
  return `<span class="badge ${level}">${days < 0 ? "เลยนัด" : `นัด${dueText(days)}`}</span>`;
}

// คลิกนัด -> เปิดหน้าแมว / กางรายชื่อ, คลิก "ดูทั้งหมด" -> ขยาย/ย่อรายการ
function setupReminders() {
  $("reminders").onclick = (e) => {
    if (e.target.id === "moreReminders") { showAllReminders = !showAllReminders; return drawReminders(); }
    const cat = e.target.closest("[data-id]");           // แถวแมวตัวเดียว หรือชื่อแมวในแถวที่กางไว้
    if (cat) return goToCatDetailPage(cat.dataset.id);
    const group = e.target.closest("li[data-group]");    // แถวหลายตัว -> กาง/พับรายชื่อ
    if (group) {
      const key = group.dataset.group;
      openGroups.has(key) ? openGroups.delete(key) : openGroups.add(key);
      drawReminders();
    }
  };
}

// นัดที่ใกล้ที่สุดของแมวตัวนั้น (ใช้ในการ์ดแบบรายการ) คืน null ถ้าไม่มีนัด
function nearestReminder(c) {
  return findCatReminders(c).sort((a, b) => a.days - b.days)[0] || null;
}
