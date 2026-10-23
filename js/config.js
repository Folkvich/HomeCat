// ===== ค่าคงที่ (ตั้งค่าครั้งเดียว ใช้ทั้งเว็บ) =====

// ===== Supabase (ฐานข้อมูลออนไลน์) =====
// publishable key ใส่ในหน้าเว็บได้ สิทธิ์จริงคุมด้วย Row Level Security ในฐานข้อมูล
// ⚠️ ห้ามเอา service_role / secret key มาใส่ที่นี่เด็ดขาด
const SUPABASE_URL = "https://lyeporeihiufmybbjxha.supabase.co";
const SUPABASE_KEY = "sb_publishable_2wUc0y153WBM6NiDE-KQZA_YPImdEPc";

// ชื่อกล่องเก็บข้อมูลในเบราว์เซอร์ (localStorage)
const KEY = "homecat.v1";                 // ข้อมูลรุ่นเก่า (ก่อนมีระบบบ้าน) ใช้ตอนย้ายขึ้นออนไลน์
const CACHE_KEY = "homecat.cache.";       // + id บ้าน: สำเนาข้อมูลไว้เปิดดูตอนไม่มีเน็ต
const OUTBOX_KEY = "homecat.outbox";      // การแก้ไขที่ยังส่งขึ้นเซิร์ฟเวอร์ไม่ได้ (ออฟไลน์)
const HOUSE_KEY = "homecat.household";    // บ้านที่เลือกใช้อยู่

// ประเภทบันทึกประวัติ: รหัส -> ข้อความที่แสดงบนหน้าเว็บ
const TYPES = {
  vaccine: "💉 วัคซีน",
  vet: "🩺 พบสัตวแพทย์",
  weight: "⚖️ น้ำหนัก",
  deworm: "💊 ถ่ายพยาธิ/ยากันเห็บหมัด",
  grooming: "🛁 อาบน้ำ/ตัดขน",
  note: "📝 บันทึกทั่วไป",
};

// สถานะทำหมัน: รหัส -> ข้อความที่แสดงบนหน้าเว็บ
const NEUTERED = {
  no: "ยังไม่ทำหมัน",
  yes: "ทำหมันแล้ว",
  unknown: "ไม่ทราบ",
};

// อีโมจิให้เลือกเป็นรูปโปรไฟล์
const AVATARS = ["😺", "🐱", "🐾", "🦊", "🐻", "🐰", "🐶", "🐼", "🐯", "🐹", "🐨", "🐸"];
