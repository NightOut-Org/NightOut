-- =====================================================================
-- bar · บันทึกหน้า /merchant/settings ในคำขอเดียว (CLAUDE.md "ฟอร์ม · การบันทึก")
--   p_settings = field ที่แก้ของตั้งค่าการจอง/มัดจำ/PR (null = ไม่แตะ) → app_update_booking_settings (เจ้าของ/ผู้จัดการ)
--   p_payout   = { bank_code, account_name, account_no_enc, last4 } (null = ไม่แตะ · NestJS เข้ารหัสเลขบัญชีแล้ว) → app_set_payout_account (เจ้าของเท่านั้น)
-- ธุรกรรมเดียว — ผู้จัดการแก้บัญชีรับเงิน = ไม่บันทึกทั้งคู่
-- =====================================================================
create or replace function public.app_save_settings_page(p_actor uuid, p_bar uuid, p_settings jsonb, p_payout jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare r jsonb := null;
begin
  perform public.app_assert_user(p_actor);
  perform public.app_assert_manager(p_actor, p_bar);
  if p_settings is null and p_payout is null then
    raise exception 'INVALID_SETTINGS_PAGE' using errcode = '22023';
  end if;
  if p_settings is not null then
    perform public.app_update_booking_settings(p_actor, p_bar, p_settings);
  end if;
  if p_payout is not null then
    r := public.app_set_payout_account(p_actor, p_bar, p_payout->>'bank_code', p_payout->>'account_name',
                                       p_payout->>'account_no_enc', p_payout->>'last4');
  end if;
  return jsonb_build_object(
    'bar_id', p_bar,
    'settings_updated', p_settings is not null,
    'account_no_last4', r->>'account_no_last4');
end $$;

revoke all on function public.app_save_settings_page(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.app_save_settings_page(uuid, uuid, jsonb, jsonb) to service_role;
