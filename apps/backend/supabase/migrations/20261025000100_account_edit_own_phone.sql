-- =====================================================================
-- NightOut · account — ลูกค้าแก้เบอร์โทรของตัวเอง (นอก MVP — อนุมัติ 2026-10-25)
--   - app_update_my_phone: แก้ users.phone_e164 (ลบเป็นค่าว่างไม่ได้ · ไม่มี OTP → ล้าง phone_verified_at)
--   - เบอร์ที่ถูกแบน (banned_phones) = PHONE_BANNED · บัญชีอื่นใช้อยู่ (unique) = PHONE_IN_USE
--   - การจองที่ยังไม่ถึงเวลา (PENDING / AWAITING_DEPOSIT / DEPOSIT_SUBMITTED / CONFIRMED · booking_datetime > now())
--     เปลี่ยน contact_phone เป็นเบอร์ใหม่ด้วย
-- =====================================================================
set search_path = public, extensions;

create or replace function public.app_update_my_phone(p_actor uuid, p_phone text)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users; v_phone text := nullif(btrim(p_phone), ''); v_bookings integer := 0;
begin
  u := public.app_assert_user(p_actor);
  if v_phone is null then raise exception 'CONTACT_PHONE_REQUIRED' using errcode = '22023'; end if;
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'INVALID_PHONE' using errcode = '22023'; end if;
  if exists (select 1 from public.banned_phones where phone_e164 = v_phone) then
    raise exception 'PHONE_BANNED' using errcode = '42501';
  end if;
  if exists (select 1 from public.users o where o.phone_e164 = v_phone and o.id <> p_actor) then
    raise exception 'PHONE_IN_USE' using errcode = '23505';
  end if;

  if u.phone_e164 is distinct from v_phone then
    update public.users set phone_e164 = v_phone, phone_verified_at = null where id = p_actor;
  end if;

  update public.bookings set contact_phone = v_phone
   where user_id = p_actor
     and status in ('PENDING', 'AWAITING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'CONFIRMED')
     and booking_datetime > now()
     and contact_phone is distinct from v_phone;
  get diagnostics v_bookings = row_count;

  if u.phone_e164 is distinct from v_phone or v_bookings > 0 then
    perform public.app_audit(p_actor, 'user.phone_update', 'users', p_actor,
      jsonb_build_object('from', u.phone_e164, 'to', v_phone, 'bookings_updated', v_bookings));
  end if;
  return jsonb_build_object('phone_e164', v_phone, 'bookings_updated', v_bookings);
end $$;

revoke all on function public.app_update_my_phone(uuid, text) from public, anon, authenticated;
grant execute on function public.app_update_my_phone(uuid, text) to service_role;
