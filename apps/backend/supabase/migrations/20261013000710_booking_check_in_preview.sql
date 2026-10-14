-- =====================================================================
-- booking · ดูการจองก่อนยืนยันเช็กอิน (หน้า /merchant/tonight: สแกน QR / พิมพ์รหัส → ตรวจ → กดยืนยัน)
--   bar_check_in_preview(p_bar, p_code) — ทีมร้านทุกบทบาท (รวม STAFF) · ไม่เปลี่ยนสถานะ · อ่านอย่างเดียว
--     หาการจองแบบเดียวกับ app_check_in: รหัส NL-XXXXXX หรือข้อความจาก QR NIGHTOUT:<booking id>
--     คืนชื่อลูกค้า / จำนวนคน / โซน / โต๊ะ / เวลา / โปร / หมายเหตุ + กดเช็กอินได้ไหม ณ เวลา server
--     block_reason ตรงกับ trigger bookings_check_in_window (…20261013000500): ตั้งแต่ 3 ชม. ก่อนเวลาจอง ถึง auto_cancel_at
--     ไม่มียอดเงิน (deposit_required / Table Fee) และไม่มีเบอร์โทร — Staff/PR ห้ามเห็นยอดเงินของร้าน
-- =====================================================================
set search_path = public, extensions;

create or replace function public.bar_check_in_preview(p_bar uuid, p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v text := upper(btrim(coalesce(p_code, '')));
  bk public.bookings; v_block text;
begin
  if not public.is_bar_member(p_bar) then raise exception 'NOT_BAR_MEMBER' using errcode = '42501'; end if;
  select * into bk from public.bookings
   where bar_id = p_bar
     and (code = v or (v like 'NIGHTOUT:%' and id::text = lower(substr(v, 10))));
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;

  v_block := case
    when bk.status in ('CHECKED_IN', 'COMPLETED')            then 'ALREADY_CHECKED_IN'
    when bk.status <> 'CONFIRMED'                            then 'NOT_CONFIRMED'
    when now() < bk.booking_datetime - interval '3 hours'    then 'TOO_EARLY'
    when now() > bk.auto_cancel_at                           then 'TOO_LATE'
    else null end;

  return jsonb_build_object(
    'id', bk.id,
    'code', bk.code,
    'status', bk.status,
    'booking_datetime', bk.booking_datetime,
    'auto_cancel_at', bk.auto_cancel_at,
    'extended_at', bk.extended_at,
    'pax', bk.pax,
    'zone_name', (select z.name from public.table_zones z where z.id = bk.zone_id),
    'table_name', (select t.name from public.tables t where t.id = bk.table_id),
    'customer_name', (select u.display_name from public.users u where u.id = bk.user_id),
    'promotion_title', (select bp.title_snapshot from public.booking_promotions bp where bp.booking_id = bk.id),
    'customer_note', bk.customer_note,
    'checked_in_at', bk.checked_in_at,
    'check_in_opens_at', bk.booking_datetime - interval '3 hours',
    'is_today', (bk.booking_datetime at time zone 'Asia/Bangkok')::date = (now() at time zone 'Asia/Bangkok')::date,
    'can_check_in', v_block is null,
    'block_reason', v_block,
    'server_now', now());
end $$;

revoke all on function public.bar_check_in_preview(uuid, text) from public, anon;
grant execute on function public.bar_check_in_preview(uuid, text) to authenticated, service_role;
