-- ===== ลากเรียงลำดับแมวและสมาชิกในบ้าน (ทุกคนในบ้านเห็นลำดับเดียวกัน) =====
-- sort_order ว่าง = ยังไม่เคยเรียง -> ต่อท้ายตามเวลาที่เพิ่ม/เข้าร่วม (แมวใหม่/สมาชิกใหม่จึงไปอยู่ท้ายเอง)

alter table public.cats add column if not exists sort_order int;
alter table public.household_members add column if not exists sort_order int;

-- ----- รายชื่อสมาชิก: เรียงตามที่ลากไว้ก่อน แล้วค่อยตามวันที่เข้าร่วม -----
create or replace function public.list_household_members(hid uuid)
returns table (user_id uuid, display_name text, avatar text, role text, joined_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select m.user_id, coalesce(p.display_name, 'ไม่มีชื่อ'), coalesce(p.avatar, '😺'), m.role, m.joined_at
  from public.household_members m
  left join public.profiles p on p.id = m.user_id
  where m.household_id = hid and private.is_household_member(hid)
  order by m.sort_order nulls last, m.joined_at;
$$;

-- ----- บันทึกลำดับแมว: ids เรียงตามที่ผู้ใช้ลาก (สมาชิกบ้านคนไหนก็เรียงได้) -----
create or replace function public.reorder_cats(hid uuid, ids uuid[])
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.is_household_member(hid) then raise exception 'not_member'; end if;
  update public.cats c set sort_order = o.pos
  from unnest(ids) with ordinality as o(id, pos)
  where c.id = o.id and c.household_id = hid;
end;
$$;

-- ----- บันทึกลำดับสมาชิก: uids เรียงตามที่ผู้ใช้ลาก (สมาชิกบ้านคนไหนก็เรียงได้) -----
create or replace function public.reorder_household_members(hid uuid, uids uuid[])
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.is_household_member(hid) then raise exception 'not_member'; end if;
  update public.household_members m set sort_order = o.pos
  from unnest(uids) with ordinality as o(id, pos)
  where m.user_id = o.id and m.household_id = hid;
end;
$$;

revoke execute on function public.reorder_cats(uuid, uuid[]) from public, anon;
revoke execute on function public.reorder_household_members(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_cats(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_household_members(uuid, uuid[]) to authenticated;
