-- booking_customer_name: เดิมทีมร้านส่ง p_bar ของร้านตัวเองคู่กับ p_user ของใครก็ได้ → อ่านชื่อที่แสดงของผู้ใช้ทุกคนได้ (IDOR)
-- ตอนนี้ต้องมีการจองของ p_user ที่ร้าน p_bar จริงก่อน · ผู้เรียกยังต้องเป็นเจ้าของการจองหรือทีมร้านเหมือนเดิม
-- ใช้ใน view booking_detail เท่านั้น (ส่ง bk.user_id, bk.bar_id ของการจองจริง → ผลเหมือนเดิม)
-- การจองหาด้วย index bookings_user (user_id, booking_datetime desc)
create or replace function public.booking_customer_name(p_user uuid, p_bar uuid) returns text
language sql stable security definer set search_path = '' as $$
  select u.display_name from public.users u
  where u.id = p_user
    and exists (select 1 from public.bookings bk where bk.user_id = p_user and bk.bar_id = p_bar)
    and (p_user = (select auth.uid()) or public.is_bar_member(p_bar))
$$;

-- anon ไม่ต้องใช้ (view booking_detail อ่านได้เฉพาะคนที่ล็อกอิน)
revoke all on function public.booking_customer_name(uuid, uuid) from public, anon;
grant execute on function public.booking_customer_name(uuid, uuid) to authenticated, service_role;
