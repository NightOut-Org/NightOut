-- =====================================================================
-- NightOut · catalog — Backoffice จัดการสไตล์ร้าน (/styles) — เจ้าของตัดสิน 2026-10-13
--   - เพิ่ม / เปลี่ยนชื่อ / เปลี่ยนไอคอน / ซ่อน / สลับลำดับ ในการบันทึกครั้งเดียว (admin_save_styles)
--       ส่งสไตล์ทั้งหมดเรียงตามที่แสดง (ต้องมีทุกสไตล์เดิม — ลบไม่ได้ ใช้ซ่อนแทน) · sort_order = ลำดับ × 10
--       สไตล์ใหม่ได้ key อัตโนมัติ STYLE_<สุ่ม 10 ตัว> · ชื่อซ้ำ (ไม่สนตัวพิมพ์) → DUPLICATE_STYLE_NAME
--       ซ่อน (active = false) → หายจากตัวเลือก ตัวกรอง และการ์ดร้านทันที (RLS styles_read using (active) · view เป็น security_invoker)
--       ลิงก์ร้าน ↔ สไตล์ที่ถูกซ่อนยังอยู่ → เปิดแสดงอีกครั้งร้านเดิมกลับมา
--   - ประเภทร้าน (bar_category) และ perk_type ของโปรโมชันยังแก้ผ่าน migration เท่านั้น
--   - view admin_styles: ทุกสไตล์ (รวมที่ซ่อน) + จำนวนร้านที่แสดงอยู่ที่ใช้ + ลูกค้าที่ตั้งเป็นสไตล์ที่ชอบ
-- =====================================================================
set search_path = public, extensions;

create unique index if not exists styles_name_th_lower on public.styles (lower(name_th));

-- ---------------------------------------------------------------------
-- 1. บันทึกสไตล์ทั้งชุด
-- ---------------------------------------------------------------------
create or replace function public.admin_save_styles(p_actor uuid, p_items jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  it jsonb; i bigint; s public.styles; v_id uuid; v_name text; v_icon text; v_active boolean;
  v_created integer := 0; v_updated integer := 0; v_n integer;
begin
  perform public.admin_assert(p_actor);
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_STYLES' using errcode = '22023';
  end if;
  v_n := jsonb_array_length(p_items);
  if v_n not between 1 and 50
     or exists (select 1 from jsonb_array_elements(p_items) e where jsonb_typeof(e) <> 'object') then
    raise exception 'INVALID_STYLES' using errcode = '22023';
  end if;
  -- id ที่ส่งมาต้องเป็น uuid ไม่ซ้ำ และมีอยู่จริง · ทุกสไตล์เดิมต้องอยู่ในรายการ (ลบไม่ได้)
  if exists (select 1 from jsonb_array_elements(p_items) e
              where nullif(e->>'id', '') is not null
                and (e->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'INVALID_STYLES' using errcode = '22023', detail = 'id';
  end if;
  if exists (select x.id from (select (e->>'id')::uuid as id from jsonb_array_elements(p_items) e
                               where nullif(e->>'id', '') is not null) x
              group by x.id having count(*) > 1)
     or exists (select 1 from jsonb_array_elements(p_items) e
                 where nullif(e->>'id', '') is not null
                   and not exists (select 1 from public.styles st where st.id = (e->>'id')::uuid))
     or exists (select 1 from public.styles st
                 where not exists (select 1 from jsonb_array_elements(p_items) e
                                    where nullif(e->>'id', '') is not null and (e->>'id')::uuid = st.id)) then
    raise exception 'INVALID_STYLES' using errcode = '22023', detail = 'ids';
  end if;

  for it, i in select e.value, e.ordinality from jsonb_array_elements(p_items) with ordinality e loop
    v_name := btrim(coalesce(it->>'name_th', ''));
    v_icon := it->>'icon';
    if char_length(v_name) not between 1 and 40
       or jsonb_typeof(it->'name_th') is distinct from 'string'
       or coalesce(v_icon, '') !~ '^[A-Z][A-Za-z0-9]{1,40}$'
       or coalesce(jsonb_typeof(it->'active'), 'null') not in ('boolean', 'null') then
      raise exception 'INVALID_STYLES' using errcode = '22023', detail = i::text;
    end if;
    v_active := coalesce((it->>'active')::boolean, true);
    v_id := nullif(it->>'id', '')::uuid;
    begin
      if v_id is null then
        insert into public.styles (key, name_th, icon, sort_order, active)
        values ('STYLE_' || upper(left(replace(gen_random_uuid()::text, '-', ''), 10)), v_name, v_icon, (i * 10)::integer, v_active)
        returning * into s;
        perform public.admin_audit(p_actor, 'style.create', 'styles', s.id, null,
          jsonb_build_object('key', s.key, 'name_th', s.name_th, 'icon', s.icon, 'active', s.active, 'sort_order', s.sort_order));
        v_created := v_created + 1;
      else
        select * into s from public.styles where id = v_id for update;
        if (s.name_th, s.icon, s.active, s.sort_order) is distinct from (v_name, v_icon, v_active, (i * 10)::integer) then
          update public.styles set name_th = v_name, icon = v_icon, active = v_active, sort_order = (i * 10)::integer
           where id = v_id;
          perform public.admin_audit(p_actor, 'style.update', 'styles', v_id,
            jsonb_build_object('key', s.key, 'name_th', s.name_th, 'icon', s.icon, 'active', s.active, 'sort_order', s.sort_order),
            jsonb_build_object('key', s.key, 'name_th', v_name, 'icon', v_icon, 'active', v_active, 'sort_order', (i * 10)::integer));
          v_updated := v_updated + 1;
        end if;
      end if;
    exception when unique_violation then
      raise exception 'DUPLICATE_STYLE_NAME' using errcode = '23505', detail = v_name;
    end;
  end loop;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'total', v_n);
end $$;

-- ---------------------------------------------------------------------
-- 2. view ของหน้า /styles
-- ---------------------------------------------------------------------
create or replace view public.admin_styles with (security_invoker = true) as
select
  s.id, s.key, s.name_th, s.icon, s.sort_order, s.active, s.created_at, s.updated_at,
  (select count(*) from public.bar_styles bs join public.bars b on b.id = bs.bar_id
    where bs.style_id = s.id and b.status = 'APPROVED')::integer as bar_count,
  (select count(*) from public.user_preferences up where s.id = any (up.preferred_style_ids))::integer as fan_count
from public.styles s
where public.is_admin();

-- ---------------------------------------------------------------------
-- 3. สิทธิ์
-- ---------------------------------------------------------------------
revoke all on function public.admin_save_styles(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_styles(uuid, jsonb) to service_role;

revoke all on public.admin_styles from anon;
grant select on public.admin_styles to authenticated;
