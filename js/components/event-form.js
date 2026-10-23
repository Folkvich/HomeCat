// ===== Component: ฟอร์มเพิ่ม/แก้ไขบันทึกประวัติ (วัคซีน, พบหมอ, น้ำหนัก ฯลฯ) =====
// เปิดเป็นหน้าต่างเลื่อนขึ้นจากด้านล่าง (บนมือถือ) จากปุ่ม "+ เพิ่มบันทึก" หรือปุ่ม ✏️ ในประวัติ
// เพิ่มบันทึกใหม่ เลือกแมวได้หลายตัว (เช่น พาทั้งบ้านไปฉีดวัคซีน) แมวแต่ละตัวได้บันทึกแยกของตัวเอง

const pickedCats = new Set(); // id แมวที่จะได้บันทึกนี้
const MAX_EVENT_PHOTOS = 3;
let formPhotos = [];          // รูปในฟอร์ม: [{ id?, data, isNew }] (id = รูปเดิมที่อยู่บนเซิร์ฟเวอร์แล้ว)
let removedPhotoIds = [];     // รูปเดิมที่กดลบในฟอร์ม (ลบจริงตอนกดบันทึก)

// เปิดฟอร์ม: ส่งบันทึกเดิมมา = โหมดแก้ไข, ไม่ส่ง = เพิ่มบันทึกใหม่ (วันที่เป็นวันนี้)
// เปิดจากหน้าแมว -> เลือกตัวนั้นไว้ก่อน, เปิดจากหน้ารายชื่อ ("เพิ่มบันทึกหลายตัว") -> ยังไม่เลือก
function openEventForm(ev) {
  const f = $("eventForm");
  editingEventId = ev ? ev.id : null;
  pickedCats.clear();
  if (currentId) pickedCats.add(currentId);
  f.reset();
  f.dataset.dirty = ""; // เพิ่งเปิด ยังไม่ได้กรอกอะไร
  showEventErrors({});
  f.date.value = ev ? ev.date : todayString();
  if (ev) {
    f.type.value = ev.type;
    f.weight.value = ev.weight ?? "";
    f.text.value = ev.text || "";
    f.next.value = ev.next || "";
    f.cost.value = ev.cost ?? "";
    f.timesPerDay.value = ev.timesPerDay || "";
    f.until.value = ev.until || "";
  }
  formPhotos = ev ? (photosByEvent.get(ev.id) || []).map((p) => ({ ...p, isNew: false })) : [];
  removedPhotoIds = [];
  drawFormPhotos();
  $("eventFormTitle").textContent = ev ? "แก้ไขบันทึก" : currentId ? "เพิ่มบันทึก" : "เพิ่มบันทึกหลายตัว";
  toggleEventFields();
  updateDateHints(f);
  $("eventDialog").showModal();
  growToFit(f.text); // ต้องหลังเปิดหน้าต่าง (ตอนซ่อนอยู่ วัดความสูงไม่ได้)
}

// ช่องรายละเอียดสูงขึ้นตามข้อความที่พิมพ์ (สูงสุดตาม max-height ใน CSS แล้วค่อยเลื่อนในช่อง)
function growToFit(ta) {
  ta.style.height = "auto";
  ta.style.height = `${ta.scrollHeight + 2}px`; // +2 = เส้นขอบบนล่าง
}

