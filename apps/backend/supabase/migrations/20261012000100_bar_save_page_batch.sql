-- =====================================================================
-- bar · บันทึกทั้งหน้าในคำขอเดียว (CLAUDE.md "ฟอร์ม · การบันทึก") — แก้ในหน้าก่อน แล้วกดบันทึกครั้งเดียว
--   admin_set_bars_status  — Backoffice /bars: สวิตช์แสดง ↔ ระงับ หลายร้าน (ทุกร้านหรือไม่มีเลย)
--   admin_save_bar_media   — Backoffice /bar-media: แกลเลอรี + ปก + รูปเมนูหลายรายการ ของร้านเดียว
--   app_save_bar_store     — หน้าร้าน /merchant/store: ข้อมูลร้าน + แกลเลอรี
-- ฟังก์ชันเดิม (admin_set_bar_status · admin_set_bar_media · app_update_bar_info · app_set_bar_media) ยังใช้อยู่ภายใน
-- =====================================================================

-- ---------------------------------------------------------------------
-- admin_set_bars_status — p_changes = [{ "id": uuid, "status": "APPROVED" | "SUSPENDED", "reason": text|null }]
-- รับเฉพาะร้านที่แสดง/ระงับอยู่ (อนุมัติร้านใหม่ทำที่ /merchants ด้วย admin_set_bar_status) · ระงับต้องมีเหตุผล
-- ---------------------------------------------------------------------
create or replace function public.admin_set_bars_status(p_actor uuid, p_changes jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  c jsonb;
  v_id uuid;
  v_status public.bar_status;
  v_reason text;
  v_old public.bar_status;
  n integer := 0;
begin
  perform public.admin_assert(p_actor);
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) = 0 or jsonb_array_length(p_changes) > 200
     or jsonb_array_length(p_changes) <> (select count(distinct x->>'id') from jsonb_array_elements(p_changes) x) then
    raise exception 'INVALID_BAR_STATUS_CHANGES' using errcode = '22023';
  end if;

  for c in select * from jsonb_array_elements(p_changes) loop
    v_id := (c->>'id')::uuid;
    v_status := (c->>'status')::public.bar_status;
    v_reason := nullif(trim(c->>'reason'), '');
    if v_status not in ('APPROVED', 'SUSPENDED') or (v_status = 'SUSPENDED' and v_reason is null) then
      raise exception 'INVALID_BAR_STATUS_CHANGES' using errcode = '22023';
    end if;
    select status into v_old from public.bars where id = v_id for update;
    if not found then raise exception 'BAR_NOT_FOUND' using errcode = 'P0002'; end if;
    if v_old not in ('APPROVED', 'SUSPENDED') then
      raise exception 'BAR_NOT_TOGGLEABLE' using errcode = '22023';
    end if;
    perform public.admin_set_bar_status(p_actor, v_id, v_status, case when v_status = 'SUSPENDED' then v_reason end);
    n := n + 1;
  end loop;

  return jsonb_build_object('updated', n);
end $$;

-- ---------------------------------------------------------------------
-- admin_save_bar_media — แกลเลอรี (p_paths null = ไม่แตะ) + รูปเมนู p_menu = [{ "id": uuid, "path": text|null }]
-- audit ต่อเรื่องที่เปลี่ยน · แจ้งทีมร้าน 1 ครั้ง · removed_paths = ไฟล์ที่ไม่มีแถวไหนอ้างแล้ว (NestJS ลบจาก Storage)
-- ---------------------------------------------------------------------
create or replace function public.admin_save_bar_media(
  p_actor uuid, p_bar uuid, p_paths text[], p_cover_path text, p_cover_url text, p_menu jsonb
) returns jsonb language plpgsql set search_path = '' as $$
declare
  before jsonb;
  r jsonb := null;
  m jsonb;
  v_item public.menu_items;
  v_img text;
  old_paths text[] := '{}';
  n_menu integer := 0;
