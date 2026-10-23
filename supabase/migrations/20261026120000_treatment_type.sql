-- ===== เพิ่มประเภทบันทึก "การรักษา" (treatment) เช่น ป่วยแล้วพาไปรักษา ให้ยา ทำแผล =====
-- ต้องตรงกับ TYPES ใน js/config.js

alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check
  check (type = any (array['vaccine', 'vet', 'treatment', 'weight', 'deworm', 'grooming', 'note']));
