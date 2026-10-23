// โหลดไฟล์ JS ของแอป (สคริปต์ธรรมดา ไม่ใช่ module) เข้า sandbox เดียวกัน แล้วคืน context ไว้เรียกฟังก์ชัน
// จำลองเฉพาะของเบราว์เซอร์ที่ไฟล์เหล่านี้ใช้ตอนโหลด (localStorage, navigator, supabase)
import { readFileSync } from "node:fs";
import vm from "node:vm";

export function loadApp(files) {
  const store = new Map();
  const context = {
    console,
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    navigator: { onLine: false, userAgent: "node" }, // ออฟไลน์ = คิวไม่ส่งขึ้นเซิร์ฟเวอร์จริง
    crypto: globalThis.crypto,
    supabase: { createClient: () => ({ from: () => { throw new Error("no network in tests"); } }) },
    showToast: () => {},
    Intl, Date, Math, JSON, Map, Set, Number, String, Array, Object, Promise, setTimeout, clearTimeout,
  };
  vm.createContext(context);
  for (const f of files) vm.runInContext(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"), context, { filename: f });
  // let/const ระดับบนสุดของสคริปต์ไม่ได้เป็น property ของ context -> ใช้ run() อ่าน/ตั้งค่าแทน
  context.run = (code) => vm.runInContext(code, context);
  return context;
}