begin
  perform public.admin_assert(p_actor);
  if not exists (select 1 from public.bars where id = p_bar) then
    raise exception 'BAR_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_menu is not null and (jsonb_typeof(p_menu) <> 'array' or jsonb_array_length(p_menu) > 500) then
    raise exception 'INVALID_BAR_MEDIA' using errcode = '22023';
  end if;
  if p_paths is null and coalesce(jsonb_array_length(p_menu), 0) = 0 then
    raise exception 'INVALID_BAR_MEDIA' using errcode = '22023', detail = 'empty';
  end if;

  if p_paths is not null then
    select jsonb_build_object(
             'paths', coalesce((select jsonb_agg(md.storage_path order by md.sort_order, md.created_at)
                                from public.bar_media md where md.bar_id = b.id), '[]'::jsonb),
             'cover_image_url', b.cover_image_url)
      into before from public.bars b where b.id = p_bar;
    r := public.bar_media_save(p_bar, p_paths, p_cover_path, p_cover_url);
    old_paths := old_paths || array(select jsonb_array_elements_text(r->'removed_paths'));
    perform public.admin_audit(p_actor, 'bar.media.update', 'bars', p_bar, before,
                               jsonb_build_object('paths', r->'paths', 'cover_image_url', r->'cover_image_url'));
  end if;

  for m in select * from jsonb_array_elements(coalesce(p_menu, '[]'::jsonb)) loop
    select * into v_item from public.menu_items where id = (m->>'id')::uuid and bar_id = p_bar for update;
    if v_item.id is null then raise exception 'MENU_ITEM_NOT_FOUND' using errcode = 'P0002'; end if;
    v_img := public.menu_image_check(p_bar, nullif(m->>'path', ''));
    if v_item.image_path is distinct from v_img then
      update public.menu_items set image_path = v_img where id = v_item.id;
      perform public.admin_audit(p_actor, 'menu_item.image', 'menu_items', v_item.id,
                                 jsonb_build_object('image_path', v_item.image_path), jsonb_build_object('image_path', v_img));
      if v_item.image_path is not null then old_paths := old_paths || v_item.image_path; end if;
      n_menu := n_menu + 1;
    end if;
  end loop;

  perform public.app_notify_team(p_bar, 'BAR_MEDIA_UPDATED', 'ทีม NightOut แก้รูปร้านของคุณ',
    'ตรวจรูปปก แกลเลอรี และรูปเมนูได้ที่หน้าข้อมูลร้าน', '/merchant/store');

  return jsonb_build_object(
    'bar_id', p_bar,
    'gallery', case when r is null then null else r - 'removed_paths' end,
    'menu_updated', n_menu,
    'removed_paths', public.bar_media_unused(p_bar, old_paths));
end $$;

-- ---------------------------------------------------------------------
-- app_save_bar_store — p_info = body ของ PATCH /info (null = ไม่แตะ) · p_paths null = ไม่แตะแกลเลอรี
-- ---------------------------------------------------------------------
create or replace function public.app_save_bar_store(
  p_actor uuid, p_bar uuid, p_info jsonb, p_paths text[], p_cover_path text, p_cover_url text
) returns jsonb language plpgsql set search_path = '' as $$
declare r jsonb := null;
begin
  perform public.app_assert_user(p_actor);
  perform public.app_assert_manager(p_actor, p_bar);
  if p_info is null and p_paths is null then
    raise exception 'INVALID_BAR_STORE' using errcode = '22023';
  end if;
  if p_info is not null then
    perform public.app_update_bar_info(p_actor, p_bar, p_info);
  end if;
  if p_paths is not null then
    r := public.app_set_bar_media(p_actor, p_bar, p_paths, p_cover_path, p_cover_url);
  end if;
  return jsonb_build_object(
    'bar_id', p_bar,
    'info_updated', p_info is not null,
    'gallery', case when r is null then null else r - 'removed_paths' end,
    'removed_paths', coalesce(r->'removed_paths', '[]'::jsonb));
end $$;

revoke all on function public.admin_set_bars_status(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.admin_save_bar_media(uuid, uuid, text[], text, text, jsonb) from public, anon, authenticated;
revoke all on function public.app_save_bar_store(uuid, uuid, jsonb, text[], text, text) from public, anon, authenticated;
grant execute on function public.admin_set_bars_status(uuid, jsonb) to service_role;
grant execute on function public.admin_save_bar_media(uuid, uuid, text[], text, text, jsonb) to service_role;
grant execute on function public.app_save_bar_store(uuid, uuid, jsonb, text[], text, text) to service_role;
