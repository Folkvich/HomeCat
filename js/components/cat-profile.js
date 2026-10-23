// ===== Component: โปรไฟล์แมว (รูป ชื่อ ข้อมูลทั่วไป ชิป ปุ่มแก้ไข/ลบ) =====

let profileOpen = false; // ผู้ใช้กางข้อมูลเพิ่มเติมไว้หรือไม่ (วาดใหม่แล้วยังกางอยู่เหมือนเดิม)

// วาดโปรไฟล์ของแมวตัวที่ส่งเข้ามา
// โชว์สรุปสั้น ๆ ก่อน (สายพันธุ์ เพศ อายุ น้ำหนัก) ข้อมูลที่เหลือซ่อนไว้ใน "ดูข้อมูลเพิ่มเติม"
// หน้ารายละเอียดบนมือถือจะได้ไม่ยาว และเห็นประวัติเร็วขึ้น
function drawCatProfile(c) {
  const w = latestWeight(c);
  const summary = [makeTextSafe(c.breed), makeTextSafe(c.sex), c.born && calculateAge(c.born), w && `⚖️ ${w} กก.`]
    .filter(Boolean).join(" · ");
  $("profile").innerHTML = `
    <div class="head">
      <div class="pic">${catPictureHtml(c)}</div>
      <div>
        <h2>${makeTextSafe(c.name)}</h2>
        <p class="summary">${summary || "ยังไม่ได้ใส่ข้อมูล"}</p>
      </div>
    </div>
    <details id="profileMore"${profileOpen ? " open" : ""}>
      <summary>ดูข้อมูลเพิ่มเติม</summary>
      <dl>
        <dt>สายพันธุ์</dt><dd>${makeTextSafe(c.breed) || "-"}</dd>
        <dt>เพศ</dt><dd>${makeTextSafe(c.sex)}</dd>
        <dt>วันเกิด</dt><dd>${formatThaiDate(c.born)} (${calculateAge(c.born)})</dd>
        <dt>สี/ลักษณะ</dt><dd>${makeTextSafe(c.color) || "-"}</dd>
        <dt>น้ำหนักล่าสุด</dt><dd>${w ? `${w} กก.` : "-"}</dd>
        <dt>ไมโครชิป</dt><dd>${hasMicrochip(c) ? "ฝังแล้ว" : "ไม่ได้ฝัง"}</dd>
        ${microchipDetailHtml(c)}
        <dt>ทำหมัน</dt><dd>${NEUTERED[c.neutered] || "ไม่ทราบ"}</dd>
        <dt>หมายเหตุ</dt><dd>${makeTextSafe(c.note) || "-"}</dd>
      </dl>
      <div class="actions">
        <button id="editBtn">✏️ แก้ไข</button>
        <button id="delCatBtn" class="danger">🗑️ ลบ</button>
      </div>
    </details>`;
  $("profileMore").ontoggle = (e) => { profileOpen = e.target.open; };
}

// แถว "ฝังชิปเมื่อ" จะแสดงเฉพาะเมื่อฝังแล้ว และมีวันที่หรือสถานที่
function microchipDetailHtml(c) {
  if (!hasMicrochip(c) || !(c.chipDate || c.chipPlace)) return "";
  const place = c.chipPlace ? " · " + makeTextSafe(c.chipPlace) : "";
  return `<dt>ฝังชิปเมื่อ</dt><dd>${formatThaiDate(c.chipDate)}${place}</dd>`;
}

// ลบแมวตัวนี้ (ถามยืนยันก่อน) แล้วกลับหน้ารายชื่อ
async function deleteCat(c) {
  if (!(await askConfirm(`ลบ ${c.name} และประวัติทั้งหมด? ลบแล้วกู้คืนไม่ได้`, "ลบ"))) return;
  cats = cats.filter((x) => x.id !== c.id); // เอาแมวตัวนี้ออกจากรายการ
  removeCatData(c.id);                      // ลบบนเซิร์ฟเวอร์ (ประวัติถูกลบตามไปด้วย)
  goToCatListPage();
  showToast(`ลบ ${c.name} แล้ว`);
}

// ผูกปุ่ม "แก้ไข" และ "ลบ" ในโปรไฟล์
function setupCatProfile() {
  $("profile").onclick = (e) => {
    const c = findCurrentCat();
    if (e.target.id === "editBtn") openCatForm(c);
    if (e.target.id === "delCatBtn") deleteCat(c);
  };
}