// เลือกประเภท "น้ำหนัก" -> โชว์ช่องน้ำหนัก (และไม่ต้องมีนัดครั้งถัดไป)
// น้ำหนักแต่ละตัวไม่เท่ากัน -> บันทึกได้ทีละตัว
function toggleEventFields() {
  const type = $("eventForm").type.value;
  const isWeight = type === "weight";
  $("weightField").hidden = !isWeight;
  $("nextField").hidden = isWeight;
  $("costField").hidden = isWeight;                 // ชั่งน้ำหนักไม่มีค่าใช้จ่าย
  $("treatmentFields").hidden = type !== "treatment";
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
  const hide = !!editingEventId || (activeCats().length < 2 && !!currentId);
  $("catPickField").hidden = hide;
  $("pickAllBtn").hidden = isWeight;
  $("catPickLabel").textContent = isWeight ? "บันทึกน้ำหนักของ (ทีละตัว)" : currentId ? "บันทึกให้แมว (เลือกตัวอื่นเพิ่มได้)" : "บันทึกให้แมว";
  $("pickAllBtn").textContent = pickedCats.size === activeCats().length ? "ไม่เลือกเลย" : "เลือกทั้งหมด";
  $("catPicker").innerHTML = activeCats().map((c) => `
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

// ----- รูปในฟอร์ม -----
function drawFormPhotos() {
  $("evPhotoList").innerHTML = formPhotos.map((p, i) => `
    <div class="ev-photo"><img src="${p.data}" alt="รูปที่ ${i + 1}">
      <button type="button" class="icon-btn" data-remove-photo="${i}" aria-label="ลบรูปที่ ${i + 1}">✕</button></div>`).join("");
  document.querySelector("#evPhotoField label.button").hidden = formPhotos.length >= MAX_EVENT_PHOTOS;
}

async function addFormPhotos(files) {
  for (const file of [...files].slice(0, MAX_EVENT_PHOTOS - formPhotos.length)) {
    const data = await resizePhoto(file, 1280, 0.72); // ใหญ่พออ่านใบเสร็จ/ผลตรวจได้ (~100-200KB)
    if (data) formPhotos.push({ data, isNew: true });
  }
  if (files.length > MAX_EVENT_PHOTOS) showToast(`แนบได้สูงสุด ${MAX_EVENT_PHOTOS} รูป`);
  $("eventForm").dataset.dirty = "1";
  drawFormPhotos();
}

function removeFormPhoto(i) {
  const [p] = formPhotos.splice(i, 1);
  if (p && !p.isNew) removedPhotoIds.push(p.id);
  $("eventForm").dataset.dirty = "1";
  drawFormPhotos();
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
    const cost = parseFloat(f.cost.value);
    if (cost > 0) ev.cost = cost;
    if (ev.type === "treatment") {
      if (f.timesPerDay.value) ev.timesPerDay = Number(f.timesPerDay.value);
      if (f.until.value) {
        if (f.until.value < ev.date) { showToast("⚠️ วันที่ทำถึง ต้องไม่ก่อนวันที่บันทึก", 4000); f.until.focus(); return null; }
        ev.until = f.until.value;
      }
    }
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
    const old = c.events.find((x) => x.id === editingEventId);
    const saved = { id: editingEventId, ...ev, createdBy: old?.createdBy || myUserId };
    c.events = c.events.map((x) => x.id === editingEventId ? saved : x);
    saveEventData(c, saved);
    for (const id of removedPhotoIds) removeEventPhoto(saved.id, id);
    for (const p of formPhotos.filter((x) => x.isNew)) addEventPhoto(saved.id, p.data);
    showToast("แก้ไขบันทึกแล้ว");
  } else {
    // แมวแต่ละตัวได้บันทึกแยกของตัวเอง (แก้/ลบของตัวไหนก็ไม่กระทบตัวอื่น)
    for (const cat of targets) {
      const saved = { id: newId(), ...ev, createdBy: myUserId };
      cat.events.push(saved);
      saveEventData(cat, saved);                                   // ต้องส่งบันทึกก่อน รูปถึงจะผูกได้
      for (const p of formPhotos) addEventPhoto(saved.id, p.data); // บันทึกหลายตัว: ทุกตัวได้รูปชุดเดียวกัน
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
  f.weight.oninput = () => showEventErrors({}); // เริ่มพิมพ์ -> ซ่อนข้อความเตือน
  f.text.oninput = () => { showEventErrors({}); growToFit(f.text); };
  $("addEventBtn").onclick = () => openEventForm(null);       // ปุ่มลอย "+ เพิ่มบันทึก"
  $("bulkEventBtn").onclick = () => openEventForm(null);      // หน้ารายชื่อ "+ เพิ่มบันทึกหลายตัว"
  $("catPicker").onclick = (e) => { const b = e.target.closest("[data-pick]"); if (b) togglePick(b.dataset.pick); };
  f.evPhotos.onchange = () => { addFormPhotos(f.evPhotos.files); f.evPhotos.value = ""; };
  $("evPhotoList").onclick = (e) => { const b = e.target.closest("[data-remove-photo]"); if (b) removeFormPhoto(Number(b.dataset.removePhoto)); };
  $("pickAllBtn").onclick = () => {
    const all = pickedCats.size === activeCats().length;
    pickedCats.clear();
    if (!all) activeCats().forEach((c) => pickedCats.add(c.id));
    $("catPickError").hidden = true;
    drawCatPicker();
  };
  $("cancelEventBtn").onclick = () => $("eventDialog").close();
}
