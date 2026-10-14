-- =====================================================================
-- bar · ร้านรับจองแล้วไม่มีโต๊ะให้ลูกค้า (strike) + Blacklist ร้าน (เจ้าของอนุมัติ 2026-10-13)
--   - ทุกครั้งที่ร้านไม่มีโต๊ะให้ลูกค้า → บันทึก 1 ครั้งใน bar_strikes (1 การจอง = 1 ครั้ง · แก้/ลบไม่ได้) + แจ้งแอดมินและทีมร้าน
--       ทีมร้าน (ทุกบทบาท): app_team_report_no_table — เลือกเหตุ "ร้านไม่มีโต๊ะให้ลูกค้า" ตอนยกเลิก/คืน Table Fee
--         CONFIRMED / CHECKED_IN → คืน Table Fee เต็มจำนวน (app_team_refund_deposit) · ยกเลิกฝั่งร้านถ้ายังไม่เช็กอิน
--         CONFIRMED ที่ไม่มี Table Fee ให้คืน = ยกเลิกอย่างเดียว (STAFF ทำไม่ได้ เหมือน app_team_set_booking_status)
--       แอดมิน (ข้อร้องเรียนลูกค้า · Dispute & Refund Management): admin_report_no_table — บันทึกแทนร้าน
--         Override คืน Table Fee (HELD / PAYOUT_PENDING → REFUND_PENDING) · CONFIRMED / CHECKED_IN / COMPLETED / NO_SHOW
--   - แอดมินตัดสินใจ Blacklist เอง: admin_blacklist_bar / admin_unblacklist_bar (เหตุผลบังคับ · audit · แจ้งทีมร้าน)
--       Blacklist = status SUSPENDED + bars.blacklisted_at → ทุกทางอ่านของหน้าบ้านกรอง APPROVED อยู่แล้ว
--       (bar_is_public · policy bars_read · bar_cards · bar_detail · app_create_booking_core → BAR_NOT_FOUND)
--       การจองเดิมไม่ถูกยกเลิก · ระหว่างติด Blacklist เปลี่ยน status / status_reason ทางอื่นไม่ได้ (BAR_BLACKLISTED)
--       NightOut ปรับเงินร้านไม่ได้ — ประวัติ Blacklist / ปลด อยู่ใน audit_logs (bar.blacklist / bar.unblacklist)
--   - แทนที่: handle_bar_status_notify (trigger bars_status_notify) — ไม่ส่งข้อความซ้ำตอน Blacklist / ปลด
--   - trigger ใหม่: bars_blacklist_guard · bars_owner_blacklist_notify (เจ้าของร้านที่ติด Blacklist สมัครร้านใหม่ → แจ้งแอดมิน)
--   - view: admin_bar_blacklist (Backoffice /bar-blacklist)
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. bars — สถานะ Blacklist ปัจจุบัน (ประวัติอยู่ใน audit_logs)
-- ---------------------------------------------------------------------
alter table public.bars
  add column if not exists blacklisted_at   timestamptz,
  add column if not exists blacklisted_by   uuid references public.users(id) on delete set null,
  add column if not exists blacklist_reason text check (blacklist_reason is null or char_length(blacklist_reason) between 3 and 500);
alter table public.bars add constraint bars_blacklist_suspended check (blacklisted_at is null or status = 'SUSPENDED');
create index if not exists bars_blacklisted_by on public.bars (blacklisted_by) where blacklisted_by is not null;

