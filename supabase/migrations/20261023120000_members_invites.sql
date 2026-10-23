-- ===== ลิงก์เชิญ + ห้ามชื่อซ้ำในบ้าน + ลบสมาชิก + ส่งต่อเจ้าของบ้าน =====

-- ----- ชื่อนี้มีคนอื่นในบ้านใช้แล้วหรือยัง (ไม่สนตัวพิมพ์เล็ก/ใหญ่ และช่องว่างหัวท้าย) -----
create or replace function private.name_taken_in_household(hid uuid, uid uuid, p_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    join public.profiles p on p.id = m.user_id
    where m.household_id = hid and m.user_id <> uid
      and lower(trim(p.display_name)) = lower(trim(p_name))
  );
$$;
revoke execute on function private.name_taken_in_household(uuid, uuid, text) from public, anon, authenticated;

-- ----- เข้าร่วมบ้าน: อยู่แล้ว -> คืนบ้านเลย, ชื่อซ้ำกับคนในบ้าน -> ไม่ให้เข้า -----
create or replace function public.join_household(p_code text)
returns public.households
language plpgsql security definer
set search_path = ''
as $$
declare
  h public.households;
  my_name text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into h from public.households where invite_code = upper(trim(p_code));
  if not found then raise exception 'invalid_invite_code'; end if;

  -- เป็นสมาชิกอยู่แล้ว (เช่น กดลิงก์เชิญซ้ำ) -> ไม่ต้องทำอะไร
  if exists (select 1 from public.household_members where household_id = h.id and user_id = auth.uid()) then
    return h;
  end if;

  select display_name into my_name from public.profiles where id = auth.uid();
  if my_name is null then raise exception 'profile_required'; end if;
  if private.name_taken_in_household(h.id, auth.uid(), my_name) then
    raise exception 'duplicate_name';
  end if;

  insert into public.household_members (household_id, user_id) values (h.id, auth.uid());
  return h;
end;
$$;

-- ----- เปลี่ยนชื่อโปรไฟล์: ห้ามซ้ำกับคนในบ้านที่อยู่ด้วยกัน -----
create or replace function private.check_profile_name()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.household_members m
    where m.user_id = new.id and private.name_taken_in_household(m.household_id, new.id, new.display_name)
  ) then
    raise exception 'duplicate_name';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_unique_name_in_household on public.profiles;
create trigger profiles_unique_name_in_household
  before update of display_name on public.profiles
  for each row execute function private.check_profile_name();

-- ----- เจ้าของบ้านลบสมาชิกคนอื่น -----
create or replace function public.remove_household_member(hid uuid, uid uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'not_owner';
  end if;
  if uid = auth.uid() then raise exception 'cannot_remove_self'; end if;
  delete from public.household_members where household_id = hid and user_id = uid;
end;
$$;

-- ----- ออกจากบ้าน: ถ้าเป็นเจ้าของ ส่งต่อให้สมาชิกที่อยู่มานานที่สุด -----
create or replace function public.leave_household(hid uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare was_owner boolean;
begin
  delete from public.household_members
  where household_id = hid and user_id = auth.uid()
  returning role = 'owner' into was_owner;

  if was_owner then
    update public.household_members set role = 'owner'
    where household_id = hid and user_id = (
      select user_id from public.household_members where household_id = hid order by joined_at limit 1
    );
  end if;
end;
$$;

-- ออกจากบ้านต้องผ่าน leave_household เท่านั้น (จะได้ส่งต่อเจ้าของบ้านเสมอ)
drop policy if exists "leave household" on public.household_members;

-- ----- ดูข้อมูลบ้านจากรหัสเชิญ (ใช้ในหน้า landing ก่อนตั้งโปรไฟล์ จึงเปิดให้ anon เรียกได้) -----
-- บอกแค่ชื่อบ้าน จำนวนสมาชิก จำนวนแมว (ไม่บอกข้อมูลแมว) และต้องรู้รหัสเชิญเท่านั้น
create or replace function public.invite_preview(p_code text)
returns table (household_name text, member_count int, cat_count int, owner_name text, owner_avatar text)
language sql stable security definer
set search_path = ''
as $$
  select h.name,
    (select count(*)::int from public.household_members m where m.household_id = h.id),
    (select count(*)::int from public.cats c where c.household_id = h.id),
    p.display_name, p.avatar
  from public.households h
  left join public.household_members o on o.household_id = h.id and o.role = 'owner'
  left join public.profiles p on p.id = o.user_id
  where h.invite_code = upper(trim(p_code))
  limit 1;
$$;

revoke execute on function public.join_household(text) from public, anon;
revoke execute on function public.remove_household_member(uuid, uuid) from public, anon;
revoke execute on function public.leave_household(uuid) from public, anon;
revoke execute on function public.invite_preview(text) from public;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;
