// ===== Component: พฤติกรรมของหน้าต่าง popup ทุกอัน =====
// - ปุ่ม ✕ / แตะพื้นหลังมืด / ปัดแผ่นลง / ปุ่มย้อนกลับของ Android / Esc -> ปิดหน้าต่าง
// - ฟอร์มที่เริ่มกรอกแล้ว ถามก่อนทิ้ง (กันเผลอปัดทิ้งของที่พิมพ์มาครึ่งทาง)
// - คีย์บอร์ดเด้งขึ้น -> ยกแผ่นขึ้นอยู่เหนือคีย์บอร์ด และเลื่อนช่องที่กำลังพิมพ์มาให้เห็น

// เป็นแผ่นเลื่อนจากด้านล่างไหม (ตรงกับ @media ใน dialog.css)
const isSheetLayout = () => matchMedia("(max-width: 599px), (max-height: 500px)").matches;

// ฟอร์มในหน้าต่างนี้มีการกรอกอะไรไปแล้วหรือยัง
const isDirty = (d) => d.querySelector("form")?.dataset.dirty === "1";

// ปิดหน้าต่าง (ถ้ากรอกค้างไว้ ถามก่อน)
async function requestCloseDialog(d) {
  if (isDirty(d) && !(await askConfirm("ทิ้งข้อมูลที่กรอกไว้?", "ทิ้ง"))) return;
  d.close();
}

// ปัดหัวแผ่นลงเพื่อปิด (เฉพาะแบบแผ่นจากด้านล่าง)
function setupSwipeToClose(d) {
  const head = d.querySelector(".dialog-head");
  if (!head) return;
  let startY = null, dy = 0;
  head.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button") || !isSheetLayout()) return;
    startY = e.clientY;
    dy = 0;
    d.style.transition = "none";
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener("pointermove", (e) => {
    if (startY === null) return;
    dy = Math.max(0, e.clientY - startY); // ลากขึ้นไม่ได้ ลงได้อย่างเดียว
    d.style.transform = `translateY(${dy}px)`;
  });
  const end = async () => {
    if (startY === null) return;
    startY = null;
    d.style.transition = "transform .2s ease-out";
    d.style.transform = "";
    if (dy > 90) await requestCloseDialog(d); // ลากลงเกิน 90px = ปิด, ไม่ถึง = เด้งกลับ
  };
  head.addEventListener("pointerup", end);
  head.addEventListener("pointercancel", end);
}

// คีย์บอร์ดบนมือถือ: วัดว่าบังด้านล่างจอไปเท่าไหร่ แล้วส่งให้ CSS (--kb) ยกแผ่นขึ้น
function trackKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const kb = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
    const open = kb > 80; // เล็กกว่านี้คือแถบเครื่องมือเบราว์เซอร์ ไม่ใช่คีย์บอร์ด
    document.documentElement.style.setProperty("--kb", open ? `${kb}px` : "0px");
    document.documentElement.classList.toggle("kb-open", open);
  };
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  update();
}

function setupDialogs() {
  for (const d of document.querySelectorAll("dialog")) {
    const form = d.querySelector("form");
    const tracks = form && d.id !== "confirmDialog";
    if (tracks) {
      const mark = () => { form.dataset.dirty = "1"; };
      form.addEventListener("input", mark);
      form.addEventListener("change", mark);
    }
    // ปิดแล้ว -> ล้างสถานะ "กรอกค้าง" และตำแหน่งที่ลากค้างไว้
    d.addEventListener("close", () => {
      if (form) form.dataset.dirty = "";
      d.style.transform = "";
      d.style.transition = "";
    });
    d.querySelectorAll("[data-close]").forEach((b) => { b.onclick = () => requestCloseDialog(d); });
    // แตะพื้นหลังมืด (นอกกล่อง)
    d.addEventListener("click", (e) => {
      if (e.target !== d) return;
      d.id === "confirmDialog" ? d.close("cancel") : requestCloseDialog(d);
    });
    // Esc / ปุ่มย้อนกลับของ Android: ถ้ากรอกค้างไว้ ถามก่อน
    d.addEventListener("cancel", (e) => {
      if (tracks && isDirty(d)) { e.preventDefault(); requestCloseDialog(d); }
    });
    setupSwipeToClose(d);
  }

  trackKeyboard();

  // แตะช่องกรอกในหน้าต่าง -> เลื่อนช่องนั้นมากลางจอ (รอคีย์บอร์ดขึ้นเสร็จก่อน)
  document.addEventListener("focusin", (e) => {
    if (!e.target.matches?.("dialog input:not([type=hidden]), dialog select, dialog textarea")) return;
    setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
  });
}
