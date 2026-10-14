-- =====================================================================
-- booking · ยอดขายเฉลี่ย (ประมาณการ) ของร้าน — /merchant/analytics (GET /merchant/bars/:barId/sales-stats)
--   bar_sales_stats(p_bar, p_days) = ตัวเลขของ p_days วันล่าสุด (นับการจองตาม booking_datetime)
--   เทียบกับช่วงก่อนหน้าที่ยาวเท่ากัน · คำนวณจากข้อมูลที่ NightOut มีเท่านั้น 2 แหล่ง:
--   1) Table Fee ที่ร้านได้ = แถว deposits ที่ VERIFIED และ settlement ไปทางร้าน (PAYOUT_PENDING / PAID_OUT / CREDIT)
--      ทั้งโอน + สลิปเดิม และชำระออนไลน์ (payment_intents → deposits VERIFIED) อยู่ใน deposits
--      ไม่นับ HELD (ยังไม่จบ) / REFUND_PENDING / REFUNDED (คืนลูกค้า) · การจองที่ไม่มีแถว VERIFIED = ไม่ได้จ่าย = 0
--   2) ยอดใช้จ่ายโดยประมาณ ของการจองที่เช็กอินแล้ว (CHECKED_IN / COMPLETED)
--      = booking_price_snapshots.estimated_total (ถ้ามี) หรือ bar_stats.avg_price_per_person × จำนวนคน
--   ไม่ใช่ยอดบิลจริงของร้าน (NightOut ไม่ขายอาหาร/เครื่องดื่ม — ราคาแสดงเพื่อประเมินงบเท่านั้น)
--   เจ้าของ/ผู้จัดการเท่านั้น (is_bar_manager) — Staff/PR ห้ามเห็นยอดเงินรวม → NOT_BAR_MANAGER (42501)
--   ไฟล์นี้สร้างของใหม่เท่านั้น — ไม่มีตารางใหม่ ไม่แก้ฟังก์ชัน/วิวเดิม
--   (ใช้ index เดิม: bookings_bar_night · deposits_one_active · booking_price_snapshots.booking_id unique)
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1) ตัวช่วยภายใน — ตัวเลขของ 1 ช่วง [p_from, p_to) · ไม่เช็กสิทธิ์ → ไม่ grant ให้ผู้ใช้
--    เรียกผ่าน bar_sales_stats (security definer) เท่านั้น
-- ---------------------------------------------------------------------
create or replace function public.bar_sales_period(p_bar uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable set search_path = '' as $$
  with w as (
    select bk.id, bk.status, bk.pax
    from public.bookings bk
    where bk.bar_id = p_bar and bk.booking_datetime >= p_from and bk.booking_datetime < p_to
  ),
  fee as (
    -- Table Fee ที่ร้านได้ = แถว deposits ที่ VERIFIED (สลิป หรือชำระออนไลน์ — ทั้งคู่อยู่ใน deposits) และเงินไปทางร้าน
    -- deposits_one_active (unique booking_id where SUBMITTED/VERIFIED) → join ได้ไม่เกิน 1 แถวต่อการจอง
    select coalesce(d.amount, 0) as kept
    from w
    left join public.deposits d
      on d.booking_id = w.id and d.status = 'VERIFIED'
     and d.settlement in ('PAYOUT_PENDING', 'PAID_OUT', 'CREDIT')
  ),
  came as (
    -- ยอดใช้จ่ายโดยประมาณ ของการจองที่เช็กอินแล้ว — snapshot ตอนจอง (ถ้ามี) หรือราคาต่อคนโดยประมาณของร้าน × จำนวนคน
    select w.pax, coalesce(ps.estimated_total, round(st.avg_price_per_person * w.pax, 2)) as est
    from w
    left join public.booking_price_snapshots ps on ps.booking_id = w.id
    left join public.bar_stats st on st.bar_id = p_bar
    where w.status in ('CHECKED_IN', 'COMPLETED')
  )
  select jsonb_build_object(
    'table_fee_total',       (select coalesce(sum(f.kept), 0) from fee f),
    'table_fee_bookings',    (select count(*) from fee f where f.kept > 0),
    'table_fee_avg',         (select round(avg(f.kept), 2) from fee f where f.kept > 0),
    'checked_in_bookings',   (select count(*) from came),
    'checked_in_pax',        (select coalesce(sum(c.pax), 0) from came c),
    'estimated_bookings',    (select count(*) from came c where c.est is not null),
    'est_spend_total',       (select coalesce(sum(c.est), 0) from came c where c.est is not null),
    'est_spend_per_booking', (select round(avg(c.est), 2) from came c where c.est is not null),
    'est_spend_per_person',  (select round(sum(c.est) / nullif(sum(c.pax), 0), 2) from came c where c.est is not null))
$$;

-- ---------------------------------------------------------------------
-- 2) อ่าน — ช่วงปัจจุบัน (p_days วันล่าสุดจนถึงตอนนี้) + ช่วงก่อนหน้าที่ยาวเท่ากัน
--    security definer → เช็กสิทธิ์ในตัว: เจ้าของ/ผู้จัดการที่ตอบรับแล้วเท่านั้น
-- ---------------------------------------------------------------------
create or replace function public.bar_sales_stats(p_bar uuid, p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_now  timestamptz := now();
  v_span interval;
begin
  if not public.is_bar_manager(p_bar) then
    raise exception 'NOT_BAR_MANAGER' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 366 then
    raise exception 'INVALID_STATS_RANGE' using errcode = '22023';
  end if;
  v_span := make_interval(days => p_days);
  return jsonb_build_object(
    'days', p_days,
    'generated_at', v_now,
    'current',  public.bar_sales_period(p_bar, v_now - v_span, v_now),
    'previous', public.bar_sales_period(p_bar, v_now - 2 * v_span, v_now - v_span));
end $$;

revoke all on function public.bar_sales_period(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.bar_sales_period(uuid, timestamptz, timestamptz) to service_role;
revoke all on function public.bar_sales_stats(uuid, integer) from public, anon;
grant execute on function public.bar_sales_stats(uuid, integer) to authenticated, service_role;
