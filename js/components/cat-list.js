// ===== Component: รายชื่อแมว (ช่องค้นหา + การ์ดแมว แบบตาราง/รายการ) =====

// มุมมองที่เลือกไว้ จำแยกตามเครื่อง (มือถืออาจชอบรายการ คอมชอบตาราง)
let catView = (() => { try { return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid"; } catch { return "grid"; } })();

function setCatView(view) {
  catView = view;
  try { localStorage.setItem(VIEW_KEY, view); } catch { /* ไม่เป็นไร */ }
  drawCatCards();
}

// วาดการ์ดแมวทั้งหมดในหน้ารายชื่อ (กรองตามคำที่พิมพ์ในช่องค้นหา)
let showArchived = false; // กำลังดูแมวที่เก็บประวัติไว้ (จากไป/ย้ายบ้าน) อยู่ไหม

function drawCatCards() {
  const q = $("search").value.trim().toLowerCase();
  const archived = cats.filter((c) => c.archivedAt);
  if (!archived.length) showArchived = false;
  const pool = showArchived ? archived : activeCats(); // รายชื่อปกติ = แมวที่ยังดูแลอยู่
  const list = pool.filter((c) => c.name.toLowerCase().includes(q));
  $("empty").hidden = cats.length > 0;     // ถ้ายังไม่มีแมวเลย ให้โชว์หน้าแนะนำ
  $("searchBar").hidden = cats.length === 0; // ยังไม่มีแมว -> ไม่ต้องมีช่องค้นหา
  // มีแมวแต่ค้นหาไม่เจอ -> บอกผู้ใช้
  $("noResult").hidden = !(cats.length && !list.length);
  $("noResult").textContent = `ไม่พบแมวชื่อ "${$("search").value.trim()}"`;
  $("listTools").hidden = cats.length === 0;
  // จอแคบซ่อนคำในวงเล็บ <span class="long"> ให้เหลือแบบสั้น ("3 ตัว", "2/10 ตัว") ไม่ตกเป็น 2 บรรทัด
  $("catCount").innerHTML = q
    ? `<span class="long">เจอ </span>${list.length}<span class="long"> จาก </span><span class="short">/</span>${pool.length} ตัว`
    : `<span class="long">${showArchived ? "เก็บไว้ " : "แมว "}</span>${pool.length} ตัว`;
  $("bulkEventBtn").hidden = showArchived || activeCats().length < 2; // ตัวเดียว ใช้ปุ่มในหน้าแมวพอ
  $("archivedBtn").hidden = !archived.length;
  $("archivedBtn").textContent = showArchived ? "← กลับไปรายชื่อแมว" : `📦 แมวที่เก็บประวัติไว้ (${archived.length})`;
  $("noResult").hidden = !(pool.length && !list.length) && !(showArchived && !pool.length);
  for (const b of document.querySelectorAll(".view-toggle [data-view]")) {
    b.classList.toggle("on", b.dataset.view === catView);
    b.setAttribute("aria-pressed", b.dataset.view === catView);
  }
  $("cats").className = catView === "list" ? "cat-rows" : "grid";
  // ลากเรียงได้เฉพาะตอนเห็นแมวครบทุกตัว (กำลังค้นหา = เห็นแค่บางตัว ลำดับจะสับสน)
  const sortable = !q && !showArchived && list.length > 1;
  $("cats").innerHTML = list.map((c) => (catView === "list" ? catRowHtml : catCardHtml)(c, sortable)).join("");
  drawReminders();
}

// ปุ่มจับสำหรับลากเรียงลำดับ
const dragHandleHtml = (name) =>
  `<button type="button" class="drag-handle" aria-label="ลากเพื่อย้ายลำดับ ${makeTextSafe(name)}">⠿</button>`;

// สร้าง HTML การ์ดแมว 1 ใบ
function catCardHtml(c, sortable) {
  const w = latestWeight(c);
  const age = c.born ? ` · ${calculateAge(c.born)}` : ""; // ไม่มีวันเกิด -> ไม่ต้องโชว์อายุ
  return `
    <article class="card cat-card" data-id="${c.id}" ${sortable ? `data-sort-id="${c.id}"` : ""} tabindex="0">
      <div class="pic">${catPictureHtml(c)}${catDueBadgeHtml(c)}${sortable ? dragHandleHtml(c.name) : ""}</div>
      <div class="info">
        <b>${makeTextSafe(c.name)}</b>
        <small>${makeTextSafe(c.breed || "ไม่ระบุสายพันธุ์")}${age}</small>
        <small>${w ? `⚖️ ${w} กก. · ` : ""}📋 ${c.events.length} บันทึก</small>
      </div>
    </article>`;
}

// สร้าง HTML แมว 1 แถว (แบบรายการ): รูปวงกลมเล็ก + ชื่อ + ข้อมูลย่อ + นัดถัดไป
function catRowHtml(c, sortable) {
  const w = latestWeight(c);
  const facts = [makeTextSafe(c.breed || "ไม่ระบุสายพันธุ์"), c.born && calculateAge(c.born), w && `⚖️ ${w} กก.`].filter(Boolean).join(" · ");
  const r = c.archivedAt ? null : nearestReminder(c); // เก็บประวัติไว้ -> ไม่โชว์นัด
  const next = r
    ? `<small class="next ${dueLevel(r.days)}">${TYPES[r.event.type]} ${r.days < 0 ? `เลยนัดมา ${durationText(r.days)}` : `นัด${dueText(r.days)}`}</small>`
    : c.archivedAt ? `<small>${makeTextSafe(c.archiveNote || "📦 เก็บประวัติไว้")}</small>` : `<small>📋 ${c.events.length} บันทึก</small>`;
  return `
    <article class="card cat-card cat-row" data-id="${c.id}" ${sortable ? `data-sort-id="${c.id}"` : ""} tabindex="0">
      <div class="pic">${catPictureHtml(c)}</div>
      <div class="info">
        <b>${makeTextSafe(c.name)}</b>
        <small>${facts}</small>
        ${next}
      </div>
      <span class="chev" aria-hidden="true">›</span>
      ${sortable ? dragHandleHtml(c.name) : ""}
    </article>`;
}

// ผูกปุ่มและช่องกรอกของส่วนนี้
function setupCatList() {
  $("search").oninput = drawCatCards;               // พิมพ์ค้นหา -> วาดการ์ดใหม่ทันที
  $("addCatBtn").onclick = () => openCatForm(null); // ปุ่ม "เพิ่มแมว"
  $("addFirstCatBtn").onclick = () => openCatForm(null); // ปุ่มในหน้าว่าง
  $("archivedBtn").onclick = () => { showArchived = !showArchived; $("search").value = ""; drawCatCards(); window.scrollTo(0, 0); };
  document.querySelector(".view-toggle").onclick = (e) => { // สลับตาราง/รายการ
    const b = e.target.closest("[data-view]");
    if (b && b.dataset.view !== catView) setCatView(b.dataset.view);
  };

  // คลิกการ์ดแมว -> เปิดหน้ารายละเอียดของตัวนั้น
  $("cats").onclick = (e) => {
    if (e.target.closest(".drag-handle")) return; // แตะปุ่มลาก ไม่ใช่เปิดหน้าแมว
    const card = e.target.closest(".cat-card");
    if (card) goToCatDetailPage(card.dataset.id);
  };
  // กด Enter บนการ์ด (ใช้คีย์บอร์ด) ก็เปิดได้เหมือนคลิก
  $("cats").onkeydown = (e) => {
    if (e.key === "Enter" && e.target.classList.contains("cat-card")) goToCatDetailPage(e.target.dataset.id);
  };
  // ลากเรียงลำดับแมว -> ทุกคนในบ้านเห็นลำดับเดียวกัน
  makeSortable($("cats"), (ids) => {
    cats.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    saveCatOrder(ids);
  });
}
