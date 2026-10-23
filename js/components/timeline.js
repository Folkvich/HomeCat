// ===== Component: ไทม์ไลน์ประวัติ (รายการวัคซีน พบหมอ น้ำหนัก ฯลฯ) =====

// วาดไทม์ไลน์ของแมว เรียงจากใหม่ไปเก่า (กรองตามประเภทที่เลือกไว้)
function drawTimeline(c) {
  const filter = $("timelineFilter").value;
  // คัดลอกรายการก่อนเรียง จะได้ไม่ไปแก้ข้อมูลจริง
  const events = c.events.filter((e) => filter === "all" || e.type === filter)
    .sort((a, b) => b.date.localeCompare(a.date));
  $("timeline").innerHTML = events.length
    ? events.map(timelineItemHtml).join("")
    : `<li class="muted">ยังไม่มีบันทึก</li>`;
}

// สร้าง HTML ของบันทึก 1 รายการ
function timelineItemHtml(e) {
  const weight = e.type === "weight" ? ` ${e.weight} กก.` : "";
  const text = e.text ? `<div class="ev-text">${makeTextSafe(e.text)}</div>` : ""; // บรรทัดของตัวเอง เว้นบรรทัดตามที่พิมพ์
  const next = e.next ? `<div class="next ${dueLevel(daysUntil(e.next))}">📅 นัดครั้งถัดไป ${formatThaiDate(e.next)} (${dueText(daysUntil(e.next))})</div>` : "";
  return `
    <li>
      <span class="tools">
        <button data-edit="${e.id}" title="แก้ไข">✏️</button>
        <button data-del="${e.id}" title="ลบ">✕</button>
      </span>
      <div class="date">${formatThaiDate(e.date)}</div>
      <b>${TYPES[e.type]}</b>${weight}${text}
      ${next}
    </li>`;
}

// ใส่ตัวเลือกประเภทลงในช่องกรอง: "ทั้งหมด" + ทุกประเภทใน TYPES
function fillTimelineFilter() {
  $("timelineFilter").innerHTML = `<option value="all">ทั้งหมด</option>` +
    Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
}

// ลบบันทึก (ถามยืนยันก่อน)
async function deleteEvent(id) {
  if (!(await askConfirm("ลบบันทึกนี้?", "ลบ"))) return;
  const c = findCurrentCat();
  c.events = c.events.filter((x) => x.id !== id);
  removeEventData(id);
  drawCatDetail();
  showToast("ลบบันทึกแล้ว");
}

// ผูกปุ่ม ✏️ / ✕ ในไทม์ไลน์ และช่องกรองประเภท
function setupTimeline() {
  fillTimelineFilter();
  $("timelineFilter").onchange = () => drawTimeline(findCurrentCat());
  $("timeline").onclick = (e) => {
    const { edit, del } = e.target.dataset;
    if (edit) openEventForm(findCurrentCat().events.find((x) => x.id === edit));
    if (del) deleteEvent(del);
  };
}
