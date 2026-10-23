// ชุดทดสอบอัตโนมัติ: รันด้วย  npm test  (หรือ node --test tests/*.test.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadApp } from "./load-app.mjs";

const app = loadApp(["js/config.js", "js/state.js", "js/helpers.js", "js/storage.js", "js/components/reminders.js"]);
const today = app.run("todayString()");
const d = (n) => app.run(`addDays(todayString(), ${n})`);

test("addDays / daysUntil นับวันถูก ข้ามเดือนข้ามปีได้", () => {
  assert.equal(app.run('addDays("2026-12-30", 3)'), "2027-01-02");
  assert.equal(app.run('addDays("2028-03-01", -1)'), "2028-02-29"); // ปีอธิกสุรทิน
  assert.equal(app.run(`daysUntil("${d(5)}")`), 5);
  assert.equal(app.run(`daysUntil("${d(-2)}")`), -2);
});

test("dueLevel: เลยนัด = overdue, ภายใน 7 วัน = soon", () => {
  assert.equal(app.run("dueLevel(-1)"), "overdue");
  assert.equal(app.run("dueLevel(0)"), "soon");
  assert.equal(app.run("dueLevel(7)"), "soon");
  assert.equal(app.run("dueLevel(8)"), "");
});

test("durationText อ่านง่าย", () => {
  assert.equal(app.run("durationText(3)"), "3 วัน");
  assert.equal(app.run("durationText(21)"), "3 สัปดาห์");
  assert.equal(app.run("durationText(90)"), "3 เดือน");
  assert.equal(app.run("durationText(365)"), "1 ปี");
});

test("newId สร้าง UUID ที่ฐานข้อมูลรับได้ และไม่ซ้ำ", () => {
  const ids = new Set(Array.from({ length: 200 }, () => app.run("newId()")));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.ok(app.run(`isUuid("${id}")`), id);
  assert.equal(app.run('isUuid("demo")'), false);
});

test("sumCost รวมเฉพาะที่ใส่ราคา และตัดตามวันที่ได้", () => {
  app.run(`window_events = [{ date: "2026-01-05", cost: 100 }, { date: "2025-12-31", cost: 50 }, { date: "2026-02-01" }, { date: "2026-03-01", cost: 0 }]`);
  assert.equal(app.run("sumCost(window_events)"), 150);
  assert.equal(app.run('sumCost(window_events, "2026-01-01")'), 100);
});

test("formatBaht ใส่คอมมาและทศนิยมเมื่อมีเศษ", () => {
  assert.equal(app.run("formatBaht(1250)"), "฿1,250");
  assert.equal(app.run("formatBaht(99.5)"), "฿99.50");
});

test("latestOfType: วันเดียวกันเลือกบันทึกที่มีนัด", () => {
  app.run(`window_cat = { events: [
    { id: "a", type: "vaccine", date: "2026-01-01" },
    { id: "b", type: "vaccine", date: "2026-03-01" },
    { id: "c", type: "vaccine", date: "2026-03-01", next: "2027-03-01" } ] }`);
  assert.equal(app.run('latestOfType(window_cat, "vaccine").id'), "c");
});

test("กล่องนัด: รวมแมวที่นัดเรื่องเดียวกันวันเดียวกัน และไม่นับแมวที่เก็บประวัติไว้", () => {
  app.run(`cats = [
    { id: "1", name: "ชูก้า", events: [{ id: "e1", type: "vaccine", date: "${d(-360)}", next: "${d(3)}" }] },
    { id: "2", name: "ไกลเดอร์", events: [{ id: "e2", type: "vaccine", date: "${d(-360)}", next: "${d(3)}" }] },
    { id: "3", name: "มอคค่า", events: [{ id: "e3", type: "deworm", date: "${d(-95)}", next: "${d(-2)}" }] },
    { id: "4", name: "ย้ายบ้านแล้ว", archivedAt: "2026-01-01", events: [{ id: "e4", type: "vaccine", date: "${d(-360)}", next: "${d(3)}" }] } ]`);
  const groups = JSON.parse(app.run("JSON.stringify(findReminderGroups().map((g) => ({ type: g.type, n: g.cats.length })))"));
  assert.deepEqual(groups, [{ type: "deworm", n: 1 }, { type: "vaccine", n: 2 }]); // เลยนัดมาก่อน, วัคซีนรวม 2 ตัว (ไม่นับตัวที่เก็บไว้)
});

test("นำเข้าไฟล์: ไม่ใช้ id เดิมของบ้านอื่น และนำเข้าซ้ำไม่เกิดแมว/บันทึกซ้ำ", () => {
  app.run(`householdId = "h1"; cats = []; outbox = [];`);
  const file = JSON.stringify([{ id: "588aaf2c-0000-4000-8000-000000000001", name: "ชูก้า", events: [{ id: "x1", date: "2026-10-01", type: "vet", text: "ตรวจ" }] }]);
  app.run(`importCats(${file})`);
  const first = JSON.parse(app.run("JSON.stringify(cats)"));
  assert.equal(first.length, 1);
  assert.notEqual(first[0].id, "588aaf2c-0000-4000-8000-000000000001"); // ได้ id ใหม่
  app.run(`importCats(${file})`); // นำเข้าซ้ำ
  const again = JSON.parse(app.run("JSON.stringify(cats)"));
  assert.equal(again.length, 1);
  assert.equal(again[0].id, first[0].id);
  assert.equal(again[0].events.length, 1);
});

test("eventToRow: ค่าใช้จ่าย/การรักษาส่งเฉพาะที่ควรส่ง", () => {
  app.run(`householdId = "h1"`);
  const row = JSON.parse(app.run(`JSON.stringify(eventToRow("c1", { id: "e", date: "${today}", type: "vaccine", text: "x", cost: 0, timesPerDay: 2, until: "${d(3)}" }))`));
  assert.equal(row.cost, null);           // 0 = ไม่ใส่ราคา
  assert.equal(row.times_per_day, null);  // ไม่ใช่การรักษา -> ไม่ส่ง
  assert.equal(row.until, null);
  const t = JSON.parse(app.run(`JSON.stringify(eventToRow("c1", { id: "e", date: "${today}", type: "treatment", text: "x", cost: 450, timesPerDay: 2, until: "${d(3)}" }))`));
  assert.deepEqual([t.cost, t.times_per_day, t.until], [450, 2, d(3)]);
});
