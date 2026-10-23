// ===== Component: รายชื่อแมว (ช่องค้นหา + การ์ดแมว) =====

// วาดการ์ดแมวทั้งหมดในหน้ารายชื่อ (กรองตามคำที่พิมพ์ในช่องค้นหา)
function drawCatCards() {
  const q = $("search").value.trim().toLowerCase();
  const list = cats.filter((c) => c.name.toLowerCase().includes(q));
  $("empty").hidden = cats.length > 0;     // ถ้ายังไม่มีแมวเลย ให้โชว์หน้าแนะนำ
  $("searchBar").hidden = cats.length === 0; // ยังไม่มีแมว -> ไม่ต้องมีช่องค้นหา
  // มีแมวแต่ค้นหาไม่เจอ -> บอกผู้ใช้
  $("noResult").hidden = !(cats.length && !list.length);
  $("noResult").textContent = `ไม่พบแมวชื่อ "${$("search").value.trim()}"`;
  $("cats").innerHTML = list.map(catCardHtml).join("");
  drawReminders();
}

// สร้าง HTML การ์ดแมว 1 ใบ
function catCardHtml(c) {
  const w = latestWeight(c);
  const age = c.born ? ` · ${calculateAge(c.born)}` : ""; // ไม่มีวันเกิด -> ไม่ต้องโชว์อายุ
  return `
    <article class="card cat-card" data-id="${c.id}" tabindex="0">
      <div class="pic">${catPictureHtml(c)}${catDueBadgeHtml(c)}</div>
      <div class="info">
        <b>${makeTextSafe(c.name)}</b>
        <small>${makeTextSafe(c.breed || "ไม่ระบุสายพันธุ์")}${age}</small>
        <small>${w ? `⚖️ ${w} กก. · ` : ""}📋 ${c.events.length} บันทึก</small>
      </div>
    </article>`;
}

// ผูกปุ่มและช่องกรอกของส่วนนี้
function setupCatList() {
  $("search").oninput = drawCatCards;               // พิมพ์ค้นหา -> วาดการ์ดใหม่ทันที
  $("addCatBtn").onclick = () => openCatForm(null); // ปุ่ม "เพิ่มแมว"
  $("addFirstCatBtn").onclick = () => openCatForm(null); // ปุ่มในหน้าว่าง

  // คลิกการ์ดแมว -> เปิดหน้ารายละเอียดของตัวนั้น
  $("cats").onclick = (e) => {
    const card = e.target.closest(".cat-card");
    if (card) goToCatDetailPage(card.dataset.id);
  };
  // กด Enter บนการ์ด (ใช้คีย์บอร์ด) ก็เปิดได้เหมือนคลิก
  $("cats").onkeydown = (e) => {
    if (e.key === "Enter" && e.target.classList.contains("cat-card")) goToCatDetailPage(e.target.dataset.id);
  };
}
