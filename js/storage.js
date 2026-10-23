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
    archived_at: c.archivedAt || null, archive_note: c.archiveNote || "",
  };
}

function eventToRow(catId, e) {
  return {
    id: e.id, household_id: householdId, cat_id: catId, date: e.date, type: e.type,
    weight: e.type === "weight" ? e.weight : null, text: e.text || "", next: e.next || null,
    cost: e.cost > 0 ? e.cost : null,
    times_per_day: e.type === "treatment" && e.timesPerDay ? e.timesPerDay : null,
    until: e.type === "treatment" && e.until ? e.until : null,
    updated_at: new Date().toISOString(),
  };
}

function rowToCat(r) {
  return {
    id: r.id, name: r.name, breed: r.breed, sex: r.sex, born: r.born || "", color: r.color, note: r.note,
    chip: r.chip, chipDate: r.chip_date || "", chipPlace: r.chip_place, neutered: r.neutered, photo: r.photo,
    archivedAt: r.archived_at || null, archiveNote: r.archive_note || "",
    events: (r.events || []).map((e) => ({
      id: e.id, date: e.date, type: e.type, text: e.text, createdBy: e.created_by || null,
      ...(e.weight != null && { weight: Number(e.weight) }), ...(e.next && { next: e.next }),
      ...(e.cost != null && { cost: Number(e.cost) }),
      ...(e.times_per_day && { timesPerDay: e.times_per_day }), ...(e.until && { until: e.until }),
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
let resync = false; // มีงานที่เซิร์ฟเวอร์ไม่รับ -> ต้องโหลดข้อมูลจริงมาทับในเครื่อง

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
        showToast(`⚠️ ${syncErrorText(error)}`, 6000);
        resync = true;
      }
      outbox.shift(); // สำเร็จ (หรือผิดพลาดแบบลองซ้ำก็ไม่หาย) -> เอาออกจากคิว
      saveOutbox();
    }
  } finally {
    flushing = false;
  }
  // มีงานที่เซิร์ฟเวอร์ไม่รับ -> ข้อมูลในเครื่องไม่ตรงกับเซิร์ฟเวอร์แล้ว โหลดของจริงมาแทน
  if (resync && !outbox.length && householdId) {
    resync = false;
    if (await refreshFromServer()) redrawCurrentPage();
  }
}

// แปลง error ตอนส่งข้อมูลเป็นภาษาไทย
function syncErrorText(error) {
  if (error.code === "42501") return "บันทึกไม่ได้ ข้อมูลนี้เป็นของบ้านอื่นที่คุณไม่ได้เป็นสมาชิก (หรือคุณถูกลบออกจากบ้านแล้ว)";
  if (error.code === "23503") return "บันทึกไม่ได้ แมวตัวนี้ถูกลบไปแล้ว";
  if (error.code === "23505") return "บันทึกไม่ได้ มีแมวชื่อนี้ในบ้านแล้ว (คนในบ้านอาจเพิ่งเพิ่มไป) ลองเปลี่ยนชื่อ";
  return `ส่งข้อมูลขึ้นไม่สำเร็จ: ${error.message}`;
}

function runOp(op) {
  switch (op.kind) {
    case "upsertCat": return db.from("cats").upsert(op.row);
    case "deleteCat": return db.from("cats").delete().eq("id", op.id);
    case "upsertEvent": return db.from("events").upsert(op.row);
    case "deleteEvent": return db.from("events").delete().eq("id", op.id);
    case "reorderCats": return db.rpc("reorder_cats", { hid: op.hid, ids: op.ids });
    case "insertPhoto": return db.from("event_photos").upsert(op.row);
    case "deletePhoto": return db.from("event_photos").delete().eq("id", op.id);
  }
}

// เน็ตหลุด/ต่อเซิร์ฟเวอร์ไม่ได้ (ต่างจากข้อมูลผิด ที่ลองซ้ำก็ไม่ผ่าน)
const isNetworkError = (error) => !navigator.onLine || /fetch|network|Load failed/i.test(error.message || "");

// ----- คำสั่งที่ component เรียกใช้ (ข้อมูลใน cats ต้องแก้ไว้ก่อนแล้ว) -----

function saveCatData(c) { saveCache(); queue({ kind: "upsertCat", row: catToRow(c) }); }
function removeCatData(id) { saveCache(); queue({ kind: "deleteCat", id }); }
function saveEventData(c, ev) { saveCache(); queue({ kind: "upsertEvent", row: eventToRow(c.id, ev) }); }
function removeEventData(id) { saveCache(); queue({ kind: "deleteEvent", id }); }
function saveCatOrder(ids) { saveCache(); queue({ kind: "reorderCats", hid: householdId, ids }); }

// เพิ่ม/อัปเดตแมวหลายตัวพร้อมประวัติ (ใช้ตอนนำเข้าไฟล์ หรือย้ายข้อมูลเก่าในเครื่องขึ้นออนไลน์)
// จับคู่กับแมวที่มีในบ้านนี้อยู่แล้ว (id เดียวกัน หรือชื่อเดียวกัน) -> อัปเดตตัวเดิม ไม่สร้างซ้ำ
// ไม่เจอในบ้านนี้ -> ให้ id ใหม่เสมอ เพราะ id เดิมในไฟล์อาจเป็นแมวของบ้านอื่นในฐานข้อมูล
// (ถ้าใช้ id เดิม ฐานข้อมูลจะเข้าใจว่าเราไปแก้แมวของบ้านอื่น แล้วบล็อกไว้)
function importCats(list) {
  const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const sameEvent = (a, b) => a.date === b.date && a.type === b.type && (a.text || "") === (b.text || "") && (a.weight ?? null) === (b.weight ?? null);
  for (const raw of list) {
    const old = cats.find((x) => x.id === raw.id) || cats.find((x) => sameName(x.name, raw.name));
    const oldEvents = old?.events || [];
    // บันทึกที่มีอยู่แล้ว (เหมือนกันทุกช่อง) ใช้ id เดิม, ที่ยังไม่มีได้ id ใหม่
    const events = raw.events.map((e) => ({ ...e, id: oldEvents.find((x) => x.id === e.id || sameEvent(x, e))?.id || newId() }));
    const c = { ...raw, id: old ? old.id : newId(),
      events: [...oldEvents.filter((x) => !events.some((e) => e.id === x.id)), ...events] };
    old ? (cats[cats.indexOf(old)] = c) : cats.push(c);
    outbox.push({ kind: "upsertCat", row: catToRow(c) });
    for (const e of events) outbox.push({ kind: "upsertEvent", row: eventToRow(c.id, e) });
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
    .eq("household_id", householdId)
    .order("sort_order", { nullsFirst: false }).order("created_at"); // ตามที่ลากเรียงไว้ แมวใหม่ต่อท้าย
  if (error) { if (!isNetworkError(error)) console.error(error); return false; }
  if (outbox.length) return false; // ระหว่างรอ มีการแก้ใหม่เข้ามา -> รอบหน้าค่อยโหลด
  cats = data.map(rowToCat);
  saveCache();
  return true;
}

// ----- รูปในบันทึก: โหลดเฉพาะตอนเปิดหน้าแมว (ไม่โหลดรูปทั้งบ้านทุกครั้งที่ซิงก์) -----
// photosByEvent: { event_id: [{ id, data }] } เก็บในหน่วยความจำ (ไม่มีเน็ต = ไม่เห็นรูป)

const photosByEvent = new Map();

// โหลดรูปของทุกบันทึกของแมวตัวนี้ คืน true ถ้ามีรูปใหม่ต้องวาดใหม่
async function loadEventPhotos(c) {
  const ids = c.events.map((e) => e.id).filter((id) => !photosByEvent.has(id));
  if (!ids.length) return false;
  const { data, error } = await db.from("event_photos").select("id, event_id, data").in("event_id", ids).order("created_at");
  if (error) return false;
  for (const id of ids) photosByEvent.set(id, []);
  for (const p of data) photosByEvent.get(p.event_id).push({ id: p.id, data: p.data });
  return data.length > 0;
}

// เพิ่ม/ลบรูปของบันทึก (หน้าจอเปลี่ยนทันที แล้วต่อคิวส่งขึ้นเซิร์ฟเวอร์)
function addEventPhoto(eventId, data) {
  const photo = { id: newId(), data };
  photosByEvent.set(eventId, [...(photosByEvent.get(eventId) || []), photo]);
  queue({ kind: "insertPhoto", row: { id: photo.id, household_id: householdId, event_id: eventId, data } });
}
function removeEventPhoto(eventId, photoId) {
  photosByEvent.set(eventId, (photosByEvent.get(eventId) || []).filter((p) => p.id !== photoId));
  queue({ kind: "deletePhoto", id: photoId });
}

// ----- อัปเดตทันที: คนอื่นในบ้านแก้อะไร หน้าจอเราเปลี่ยนตาม (Supabase Realtime) -----
let liveChannel = null;
let liveTimer = null;

function startLiveUpdates() {
  stopLiveUpdates();
  const filter = `household_id=eq.${householdId}`;
  const changed = (payload) => {
    // รูปเปลี่ยน -> ล้างรูปที่จำไว้ของบันทึกนั้น จะได้โหลดใหม่
    const evId = payload.new?.event_id || payload.old?.event_id;
    if (payload.table === "event_photos" && evId) photosByEvent.delete(evId);
    // รวบหลายการเปลี่ยนแปลงที่มาติด ๆ กันเป็นการโหลดครั้งเดียว
    clearTimeout(liveTimer);
    liveTimer = setTimeout(async () => { if (await refreshFromServer()) redrawCurrentPage(); }, 700);
  };
  liveChannel = db.channel(`house-${householdId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "cats", filter }, changed)
    .on("postgres_changes", { event: "*", schema: "public", table: "events", filter }, changed)
    .on("postgres_changes", { event: "*", schema: "public", table: "event_photos", filter }, changed)
    .subscribe();
}

function stopLiveUpdates() {
  clearTimeout(liveTimer);
  if (liveChannel) db.removeChannel(liveChannel);
  liveChannel = null;
}
