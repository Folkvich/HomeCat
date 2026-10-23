// ===== Component: กราฟน้ำหนัก + สรุปการเปลี่ยนแปลง + เตือนน้ำหนักเปลี่ยนเร็ว =====

const WEIGHT_ALERT_DAYS = 60;      // ดูการเปลี่ยนแปลงย้อนหลังกี่วัน
const WEIGHT_ALERT_PERCENT = 10;   // เปลี่ยนเกินกี่ % ในช่วงนั้นถึงเตือน (แมวน้ำหนักลด 10% เป็นสัญญาณที่ควรพบหมอ)
const WEIGHT_TYPO_PERCENT = 30;    // บันทึกใหม่ต่างจากครั้งก่อนเกินกี่ % ถึงถามยืนยัน (กันพิมพ์ผิด)

// บันทึกน้ำหนักของแมว เรียงจากเก่าไปใหม่
const weightPoints = (c) => c.events.filter((e) => e.type === "weight" && e.weight > 0)
  .sort((a, b) => a.date.localeCompare(b.date));

// % ที่เปลี่ยนจาก a ไป b (บวก = เพิ่ม, ลบ = ลด)
const percentChange = (a, b) => ((b - a) / a) * 100;

// "+3.3 กก. (+49%)" / "-0.2 กก. (-5%)"
function changeText(from, to) {
  const diff = to - from, pct = percentChange(from, to);
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  return `${sign}${Math.abs(diff).toFixed(2).replace(/\.?0+$/, "")} กก. (${sign}${Math.abs(pct).toFixed(0)}%)`;
}

// หาการเปลี่ยนแปลงที่ควรเตือน: เทียบน้ำหนักล่าสุดกับครั้งแรกในช่วง WEIGHT_ALERT_DAYS วันก่อนหน้า
// คืน null ถ้าไม่มีอะไรน่าห่วง
function findWeightAlert(pts) {
  if (pts.length < 2) return null;
  const latest = pts.at(-1);
  const since = addDays(latest.date, -WEIGHT_ALERT_DAYS);
  const base = pts.find((p) => p.date >= since && p !== latest);
  if (!base) return null;
  const pct = percentChange(base.weight, latest.weight);
  if (Math.abs(pct) < WEIGHT_ALERT_PERCENT) return null;
  const days = daysUntil(latest.date) - daysUntil(base.date);
  return { loss: pct < 0, text: `${pct < 0 ? "น้ำหนักลด" : "น้ำหนักขึ้น"} ${changeText(base.weight, latest.weight)} ใน ${durationText(days)}` };
}

