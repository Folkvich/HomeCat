-- ===== โอนเจ้าของบ้าน + ขอเป็นเจ้าของแทน เมื่อเจ้าของไม่ได้เปิดแอปเกิน 30 วัน =====

-- ----- เปิดบ้านครั้งล่าสุดเมื่อไหร่ (ใช้ดูว่าเจ้าของบ้านยังใช้งานอยู่ไหม) -----
alter table public.household_members add column if not exists last_seen_at timestamptz not null default now();

-- ----- บันทึกว่าเราเพิ่งเปิดบ้านนี้ (แอปเรียกทุกครั้งที่เปิดบ้าน/กลับมาที่แอป) -----
create or replace function public.touch_household(hid uuid)
returns void
language sql security definer
set search_path = ''
as $$
  update public.household_members set last_seen_at = now()
  where household_id = hid and user_id = auth.uid();
$$;

-- ----- เจ้าของบ้านโอนสิทธิ์ให้สมาชิกคนอื่น (สลับบทบาทกัน) -----
create or replace function public.transfer_household_owner(hid uuid, uid uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare their_role public.household_members.role%type;
begin
  if not exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'not_owner';
  end if;
  if uid = auth.uid() then raise exception 'cannot_transfer_self'; end if;
  select role into their_role from public.household_members where household_id = hid and user_id = uid;
  if not found then raise exception 'not_member'; end if;

  update public.household_members set role = 'owner' where household_id = hid and user_id = uid;
  update public.household_members set role = their_role where household_id = hid and user_id = auth.uid();
end;
$$;

-- ----- เจ้าของบ้านไม่ได้เปิดแอปมากี่วันแล้ว (เฉพาะสมาชิกบ้านนี้ถามได้, ไม่ใช่สมาชิก -> null) -----
create or replace function public.owner_inactive_days(hid uuid)
returns int
language sql stable security definer
set search_path = ''
as $$
  select extract(day from now() - o.last_seen_at)::int
  from public.household_members o
  where o.household_id = hid and o.role = 'owner'
    and exists (select 1 from public.household_members m where m.household_id = hid and m.user_id = auth.uid())
  limit 1;
$$;

-- ----- ขอเป็นเจ้าของแทน: เจ้าของไม่ได้เปิดแอปเกิน 30 วัน (เช่น เครื่องหาย/พัง) สมาชิกคนไหนก็กดได้ -----
create or replace function public.claim_household_owner(hid uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare my_role public.household_members.role%type;
begin
  select role into my_role from public.household_members where household_id = hid and user_id = auth.uid();
  if not found then raise exception 'not_member'; end if;
  if my_role = 'owner' then return; end if;
  if exists (
    select 1 from public.household_members
    where household_id = hid and role = 'owner' and last_seen_at > now() - interval '30 days'
  ) then
    raise exception 'owner_active';
  end if;

  update public.household_members set role = my_role where household_id = hid and role = 'owner';
  update public.household_members set role = 'owner' where household_id = hid and user_id = auth.uid();
end;
$$;

revoke execute on function public.touch_household(uuid) from public, anon;
revoke execute on function public.transfer_household_owner(uuid, uuid) from public, anon;
revoke execute on function public.owner_inactive_days(uuid) from public, anon;
revoke execute on function public.claim_household_owner(uuid) from public, anon;
grant execute on function public.touch_household(uuid) to authenticated;
grant execute on function public.transfer_household_owner(uuid, uuid) to authenticated;
grant execute on function public.owner_inactive_days(uuid) to authenticated;
grant execute on function public.claim_household_owner(uuid) to authenticated;
