// ===== เก็บ/ดึงข้อมูล: Supabase (ออนไลน์) + สำเนาในเครื่อง (ออฟไลน์) =====
// แก้ข้อมูลเมื่อไหร่ -> อัปเดตหน้าจอและสำเนาในเครื่องทันที แล้วต่อคิวส่งขึ้นเซิร์ฟเวอร์
// ถ้าไม่มีเน็ต คิวจะค้างไว้ในเครื่อง แล้วส่งให้เองเมื่อกลับมาออนไลน์

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ----- แปลงข้อมูล: หน้าเว็บ (camelCase) <-> ตารางในฐานข้อมูล (snake_case) -----

function catToRow(c) {
  return {
    id: c.id, household_id: householdId, name: c.name,
    breed: c.breed || "", sex: c.sex || "ไม่ทราบ", born: c.born || null,
    color: c.color || "", note: c.note || "",
    chip: c.chip === "yes" ? "yes" : "no", chip_date: c.chipDate || null, chip_place: c.chipPlace || "",
    neutered: ["no", "yes"].includes(c.neutered) ? c.neutered : "unknown",
    photo: c.photo || null, updated_at: new Date().toISOString(),
  };
}

function eventToRow(catId, e) {
  return {
    id: e.id, household_id: householdId, cat_id: catId, date: e.date, type: e.type,
    weight: e.type === "weight" ? e.weight : null, text: e.text || "", next: e.next || null,
    updated_at: new Date().toISOString(),
  };
}

function rowToCat(r) {
  return {
    id: r.id, name: r.name, breed: r.breed, sex: r.sex, born: r.born || "", color: r.color, note: r.note,
    chip: r.chip, chipDate: r.chip_date || "", chipPlace: r.chip_place, neutered: r.neutered, photo: r.photo,
    events: (r.events || []).map((e) => ({
      id: e.id, date: e.date, type: e.type, text: e.text,
      ...(e.weight != null && { weight: Number(e.weight) }), ...(e.next && { next: e.next }),
    })),
  };
}

// ----- สำเนาในเครื่อง (แยกตามบ้าน) -----

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY + householdId)) || []; } catch { return []; }
}

function saveCache() {
  try { localStorage.setItem(CACHE_KEY + householdId, JSON.stringify(cats)); }
  catch { showToast("⚠️ พื้นที่ในเครื่องเต็ม ข้อมูลยังส่งขึ้นออนไลน์ได้ แต่เปิดดูตอนไม่มีเน็ตอาจไม่ครบ", 6000); }
}

// ----- คิวส่งข้อมูลขึ้นเซิร์ฟเวอร์ -----

let outbox = (() => { try { return JSON.parse(localStorage.getItem(OUTBOX_KEY)) || []; } catch { return []; } })();
let flushing = false;

function saveOutbox() {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox)); } catch { /* เต็ม: ยังอยู่ในหน่วยความจำ */ }
}

// ต่อคิว 1 งาน แล้วลองส่งทันที
function queue(op) {
  outbox.push(op);
  saveOutbox();
  if (!navigator.onLine) showToast("📴 ไม่มีเน็ต บันทึกไว้ในเครื่องก่อน จะส่งขึ้นให้เมื่อออนไลน์");
  flushOutbox();
}

// ส่งงานในคิวทีละงานตามลำดับ (เช่น ต้องสร้างแมวก่อน ถึงจะเพิ่มบันทึกของแมวตัวนั้นได้)
async function flushOutbox() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    while (outbox.length) {
      const op = outbox[0];
      const { error } = await runOp(op);
      if (error && isNetworkError(error)) break; // เน็ตหลุดกลางทาง -> เก็บคิวไว้ลองใหม่
      if (error) {
        console.error("sync failed", op, error);
        showToast(`⚠️ ส่งข้อมูลขึ้นไม่สำเร็จ: ${error.message}`, 6000);
      }
      outbox.shift(); // สำเร็จ (หรือผิดพลาดแบบลองซ้ำก็ไม่หาย) -> เอาออกจากคิว
      saveOutbox();
    }
  } finally {
    flushing = false;
  }
}

function runOp(op) {
  switch (op.kind) {
    case "upsertCat": return db.from("cats").upsert(op.row);
    case "deleteCat": return db.from("cats").delete().eq("id", op.id);
    case "upsertEvent": return db.from("events").upsert(op.row);
    case "deleteEvent": return db.from("events").delete().eq("id", op.id);
  }
}

// เน็ตหลุด/ต่อเซิร์ฟเวอร์ไม่ได้ (ต่างจากข้อมูลผิด ที่ลองซ้ำก็ไม่ผ่าน)
const isNetworkError = (error) => !navigator.onLine || /fetch|network|Load failed/i.test(error.message || "");

// ----- คำสั่งที่ component เรียกใช้ (ข้อมูลใน cats ต้องแก้ไว้ก่อนแล้ว) -----

function saveCatData(c) { saveCache(); queue({ kind: "upsertCat", row: catToRow(c) }); }
function removeCatData(id) { saveCache(); queue({ kind: "deleteCat", id }); }
function saveEventData(c, ev) { saveCache(); queue({ kind: "upsertEvent", row: eventToRow(c.id, ev) }); }
function removeEventData(id) { saveCache(); queue({ kind: "deleteEvent", id }); }

// เพิ่ม/อัปเดตแมวหลายตัวพร้อมประวัติ (ใช้ตอนนำเข้าไฟล์ หรือย้ายข้อมูลเก่าในเครื่องขึ้นออนไลน์)
// id ที่ไม่ใช่ UUID (จากเวอร์ชันเก่า) จะได้ id ใหม่ แมวที่ id ซ้ำกับของเดิมจะถูกอัปเดต
function importCats(list) {
  for (const raw of list) {
    const c = { ...raw, id: isUuid(raw.id) ? raw.id : newId(),
      events: raw.events.map((e) => ({ ...e, id: isUuid(e.id) ? e.id : newId() })) };
    const i = cats.findIndex((x) => x.id === c.id);
    i >= 0 ? (cats[i] = c) : cats.push(c);
    outbox.push({ kind: "upsertCat", row: catToRow(c) });
    for (const e of c.events) outbox.push({ kind: "upsertEvent", row: eventToRow(c.id, e) });
  }
  saveOutbox();
  saveCache();
  flushOutbox();
}

// ----- โหลดข้อมูลล่าสุดจากเซิร์ฟเวอร์ -----
// ส่งคิวที่ค้างก่อน ถ้ายังส่งไม่หมด (ออฟไลน์) ใช้สำเนาในเครื่องไปก่อน ไม่ให้ทับของที่ยังไม่ได้ส่ง
// คืนค่า true ถ้าได้ข้อมูลใหม่จากเซิร์ฟเวอร์
async function refreshFromServer() {
  await flushOutbox();
  if (outbox.length) return false;
  const { data, error } = await db.from("cats").select("*, events(*)")
    .eq("household_id", householdId).order("created_at");
  if (error) { if (!isNetworkError(error)) console.error(error); return false; }
  if (outbox.length) return false; // ระหว่างรอ มีการแก้ใหม่เข้ามา -> รอบหน้าค่อยโหลด
  cats = data.map(rowToCat);
  saveCache();
  return true;
}
