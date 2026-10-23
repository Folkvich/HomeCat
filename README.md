# HomeCat
Meow Meow

แอปจดประวัติสุขภาพแมวในบ้าน (วัคซีน พบหมอ การรักษา น้ำหนัก ถ่ายพยาธิ ค่าใช้จ่าย) ใช้ร่วมกันทั้งบ้าน
เว็บ: https://folkvich.github.io/HomeCat/ (PWA เพิ่มลงหน้าจอโฮมได้ ใช้ตอนไม่มีเน็ตได้)

## ใช้งาน
- **iPhone:** เปิดลิงก์ใน Safari → ปุ่มแชร์ → เพิ่มไปยังหน้าจอโฮม แล้วเปิดจากไอคอน (จำเป็นสำหรับแจ้งเตือน)
- **Android:** เปิดใน Chrome → เมนู ⋮ → ติดตั้งแอป
- ปุ่ม 🏠: ชวนคนในบ้าน (ลิงก์/รหัสเชิญ), เปิดแจ้งเตือนนัดทุกเช้า 08:00, ผูกอีเมลไว้กู้คืนโปรไฟล์ตอนเปลี่ยนเครื่อง

## โครงสร้าง
- หน้าเว็บ: HTML/CSS/JS ธรรมดา ไม่ต้อง build (`index.html`, `css/`, `js/`) — แก้ไฟล์แล้วเปลี่ยน `CACHE` ใน `sw.js` และ `APP_VERSION` ใน `js/config.js` ทุกครั้ง
- ฐานข้อมูล: Supabase (`js/config.js` ใช้ publishable key — สิทธิ์จริงคุมด้วย RLS) โครงสร้างทั้งหมดอยู่ใน `supabase/migrations/`
- แจ้งเตือน: Edge Function `supabase/functions/daily-reminders` ถูกเรียกโดย pg_cron ทุกวัน 01:00 UTC (08:00 เวลาไทย)
  กุญแจลับ (VAPID private key, cron secret) อยู่ในตาราง `private.app_secrets` เท่านั้น **ห้ามใส่ใน repo**

## ทดสอบ
```bash
npm test
```
ใช้ `node --test` ของ Node ไม่ต้องติดตั้งแพ็กเกจเพิ่ม

## ดู error จากเครื่องผู้ใช้
Supabase → Table Editor → `client_errors` (หน้าเว็บส่งเข้ามาเองเมื่อมี error พร้อมเวอร์ชันแอปและเบราว์เซอร์)
