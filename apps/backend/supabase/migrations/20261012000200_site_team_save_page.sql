-- =====================================================================
-- site-team · บันทึกหน้า /team ในคำขอเดียว (CLAUDE.md "ฟอร์ม · การบันทึก")
--   p_ids    = id ทีมงานเรียงบน→ล่าง (null = ไม่เปลี่ยนลำดับ · เฉพาะ SUPER_ADMIN ผ่าน admin_reorder_team_members)
--   p_active = [{ "id": uuid, "active": boolean }] (ADMIN แก้ได้เฉพาะแถวของตัวเอง ผ่าน admin_save_team_member)
-- ทุกอย่างอยู่ในธุรกรรมเดียว — แถวไหนไม่มีสิทธิ์ = ไม่บันทึกเลย
-- =====================================================================
create or replace function public.admin_save_team_page(p_actor uuid, p_ids uuid[], p_active jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  a jsonb;
  n_order integer := 0;
  n_active integer := 0;
begin
  perform public.admin_assert(p_actor);
  if p_active is not null and (jsonb_typeof(p_active) <> 'array' or jsonb_array_length(p_active) > 200) then
    raise exception 'INVALID_TEAM_PAGE' using errcode = '22023';
  end if;
  if p_ids is null and coalesce(jsonb_array_length(p_active), 0) = 0 then
    raise exception 'INVALID_TEAM_PAGE' using errcode = '22023';
  end if;

  for a in select * from jsonb_array_elements(coalesce(p_active, '[]'::jsonb)) loop
    if jsonb_typeof(a->'active') <> 'boolean' then raise exception 'INVALID_TEAM_PAGE' using errcode = '22023'; end if;
    perform public.admin_save_team_member(p_actor, (a->>'id')::uuid, jsonb_build_object('active', a->'active'));
    n_active := n_active + 1;
  end loop;

  if p_ids is not null then
    n_order := (public.admin_reorder_team_members(p_actor, p_ids)->>'updated')::integer;
  end if;

  return jsonb_build_object('reordered', n_order, 'active_updated', n_active);
end $$;

revoke all on function public.admin_save_team_page(uuid, uuid[], jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_team_page(uuid, uuid[], jsonb) to service_role;
