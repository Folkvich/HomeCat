// ===== Edge Function: แจ้งเตือนนัดแมวรายวัน (Web Push) =====
// - pg_cron เรียกทุกวัน 08:00 เวลาไทย พร้อม header x-cron-secret -> ส่งสรุปนัดให้ทุกบ้าน
// - ผู้ใช้กด "ส่งแจ้งเตือนทดสอบ" ในแอป (ส่ง JWT ของตัวเองมา, body { mode: "test" }) -> ส่งทดสอบเฉพาะเครื่องของคนนั้น
// - body { dry: true } พร้อม cron secret -> คืนข้อความที่จะส่ง โดยไม่ส่งจริง (ไว้ตรวจ)
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";

const TYPES: Record<string, string> = {
  vaccine: "💉 วัคซีน",
  vet: "🩺 พบสัตวแพทย์",
  treatment: "🩹 การรักษา",
  weight: "⚖️ น้ำหนัก",
  deworm: "💊 ถ่ายพยาธิ/ยากันเห็บหมัด",
  grooming: "🛁 อาบน้ำ/ตัดขน",
  note: "📝 บันทึกทั่วไป",
};
const OVERDUE_DAYS = 7; // เลยนัดมาไม่เกินกี่วันถึงยังเตือน (กันเตือนซ้ำทุกวันไปเรื่อย ๆ)

type Ev = { type: string; date: string; next: string | null; until: string | null; times_per_day: number | null; text: string };
type Cat = { id: string; name: string; household_id: string; events: Ev[] };
type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

// วันนี้ตามเวลาไทย (YYYY-MM-DD)
const todayBangkok = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);

// บันทึกล่าสุดของแต่ละประเภท (วันที่เท่ากัน เลือกตัวที่มีนัด) เหมือน latestOfType ในหน้าเว็บ
function latestByType(events: Ev[]) {
  const best: Record<string, Ev> = {};
  for (const e of events) {
    const b = best[e.type];
    if (!b || e.date > b.date || (e.date === b.date && e.next && !b.next)) best[e.type] = e;
  }
  return Object.values(best);
}

// "💉 วัคซีน (ชูก้า, ไกลเดอร์)" รวมแมวที่นัดเรื่องเดียวกัน
function joinByType(items: { type: string; name: string }[]) {
  const map = new Map<string, string[]>();
  for (const i of items) map.set(i.type, [...(map.get(i.type) || []), i.name]);
  return [...map].map(([t, names]) => `${TYPES[t] || t} (${names.join(", ")})`).join(" · ");
}

// สรุปของบ้านหนึ่ง คืน null ถ้าวันนี้ไม่มีอะไรต้องเตือน
function householdMessage(cats: Cat[], today: string) {
  const dueToday: { type: string; name: string }[] = [], tomorrow: typeof dueToday = [], overdue: typeof dueToday = [];
  const treating: string[] = [];
  for (const c of cats) {
    for (const e of latestByType(c.events)) {
      if (!e.next) continue;
      const d = daysBetween(today, e.next);
      if (d === 0) dueToday.push({ type: e.type, name: c.name });
      else if (d === 1) tomorrow.push({ type: e.type, name: c.name });
      else if (d < 0 && d >= -OVERDUE_DAYS) overdue.push({ type: e.type, name: c.name });
    }
    for (const e of c.events) {
      if (e.type === "treatment" && e.until && e.date <= today && e.until >= today) {
        const what = (e.text || "").split("\n")[0].slice(0, 30);
        treating.push(`${c.name}${what ? ` (${what}${e.times_per_day ? ` วันละ ${e.times_per_day} ครั้ง` : ""})` : ""}`);
      }
    }
  }
  const lines = [];
  if (dueToday.length) lines.push(`วันนี้: ${joinByType(dueToday)}`);
  if (overdue.length) lines.push(`เลยนัด: ${joinByType(overdue)}`);
  if (tomorrow.length) lines.push(`พรุ่งนี้: ${joinByType(tomorrow)}`);
  if (treating.length) lines.push(`กำลังรักษา: ${[...new Set(treating)].join(", ")}`);
  return lines.length ? lines.join("\n") : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" } });
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: config, error: configError } = await db.rpc("get_push_config");
  if (configError || !config?.vapid_private) return json({ error: "push not configured" }, 500);
  webpush.setVapidDetails(config.vapid_subject, config.vapid_public, config.vapid_private);

  const body = await req.json().catch(() => ({}));
  const fromCron = req.headers.get("x-cron-secret") === config.cron_secret;

  // ส่งให้ทุกเครื่องในรายการ ลบเครื่องที่เลิกรับแล้ว (404/410)
  const sendAll = async (subs: Sub[], payload: Record<string, unknown>) => {
    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 12 * 3600 });
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("push failed", code, (err as Error).message);
      }
    }
    return sent;
  };

  // ----- ผู้ใช้กดส่งทดสอบ: ต้องมี JWT ของผู้ใช้ ส่งเฉพาะเครื่องของคนนั้น -----
  if (!fromCron) {
    if (body?.mode !== "test") return json({ error: "unauthorized" }, 401);
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return json({ error: "unauthorized" }, 401);
    const { data: subs } = await db.from("push_subscriptions").select("*").eq("user_id", user.id);
    const sent = await sendAll(subs || [], { title: "🐱 HomeCat", body: "แจ้งเตือนใช้ได้แล้ว ทุกเช้า 08:00 จะสรุปนัดแมวให้ที่นี่", url: "./" });
    return json({ sent });
  }

  // ----- รอบประจำวัน -----
  const today = todayBangkok();
  const [{ data: houses }, { data: cats }, { data: members }, { data: subs }] = await Promise.all([
    db.from("households").select("id, name"),
    db.from("cats").select("id, name, household_id, events(type, date, next, until, times_per_day, text)").is("archived_at", null),
    db.from("household_members").select("household_id, user_id"),
    db.from("push_subscriptions").select("*"),
  ]);
  const result: { household: string; message: string; devices: number; sent: number }[] = [];
  for (const h of houses || []) {
    const message = householdMessage((cats || []).filter((c: Cat) => c.household_id === h.id), today);
    if (!message) continue;
    const userIds = new Set((members || []).filter((m) => m.household_id === h.id).map((m) => m.user_id));
    const devices = (subs || []).filter((s: Sub) => userIds.has(s.user_id));
    const sent = body?.dry ? 0 : await sendAll(devices, { title: `🐱 นัดแมว · ${h.name}`, body: message, url: "./", tag: `homecat-${h.id}` });
    result.push({ household: h.name, message, devices: devices.length, sent });
  }
  return json({ today, dry: !!body?.dry, households: result });
});
