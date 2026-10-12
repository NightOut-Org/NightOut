-- =====================================================================
-- bar · บันทึกหน้า /merchant/promotions ในคำขอเดียว (CLAUDE.md "ฟอร์ม · การบันทึก")
--   p_items = โปรทั้งชุด (null = ไม่แตะ) → app_set_bar_promotions (โปรใหม่/แก้ข้อความ → รอแอดมินตรวจ)
--   p_fees  = { service_charge, vat, other } (null = ไม่แตะ) → app_set_fees
-- ธุรกรรมเดียว — พลาดส่วนไหน = ไม่บันทึกทั้งคู่
-- =====================================================================
create or replace function public.app_save_promotions_page(p_actor uuid, p_bar uuid, p_items jsonb, p_fees jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare r jsonb := null;
begin
  perform public.app_assert_user(p_actor);
  perform public.app_assert_manager(p_actor, p_bar);
  if p_items is null and p_fees is null then
    raise exception 'INVALID_PROMOTIONS_PAGE' using errcode = '22023';
  end if;
  if p_items is not null then
    r := public.app_set_bar_promotions(p_actor, p_bar, p_items);
  end if;
  if p_fees is not null then
    if jsonb_typeof(p_fees) <> 'object' then raise exception 'INVALID_FEES' using errcode = '22023'; end if;
    perform public.app_set_fees(p_actor, p_bar, (p_fees->>'service_charge')::numeric, (p_fees->>'vat')::numeric, (p_fees->>'other')::numeric);
  end if;
  return jsonb_build_object(
    'bar_id', p_bar,
    'count', coalesce((r->>'count')::integer, 0),
    'pending', coalesce((r->>'pending')::integer, 0),
    'fees_updated', p_fees is not null);
end $$;

revoke all on function public.app_save_promotions_page(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.app_save_promotions_page(uuid, uuid, jsonb, jsonb) to service_role;
