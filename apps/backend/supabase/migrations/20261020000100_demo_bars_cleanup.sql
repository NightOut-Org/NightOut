-- NightOut · ล้างร้านเดโม 16 ร้าน (ชื่อสมมติจาก @nightout/mock เดิม) ออกจาก DB — เจ้าของตัดสิน 2026-10-20
-- ระบุด้วย id คงที่ของ seed เดิมเท่านั้น — ร้านที่ผู้ประกอบการ/ทีมสร้างเอง (รวมที่ owner_id เป็น null) ไม่ถูกแตะ
-- ลบการจอง / รีวิว / Table Fee / payment intent / เช็กอิน ฯลฯ ที่ทำทดสอบบนร้านเดโมด้วย (เจ้าของยืนยันว่าเป็นข้อมูลทดสอบ)
-- ตารางที่อ้างร้าน/การจองแบบไม่ cascade ไล่จาก pg_constraint (confdeltype = 'a') — ตารางที่ cascade อยู่แล้ว (bar_stats, เมนู, โซน, โต๊ะ, QR …) หายตามร้าน/การจอง
-- ไฟล์ใน Storage (รูปรีวิว / รูปร้าน) ไม่ถูกลบในไฟล์นี้

do $$
declare
  demo_ids uuid[] := array[
    '96e5917b-2acc-5f7f-b4ca-fc9a3b00f07d', '0cccc294-d9b5-501e-bf33-a900f1188f90',
    'fdbadfd4-d389-5cef-aee5-e622cc607bdf', 'f19f3694-3757-500b-a54a-71bd7bd1d616',
    'ca9df1a8-3a56-5dc6-849e-ea71be97f004', '98fd3a61-0a2d-5fea-85d3-8c305d39e6b4',
    '2c455e74-6029-52ae-b878-4df21dfc9c16', '772f1a13-43d3-520b-9812-8e9bda5a9b07',
    'e3a93acf-3717-55d8-a6b4-76d56644db42', '072a70ba-33a2-567f-b2c4-013b61da514f',
    '287feeb2-dd55-5c27-9ba4-9909a6e80247', 'bf05155c-d15b-54ae-a9b3-52b5efb784e9',
    '5746aa2f-136a-52ad-87dd-eb8ff90fb5e7', '5bcdb1a4-bb22-5884-8fb1-bc0a0266cde3',
    '26924211-46cf-50a1-8642-65323dc4c0b3', '2238849e-de7d-56f9-b430-273d0b9b82f6'
  ]::uuid[];
  booking_ids uuid[];
  intent_ids uuid[];
  deposit_ids uuid[];
begin
  select coalesce(array_agg(id), '{}') into booking_ids from public.bookings where bar_id = any (demo_ids);
  select coalesce(array_agg(id), '{}') into intent_ids
    from public.payment_intents where bar_id = any (demo_ids) or booking_id = any (booking_ids);
  select coalesce(array_agg(id), '{}') into deposit_ids
    from public.deposits where bar_id = any (demo_ids) or booking_id = any (booking_ids) or payment_intent_id = any (intent_ids);

  -- ลูกของการจอง / Table Fee
  delete from public.checkins where booking_id = any (booking_ids);
  delete from public.user_flags where booking_id = any (booking_ids) or deposit_id = any (deposit_ids);
  delete from public.safety_reports where booking_id = any (booking_ids);
  -- หลักฐานยอมรับเงื่อนไขแก้/ลบไม่ได้ตามปกติ — ปิด trigger เฉพาะตอนล้างการจองทดสอบนี้
  alter table public.booking_deposit_consents disable trigger booking_deposit_consents_immutable;
  delete from public.booking_deposit_consents where booking_id = any (booking_ids);
  alter table public.booking_deposit_consents enable trigger booking_deposit_consents_immutable;
  delete from public.bar_strikes where bar_id = any (demo_ids) or booking_id = any (booking_ids);
  delete from public.billing_events where bar_id = any (demo_ids) or booking_id = any (booking_ids);
  delete from public.deposits where id = any (deposit_ids);
  delete from public.payment_events where intent_id = any (intent_ids);
  delete from public.payment_intents where id = any (intent_ids);
  delete from public.reviews where bar_id = any (demo_ids) or booking_id = any (booking_ids);
  delete from public.bookings where id = any (booking_ids);

  -- ตารางของร้านที่ไม่ cascade
  delete from public.promoted_listings where bar_id = any (demo_ids);
  delete from public.bar_payouts where bar_id = any (demo_ids);
  delete from public.bar_credit_ledger where bar_id = any (demo_ids);
  delete from public.invoices where bar_id = any (demo_ids);
  delete from public.commission_rules where bar_id = any (demo_ids);

  delete from public.bars where id = any (demo_ids);
end $$;
