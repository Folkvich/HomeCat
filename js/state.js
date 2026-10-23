// ===== ตัวแปรสถานะของหน้าเว็บ (ทุกไฟล์ใช้ร่วมกัน) =====

let cats = [];                    // รายชื่อแมวทั้งหมดของบ้านที่เลือก (โหลดหลังล็อกอิน)
let householdId = null;           // id บ้านที่ใช้อยู่
let household = null;             // ข้อมูลบ้าน { id, name, invite_code }
let currentId = null;             // id ของแมวที่กำลังเปิดดูอยู่ (null = อยู่หน้ารายชื่อ)
let editingId = null;             // id ของแมวที่กำลังแก้ไขในฟอร์ม (null = กำลังเพิ่มแมวใหม่)
let editingEventId = null;        // id ของบันทึกที่กำลังแก้ไข (null = กำลังเพิ่มบันทึกใหม่)

// ทางลัดสำหรับหา element ตาม id เช่น $("search")
const $ = (id) => document.getElementById(id);

// หาข้อมูลแมวตัวที่กำลังเปิดดูอยู่
const findCurrentCat = () => cats.find((x) => x.id === currentId);
