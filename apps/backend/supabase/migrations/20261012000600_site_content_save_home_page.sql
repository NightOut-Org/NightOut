-- =====================================================================
-- site-content · บันทึกหน้า /home-content ในคำขอเดียว (CLAUDE.md "ฟอร์ม · การบันทึก")
--   p_content    = field ของ home_content ที่แก้ (Hero + หัวข้อ section · null = ไม่แตะ) → admin_save_home_content
--   p_categories = [{ "slot": text, ...field ที่แก้ }] (null/[] = ไม่แตะ) → admin_save_home_category ทีละช่อง
--   p_popular    = รหัสร้านเรียงตามลำดับ (null = ไม่แตะ · '{}' = ไม่ปัก) → admin_save_home_popular
-- ธุรกรรมเดียว · audit ต่อส่วน (ในฟังก์ชันเดิม)
-- =====================================================================
create or replace function public.admin_save_home_page(p_actor uuid, p_content jsonb, p_categories jsonb, p_popular uuid[])
returns jsonb language plpgsql set search_path = '' as $$
declare
  c jsonb;
  n_cat integer := 0;
begin
  perform public.admin_assert(p_actor);
  if p_categories is not null and (jsonb_typeof(p_categories) <> 'array' or jsonb_array_length(p_categories) > 20
     or jsonb_array_length(p_categories) <> (select count(distinct x->>'slot') from jsonb_array_elements(p_categories) x)) then
    raise exception 'INVALID_HOME_PAGE' using errcode = '22023';
  end if;
  if p_content is null and coalesce(jsonb_array_length(p_categories), 0) = 0 and p_popular is null then
    raise exception 'INVALID_HOME_PAGE' using errcode = '22023';
  end if;

  if p_content is not null then
    perform public.admin_save_home_content(p_actor, p_content);
  end if;
  for c in select * from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb)) loop
    perform public.admin_save_home_category(p_actor, c->>'slot', c - 'slot');
    n_cat := n_cat + 1;
  end loop;
  if p_popular is not null then
    perform public.admin_save_home_popular(p_actor, p_popular);
  end if;

  return jsonb_build_object('content_updated', p_content is not null, 'categories_updated', n_cat, 'popular_updated', p_popular is not null);
end $$;

revoke all on function public.admin_save_home_page(uuid, jsonb, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.admin_save_home_page(uuid, jsonb, jsonb, uuid[]) to service_role;
