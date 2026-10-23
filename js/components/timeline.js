// ===== Component: ไทม์ไลน์ประวัติ (รายการวัคซีน พบหมอ น้ำหนัก ฯลฯ) =====
// โชว์ทีละ PAGE_SIZE รายการ (แมวที่บันทึกมาหลายปี หน้าจะได้ไม่ยาวจนช้า) กด "ดูเพิ่ม" โหลดต่อ
// รูปในบันทึกโหลดตามมาทีหลัง (ไม่ต้องรอรูปก่อนเห็นประวัติ)

const PAGE_SIZE = 20;
let timelineLimit = PAGE_SIZE;

// วาดไทม์ไลน์ของแมว เรียงจากใหม่ไปเก่า (กรองตามประเภทที่เลือกไว้)
function drawTimeline(c) {
  const filter = $("timelineFilter").value;
  // คัดลอกรายการก่อนเรียง จะได้ไม่ไปแก้ข้อมูลจริง
  const events = c.events.filter((e) => filter === "all" || e.type === filter)
    .sort((a, b) => b.date.localeCompare(a.date));
  const shown = events.slice(0, timelineLimit);
  const more = events.length - shown.length;
  $("timeline").innerHTML = events.length
    ? shown.map(timelineItemHtml).join("") +
      (more > 0 ? `<li class="more-row"><button type="button" class="link" id="timelineMoreBtn">ดูเพิ่ม (อีก ${more} รายการ)</button></li>` : "")
    : `<li class="muted">ยังไม่มีบันทึก</li>`;
  // โหลดรูปของบันทึก แล้ววาดใหม่ถ้ามีรูป
  loadEventPhotos(c).then((hasNew) => { if (hasNew && currentId === c.id) drawTimeline(c); });
}

// สถานะการรักษาต่อเนื่อง เช่น "วันละ 2 ครั้ง ถึง 30 ต.ค. (เหลือ 5 วัน)" / "ครบแล้ว"
function treatmentText(e) {
  if (e.type !== "treatment" || !(e.timesPerDay || e.until)) return "";
  const times = e.timesPerDay ? `วันละ ${e.timesPerDay} ครั้ง` : "";
  if (!e.until) return `<div class="treat">💊 ${times}</div>`;
  const left = daysUntil(e.until);
  const status = left < 0 ? "ครบแล้ว" : left === 0 ? "วันสุดท้าย" : `เหลือ ${left + 1} วัน`;
  return `<div class="treat${left >= 0 ? " active" : ""}">💊 ${times}${times ? " " : ""}ถึง ${formatThaiDate(e.until)} (${status})</div>`;
}

// สร้าง HTML ของบันทึก 1 รายการ
function timelineItemHtml(e) {
  const weight = e.type === "weight" ? ` ${e.weight} กก.` : "";
  const text = e.text ? `<div class="ev-text">${makeTextSafe(e.text)}</div>` : ""; // บรรทัดของตัวเอง เว้นบรรทัดตามที่พิมพ์
  const next = e.next ? `<div class="next ${dueLevel(daysUntil(e.next))}">📅 นัดครั้งถัดไป ${formatThaiDate(e.next)} (${dueText(daysUntil(e.next))})</div>` : "";
  const photos = (photosByEvent.get(e.id) || []).map((p, i) =>
    `<button type="button" class="ev-thumb" data-photo="${e.id}:${i}" aria-label="ดูรูปที่ ${i + 1}"><img src="${p.data}" alt="" loading="lazy"></button>`).join("");
  const by = e.createdBy && memberNames.get(e.createdBy);
  const meta = [e.cost > 0 && `💰 ${formatBaht(e.cost)}`, by && `บันทึกโดย ${makeTextSafe(by)}${e.createdBy === myUserId ? " (คุณ)" : ""}`].filter(Boolean).join(" · ");
  return `
    <li>
      <span class="tools">
        <button data-edit="${e.id}" title="แก้ไข">✏️</button>
        <button data-del="${e.id}" title="ลบ">✕</button>
      </span>
      <div class="date">${formatThaiDate(e.date)}</div>
      <b>${TYPES[e.type]}</b>${weight}${text}
      ${treatmentText(e)}
      ${next}
      ${photos ? `<div class="ev-thumbs">${photos}</div>` : ""}
      ${meta ? `<div class="ev-meta">${meta}</div>` : ""}
    </li>`;
}

// ใส่ตัวเลือกประเภทลงในช่องกรอง: "ทั้งหมด" + ทุกประเภทใน TYPES
function fillTimelineFilter() {
  $("timelineFilter").innerHTML = `<option value="all">ทั้งหมด</option>` +
    Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
}

// ลบบันทึก (ถามยืนยันก่อน) รูปในบันทึกถูกลบตามไปด้วย
async function deleteEvent(id) {
  if (!(await askConfirm("ลบบันทึกนี้? รูปในบันทึกจะถูกลบด้วย", "ลบ"))) return;
  const c = findCurrentCat();
  c.events = c.events.filter((x) => x.id !== id);
  photosByEvent.delete(id);
  removeEventData(id);
  drawCatDetail();
  showToast("ลบบันทึกแล้ว");
}

// ดูรูปเต็มจอ
function openPhotoViewer(eventId, index) {
  const photos = photosByEvent.get(eventId) || [];
  if (!photos[index]) return;
  $("photoViewerImg").src = photos[index].data;
  $("photoViewer").showModal();
}

// ผูกปุ่ม ✏️ / ✕ / รูป / ดูเพิ่ม ในไทม์ไลน์ และช่องกรองประเภท
function setupTimeline() {
  fillTimelineFilter();
  $("timelineFilter").onchange = () => { timelineLimit = PAGE_SIZE; drawTimeline(findCurrentCat()); };
  $("timeline").onclick = (e) => {
    const { edit, del } = e.target.dataset;
    if (edit) openEventForm(findCurrentCat().events.find((x) => x.id === edit));
    if (del) deleteEvent(del);
    const thumb = e.target.closest("[data-photo]");
    if (thumb) { const [id, i] = thumb.dataset.photo.split(":"); openPhotoViewer(id, Number(i)); }
    if (e.target.id === "timelineMoreBtn") { timelineLimit += PAGE_SIZE; drawTimeline(findCurrentCat()); }
  };
}