-- ---------------------------------------------------------------------
-- 2. bar_strikes — ร้านไม่มีโต๊ะให้ลูกค้า (1 การจอง = 1 แถว · หลักฐาน ไม่ cascade)
-- ---------------------------------------------------------------------
create table public.bar_strikes (
  id          uuid primary key default gen_random_uuid(),
  bar_id      uuid not null references public.bars(id),
  booking_id  uuid not null unique references public.bookings(id),
  kind        text not null default 'NO_TABLE' check (kind in ('NO_TABLE')),
  source      text not null default 'TEAM' check (source in ('TEAM', 'ADMIN')),  -- TEAM = ทีมร้านเลือกเหตุเอง · ADMIN = แอดมินบันทึกจากข้อร้องเรียน
  note        text check (note is null or char_length(note) <= 300),
  reported_by uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index bar_strikes_bar_created on public.bar_strikes (bar_id, created_at desc);
create index bar_strikes_reported_by on public.bar_strikes (reported_by);

alter table public.bar_strikes enable row level security;
-- …001600 สร้าง admin_read ให้ตารางที่มีตอนนั้นเท่านั้น — ตารางใหม่ต้องเพิ่มเอง · ร้านไม่มีทางอ่านตรง (รู้ผ่านแจ้งเตือน)
create policy admin_read on public.bar_strikes for select to authenticated using (public.is_admin());
revoke all on public.bar_strikes from anon;
revoke insert, update, delete, truncate on public.bar_strikes from authenticated;
grant select on public.bar_strikes to authenticated;   -- view admin_bar_blacklist (security_invoker) อ่าน · RLS จำกัดเฉพาะแอดมิน

-- ---------------------------------------------------------------------
-- 3. กัน: ระหว่างติด Blacklist ห้ามเปลี่ยน status / status_reason ทางอื่น
--    (/bars สวิตช์แสดง ↔ ระงับ · PATCH /admin/bars/:id/status · อนุมัติที่ /merchants · ร้านส่งตรวจใหม่)
--    admin_set_bar_status เขียน status_reason แม้ status ไม่เปลี่ยน → ต้องกันทั้ง 2 คอลัมน์
--    ปลด Blacklist ล้าง blacklisted_at ใน UPDATE เดียวกัน → ผ่าน · ตอน Blacklist old.blacklisted_at ว่าง → trigger ไม่ทำงาน
-- ---------------------------------------------------------------------
create or replace function public.bars_blacklist_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.blacklisted_at is not null
     and (new.status is distinct from old.status or new.status_reason is distinct from old.status_reason) then
    raise exception 'BAR_BLACKLISTED' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger bars_blacklist_guard before update of status, status_reason on public.bars
  for each row when (old.blacklisted_at is not null) execute function public.bars_blacklist_guard();

-- ---------------------------------------------------------------------
-- 3b. แจ้งทีมร้านเมื่อสถานะร้านเปลี่ยน (นิยามเดิม …001700 ทุกบรรทัด)
--     + Blacklist / ปลด Blacklist ส่งข้อความของตัวเอง → ไม่ส่ง "ร้านของคุณถูกระงับชั่วคราว" / "เปิดแสดงแล้ว" ซ้ำ
--     trigger bars_status_notify เดิมใช้ต่อ
-- ---------------------------------------------------------------------
create or replace function public.handle_bar_status_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Blacklist / ปลด Blacklist ส่งข้อความของตัวเอง (admin_blacklist_bar / admin_unblacklist_bar) — ไม่ส่งซ้ำ
  if new.blacklisted_at is distinct from old.blacklisted_at then return new; end if;
  perform public.app_notify_team(new.id, 'BAR_' || new.status,
    case new.status when 'APPROVED' then 'ร้านของคุณเปิดแสดงบน NightOut แล้ว'
                    when 'REJECTED' then 'ร้านของคุณยังไม่ผ่านการตรวจ'
                    when 'SUSPENDED' then 'ร้านของคุณถูกระงับชั่วคราว'
                    else 'สถานะร้านเปลี่ยนเป็น ' || new.status end,
    new.name || coalesce(' · ' || new.status_reason, ''), '/merchant');
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3c. เจ้าของร้านที่ติด Blacklist สมัครร้านใหม่ (app_merchant_join ยอมให้) → แจ้งแอดมินให้ตรวจก่อนอนุมัติ
--     (เจ้าของ = bars.owner_id หรือ OWNER ในทีมร้านที่ยังไม่ถูกถอด)
-- ---------------------------------------------------------------------
create or replace function public.bars_owner_blacklist_notify() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  if new.owner_id is null then return new; end if;
  select string_agg(b.name, ', ' order by b.blacklisted_at) into v_old
    from public.bars b
   where b.id <> new.id and b.blacklisted_at is not null
     and (b.owner_id = new.owner_id
          or exists (select 1 from public.bar_staff s
                      where s.bar_id = b.id and s.user_id = new.owner_id and s.role = 'OWNER' and s.revoked_at is null));
  if v_old is not null then
    perform public.app_notify_admins('BAR_APPLICATION_BLACKLISTED_OWNER', 'ร้านสมัครใหม่ — เจ้าของเคยมีร้านติด Blacklist',
      new.name || ' · ร้านเดิมที่ติด Blacklist: ' || v_old || ' · ตรวจก่อนอนุมัติ', '/merchants', null, new.id);
  end if;
  return new;
end $$;
create trigger bars_owner_blacklist_notify after insert on public.bars
  for each row execute function public.bars_owner_blacklist_notify();

-- ---------------------------------------------------------------------
-- 4. ทีมร้าน (ทุกบทบาท): แจ้งร้านไม่มีโต๊ะให้ลูกค้า → คืน Table Fee / ยกเลิก + บันทึกประวัติร้าน
--    deposits.refund_reason ≤ 300 ตัวอักษร (app_team_refund_deposit เก็บตามที่ได้) → ตัดเหตุผลที่ 300
-- ---------------------------------------------------------------------
create or replace function public.app_team_report_no_table(p_actor uuid, p_booking uuid, p_note text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_note text := left(nullif(btrim(p_note), ''), 300);
  bk public.bookings; v_role public.bar_staff_role; v_reason text; v_refund jsonb; v_n integer; v_bar text;
begin
  perform public.app_assert_user(p_actor);
  select * into bk from public.bookings where id = p_booking for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  v_role := public.app_team_role(p_actor, bk.bar_id);   -- NOT_BAR_MEMBER · ทุกบทบาทคืน Table Fee ได้
  -- เช็กก่อนสถานะ: แจ้งแล้วการจองถูกยกเลิก → กดซ้ำได้ข้อความ "แจ้งไปแล้ว" (ไม่ใช่ "สถานะไม่ถูกต้อง")
  if exists (select 1 from public.bar_strikes where booking_id = bk.id) then
    raise exception 'NO_TABLE_ALREADY_REPORTED' using errcode = 'P0001';
  end if;
  -- PENDING = ร้านยังไม่รับ → กด "ปฏิเสธ" แทน
  if bk.status not in ('CONFIRMED', 'CHECKED_IN') then
    raise exception 'NO_TABLE_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  v_reason := left('ร้านไม่มีโต๊ะให้ลูกค้า' || coalesce(' — ' || v_note, ''), 300);

  if bk.status = 'CHECKED_IN'
     or exists (select 1 from public.deposits
                 where booking_id = bk.id and status = 'VERIFIED' and settlement in ('HELD', 'PAYOUT_PENDING')) then
    -- คืน Table Fee เต็มจำนวน (CONFIRMED → CANCELLED_BY_MERCHANT ในตัว · แจ้งลูกค้า + แอดมิน)
    -- CHECKED_IN ที่ไม่มี Table Fee ให้คืน → NO_REFUNDABLE_DEPOSIT / REFUND_ALREADY_REQUESTED (ทั้งหมดย้อนกลับ ไม่บันทึก)
    v_refund := public.app_team_refund_deposit(p_actor, bk.id, v_reason);
  else
    -- CONFIRMED ที่ไม่มี Table Fee ให้คืน = ยกเลิกอย่างเดียว (STAFF ยกเลิกไม่ได้ เหมือน app_team_set_booking_status)
    if v_role = 'STAFF' then raise exception 'NOT_BAR_MANAGER' using errcode = '42501'; end if;
    perform set_config('app.reason', v_reason, true);
    update public.bookings set status = 'CANCELLED_BY_MERCHANT', cancel_reason = v_reason where id = bk.id;
  end if;

  insert into public.bar_strikes (bar_id, booking_id, kind, source, note, reported_by)
  values (bk.bar_id, bk.id, 'NO_TABLE', 'TEAM', v_note, p_actor);
  select count(*)::integer into v_n from public.bar_strikes
   where bar_id = bk.bar_id and created_at > now() - interval '90 days';
  select name into v_bar from public.bars where id = bk.bar_id;

  perform public.app_audit(p_actor, 'bar.strike.no_table', 'bookings', bk.id, jsonb_build_object(
    'bar_id', bk.bar_id, 'booking_status', bk.status, 'note', v_note,
    'refund_amount', v_refund->'amount', 'strikes_90d', v_n));
  perform public.app_notify_admins('BAR_NO_TABLE', 'ร้านไม่มีโต๊ะให้ลูกค้า · ' || v_bar,
    bk.code || ' · นัด ' || public.app_fmt(bk.booking_datetime) || ' · ครั้งที่ ' || v_n || ' ใน 90 วัน'
      || coalesce(' · ' || v_note, ''),
    '/bar-blacklist?bar=' || bk.bar_id, bk.id, bk.bar_id);
  perform public.app_notify_team(bk.bar_id, 'BAR_NO_TABLE',
    'บันทึกประวัติร้าน: ไม่มีโต๊ะให้ลูกค้า (ครั้งที่ ' || v_n || ' ใน 90 วัน)',
    bk.code || case when v_refund is null then ' · ยกเลิกการจองแล้ว' else ' · คืน Table Fee ให้ลูกค้าเต็มจำนวน' end
      || ' · ร้านที่ไม่มีโต๊ะให้ลูกค้าซ้ำอาจถูกระงับการแสดง (Blacklist)',
    '/merchant/bookings/' || bk.id, bk.id);

  return jsonb_build_object('booking_id', bk.id,
                            'booking_status', (select status from public.bookings where id = bk.id),
                            'refund_amount', (v_refund->>'amount')::numeric,
                            'strikes_90d', v_n);
end $$;

-- ---------------------------------------------------------------------
-- 4b. แอดมิน: ลูกค้าร้องเรียนว่าร้านไม่มีโต๊ะ → บันทึกแทนร้าน + Override คืน Table Fee
--     ยังไม่เช็กอิน (CONFIRMED) → ยกเลิกฝั่งร้าน · สถานะอื่นคงเดิม (booking_transition_allowed ไม่มีทางออก)
--     ร้านยกเลิก/คืนเงินไปแล้วด้วยเหตุผลอื่น (CANCELLED_BY_MERCHANT — เลี่ยงประวัติ) → ยังบันทึกได้ · Override เหตุผลคืนเงิน
--     ไม่มี Table Fee ที่คืนผ่านระบบได้ (เช่น โอนให้ร้านแล้ว) → ยังบันทึกประวัติ · แอดมินจัดการเงินนอกระบบ
-- ---------------------------------------------------------------------
create or replace function public.admin_report_no_table(p_actor uuid, p_code text, p_note text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_note text := nullif(btrim(p_note), '');
  bk public.bookings; d public.deposits; v_reason text; v_from public.deposit_settlement;
  v_amount numeric; v_n integer; v_bar text; v_status public.booking_status;
begin
  perform public.admin_assert(p_actor);   -- ตั้ง app.user_id → booking_status_history.changed_by = แอดมิน
  if v_note is null or char_length(v_note) < 3 or char_length(v_note) > 300 then
    raise exception 'NO_TABLE_NOTE_REQUIRED' using errcode = '22023';
  end if;
  select * into bk from public.bookings where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  -- เช็กก่อนสถานะ: ร้านแจ้งเองไปแล้ว (การจองถูกยกเลิก) → "แจ้งไปแล้ว"
  if exists (select 1 from public.bar_strikes where booking_id = bk.id) then
    raise exception 'NO_TABLE_ALREADY_REPORTED' using errcode = 'P0001';
  end if;
  -- NO_SHOW ตั้งใจรวม: "มาแล้วแต่ไม่มีโต๊ะ แล้วโดนปลดโต๊ะ" คือข้อร้องเรียนที่พบบ่อย
  -- CANCELLED_BY_MERCHANT ตั้งใจรวม: ร้านเลือกเหตุผลอื่นตอนยกเลิก/คืนเงินเพื่อเลี่ยงประวัติ (สถานะคงเดิม)
  if bk.status not in ('CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW', 'CANCELLED_BY_MERCHANT') then
    raise exception 'NO_TABLE_ADMIN_NOT_ALLOWED' using errcode = 'P0001';
  end if;
  v_reason := left('ร้านไม่มีโต๊ะให้ลูกค้า (NightOut ตรวจข้อร้องเรียน) — ' || v_note, 300);
  -- สถานะเงินก่อนเปลี่ยน (ลง audit)
  select settlement into v_from from public.deposits where booking_id = bk.id order by created_at desc limit 1;

  if bk.status = 'CONFIRMED' then
    -- handle_booking_status_effects: HELD → REFUND_PENDING + แจ้งลูกค้า "ร้านยกเลิกการจอง"
    perform set_config('app.reason', v_reason, true);
    update public.bookings set status = 'CANCELLED_BY_MERCHANT', cancel_reason = v_reason where id = bk.id;
  end if;

  -- Override คืน Table Fee
  select * into d from public.deposits
   where booking_id = bk.id and status = 'VERIFIED' and settlement in ('HELD', 'PAYOUT_PENDING', 'REFUND_PENDING')
   order by created_at desc limit 1
   for update;
  if found then
    update public.deposits
       set settlement = 'REFUND_PENDING',
           settled_at = coalesce(case when d.settlement = 'REFUND_PENDING' then d.settled_at end, now()),
           refund_reason = v_reason, refund_requested_by = p_actor, refund_requested_at = now()
     where id = d.id;
    v_amount := d.amount;
  end if;

  insert into public.bar_strikes (bar_id, booking_id, kind, source, note, reported_by)
  values (bk.bar_id, bk.id, 'NO_TABLE', 'ADMIN', v_note, p_actor);
  select count(*)::integer into v_n from public.bar_strikes
   where bar_id = bk.bar_id and created_at > now() - interval '90 days';
  select name into v_bar from public.bars where id = bk.bar_id;
  select status into v_status from public.bookings where id = bk.id;

  perform public.admin_audit(p_actor, 'bar.strike.no_table', 'bookings', bk.id,
    jsonb_build_object('booking_status', bk.status, 'settlement', v_from),
    jsonb_build_object('bar_id', bk.bar_id, 'source', 'ADMIN', 'booking_status', v_status, 'note', v_note,
                       'refund_amount', v_amount, 'strikes_90d', v_n));
  if v_amount is not null then
    perform public.app_notify(bk.user_id, 'DEPOSIT_REFUND_APPROVED', 'NightOut ตรวจข้อร้องเรียนแล้ว — คืน Table Fee ให้คุณเต็มจำนวน',
      v_bar || ' · ' || bk.code || ' · ' || v_amount || ' บาท · NightOut จะโอนคืนให้เร็วที่สุด',
      '/bookings/' || bk.id, bk.id, bk.bar_id);
  end if;
  -- ไม่แจ้งแอดมิน: ผู้ทำคือแอดมิน · แถวขึ้นที่ /bar-blacklist และ /deposits "รอคืนลูกค้า"
  perform public.app_notify_team(bk.bar_id, 'BAR_NO_TABLE',
    'NightOut บันทึกประวัติร้าน: ไม่มีโต๊ะให้ลูกค้า (ครั้งที่ ' || v_n || ' ใน 90 วัน)',
    bk.code || ' · จากข้อร้องเรียนของลูกค้า: ' || v_note
      || case when v_amount is null then '' else ' · คืน Table Fee ให้ลูกค้าเต็มจำนวน' end,
    '/merchant/bookings/' || bk.id, bk.id);

  return jsonb_build_object('booking_id', bk.id, 'booking_code', bk.code, 'booking_status', v_status,
                            'refund_amount', v_amount, 'strikes_90d', v_n);
end $$;

-- ---------------------------------------------------------------------
-- 5. แอดมิน: Blacklist ร้าน (แสดง / ระงับ → SUSPENDED + blacklisted_at) · การจองเดิมยังอยู่
-- ---------------------------------------------------------------------
create or replace function public.admin_blacklist_bar(p_actor uuid, p_bar uuid, p_reason text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_reason text := nullif(btrim(p_reason), '');
  b public.bars; v_strikes integer; v_upcoming integer; v_at timestamptz;
begin
  perform public.admin_assert(p_actor);
  if v_reason is null or char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'BLACKLIST_REASON_REQUIRED' using errcode = '22023';
  end if;
  select * into b from public.bars where id = p_bar for update;
  if not found then raise exception 'BAR_NOT_FOUND' using errcode = 'P0002'; end if;
  if b.blacklisted_at is not null then raise exception 'BAR_ALREADY_BLACKLISTED' using errcode = 'P0001'; end if;
  if b.status not in ('APPROVED', 'SUSPENDED') then raise exception 'BAR_NOT_BLACKLISTABLE' using errcode = 'P0001'; end if;

  select count(*)::integer into v_strikes from public.bar_strikes where bar_id = p_bar;
  select count(*)::integer into v_upcoming from public.bookings
   where bar_id = p_bar and booking_datetime > now()
     and status in ('PENDING', 'AWAITING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'CONFIRMED');

  -- handle_bar_status_notify ข้าม (blacklisted_at เปลี่ยน) → แจ้งทีมร้านครั้งเดียวด้านล่าง
  update public.bars
     set status = 'SUSPENDED', status_reason = 'ติด Blacklist: ' || v_reason,
         blacklisted_at = now(), blacklisted_by = p_actor, blacklist_reason = v_reason
   where id = p_bar
  returning blacklisted_at into v_at;

  perform public.admin_audit(p_actor, 'bar.blacklist', 'bars', p_bar,
    jsonb_build_object('status', b.status, 'status_reason', b.status_reason),
    jsonb_build_object('status', 'SUSPENDED', 'reason', v_reason, 'strike_count', v_strikes, 'upcoming_bookings', v_upcoming));
  perform public.app_notify_team(p_bar, 'BAR_BLACKLISTED', 'ร้านถูกระงับ (Blacklist) — ลูกค้าไม่เห็นร้านและจองใหม่ไม่ได้',
    v_reason || ' · การจองที่ยืนยันแล้วยังต้องรับลูกค้าตามเดิม · ติดต่อทีม NightOut เพื่อขอปลด', '/merchant/status');

  return jsonb_build_object('id', p_bar, 'status', 'SUSPENDED', 'blacklisted_at', v_at, 'upcoming_bookings', v_upcoming);
end $$;

-- ---------------------------------------------------------------------
-- 6. แอดมิน: ปลด Blacklist → กลับมาแสดง (APPROVED) และรับจองได้ทันที
-- ---------------------------------------------------------------------
create or replace function public.admin_unblacklist_bar(p_actor uuid, p_bar uuid, p_reason text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_reason text := nullif(btrim(p_reason), '');
  b public.bars;
begin
  perform public.admin_assert(p_actor);
  if v_reason is null or char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'BLACKLIST_REASON_REQUIRED' using errcode = '22023';
  end if;
  select * into b from public.bars where id = p_bar for update;
  if not found then raise exception 'BAR_NOT_FOUND' using errcode = 'P0002'; end if;
  if b.blacklisted_at is null then raise exception 'BAR_NOT_BLACKLISTED' using errcode = 'P0001'; end if;

  -- ล้าง blacklisted_at ใน UPDATE เดียวกัน → bars_blacklist_guard ผ่าน · handle_bar_status_notify ข้าม
  update public.bars
     set status = 'APPROVED', status_reason = null, approved_at = coalesce(approved_at, now()),
         blacklisted_at = null, blacklisted_by = null, blacklist_reason = null
   where id = p_bar;

  perform public.admin_audit(p_actor, 'bar.unblacklist', 'bars', p_bar,
    jsonb_build_object('status', b.status, 'blacklisted_at', b.blacklisted_at, 'blacklist_reason', b.blacklist_reason),
    jsonb_build_object('status', 'APPROVED', 'reason', v_reason));
  perform public.app_notify_team(p_bar, 'BAR_UNBLACKLISTED', 'ปลด Blacklist แล้ว — ร้านกลับมาแสดงและรับจองได้',
    v_reason, '/merchant');

  return jsonb_build_object('id', p_bar, 'status', 'APPROVED', 'blacklisted_at', null);
end $$;

-- ---------------------------------------------------------------------
-- 7. view Backoffice /bar-blacklist — ร้านที่แสดง/ระงับ หรือมีประวัติ + สถานะ Blacklist (Db.AdminBarBlacklist)
--    strikes = ประวัติไม่มีโต๊ะ ใหม่สุดก่อน สูงสุด 50 แถว
-- ---------------------------------------------------------------------
create view public.admin_bar_blacklist with (security_invoker = true) as
select
  b.id, b.slug, b.name, b.status, b.status_reason,
  (b.blacklisted_at is not null) as is_blacklisted, b.blacklisted_at, b.blacklist_reason,
  case when bu.id is null then null
       else jsonb_build_object('id', bu.id, 'email', bu.email, 'display_name', bu.display_name) end as blacklisted_by,
  coalesce(c.strike_count, 0) as strike_count,
  coalesce(c.strike_count_90d, 0) as strike_count_90d,
  c.last_strike_at,
  coalesce((select jsonb_agg(x.j order by x.created_at desc) from (
     select st.created_at, jsonb_build_object(
       'id', st.id, 'booking_id', st.booking_id, 'booking_code', bk.code,
       'booking_datetime', bk.booking_datetime, 'pax', bk.pax, 'booking_status', bk.status, 'note', st.note,
       'source', st.source, 'reported_by', ru.display_name, 'created_at', st.created_at) as j
     from public.bar_strikes st
     join public.bookings bk on bk.id = st.booking_id
     left join public.users ru on ru.id = st.reported_by
     where st.bar_id = b.id
     order by st.created_at desc
     limit 50) x), '[]'::jsonb) as strikes
from public.bars b
left join public.users bu on bu.id = b.blacklisted_by
left join lateral (
  select count(*)::integer as strike_count,
         (count(*) filter (where s.created_at > now() - interval '90 days'))::integer as strike_count_90d,
         max(s.created_at) as last_strike_at
  from public.bar_strikes s where s.bar_id = b.id) c on true
where public.is_admin()
  and (b.status in ('APPROVED', 'SUSPENDED') or b.blacklisted_at is not null or c.strike_count > 0);

-- ---------------------------------------------------------------------
-- 8. สิทธิ์
-- ---------------------------------------------------------------------
revoke all on public.admin_bar_blacklist from anon;
grant select on public.admin_bar_blacklist to authenticated;

-- ฟังก์ชันเขียน — NestJS service_role เท่านั้น
revoke all on function
  public.app_team_report_no_table(uuid, uuid, text),
  public.admin_report_no_table(uuid, text, text),
  public.admin_blacklist_bar(uuid, uuid, text),
  public.admin_unblacklist_bar(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function
  public.app_team_report_no_table(uuid, uuid, text),
  public.admin_report_no_table(uuid, text, text),
  public.admin_blacklist_bar(uuid, uuid, text),
  public.admin_unblacklist_bar(uuid, uuid, text)
  to service_role;

-- trigger function ไม่ให้ใครเรียกตรง (handle_bar_status_notify คงสิทธิ์เดิม — create or replace ไม่เปลี่ยน grant)
revoke all on function public.bars_blacklist_guard(), public.bars_owner_blacklist_notify() from public, anon, authenticated;
