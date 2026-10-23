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

// คำนวณอายุแมวจากวันเกิด แสดงเป็น "X ปี Y เดือน" หรือ "Y เดือน" ถ้ายังไม่ถึงปี
function calculateAge(born) {
  if (!born) return "-";
  const b = new Date(born), n = new Date();
  // นับจำนวนเดือนทั้งหมดตั้งแต่เกิดถึงวันนี้
  let m = (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) m--; // ยังไม่ถึงวันเกิดของเดือนนี้ ลบออก 1 เดือน
  if (m < 0) return "-";              // วันเกิดอยู่ในอนาคต
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
