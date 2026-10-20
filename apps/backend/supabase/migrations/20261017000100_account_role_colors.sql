-- =====================================================================
-- NightOut · account — สีของชั้นบัญชี (role) เก็บใน DB (นอก MVP — อนุมัติ 2026-10-17)
--   - roles.color = สีหลักของชั้น #RRGGBB (ตัวพิมพ์ใหญ่) 1 สี — หน้าบ้านใช้ทุกที่ที่แสดงชั้นบัญชี
--       (ป้าย วงรอบรูป พื้นหลัง /profile รายการชั้นบัญชี ปุ่ม/เมนูบัญชีบน navbar) · ธีมสว่างหน้าเว็บเข้มตัวหนังสือเอง
--   - ค่าตั้งต้น = สีเดิมที่เคยตายตัวใน apps/frontend/src/configs/roles.ts
--   - admin_save_role_colors: Super Admin แก้สีหลายชั้นในครั้งเดียว · audit ต่อชั้นที่เปลี่ยน (entity_id = null · code อยู่ใน before/after)
--   - อ่าน: GET /me/roles (ผู้ที่ล็อกอิน · RLS roles_read เดิม) · GET /admin/roles
-- =====================================================================
set search_path = public, extensions;

alter table public.roles
  add column if not exists color text not null default '#B86BFA'
    constraint roles_color_hex check (color ~ '^#[0-9A-F]{6}$');

update public.roles set color = v.color
from (values
  ('CUSTOMER'::public.user_role, '#B86BFA'),
  ('STAFF', '#8C9BEA'),
  ('MERCHANT', '#E8B64C'),
  ('ADMIN', '#22C55E'),
  ('SUPER_ADMIN', '#EF4444')
) as v(code, color)
where roles.code = v.code;

-- p_items = [{ "code": "ADMIN", "color": "#22C55E" }, …] · ส่งเฉพาะชั้นที่จะแก้ก็ได้
create or replace function public.admin_save_role_colors(p_actor uuid, p_items jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  it jsonb; i bigint; r public.roles; v_code text; v_color text; v_updated integer := 0;
begin
  perform public.admin_assert(p_actor);
  perform public.super_admin_assert(p_actor);
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 20
     or exists (select 1 from jsonb_array_elements(p_items) e where jsonb_typeof(e) <> 'object') then
    raise exception 'INVALID_ROLE_COLORS' using errcode = '22023';
  end if;
  if exists (select e->>'code' from jsonb_array_elements(p_items) e group by e->>'code' having count(*) > 1) then
    raise exception 'INVALID_ROLE_COLORS' using errcode = '22023', detail = 'duplicate';
  end if;

  for it, i in select e.value, e.ordinality from jsonb_array_elements(p_items) with ordinality e loop
    v_code := it->>'code';
    v_color := upper(coalesce(it->>'color', ''));
    if v_color !~ '^#[0-9A-F]{6}$' then
      raise exception 'INVALID_ROLE_COLORS' using errcode = '22023', detail = i::text;
    end if;
    select * into r from public.roles where code::text = v_code for update;
    if not found then
      raise exception 'INVALID_ROLE_COLORS' using errcode = '22023', detail = coalesce(v_code, i::text);
    end if;
    if r.color is distinct from v_color then
      update public.roles set color = v_color where code = r.code;
      perform public.admin_audit(p_actor, 'role.color', 'roles', null,
        jsonb_build_object('code', r.code, 'color', r.color),
        jsonb_build_object('code', r.code, 'color', v_color));
      v_updated := v_updated + 1;
    end if;
  end loop;

  return jsonb_build_object('updated', v_updated);
end $$;

revoke all on function public.admin_save_role_colors(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_role_colors(uuid, jsonb) to service_role;
