// ===== Component: การ์ดสรุปสุขภาพ (ทำครั้งล่าสุดเมื่อไหร่ ถึงกำหนดครั้งต่อไปหรือยัง) =====
// ถ้าบันทึกมี "นัดครั้งถัดไป" ใช้วันนัดนั้น ถ้าไม่มีใช้รอบปกติจาก HEALTH_ITEMS

// เรื่องที่สรุป และรอบปกติ (วัน) ถ้าไม่ได้ใส่วันนัดไว้ (null = ไม่มีรอบตายตัว แค่บอกว่าทำล่าสุดเมื่อไหร่)
const HEALTH_ITEMS = [
  { type: "vaccine", label: "💉 วัคซีน", every: 365 },
  { type: "deworm", label: "💊 ถ่ายพยาธิ/เห็บหมัด", every: 90 },
  { type: "vet", label: "🩺 ตรวจสุขภาพ", every: 365 },
  { type: "grooming", label: "🛁 อาบน้ำ/ตัดขน", every: null },
];

// สรุปเรื่องเดียว: { last, due, level } level = "overdue" | "soon" | "" | "none" (ยังไม่เคยบันทึก)
function healthStatus(c, item) {
  const last = latestOfType(c, item.type);
  if (!last) return { level: "none" };
  const due = last.next || (item.every && addDays(last.date, item.every));
  return { last, due, level: due ? dueLevel(daysUntil(due)) : "" };
}

function drawHealthSummary(c) {
  $("healthList").innerHTML = HEALTH_ITEMS.map((item) => {
    const s = healthStatus(c, item);
    let detail;
    if (s.level === "none") detail = `<span class="muted-text">ยังไม่มีบันทึก</span>`;
    else {
      detail = `ล่าสุด ${agoText(s.last.date)}`;
      if (s.level === "overdue") detail += ` · <b>เกินกำหนด ${durationText(daysUntil(s.due))}</b>`;
      else if (s.level === "soon") detail += ` · <b>ถึงกำหนด${dueText(daysUntil(s.due))}</b>`;
      else if (s.due) detail += ` · ครั้งต่อไป ${formatThaiDate(s.due)}`;
    }
    return `<li class="${s.level}"><span class="label">${item.label}</span><span class="detail">${detail}</span></li>`;
  }).join("");
}
