// ===== ฟังก์ชันช่วยทั่วไป (ไม่ยุ่งกับหน้าจอ ใช้ได้ทุกที่) =====

// แปลงอักขระพิเศษ (< > & " ') ให้เป็นข้อความธรรมดา กันคนพิมพ์โค้ดแทรกเข้ามาในหน้าเว็บ
const makeTextSafe = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// สร้าง id ใหม่ที่ไม่ซ้ำกัน (รูปแบบ UUID ตามที่ฐานข้อมูลต้องการ)
// (crypto.randomUUID ใช้ได้เฉพาะ https/localhost ถ้าเปิดผ่าน IP ในวง Wi-Fi จะสุ่ม UUID เองแทน)
const newId = () => crypto.randomUUID?.() ??
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

// เช็กว่าเป็น UUID ไหม (id จากเวอร์ชันเก่าอาจไม่ใช่)
const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// แปลงวันที่ (เช่น 2026-10-04) เป็นรูปแบบไทย ถ้าไม่มีวันที่ให้แสดง "-"
const formatThaiDate = (d) => d ? new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }) : "-";

// วันที่วันนี้ในรูปแบบ 2026-10-04 ตามเวลาเครื่อง (ใช้ตั้งค่าเริ่มต้นให้ช่องวันที่)
// (ไม่ใช้ toISOString เพราะเป็นเวลาอังกฤษ ช่วงก่อน 7 โมงเช้าจะได้วันที่ของเมื่อวาน)
function todayString() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

// นับว่าอีกกี่วันจะถึงวันที่ d (ติดลบ = เลยมาแล้ว)
function daysUntil(d) {
  const target = new Date(d + "T00:00"), today = new Date(todayString() + "T00:00");
  return Math.round((target - today) / 86400000);
}

// แปลงจำนวนวันเป็นคำอ่านง่าย เช่น "วันนี้", "อีก 3 วัน", "เลยมา 2 วัน"
function dueText(days) {
  if (days === 0) return "วันนี้";
  if (days === 1) return "พรุ่งนี้";
  return days > 0 ? `อีก ${days} วัน` : `เลยมา ${-days} วัน`;
}

// ระดับความเร่งด่วนของนัด ใช้เป็นชื่อ class สี: เลยกำหนด = "overdue" (แดง), ภายใน 7 วัน = "soon" (ส้ม)
const dueLevel = (days) => days < 0 ? "overdue" : days <= 7 ? "soon" : "";

// น้ำหนักล่าสุดของแมว (null ถ้ายังไม่เคยชั่ง)
function latestWeight(c) {
  const ws = c.events.filter((e) => e.type === "weight" && e.weight > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  return ws.length ? ws[0].weight : null;
}

// บันทึกล่าสุดของประเภทนั้น (null ถ้าไม่มี)
// ถ้าวันเดียวกันมีหลายบันทึก เลือกอันที่ใส่ "นัดครั้งถัดไป" ไว้ก่อน (การ์ดสรุปสุขภาพกับกล่องนัดจะได้ตรงกัน)
function latestOfType(c, type) {
  let best = null;
  for (const e of c.events) {
    if (e.type !== type) continue;
    if (!best || e.date > best.date || (e.date === best.date && e.next && !best.next)) best = e;
  }
  return best;
}

// คำนวณอายุแมวจากวันเกิด แสดงเป็น "X ปี Y เดือน", "Y เดือน" หรือ ถ้ายังไม่ถึงเดือน "X สัปดาห์" / "X วัน"
function calculateAge(born) {
  if (!born) return "-";
  const b = new Date(born), n = new Date();
  // นับจำนวนเดือนทั้งหมดตั้งแต่เกิดถึงวันนี้
  let m = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) m--; // ยังไม่ถึงวันเกิดของเดือนนี้ ลบออก 1 เดือน
  if (m < 0) return "-";              // วันเกิดอยู่ในอนาคต
  if (m === 0) {                      // ลูกแมวยังไม่ถึงเดือน: นับเป็นวัน/สัปดาห์
    const d = -daysUntil(born);
    return d < 1 ? "เกิดวันนี้" : d < 14 ? `${d} วัน` : `${Math.floor(d / 7)} สัปดาห์`;
  }
  const y = Math.floor(m / 12);
  return y ? `${y} ปี ${m % 12} เดือน` : `${m} เดือน`;
}

