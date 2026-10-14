-- =====================================================================
-- NightOut · bar — แอดมินแก้ข้อมูลร้านแทนร้าน (Drawer "แก้ข้อมูลร้าน" ใน Backoffice /bars)
--   - admin_save_bar_details(p_actor, p_bar, p_info, p_menu): บันทึกครั้งเดียวในธุรกรรมเดียว (อย่างน้อย 1 ส่วน)
--       info = ชื่อ คำอธิบาย เบอร์โทร ย่าน สไตล์ (เฉพาะที่แสดงอยู่) เวลาเปิด-ปิด ลิงก์โซเชียล — ส่งเฉพาะ key ที่แก้
--         ไม่มีที่อยู่ / หมุด (แก้ผ่านคำขอตำแหน่งร้าน …20261013000600)
--       menu = เมนูทั้งชุด แทนที่ทั้งหมด · รูปเมนูของรายการที่คงไว้ไม่ถูกแตะ (แอดมินไม่ส่ง image_path)
--         รายการที่เอาออก → removed_paths ให้ NestJS ลบไฟล์จาก Storage
--       audit ต่อส่วน (bar.admin_edit_info / bar.admin_edit_menu พร้อม before/after) + แจ้งทีมร้าน 1 ครั้ง (BAR_EDITED_BY_ADMIN)
--   - bar_info_apply / bar_menu_apply: helper ภายใน (ไม่ตรวจสิทธิ์) — โค้ดเขียนเหมือน app_update_bar_info (…20261013000600)
--       / app_set_menu (…20261009000100) ยกเว้นสไตล์: ลบ/เพิ่มเฉพาะสไตล์ที่แสดงอยู่ → ลิงก์ไปสไตล์ที่ถูกซ่อนคงอยู่
--   - view admin_bar_details: ข้อมูลร้าน 1 แถวต่อร้าน (ทุกสถานะ) สำหรับเปิด Drawer
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. ข้อมูลร้าน (คืน snapshot ก่อนแก้ เฉพาะ key ที่ส่งมา)
-- ---------------------------------------------------------------------
create or replace function public.bar_info_apply(p_bar uuid, p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare b public.bars; h jsonb; l jsonb; i integer := 0; k text; v_before jsonb; v_bad text;
begin
  if p is null or jsonb_typeof(p) <> 'object' or p = '{}'::jsonb then
    raise exception 'INVALID_BAR_DETAILS' using errcode = '22023', detail = 'empty';
  end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('name', 'description', 'phone', 'district_id', 'style_keys', 'hours', 'links') then
      raise exception 'INVALID_BAR_DETAILS' using errcode = '22023', detail = k;
    end if;
  end loop;
  select * into b from public.bars where id = p_bar for update;
  if not found then raise exception 'BAR_NOT_FOUND' using errcode = 'P0002'; end if;

  -- ตรวจค่า
  if p ? 'name' and (jsonb_typeof(p->'name') <> 'string' or char_length(trim(p->>'name')) not between 1 and 80) then
    raise exception 'INVALID_BAR_DETAILS' using errcode = '22023', detail = 'name';
  end if;
  if p ? 'description' and (jsonb_typeof(p->'description') not in ('string', 'null')
                            or char_length(coalesce(trim(p->>'description'), '')) > 400) then
    raise exception 'INVALID_BAR_DETAILS' using errcode = '22023', detail = 'description';
  end if;
  if p ? 'phone' and (jsonb_typeof(p->'phone') not in ('string', 'null') or char_length(coalesce(trim(p->>'phone'), '')) > 30) then
    raise exception 'INVALID_BAR_DETAILS' using errcode = '22023', detail = 'phone';
  end if;
  if p ? 'district_id' then
    if jsonb_typeof(p->'district_id') not in ('string', 'null') then
      raise exception 'INVALID_BAR_DETAILS' using errcode = '22023', detail = 'district_id';
    end if;
    if nullif(p->>'district_id', '') is not null then
      if p->>'district_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'INVALID_BAR_DETAILS' using errcode = '22023', detail = 'district_id';
      end if;
      if not exists (select 1 from public.districts d where d.id = (p->>'district_id')::uuid) then
        raise exception 'INVALID_BAR_DETAILS' using errcode = '22023', detail = 'district_id';
      end if;
    end if;
  end if;
  if p ? 'style_keys' then
    if jsonb_typeof(p->'style_keys') <> 'array' or jsonb_array_length(p->'style_keys') > 20
       or exists (select 1 from jsonb_array_elements(p->'style_keys') e where jsonb_typeof(e) <> 'string') then
      raise exception 'INVALID_BAR_DETAILS' using errcode = '22023', detail = 'style_keys';
    end if;
    select x into v_bad from jsonb_array_elements_text(p->'style_keys') x
     where not exists (select 1 from public.styles s where s.key = x and s.active) limit 1;
    if v_bad is not null then raise exception 'INVALID_STYLE' using errcode = '22023', detail = v_bad; end if;
  end if;
  if p ? 'hours' then
    if jsonb_typeof(p->'hours') <> 'array' or jsonb_array_length(p->'hours') > 7
       or exists (select 1 from jsonb_array_elements(p->'hours') e
                   where jsonb_typeof(e) <> 'object'
                      or jsonb_typeof(e->'day_of_week') is distinct from 'number' or (e->>'day_of_week') !~ '^[0-6]$'
                      or coalesce(jsonb_typeof(e->'is_closed'), 'null') not in ('boolean', 'null')
                      or (coalesce(e->'is_closed', 'false'::jsonb) <> 'true'::jsonb
                          and (coalesce(e->>'open_time', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
                               or coalesce(e->>'close_time', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$')))
       or (select count(distinct e->>'day_of_week') from jsonb_array_elements(p->'hours') e) <> jsonb_array_length(p->'hours') then
      raise exception 'INVALID_BAR_DETAILS' using errcode = '22023', detail = 'hours';
    end if;
  end if;
  if p ? 'links' then
    if jsonb_typeof(p->'links') <> 'array' or jsonb_array_length(p->'links') > 10
       or exists (select 1 from jsonb_array_elements(p->'links') e
                   where jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'url') is distinct from 'string'
                      or coalesce(e->>'type', '') not in (select unnest(enum_range(null::public.link_type))::text)) then
      raise exception 'INVALID_BAR_DETAILS' using errcode = '22023', detail = 'links';
    end if;
  end if;

  -- snapshot ก่อนแก้ (รูปแบบเดียวกับ my_bar_detail) เฉพาะ key ที่ส่งมา
  v_before := jsonb_build_object(
    'name', b.name, 'description', b.description, 'phone', b.phone, 'district_id', b.district_id,
    'style_keys', coalesce((select jsonb_agg(s.key order by s.sort_order, s.key)
                            from public.bar_styles bs join public.styles s on s.id = bs.style_id where bs.bar_id = p_bar), '[]'::jsonb),
    'hours', coalesce((select jsonb_agg(jsonb_build_object(
                         'day_of_week', bh.day_of_week, 'open_time', to_char(bh.open_time, 'HH24:MI'),
                         'close_time', to_char(bh.close_time, 'HH24:MI'), 'is_closed', bh.is_closed) order by bh.day_of_week)
                       from public.bar_hours bh where bh.bar_id = p_bar), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(jsonb_build_object('type', bl.type, 'url', bl.url) order by bl.sort_order, bl.created_at)
                       from public.bar_links bl where bl.bar_id = p_bar), '[]'::jsonb));
  select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) into v_before
  from jsonb_each(v_before) e where p ? e.key;

  -- บันทึก (เหมือน app_update_bar_info ล่าสุด · ไม่มี address)
  update public.bars set
    name        = case when p ? 'name' then trim(p->>'name') else name end,
    description = case when p ? 'description' then nullif(trim(p->>'description'), '') else description end,
    phone       = case when p ? 'phone' then nullif(trim(p->>'phone'), '') else phone end,
    district_id = case when p ? 'district_id' then nullif(p->>'district_id', '')::uuid else district_id end
  where id = p_bar;
  if p ? 'style_keys' then
    -- เฉพาะสไตล์ที่แสดงอยู่ — ลิงก์ไปสไตล์ที่ถูกซ่อนคงไว้ (แสดงกลับเมื่อเปิดสไตล์อีกครั้ง)
    delete from public.bar_styles bs using public.styles s where bs.bar_id = p_bar and s.id = bs.style_id and s.active;
    insert into public.bar_styles (bar_id, style_id)
    select p_bar, s.id from public.styles s where s.active and s.key in (select jsonb_array_elements_text(p->'style_keys'))
    on conflict do nothing;
  end if;
  if p ? 'hours' then
    delete from public.bar_hours where bar_id = p_bar;
    for h in select * from jsonb_array_elements(p->'hours') loop
      insert into public.bar_hours (bar_id, day_of_week, open_time, close_time, is_closed)
      values (p_bar, (h->>'day_of_week')::smallint,
              case when coalesce((h->>'is_closed')::boolean, false) then null else (h->>'open_time')::time end,
              case when coalesce((h->>'is_closed')::boolean, false) then null else (h->>'close_time')::time end,
              coalesce((h->>'is_closed')::boolean, false));
    end loop;
  end if;
  if p ? 'links' then
    delete from public.bar_links where bar_id = p_bar;
    for l in select * from jsonb_array_elements(p->'links') loop
      begin
        insert into public.bar_links (bar_id, type, url, sort_order) values (p_bar, (l->>'type')::public.link_type, l->>'url', i);
      exception when check_violation then
        raise exception 'INVALID_LINK' using errcode = '22023', detail = l->>'type';
      end;
      i := i + 1;
    end loop;
  end if;
  return v_before;
end $$;

-- ---------------------------------------------------------------------
-- 2. เมนูทั้งชุด (คืน {count, before, removed_paths})
-- ---------------------------------------------------------------------
create or replace function public.bar_menu_apply(p_bar uuid, p_items jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare it jsonb; v_cat uuid; v_id uuid; v_img text; i integer := 0; keep uuid[] := '{}'; old_imgs text[]; v_before jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 500 then
    raise exception 'INVALID_MENU_ITEM' using errcode = '22023';
  end if;
  perform 1 from public.bars where id = p_bar for update;
  if not found then raise exception 'BAR_NOT_FOUND' using errcode = 'P0002'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', mi.id, 'category', mc.name, 'name', mi.name, 'price', mi.price,
                                               'available', mi.is_available) order by mi.sort_order, mi.name), '[]'::jsonb)
    into v_before
  from public.menu_items mi left join public.menu_categories mc on mc.id = mi.category_id
  where mi.bar_id = p_bar;
  select coalesce(array_agg(image_path) filter (where image_path is not null), '{}') into old_imgs
  from public.menu_items where bar_id = p_bar;
  for it in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(it) <> 'object' or jsonb_typeof(it->'price') is distinct from 'number'
       or coalesce(jsonb_typeof(it->'available'), 'null') not in ('boolean', 'null') then
      raise exception 'INVALID_MENU_ITEM' using errcode = '22023';
    end if;
    if coalesce(trim(it->>'name'), '') = '' or (it->>'price')::numeric < 0 then raise exception 'INVALID_MENU_ITEM' using errcode = '22023'; end if;
    v_img := case when it ? 'image_path' then public.menu_image_check(p_bar, nullif(it->>'image_path', '')) end;
    select id into v_cat from public.menu_categories where bar_id = p_bar and name = coalesce(nullif(trim(it->>'category'), ''), 'อื่นๆ');
    if v_cat is null then
      insert into public.menu_categories (bar_id, name, sort_order)
      values (p_bar, coalesce(nullif(trim(it->>'category'), ''), 'อื่นๆ'),
              (select coalesce(max(sort_order), 0) + 1 from public.menu_categories where bar_id = p_bar))
      returning id into v_cat;
    end if;
    v_id := null;
    if it->>'id' ~ '^[0-9a-f-]{36}$' then
      update public.menu_items set category_id = v_cat, name = trim(it->>'name'), price = (it->>'price')::numeric,
             is_available = coalesce((it->>'available')::boolean, true), sort_order = i,
             image_path = case when it ? 'image_path' then v_img else image_path end
       where id = (it->>'id')::uuid and bar_id = p_bar returning id into v_id;
    end if;
    if v_id is null then
      insert into public.menu_items (bar_id, category_id, name, price, is_available, sort_order, image_path)
      values (p_bar, v_cat, trim(it->>'name'), (it->>'price')::numeric, coalesce((it->>'available')::boolean, true), i, v_img)
      returning id into v_id;
    end if;
    keep := keep || v_id;
    i := i + 1;
  end loop;
  delete from public.menu_items where bar_id = p_bar and not (id = any (keep));
  -- ราคาเฉลี่ยต่อหัว (ประมาณจากเมนู) ใช้ในตัวกรองงบ
  update public.bar_stats set avg_price_per_person = coalesce(
    (select round(avg(price)) * 2 from public.menu_items where bar_id = p_bar and is_available), avg_price_per_person)
   where bar_id = p_bar and avg_price_per_person is null;
  return jsonb_build_object('count', i, 'before', v_before, 'removed_paths', public.bar_media_unused(p_bar, old_imgs));
end $$;

-- ---------------------------------------------------------------------
-- 3. บันทึกครั้งเดียว (แอดมิน)
-- ---------------------------------------------------------------------
create or replace function public.admin_save_bar_details(p_actor uuid, p_bar uuid, p_info jsonb, p_menu jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare v_before jsonb; m jsonb; v_parts text[] := '{}';
begin
  perform public.admin_assert(p_actor);
  if p_info = 'null'::jsonb then p_info := null; end if;
  if p_menu = 'null'::jsonb then p_menu := null; end if;
  if p_info is null and p_menu is null then
    raise exception 'INVALID_BAR_DETAILS' using errcode = '22023', detail = 'empty';
  end if;
  if not exists (select 1 from public.bars where id = p_bar) then
    raise exception 'BAR_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_info is not null then
    v_before := public.bar_info_apply(p_bar, p_info);
    perform public.admin_audit(p_actor, 'bar.admin_edit_info', 'bars', p_bar, v_before, p_info);
    v_parts := v_parts || array(
      select t.label from (values (1, 'name', 'ชื่อร้าน'), (2, 'description', 'คำอธิบาย'), (3, 'phone', 'เบอร์โทร'),
                                  (4, 'district_id', 'ย่าน'), (5, 'style_keys', 'สไตล์ร้าน'), (6, 'hours', 'เวลาเปิด-ปิด'),
                                  (7, 'links', 'ลิงก์โซเชียล')) t(ord, key, label)
      where p_info ? t.key order by t.ord);
  end if;

  if p_menu is not null then
    m := public.bar_menu_apply(p_bar, p_menu);
    perform public.admin_audit(p_actor, 'bar.admin_edit_menu', 'bars', p_bar,
      jsonb_build_object('items', m->'before'), jsonb_build_object('items', p_menu, 'count', m->'count'));
    v_parts := v_parts || 'เมนูและราคา'::text;
  end if;

  perform public.app_notify_team(p_bar, 'BAR_EDITED_BY_ADMIN', 'ทีม NightOut แก้ข้อมูลร้านของคุณ',
    array_to_string(v_parts, ' · ') || ' — ตรวจได้ที่หน้าร้านของคุณ',
    case when p_info is null then '/merchant/menu' else '/merchant/store' end);

  return jsonb_build_object('bar_id', p_bar, 'info_updated', p_info is not null,
                            'menu_count', (m->>'count')::integer,
                            'removed_paths', coalesce(m->'removed_paths', '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------
-- 4. view ของ Drawer "แก้ข้อมูลร้าน" (1 แถวต่อร้าน ทุกสถานะ)
-- ---------------------------------------------------------------------
create or replace view public.admin_bar_details with (security_invoker = true) as
select
  b.id, b.slug, b.name, b.status, b.category, b.description, b.address, b.phone, b.district_id,
  case when d.id is null then null else jsonb_build_object('id', d.id, 'slug', d.slug, 'name_th', d.name_th) end as district,
  coalesce((select jsonb_agg(s.key order by s.sort_order, s.key)
            from public.bar_styles bs join public.styles s on s.id = bs.style_id where bs.bar_id = b.id), '[]'::jsonb) as style_keys,
  coalesce((select jsonb_agg(jsonb_build_object(
              'day_of_week', h.day_of_week, 'open_time', to_char(h.open_time, 'HH24:MI'),
              'close_time', to_char(h.close_time, 'HH24:MI'), 'is_closed', h.is_closed) order by h.day_of_week)
            from public.bar_hours h where h.bar_id = b.id), '[]'::jsonb) as hours,
  coalesce((select jsonb_agg(jsonb_build_object('type', l.type, 'url', l.url) order by l.sort_order, l.created_at)
            from public.bar_links l where l.bar_id = b.id), '[]'::jsonb) as links,
  coalesce((select jsonb_agg(jsonb_build_object(
              'id', mi.id, 'category', mc.name, 'name', mi.name, 'price', mi.price,
              'available', mi.is_available, 'image_path', mi.image_path) order by mi.sort_order, mi.name)
            from public.menu_items mi left join public.menu_categories mc on mc.id = mi.category_id
            where mi.bar_id = b.id), '[]'::jsonb) as menu,
  case when o.id is null then null else jsonb_build_object('id', o.id, 'email', o.email, 'display_name', o.display_name) end as owner,
  b.updated_at
from public.bars b
left join public.districts d on d.id = b.district_id
left join public.users     o on o.id = b.owner_id
where public.is_admin();

-- ---------------------------------------------------------------------
-- 5. สิทธิ์
-- ---------------------------------------------------------------------
revoke all on function public.bar_info_apply(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.bar_menu_apply(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.admin_save_bar_details(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.bar_info_apply(uuid, jsonb) to service_role;
grant execute on function public.bar_menu_apply(uuid, jsonb) to service_role;
grant execute on function public.admin_save_bar_details(uuid, uuid, jsonb, jsonb) to service_role;

revoke all on public.admin_bar_details from anon;
grant select on public.admin_bar_details to authenticated;