// วาดสรุปด้านบนกราฟ + กล่องเตือน + กราฟ
function drawWeightChart(c) {
  const pts = weightPoints(c);
  drawWeightSummary(pts);

  const svg = $("chart");
  $("noChart").hidden = pts.length >= 2; // ข้อมูลไม่พอ -> โชว์ข้อความแนะนำแทนกราฟ
  svg.hidden = pts.length < 2;
  if (pts.length < 2) return;

  // ใช้ความกว้างจริงของกราฟบนจอ ตัวหนังสือจะได้ขนาดเท่าเดิมทั้งบนมือถือและคอม
  const W = svg.clientWidth || 400, H = 170;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const left = 38, right = 14, top = 22, bottom = 30; // ระยะขอบ (ซ้ายเว้นไว้ใส่ตัวเลขแกน)

  // แกนตั้ง: ปัดค่าต่ำสุด/สูงสุดเป็นทีละ 0.5 กก. ให้เส้นตารางเป็นเลขกลม ๆ
  const ws = pts.map((p) => p.weight);
  let lo = Math.floor(Math.min(...ws) * 2) / 2, hi = Math.ceil(Math.max(...ws) * 2) / 2;
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; } // น้ำหนักแทบไม่เปลี่ยน -> ไม่ให้กราฟดูชันเกินจริง
  lo = Math.max(0, lo);
  const y = (w) => top + (1 - (w - lo) / (hi - lo)) * (H - top - bottom);

  // แกนนอน: วางจุดตามวันที่จริง (ชั่งห่างกัน 1 ปี จะอยู่ห่างกว่าชั่งห่างกัน 1 สัปดาห์)
  const t = pts.map((p) => new Date(p.date + "T00:00").getTime());
  const tSpan = t.at(-1) - t[0];
  const x = (i) => left + (tSpan ? (t[i] - t[0]) / tSpan : i / (pts.length - 1)) * (W - left - right);

  // เส้นตาราง 3 เส้น: ต่ำสุด กลาง สูงสุด
  const grid = [lo, (lo + hi) / 2, hi].map((v) =>
    `<line class="grid" x1="${left}" x2="${W - right}" y1="${y(v)}" y2="${y(v)}"/>
     <text class="axis" x="${left - 6}" y="${y(v) + 4}" text-anchor="end">${+v.toFixed(2)}</text>`).join("");

  // ใส่ตัวเลขเฉพาะจุดล่าสุด สูงสุด ต่ำสุด (ชั่งบ่อย ๆ ตัวเลขจะได้ไม่ทับกัน)
  const labeled = new Set([pts.length - 1, ws.indexOf(Math.max(...ws)), ws.indexOf(Math.min(...ws))]);

  svg.innerHTML = grid +
    `<polyline points="${pts.map((p, i) => `${x(i)},${y(p.weight)}`).join(" ")}"/>` +
    pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.weight)}" r="${i === pts.length - 1 ? 5 : 3.5}"/>` +
      (labeled.has(i) ? `<text x="${x(i)}" y="${y(p.weight) - 9}" text-anchor="middle"${i === pts.length - 1 ? ' class="latest"' : ""}>${p.weight}</text>` : "")).join("") +
    // วันที่แรก (ชิดซ้าย) และวันที่ล่าสุด (ชิดขวา จะได้ไม่ล้นขอบ) ใต้กราฟ
    `<text x="${left}" y="${H - 6}" text-anchor="start">${formatThaiDate(pts[0].date)}</text>
     <text x="${W - right}" y="${H - 6}" text-anchor="end">${formatThaiDate(pts.at(-1).date)}</text>`;
}

// บรรทัดสรุปใต้หัวการ์ด + กล่องเตือนน้ำหนักเปลี่ยนเร็ว
function drawWeightSummary(pts) {
  const latest = pts.at(-1), prev = pts.at(-2);
  $("weightSummary").hidden = !latest;
  if (latest) {
    $("weightSummary").innerHTML = `ล่าสุด <b>${latest.weight} กก.</b> (${agoText(latest.date)})` +
      (prev ? ` · ${changeText(prev.weight, latest.weight)} จากครั้งก่อน` : "");
  }
  const alert = findWeightAlert(pts);
  $("weightAlert").hidden = !alert;
  if (alert) {
    $("weightAlert").className = `alert ${alert.loss ? "danger" : "warn"}`;
    $("weightAlert").textContent = `⚠️ ${alert.text} — ${alert.loss ? "น้ำหนักลดเร็ว ควรปรึกษาสัตวแพทย์" : "ขึ้นเร็วกว่าปกติ ลองเช็กอาหารหรือปรึกษาสัตวแพทย์"}`;
  }
}

// ก่อนบันทึกน้ำหนักใหม่: ต่างจากครั้งก่อนหน้า (ตามวันที่) มากผิดปกติไหม -> คืนข้อความถาม หรือ null
function weightTypoWarning(c, ev, editingId) {
  const before = weightPoints(c).filter((p) => p.id !== editingId && p.date <= ev.date).at(-1);
  if (!before) return null;
  const pct = percentChange(before.weight, ev.weight);
  if (Math.abs(pct) < WEIGHT_TYPO_PERCENT) return null;
  return `น้ำหนัก ${ev.weight} กก. ต่างจากครั้งก่อน (${before.weight} กก. เมื่อ ${formatThaiDate(before.date)}) ถึง ${Math.abs(pct).toFixed(0)}% พิมพ์ถูกไหม?`;
}