// เช็กว่าแมวฝังไมโครชิปแล้วหรือไม่
// (ข้อมูลเก่าที่ยังไม่มีช่อง chip แต่มีเลขชิป ให้นับว่าฝังแล้ว)
const hasMicrochip = (c) => c.chip === "yes" || (c.chip === undefined && !!c.chipDate);

// สร้าง HTML รูปแมว ถ้ายังไม่มีรูปให้ใช้อีโมจิ 🐱 แทน
function catPictureHtml(c) {
  return c.photo ? `<img src="${c.photo}" alt="${makeTextSafe(c.name)}">` : "🐱";
}

// ย่อรูปให้ด้านยาวสุดไม่เกิน 400px แล้วแปลงเป็นข้อความ เพื่อไม่ให้กินพื้นที่เก็บข้อมูลมาก
// คืนค่า null ถ้าไม่ได้เลือกรูปหรืออ่านรูปไม่ได้
function resizePhoto(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 400 / Math.max(img.width, img.height)); // อัตราส่วนย่อ (ไม่ขยายรูปเล็ก)
      const cv = document.createElement("canvas");
      cv.width = img.width * s; cv.height = img.height * s;
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); // วาดรูปลงผืนผ้าใบขนาดใหม่
      resolve(cv.toDataURL("image/jpeg", 0.8));                      // แปลงเป็น JPEG คุณภาพ 80%
      URL.revokeObjectURL(img.src);                                  // คืนหน่วยความจำ
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

// ช่องเลือกวันที่ของมือถือแสดงปี ค.ศ. -> โชว์วันที่แบบไทย (พ.ศ.) ไว้ใต้ช่องด้วย ให้ตรงกับส่วนอื่นของแอป
function setupDateHints() {
  for (const input of document.querySelectorAll('input[type="date"]')) {
    const hint = document.createElement("small");
    hint.className = "date-hint";
    input.after(hint);
    input.addEventListener("input", () => updateDateHints(input.form));
  }
}

// อัปเดตวันที่แบบไทยใต้ทุกช่องวันที่ในฟอร์ม (เรียกหลังเติมค่าลงฟอร์มด้วยโค้ด)
function updateDateHints(form) {
  for (const input of form.querySelectorAll('input[type="date"]')) {
    input.nextElementSibling.textContent = input.value ? formatThaiDate(input.value) : "";
  }
}

// แปลงจำนวนวันเป็นช่วงเวลาอ่านง่าย เช่น 3 -> "3 วัน", 20 -> "3 สัปดาห์", 75 -> "2 เดือน", 400 -> "1 ปี"
function durationText(days) {
  days = Math.abs(days);
  if (days < 14) return `${days} วัน`;
  if (days < 60) return `${Math.round(days / 7)} สัปดาห์`;
  if (days < 365) return `${Math.round(days / 30)} เดือน`;
  const y = Math.floor(days / 365), m = Math.round((days % 365) / 30);
  return m ? `${y} ปี ${m} เดือน` : `${y} ปี`;
}

// "X วันก่อน" / "วันนี้" จากวันที่ในอดีต
const agoText = (d) => { const days = -daysUntil(d); return days <= 0 ? "วันนี้" : `${durationText(days)}ก่อน`; };

