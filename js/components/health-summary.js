// ===== Component: การ์ดสรุปสุขภาพ (ทำครั้งล่าสุดเมื่อไหร่ ถึงกำหนดครั้งต่อไปหรือยัง) =====
// รายการในการ์ดมาจาก TYPES (config.js) ทุกประเภท ยกเว้นบันทึกทั่วไป
// -> ชื่อตรงกับในฟอร์มเสมอ และเพิ่มประเภทใหม่ใน TYPES แล้วการ์ดจะมีแถวนั้นเอง
// ถ้าบันทึกมี "นัดครั้งถัดไป" ใช้วันนัดนั้น ถ้าไม่มีใช้รอบปกติจาก HEALTH_EVERY

// รอบปกติ (วัน) ของแต่ละประเภท ถ้าไม่ได้ใส่วันนัดไว้ (ไม่อยู่ในนี้ = ไม่มีรอบตายตัว แค่บอกว่าทำล่าสุดเมื่อไหร่)
const HEALTH_EVERY = { vaccine: 365, vet: 365, deworm: 90 };
const HEALTH_SKIP = ["note"]; // ประเภทที่ไม่ต้องสรุป

const healthTypes = () => Object.keys(TYPES).filter((t) => !HEALTH_SKIP.includes(t));

// สรุปเรื่องเดียว: { last, due, level } level = "overdue" | "soon" | "" | "none" (ยังไม่เคยบันทึก)
function healthStatus(c, type) {
  const last = latestOfType(c, type);
  if (!last) return { level: "none" };
  const every = HEALTH_EVERY[type];
  const due = last.next || (every && addDays(last.date, every));
  return { last, due, level: due ? dueLevel(daysUntil(due)) : "" };
}

// ข้อมูลเพิ่มของบางประเภท: น้ำหนัก = ตัวเลขล่าสุด, การรักษา = รักษาอะไร
function healthExtra(type, last) {
  if (type === "weight" && last.weight) return ` · ${last.weight} กก.`;
  if (type === "treatment" && last.text) {
    const t = last.text.split("\n")[0];
    return ` · ${makeTextSafe(t.length > 24 ? t.slice(0, 24) + "…" : t)}`;
  }
  return "";
}

function drawHealthSummary(c) {
  $("healthList").innerHTML = healthTypes().map((type) => {
    const s = healthStatus(c, type);
    let detail;
    if (s.level === "none") detail = `<span class="muted-text">ยังไม่มีบันทึก</span>`;
    else {
      detail = `ล่าสุด ${agoText(s.last.date)}${healthExtra(type, s.last)}`;
      if (s.level === "overdue") detail += ` · <b>เกินกำหนด ${durationText(daysUntil(s.due))}</b>`;
      else if (s.level === "soon") detail += ` · <b>ถึงกำหนด${dueText(daysUntil(s.due))}</b>`;
      else if (s.due) detail += ` · ครั้งต่อไป ${formatThaiDate(s.due)}`;
    }
    return `<li class="${s.level}"><span class="label">${TYPES[type]}</span><span class="detail">${detail}</span></li>`;
  }).join("");
}
