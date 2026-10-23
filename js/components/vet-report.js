// ===== Component: สรุปประวัติให้สัตวแพทย์ (หน้าพิมพ์ / บันทึกเป็น PDF) =====
// รวมข้อมูลสำคัญของแมว 1 ตัว: ข้อมูลทั่วไป สรุปสุขภาพ วัคซีน การรักษา พบหมอ ถ่ายพยาธิ น้ำหนัก
// กด "พิมพ์ / บันทึก PDF" -> หน้าต่างพิมพ์ของเครื่อง (เลือก "บันทึกเป็น PDF" แล้วส่งให้คลินิกได้)

const REPORT_SECTIONS = ["vaccine", "treatment", "vet", "deworm", "weight"]; // ลำดับหัวข้อในรายงาน

function openVetReport(c) {
  const w = latestWeight(c);
  const facts = [
    ["ชื่อ", c.name], ["สายพันธุ์", c.breed || "-"], ["เพศ", c.sex || "-"],
    ["วันเกิด", c.born ? `${formatThaiDate(c.born)} (${calculateAge(c.born)})` : "-"],
    ["สี/ลักษณะ", c.color || "-"], ["น้ำหนักล่าสุด", w ? `${w} กก.` : "-"],
    ["ทำหมัน", NEUTERED[c.neutered] || "ไม่ทราบ"],
    ["ไมโครชิป", hasMicrochip(c) ? `ฝังแล้ว${c.chipDate ? ` (${formatThaiDate(c.chipDate)})` : ""}${c.chipPlace ? ` · ${c.chipPlace}` : ""}` : "ไม่ได้ฝัง"],
    ["หมายเหตุ / แพ้", c.note || "-"],
  ];
  const sections = REPORT_SECTIONS.map((type) => {
    const list = c.events.filter((e) => e.type === type).sort((a, b) => b.date.localeCompare(a.date));
    if (!list.length) return "";
    const rows = list.map((e) => {
      const detail = type === "weight" ? `${e.weight} กก.` : makeTextSafe(e.text || "");
      const extra = [
        e.timesPerDay && `วันละ ${e.timesPerDay} ครั้ง`, e.until && `ถึง ${formatThaiDate(e.until)}`,
        e.next && `นัดครั้งถัดไป ${formatThaiDate(e.next)}`,
      ].filter(Boolean).join(" · ");
      return `<tr><td class="r-date">${formatThaiDate(e.date)}</td><td>${detail}${extra ? `<div class="r-extra">${extra}</div>` : ""}</td></tr>`;
    }).join("");
    return `<section><h3>${TYPES[type]}</h3><table>${rows}</table></section>`;
  }).join("");

  $("reportBody").innerHTML = `
    <header class="r-head">
      <div class="r-pic">${catPictureHtml(c)}</div>
      <div><h2>${makeTextSafe(c.name)}</h2>
        <p class="muted">สรุปประวัติสุขภาพ · พิมพ์เมื่อ ${formatThaiDate(todayString())} · บ้าน ${makeTextSafe(household?.name || "")}</p></div>
    </header>
    <section><h3>ข้อมูลทั่วไป</h3>
      <dl class="r-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${makeTextSafe(v)}</dd>`).join("")}</dl></section>
    <section><h3>สรุปสุขภาพ</h3><ul class="health">${healthRowsHtml(c)}</ul></section>
    ${sections || `<p class="muted">ยังไม่มีประวัติการรักษา</p>`}
    <p class="r-foot muted">สร้างจากแอป HomeCat</p>`;
  showOnly("reportView");
  $("topTitle").textContent = `สรุป · ${c.name}`;
  window.scrollTo(0, 0);
}

function setupVetReport() {
  $("printReportBtn").onclick = () => window.print();
  $("closeReportBtn").onclick = () => showCatDetailPage(currentId);
}