// บวกวันให้วันที่ (รูปแบบ 2026-10-04) แล้วคืนเป็นรูปแบบเดิม
function addDays(d, n) {
  const t = new Date(d + "T00:00");
  t.setDate(t.getDate() + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

// คัดลอกข้อความลงคลิปบอร์ด คืน true ถ้าสำเร็จ
// 1) Clipboard API (ต้องเป็น https/localhost และหน้าเว็บต้องโฟกัสอยู่)
// 2) วิธีเก่า execCommand (ใช้ได้ตอนเปิดผ่าน http ในวง Wi-Fi) ต้องวางช่องไว้ในหน้าต่างที่เปิดอยู่
//    เพราะตอนหน้าต่าง popup เปิด ส่วนอื่นของหน้าจะเลือกข้อความไม่ได้
async function copyText(text, container = document.body) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* ลองวิธีถัดไป */ }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed; top:0; left:0; opacity:0; font-size:16px;";
  container.append(ta);
  ta.select();
  ta.setSelectionRange(0, text.length); // iOS
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove();
  return ok;
}

// ----- ลากเรียงลำดับ (ใช้ได้ทั้งนิ้วและเมาส์) -----
// แต่ละรายการต้องมี data-sort-id และปุ่มจับ .drag-handle (จับที่ปุ่มเท่านั้น แตะส่วนอื่นยังเปิด/เลื่อนหน้าได้ตามปกติ)
// ลากผ่านรายการไหน รายการที่ลากจะย้ายไปแทนที่ตรงนั้นทันที ใช้ได้ทั้งแบบตารางและแบบแถว
// ปล่อยแล้วลำดับเปลี่ยน -> เรียก onDone(รายการ id ตามลำดับใหม่)
// คีย์บอร์ด: โฟกัสที่ปุ่มจับแล้วกดลูกศร ขึ้น/ซ้าย = เลื่อนขึ้น, ลง/ขวา = เลื่อนลง
function makeSortable(list, onDone) {
  const ids = () => [...list.querySelectorAll(":scope > [data-sort-id]")].map((el) => el.dataset.sortId);

  list.addEventListener("pointerdown", (e) => {
    const handle = e.target.closest(".drag-handle");
    if (!handle || e.button > 0) return;
    const item = handle.closest("[data-sort-id]");
    e.preventDefault();
    const before = ids().join();
    item.classList.add("dragging");
    list.classList.add("sorting");

    // ฟังที่ window ไม่ใช้ setPointerCapture: ย้ายรายการใน DOM แล้วเบราว์เซอร์จะปล่อย capture ทิ้ง ทำให้ไม่ได้ยินตอนปล่อยนิ้ว
    const move = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      // ลากเข้าใกล้ขอบจอ -> เลื่อนหน้าให้ (รายการยาวเกินจอ)
      if (ev.clientY < 70) scrollBy(0, -12);
      else if (ev.clientY > innerHeight - 70) scrollBy(0, 12);
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-sort-id]");
      if (!over || over === item || over.parentElement !== list) return;
      // อยู่หลังรายการที่ลาก -> ไปต่อท้ายมัน, อยู่ก่อน -> ไปแทรกหน้ามัน
      const after = item.compareDocumentPosition(over) & Node.DOCUMENT_POSITION_FOLLOWING;
      list.insertBefore(item, after ? over.nextSibling : over);
    };
    const end = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", end);
      removeEventListener("pointercancel", end);
      item.classList.remove("dragging");
      list.classList.remove("sorting");
      if (ids().join() !== before) onDone(ids());
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", end);
    addEventListener("pointercancel", end);
  });

  list.addEventListener("keydown", (e) => {
    const handle = e.target.closest(".drag-handle");
    const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
    if (!handle || !step) return;
    e.preventDefault();
    const item = handle.closest("[data-sort-id]");
    const sib = step < 0 ? item.previousElementSibling : item.nextElementSibling;
    if (!sib?.dataset.sortId) return;
    list.insertBefore(item, step < 0 ? sib : sib.nextSibling);
    handle.focus();
    onDone(ids());
  });
}
