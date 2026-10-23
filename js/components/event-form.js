// ===== Component: ฟอร์มเพิ่ม/แก้ไขบันทึกประวัติ (วัคซีน, พบหมอ, น้ำหนัก ฯลฯ) =====
// เปิดเป็นหน้าต่างเลื่อนขึ้นจากด้านล่าง (บนมือถือ) จากปุ่ม "+ เพิ่มบันทึก" หรือปุ่ม ✏️ ในประวัติ
// เพิ่มบันทึกใหม่ เลือกแมวได้หลายตัว (เช่น พาทั้งบ้านไปฉีดวัคซีน) แมวแต่ละตัวได้บันทึกแยกของตัวเอง

const pickedCats = new Set(); // id แมวที่จะได้บันทึกนี้

// เปิดฟอร์ม: ส่งบันทึกเดิมมา = โหมดแก้ไข, ไม่ส่ง = เพิ่มบันทึกใหม่ (วันที่เป็นวันนี้)
// เปิดจากหน้าแมว -> เลือกตัวนั้นไว้ก่อน, เปิดจากหน้ารายชื่อ ("บันทึกหลายตัว") -> ยังไม่เลือก
function openEventForm(ev) {
  const f = $("eventForm");
  editingEventId = ev ? ev.id : null;
  pickedCats.clear();
  if (currentId) pickedCats.add(currentId);
  f.reset();
  showEventErrors({});
  f.date.value = ev ? ev.date : todayString();
  if (ev) {
    f.type.value = ev.type;
    f.weight.value = ev.weight ?? "";
    f.text.value = ev.text || "";
    f.next.value = ev.next || "";
  }
  $("eventFormTitle").textContent = ev ? "แก้ไขบันทึก" : currentId ? "เพิ่มบันทึก" : "บันทึกหลายตัว";
  toggleEventFields();
  updateDateHints(f);
  $("eventDialog").showModal();
}

// เลือกประเภท "น้ำหนัก" -> โชว์ช่องน้ำหนัก (และไม่ต้องมีนัดครั้งถัดไป)
// น้ำหนักแต่ละตัวไม่เท่ากัน -> บันทึกได้ทีละตัว
function toggleEventFields() {
  const isWeight = $("eventForm").type.value === "weight";
  $("weightField").hidden = !isWeight;
  $("nextField").hidden = isWeight;
  if (isWeight && pickedCats.size > 1) {
    const keep = currentId && pickedCats.has(currentId) ? currentId : [...pickedCats][0];
    pickedCats.clear();
    pickedCats.add(keep);
  }
  showEventErrors({});
  drawCatPicker();
}

// ส่วนเลือกแมว: ซ่อนตอนแก้ไขบันทึกเดิม และตอนบ้านมีแมวตัวเดียวแล้วเปิดจากหน้าแมวตัวนั้น
function drawCatPicker() {
  const isWeight = $("eventForm").type.value === "weight";
  const hide = !!editingEventId || (cats.length < 2 && !!currentId);
  $("catPickField").hidden = hide;
  $("pickAllBtn").hidden = isWeight;
  $("catPickLabel").textContent = isWeight ? "บันทึกน้ำหนักของ (ทีละตัว)" : currentId ? "บันทึกให้แมว (เลือกตัวอื่นเพิ่มได้)" : "บันทึกให้แมว";
  $("pickAllBtn").textContent = pickedCats.size === cats.length ? "ไม่เลือกเลย" : "เลือกทั้งหมด";
  $("catPicker").innerHTML = cats.map((c) => `
    <button type="button" class="pick${pickedCats.has(c.id) ? " picked" : ""}" data-pick="${c.id}" aria-pressed="${pickedCats.has(c.id)}">
      ${pickedCats.has(c.id) ? "✓ " : ""}${makeTextSafe(c.name)}</button>`).join("");
  const n = pickedCats.size;
  $("saveEventBtn").textContent = editingEventId ? "บันทึกการแก้ไข" : n > 1 ? `บันทึก ${n} ตัว` : "บันทึก";
}

// แตะชื่อแมว: เลือก/ไม่เลือก (น้ำหนัก = เลือกได้ตัวเดียว แตะตัวใหม่แทนตัวเดิม)
function togglePick(id) {
  if ($("eventForm").type.value === "weight") { pickedCats.clear(); pickedCats.add(id); }
  else pickedCats.has(id) ? pickedCats.delete(id) : pickedCats.add(id);
  $("catPickError").hidden = true;
  drawCatPicker();
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
  // แมวที่จะได้บันทึก: แก้ไข = ตัวที่เปิดอยู่, เพิ่มใหม่ = ตัวที่เลือกไว้
  const targets = editingEventId ? [findCurrentCat()] : cats.filter((x) => pickedCats.has(x.id));
  if (!targets.length) { $("catPickError").hidden = false; return e.preventDefault(); }
  const c = targets[0];
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
  if (editingEventId) {
    // แทนที่รายการเดิมทั้งก้อน (ช่องที่ไม่ได้กรอกแล้ว เช่น นัด จะหายไปด้วย)
    const saved = { id: editingEventId, ...ev };
    c.events = c.events.map((x) => x.id === editingEventId ? saved : x);
    saveEventData(c, saved);
    showToast("แก้ไขบันทึกแล้ว");
  } else {
    // แมวแต่ละตัวได้บันทึกแยกของตัวเอง (แก้/ลบของตัวไหนก็ไม่กระทบตัวอื่น)
    for (const cat of targets) {
      const saved = { id: newId(), ...ev };
      cat.events.push(saved);
      saveEventData(cat, saved);
    }
    showToast(targets.length > 1 ? `บันทึกให้ ${targets.length} ตัวแล้ว` : "บันทึกแล้ว");
  }
  editingEventId = null;
  currentId ? drawCatDetail() : drawCatCards();
}

// ผูกปุ่มและช่องกรอกของฟอร์ม
function setupEventForm() {
  const f = $("eventForm");
  f.type.onchange = toggleEventFields;
  f.onsubmit = saveEvent;
  f.weight.oninput = f.text.oninput = () => showEventErrors({}); // เริ่มพิมพ์ -> ซ่อนข้อความเตือน
  $("addEventBtn").onclick = () => openEventForm(null);       // ปุ่มลอย "+ เพิ่มบันทึก"
  $("bulkEventBtn").onclick = () => openEventForm(null);      // หน้ารายชื่อ "+ บันทึกหลายตัว"
  $("catPicker").onclick = (e) => { const b = e.target.closest("[data-pick]"); if (b) togglePick(b.dataset.pick); };
  $("pickAllBtn").onclick = () => {
    const all = pickedCats.size === cats.length;
    pickedCats.clear();
    if (!all) cats.forEach((c) => pickedCats.add(c.id));
    $("catPickError").hidden = true;
    drawCatPicker();
  };
  $("cancelEventBtn").onclick = () => $("eventDialog").close();
}
