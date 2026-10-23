-- ===== ฟีเจอร์สำหรับใช้จริงในบ้าน =====
-- ใครบันทึก, ค่าใช้จ่าย, การรักษาต่อเนื่อง, รูปในบันทึก, เก็บประวัติแมว, เปลี่ยนรหัสเชิญ,
-- อัปเดตทันที (Realtime), แจ้งเตือนเด้ง (Web Push), เก็บ error จากเครื่องผู้ใช้

-- ----- บันทึก: ใครบันทึก + ค่าใช้จ่าย + การรักษา (กี่ครั้งต่อวัน ถึงวันไหน) -----
alter table public.events
  add column created_by uuid default auth.uid() references auth.users on delete set null,
  add column cost numeric(10, 2) check (cost is null or cost >= 0),
  add column times_per_day smallint check (times_per_day is null or times_per_day between 1 and 12),
  add column until date,
  add constraint events_until_after_date check (until is null or until >= date),
  add constraint events_id_household_unique unique (id, household_id);

-- ----- แมว: เก็บประวัติไว้ (จากไป/ย้ายบ้าน) แทนการลบ -----
alter table public.cats
  add column archived_at timestamptz,
  add column archive_note text not null default '';

-- ----- รูปในบันทึก (แยกตาราง: โหลดเฉพาะตอนเปิดหน้าแมว ไม่ต้องโหลดรูปทั้งบ้านทุกครั้งที่ซิงก์) -----
create table public.event_photos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  event_id uuid not null,
  data text not null check (data like 'data:image/%' and length(data) < 400000), -- รูปย่อ JPEG ~100KB
  created_at timestamptz not null default now(),
  foreign key (event_id, household_id) references public.events (id, household_id) on delete cascade
);
create index event_photos_event_id_idx on public.event_photos (event_id);
create index event_photos_household_id_idx on public.event_photos (household_id);
create index event_photos_event_household_idx on public.event_photos (event_id, household_id);
alter table public.event_photos enable row level security;
create policy "members manage event photos" on public.event_photos
  for all to authenticated
  using (private.is_household_member(household_id))
  with check (private.is_household_member(household_id));

-- ----- เปลี่ยนรหัสเชิญ (เจ้าของบ้านเท่านั้น) รหัสเดิมใช้ไม่ได้ทันที -----
create function public.regenerate_invite_code(hid uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare code text;
begin
  if not exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'not_owner';
  end if;
  loop
    code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  update public.households set invite_code = code where id = hid;
  return code;
end;
$$;
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;

-- ----- อัปเดตทันทีระหว่างคนในบ้าน (Realtime ส่งเฉพาะแถวที่ RLS อนุญาต) -----
alter publication supabase_realtime add table public.cats, public.events, public.event_photos;

-- ----- แจ้งเตือนเด้ง: เครื่องที่เปิดรับแจ้งเตือน -----
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "own push subscriptions" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- บันทึกเครื่องรับแจ้งเตือน: เครื่องเดิมที่เคยผูกกับผู้ใช้อื่น (เช่น ออกแล้วตั้งโปรไฟล์ใหม่) ย้ายมาเป็นของเรา
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth);
end;
$$;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- ความลับของระบบ (กุญแจ VAPID, รหัสของ cron) อยู่ใน private: หน้าเว็บอ่านไม่ได้
create table private.app_secrets (key text primary key, value text not null);
revoke all on private.app_secrets from public, anon, authenticated;

-- ให้ Edge Function (service_role) อ่านค่าตั้งค่าแจ้งเตือน
create function public.get_push_config()
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) from private.app_secrets;
$$;
revoke execute on function public.get_push_config() from public, anon, authenticated;
grant execute on function public.get_push_config() to service_role;

-- ----- เก็บ error จากเครื่องผู้ใช้ (เขียนได้อย่างเดียว อ่านดูผ่าน Dashboard/SQL) -----
create table public.client_errors (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users on delete set null,
  message text not null check (length(message) <= 2000),
  stack text check (stack is null or length(stack) <= 8000),
  url text check (url is null or length(url) <= 500),
  user_agent text check (user_agent is null or length(user_agent) <= 500),
  app_version text check (app_version is null or length(app_version) <= 40),
  created_at timestamptz not null default now()
);
create index client_errors_created_at_idx on public.client_errors (created_at desc);
create index client_errors_user_id_idx on public.client_errors (user_id);
alter table public.client_errors enable row level security;
create policy "report own errors" on public.client_errors
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ----- ตั้งเวลาส่งแจ้งเตือนทุกวัน 08:00 เวลาไทย (01:00 UTC) -----
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.schedule(
  'homecat-daily-reminders',
  '0 1 * * *',
  $$
    select net.http_post(
      url := 'https://lyeporeihiufmybbjxha.supabase.co/functions/v1/daily-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select value from private.app_secrets where key = 'cron_secret')
      ),
      body := '{}'::jsonb
    );
  $$
);
