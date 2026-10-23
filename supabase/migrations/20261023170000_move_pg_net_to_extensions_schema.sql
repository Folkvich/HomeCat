-- pg_net ย้าย schema ด้วย ALTER ไม่ได้ -> ติดตั้งใหม่ใน schema extensions (ตามคำแนะนำของ Supabase)
-- ฟังก์ชัน net.http_post ที่ cron ใช้ยังอยู่ที่ schema net เหมือนเดิม
drop extension if exists pg_net;
create extension pg_net with schema extensions;
