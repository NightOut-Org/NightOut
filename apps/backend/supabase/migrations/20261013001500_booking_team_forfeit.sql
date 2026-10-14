-- =====================================================================
-- booking · ทีมร้านกด "ปลดโต๊ะ (Forfeited)" เอง (คอมเมนต์ #76 · เจ้าของอนุมัติ 2026-10-14)
--   - ทีมร้านทุกบทบาท (OWNER / MANAGER / STAFF / PR …) กดได้ เฉพาะเมื่อเลยเวลาเก็บโต๊ะ (auto_cancel_at) แล้ว
--     (ลูกค้ากด "ขอต่อเวลา 15 นาที" → auto_cancel_at เลื่อนตาม · ก่อนเวลานั้นกดไม่ได้)
--   - ผลเหมือน job run_booking_timeouts ทุกอย่าง: CONFIRMED → NO_SHOW แล้ว trigger handle_booking_status_effects
--     ส่ง Table Fee ให้ร้าน (deposits HELD → PAYOUT_PENDING) + billing_events NO_SHOW + แจ้งลูกค้า / ทีมร้าน / แอดมิน
--   - ประวัติสถานะ: changed_by = คนกด · reason = 'team forfeit' · audit 'booking.forfeit'
--   - booking_transition_allowed อนุญาต CONFIRMED → NO_SHOW อยู่แล้ว (…20261013001100) ไม่ต้องแก้
-- =====================================================================
set search_path = public, extensions;

create or replace function public.app_team_forfeit_booking(p_actor uuid, p_booking uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare bk public.bookings; v_role public.bar_staff_role;
begin
  perform public.app_assert_user(p_actor);   -- ตั้ง app.user_id → booking_status_history.changed_by = คนกด
  select * into bk from public.bookings where id = p_booking for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  v_role := public.app_team_role(p_actor, bk.bar_id);   -- ทุกบทบาท (รวม STAFF) · ไม่ใช่ทีมร้าน = NOT_BAR_MEMBER
  if bk.status <> 'CONFIRMED' then raise exception 'BOOKING_NOT_CONFIRMED' using errcode = 'P0001'; end if;
  if bk.auto_cancel_at is null or now() < bk.auto_cancel_at then
    raise exception 'BOOKING_NOT_OVERDUE' using errcode = 'P0001';
  end if;

  perform set_config('app.user_id', p_actor::text, true);
  perform set_config('app.reason', 'team forfeit', true);
  update public.bookings set status = 'NO_SHOW' where id = bk.id;   -- trigger: ส่ง Table Fee ให้ร้าน + แจ้งเตือนทุกฝ่าย

  perform public.app_audit(p_actor, 'booking.forfeit', 'bookings', bk.id, jsonb_build_object(
    'bar_id', bk.bar_id, 'code', bk.code, 'role', v_role, 'from', bk.status, 'to', 'NO_SHOW',
    'auto_cancel_at', bk.auto_cancel_at, 'booking_datetime', bk.booking_datetime));
  return jsonb_build_object('id', bk.id, 'status', 'NO_SHOW');
end $$;

revoke all on function public.app_team_forfeit_booking(uuid, uuid) from public, anon, authenticated;
grant execute on function public.app_team_forfeit_booking(uuid, uuid) to service_role;
