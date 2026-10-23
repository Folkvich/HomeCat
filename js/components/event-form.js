// ===== Component: ฟอร์มเพิ่ม/แก้ไขบันทึกประวัติ (วัคซีน, พบหมอ, น้ำหนัก ฯลฯ) =====
// เปิดเป็นหน้าต่างเลื่อนขึ้นจากด้านล่าง (บนมือถือ) จากปุ่ม "+ เพิ่มบันทึก" หรือปุ่ม ✏️ ในประวัติ

// เปิดฟอร์ม: ส่งบันทึกเดิมมา = โหมดแก้ไข, ไม่ส่ง = เพิ่มบันทึกใหม่ (วันที่เป็นวันนี้)
function openEventForm(ev) {
  const f = $("eventForm");
  editingEventId = ev ? ev.id : null;
  f.reset();
  showEventErrors({});
  f.date.value = ev ? ev.date : todayString();
  if (ev) {
    f.type.value = ev.type;
    f.weight.value = ev.weight ?? "";
    f.text.value = ev.text || "";
    f.next.value = ev.next || "";
  }
  $("eventFormTitle").textContent = ev ? "แก้ไขบันทึก" : "เพิ่มบันทึก";
  $("saveEventBtn").textContent = ev ? "บันทึกการแก้ไข" : "บันทึก";
  toggleEventFields();
  updateDateHints(f);
  $("eventDialog").showModal();
}

// เลือกประเภท "น้ำหนัก" -> โชว์ช่องน้ำหนัก (และไม่ต้องมีนัดครั้งถัดไป)
function toggleEventFields() {
  const isWeight = $("eventForm").type.value === "weight";
  $("weightField").hidden = !isWeight;
  $("nextField").hidden = isWeight;
  showEventErrors({});
}

// โชว์/ซ่อนข้อความเตือนใต้ช่องที่กรอกไม่ครบ เช่น showEventErrors({ text: true })
function showEventErrors({ weight = false, text = false }) {
  const f = $("eventForm");
  $("weightError").hidden = !weight;
  $("textError").hidden = !text;
  f.weight.classList.toggle("invalid", weight);
  f.text.classList.toggle("invalid", text);
}

// อ่านค่าจากฟอร์มเป็นบันทึก 1 รายการ (คืน null และโชว์ข้อความเตือน ถ้ากรอกไม่ครบ)
function readEventForm(f) {
  const ev = { date: f.date.value || todayString(), type: f.type.value, text: f.text.value.trim() };
  if (ev.type === "weight") {
    ev.weight = parseFloat(f.weight.value);
    if (!(ev.weight > 0)) { showEventErrors({ weight: true }); f.weight.focus(); return null; } // น้ำหนักต้องเป็นเลขมากกว่า 0
  } else {
    if (!ev.text) { showEventErrors({ text: true }); f.text.focus(); return null; }
    if (f.next.value) ev.next = f.next.value;
  }
  return ev;
}

// กด "บันทึก": เพิ่มรายการใหม่ หรืออัปเดตรายการที่กำลังแก้ (กรอกไม่ครบ = ไม่ปิดหน้าต่าง)
let weightConfirmed = false; // ผู้ใช้ยืนยันน้ำหนักที่ดูผิดปกติแล้ว (ไม่ต้องถามซ้ำ)

function saveEvent(e) {
  const ev = readEventForm(e.target);
  if (!ev) return e.preventDefault();
  const c = findCurrentCat();
  // น้ำหนักต่างจากครั้งก่อนมากผิดปกติ -> ถามก่อน (กันพิมพ์ผิด เช่น 10 แทน 1.0)
  const warning = ev.type === "weight" && !weightConfirmed && weightTypoWarning(c, ev, editingEventId);
  if (warning) {
    e.preventDefault(); // ยังไม่ปิดฟอร์ม
    askConfirm(warning, "ถูกแล้ว บันทึกเลย", false).then((ok) => {
      if (!ok) return e.target.weight.focus();
      weightConfirmed = true;
      e.target.requestSubmit(); // ส่งฟอร์มอีกรอบ (รอบนี้ข้ามการถาม)
    });
    return;
  }
  weightConfirmed = false;
  const saved = { id: editingEventId || newId(), ...ev };
  if (editingEventId) {
    // แทนที่รายการเดิมทั้งก้อน (ช่องที่ไม่ได้กรอกแล้ว เช่น นัด จะหายไปด้วย)
    c.events = c.events.map((x) => x.id === editingEventId ? saved : x);
    showToast("แก้ไขบันทึกแล้ว");
  } else {
    c.events.push(saved);
    showToast("บันทึกแล้ว");
  }
  editingEventId = null;
  saveEventData(c, saved);
  drawCatDetail();
}

// ผูกปุ่มและช่องกรอกของฟอร์ม
function setupEventForm() {
  const f = $("eventForm");
  f.type.onchange = toggleEventFields;
  f.onsubmit = saveEvent;
  f.weight.oninput = f.text.oninput = () => showEventErrors({}); // เริ่มพิมพ์ -> ซ่อนข้อความเตือน
  $("addEventBtn").onclick = () => openEventForm(null);       // ปุ่มลอย "+ เพิ่มบันทึก"
  $("cancelEventBtn").onclick = () => $("eventDialog").close();
}
