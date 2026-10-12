-- =====================================================================
-- account · บันทึกชั้นบัญชีหลายคนในคำขอเดียว (หน้า /users · CLAUDE.md "ฟอร์ม · การบันทึก")
--   p_changes = [{ "id": uuid, "role": user_role }] — เรียก admin_set_user_role ทีละคน (Super Admin · ห้ามเหลือ Super Admin เป็นศูนย์)
-- ธุรกรรมเดียว — คนไหนพลาด = ไม่บันทึกเลย · audit ต่อคน (ใน admin_set_user_role)
-- =====================================================================
create or replace function public.admin_set_users_role(p_actor uuid, p_changes jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  c jsonb;
  r jsonb;
  n integer := 0;
  v_detached integer := 0;
begin
  perform public.admin_assert(p_actor);
  perform public.super_admin_assert(p_actor);
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) = 0 or jsonb_array_length(p_changes) > 200
     or jsonb_array_length(p_changes) <> (select count(distinct x->>'id') from jsonb_array_elements(p_changes) x) then
    raise exception 'INVALID_ROLE_CHANGES' using errcode = '22023';
  end if;

  for c in select * from jsonb_array_elements(p_changes) loop
    r := public.admin_set_user_role(p_actor, (c->>'id')::uuid, (c->>'role')::public.user_role);
    n := n + 1;
    v_detached := v_detached + coalesce((r->>'bars_detached')::integer, 0);
  end loop;

  return jsonb_build_object('updated', n, 'bars_detached', v_detached);
end $$;

revoke all on function public.admin_set_users_role(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_set_users_role(uuid, jsonb) to service_role;
