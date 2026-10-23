// ===== Component: ฟอร์มเพิ่ม/แก้ไขแมว (หน้าต่าง popup) =====

let removePhoto = false; // ผู้ใช้กด "ลบรูป" ในฟอร์มหรือไม่

// เปิดฟอร์ม ถ้าส่งข้อมูลแมวมา = โหมดแก้ไข (เติมข้อมูลเดิมให้) ถ้าส่ง null = เพิ่มแมวใหม่
function openCatForm(cat) {
  editingId = cat ? cat.id : null;
  removePhoto = false;
  const f = $("catForm");
  f.reset();
  f.dataset.dirty = ""; // เพิ่งเปิด ยังไม่ได้กรอกอะไร
  showNameError(false);
  $("dialogTitle").textContent = cat ? "แก้ไขข้อมูลแมว" : "เพิ่มแมว";
  if (cat) {
    // เติมค่าเดิมลงในช่องต่าง ๆ
    for (const k of ["name", "breed", "sex", "born", "color", "note", "chipDate", "chipPlace"]) f[k].value = cat[k] || "";
    f.chip.value = hasMicrochip(cat) ? "yes" : "no";
    f.neutered.value = cat.neutered || "unknown"; // แมวที่บันทึกไว้ก่อนมีช่องนี้ -> "ไม่ทราบ"
  }
  showPhotoPreview(cat?.photo);
  toggleChipFields();
  updateDateHints(f);
  $("catDialog").showModal();
}

// โชว์รูปตัวอย่างในฟอร์ม (ไม่มีรูป = อีโมจิ 🐱 และซ่อนปุ่ม "ลบรูป")
function showPhotoPreview(src) {
  $("photoPreview").innerHTML = src ? `<img src="${src}" alt="รูปแมว">` : "🐱";
  $("removePhotoBtn").hidden = !src;
}

// โชว์ช่องรายละเอียดชิปเฉพาะเมื่อเลือก "ฝังแล้ว"
function toggleChipFields() {
  $("chipFields").hidden = $("catForm").chip.value !== "yes";
}

// โชว์/ซ่อนข้อความ "กรุณากรอกข้อมูล" ใต้ช่องชื่อ
function showNameError(show) {
  $("nameError").hidden = !show;
  $("catForm").name.classList.toggle("invalid", show);
}

// อ่านค่าทุกช่องในฟอร์มออกมาเป็นข้อมูลแมว (ยังไม่รวมรูป)
function readCatForm(f) {
  const data = { name: f.name.value.trim(), breed: f.breed.value.trim(), sex: f.sex.value,
    born: f.born.value, color: f.color.value.trim(), note: f.note.value.trim(),
    chip: f.chip.value, chipDate: "", chipPlace: "", neutered: f.neutered.value };
  // เก็บรายละเอียดชิปเฉพาะเมื่อเลือก "ฝังแล้ว" (ถ้าไม่ฝังจะล้างค่าทิ้ง)
  if (data.chip === "yes") {
    data.chipDate = f.chipDate.value;
    data.chipPlace = f.chipPlace.value.trim();
  }
  return data;
}

// กด "บันทึก" ในฟอร์มแมว: เพิ่มแมวใหม่ หรืออัปเดตแมวตัวเดิม
async function saveCatForm(e) {
  const f = e.target;
  // ยังไม่กรอกชื่อ (หรือกรอกแต่ช่องว่าง) -> ไม่ปิดฟอร์ม และโชว์ข้อความเตือน
  if (!f.name.value.trim()) {
    e.preventDefault();
    showNameError(true);
    f.name.focus();
    return;
  }
  const photo = await resizePhoto(f.photo.files[0]);
  const data = readCatForm(f);
  let c;
  if (editingId) {
    // โหมดแก้ไข: อัปเดตข้อมูล และเปลี่ยนรูปเฉพาะเมื่อเลือกรูปใหม่หรือกดลบรูป
    c = cats.find((x) => x.id === editingId);
    Object.assign(c, data);
    if (photo) c.photo = photo;
    else if (removePhoto) c.photo = null;
    showToast("บันทึกข้อมูลแล้ว");
  } else {
    // โหมดเพิ่มใหม่: สร้างแมวพร้อม id ใหม่ และยังไม่มีประวัติ
    c = { id: newId(), ...data, photo, events: [] };
    cats.push(c);
    showToast(`เพิ่ม ${data.name} แล้ว`);
  }
  saveCatData(c);
  currentId ? drawCatDetail() : drawCatCards(); // วาดหน้าที่กำลังเปิดอยู่ใหม่
}

// ผูกปุ่มและช่องกรอกของฟอร์ม
function setupCatForm() {
  const f = $("catForm");
  f.chip.onchange = toggleChipFields;                     // เลือกฝังชิป/ไม่ฝัง
  f.onsubmit = saveCatForm;                               // ปุ่ม "บันทึก"
  f.name.oninput = () => showNameError(false);            // เริ่มพิมพ์ชื่อ -> ซ่อนข้อความเตือน
  $("cancelBtn").onclick = () => $("catDialog").close();  // ปุ่ม "ยกเลิก"

  // เลือกรูป -> โชว์รูปตัวอย่างทันที
  f.photo.onchange = () => {
    const file = f.photo.files[0];
    if (file) { removePhoto = false; showPhotoPreview(URL.createObjectURL(file)); }
  };
  // กด "ลบรูป" -> ล้างรูปที่เลือกไว้ และจำไว้ว่าจะลบรูปเดิมตอนบันทึก
  $("removePhotoBtn").onclick = () => {
    f.photo.value = "";
    removePhoto = true;
    showPhotoPreview(null);
  };
}
