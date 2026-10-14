-- =====================================================================
-- booking · กติกาเวลาการจอง (เจ้าของอนุมัติ 2026-10-13)
--   1) ขอต่อเวลา 15 นาทีได้ 1 ครั้ง (ตั้งแต่ 15 นาทีก่อนเวลาจอง จนถึงเวลาปลดโต๊ะ) → auto_cancel_at + 15 นาที
--      bookings.extended_at + app_extend_booking · เวลาเก็บโต๊ะ (grace_minutes) ร้านยังตั้งเองเหมือนเดิม
--   2) ยกเลิกโต๊ะทั่วไป คืน Table Fee เต็มเมื่อยกเลิก ≥ 6 ชม. ก่อนเวลาจอง → refund_before_hours = 6 ทุกร้าน (ค่าเริ่มต้น 6)
--      (กลุ่ม ≥ 24 ชม. รอ Party Set — ยังไม่ทำ)
--   3) เช็กอินได้ตั้งแต่ 3 ชม. ก่อนเวลาจอง จนถึงเวลาปลดโต๊ะ (auto_cancel_at) — trigger บังคับทุกทาง (QR / รหัส / ทีมร้าน / แอดมิน)
--   4) เพื่อนกด "ไปด้วย" ในลิงก์แชร์ (ต้องล็อกอิน) → app_join_share · get_share_card + is_member / checkin_qr
--      สมาชิกของกลุ่มเห็น QR เช็กอินเดียวกัน (NIGHTOUT:<booking id>) — ใครถึงร้านก่อนสแกนได้เลย เช็กอินทั้งโต๊ะ
--   5) run_booking_timeouts: แจ้งเตือน 15 นาทีก่อนเวลาจอง (ผู้จอง + เพื่อนที่กดไปด้วย) + เตือนผู้จอง 5 นาทีก่อนปลดโต๊ะ
--   6) ปลดโต๊ะ = สถานะ NO_SHOW เดิม (ไม่เปลี่ยน enum) แต่ข้อความเรียก "ปลดโต๊ะ (Forfeited)"
--      → แจ้งลูกค้า + ทีมร้าน (โต๊ะว่างรับ walk-in) + แอดมิน · admin_dashboard + forfeited_today
--   7) booking_detail + extended_at (คอลัมน์ท้ายสุด)
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. คอลัมน์ใหม่ + ค่าคืนมัดจำ
-- ---------------------------------------------------------------------
alter table public.bookings add column if not exists extended_at timestamptz;   -- กด "ขอต่อเวลา 15 นาที" เมื่อไร (null = ยังไม่ต่อ)
-- bookings ให้สิทธิ์อ่านรายคอลัมน์ (…000800 ซ่อน contact_phone) → คอลัมน์ใหม่ต้อง grant เอง
-- ไม่งั้น booking_detail (security_invoker) อ่านไม่ได้ (permission denied)
grant select (extended_at) on public.bookings to authenticated;

alter table public.bar_booking_settings alter column refund_before_hours set default 6;
update public.bar_booking_settings set refund_before_hours = 6 where refund_before_hours <> 6;

-- ---------------------------------------------------------------------
-- 2. ช่วงเวลาเช็กอิน: ตั้งแต่ 3 ชม. ก่อนเวลาจอง ถึง auto_cancel_at (เวลา server)
--    BEFORE trigger ชื่อขึ้นต้น bookings_check… → ทำงานก่อน bookings_status_update (เรียงตามชื่อ)
-- ---------------------------------------------------------------------
create or replace function public.booking_check_in_window() returns trigger
language plpgsql set search_path = '' as $$
begin
  if now() < new.booking_datetime - interval '3 hours' then
    raise exception 'CHECK_IN_TOO_EARLY' using errcode = 'P0001';
  end if;
  if now() > new.auto_cancel_at then
    raise exception 'CHECK_IN_TOO_LATE' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists bookings_check_in_window on public.bookings;
create trigger bookings_check_in_window before update of status on public.bookings
  for each row when (new.status = 'CHECKED_IN' and old.status is distinct from 'CHECKED_IN')
  execute function public.booking_check_in_window();

-- ---------------------------------------------------------------------
-- 3. ลูกค้าขอต่อเวลา 15 นาที (1 ครั้ง · ตั้งแต่ 15 นาทีก่อนเวลาจอง จนถึงเวลาปลดโต๊ะ)
-- ---------------------------------------------------------------------
create or replace function public.app_extend_booking(p_actor uuid, p_booking uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare bk public.bookings; v_until timestamptz; v_at timestamptz;
begin
  perform public.app_assert_user(p_actor);
  select * into bk from public.bookings where id = p_booking and user_id = p_actor for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  if bk.status <> 'CONFIRMED' then raise exception 'BOOKING_NOT_CONFIRMED' using errcode = 'P0001'; end if;
  if bk.extended_at is not null then raise exception 'BOOKING_ALREADY_EXTENDED' using errcode = 'P0001'; end if;
  if now() < bk.booking_datetime - interval '15 minutes' or now() >= bk.auto_cancel_at then
    raise exception 'BOOKING_EXTEND_NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  update public.bookings
     set auto_cancel_at = auto_cancel_at + interval '15 minutes', extended_at = now()
   where id = bk.id
  returning auto_cancel_at, extended_at into v_until, v_at;
  perform public.app_audit(p_actor, 'booking.extend', 'bookings', bk.id, jsonb_build_object(
    'from_auto_cancel_at', bk.auto_cancel_at, 'auto_cancel_at', v_until, 'extended_at', v_at));
  perform public.app_notify_team(bk.bar_id, 'BOOKING_EXTENDED', 'ลูกค้าขอต่อเวลา 15 นาที',
    bk.code || ' · เก็บโต๊ะถึง ' || public.app_fmt(v_until), '/merchant/bookings/' || bk.id, bk.id);
  return jsonb_build_object('id', bk.id, 'auto_cancel_at', v_until, 'extended_at', v_at);
end $$;

-- ---------------------------------------------------------------------
-- 4. เพื่อนกด "ไปด้วย" จากลิงก์แชร์ (ต้องล็อกอิน · กดซ้ำได้ ไม่นับซ้ำ · ผู้จองกดเอง = ไม่บันทึก)
-- ---------------------------------------------------------------------
create or replace function public.app_join_share(p_actor uuid, p_token text) returns jsonb
language plpgsql set search_path = '' as $$
declare u public.users; s public.booking_shares; bk public.bookings; v_join uuid; v_bar text; v_going integer;
begin
  u := public.app_assert_user(p_actor);
  select * into s from public.booking_shares where share_token = p_token and revoked_at is null;
  if not found then raise exception 'SHARE_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into bk from public.bookings where id = s.booking_id;
  if bk.status not in ('PENDING', 'AWAITING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'CONFIRMED', 'CHECKED_IN') then
    raise exception 'SHARE_CLOSED' using errcode = 'P0001';
  end if;
  if bk.user_id <> p_actor then
    insert into public.booking_share_joins (share_id, user_id) values (s.id, p_actor)
    on conflict (share_id, user_id) where user_id is not null do nothing
    returning id into v_join;
    if v_join is not null then   -- เพิ่งกดครั้งแรก → แจ้งผู้จอง
      select name into v_bar from public.bars where id = bk.bar_id;
      perform public.app_notify(bk.user_id, 'SHARE_JOINED', u.display_name || ' จะไปด้วย',
        v_bar || ' · ' || public.app_fmt(bk.booking_datetime), '/bookings/' || bk.id, bk.id, bk.bar_id,
        'SHARE_JOINED:' || s.id || ':' || p_actor);
      perform public.app_audit(p_actor, 'booking_share.join', 'booking_share_joins', v_join,
        jsonb_build_object('share_id', s.id, 'booking_id', bk.id));
    end if;
  end if;
  select count(*)::integer into v_going from public.booking_share_joins where share_id = s.id;
  return jsonb_build_object('joined', true, 'going_count', v_going);
end $$;

-- ---------------------------------------------------------------------
-- 5. บัตรจองที่แชร์ + is_member / checkin_qr (เปลี่ยนชนิดผลลัพธ์ → drop แล้วสร้างใหม่)
--    is_member = ผู้เรียกเป็นผู้จอง หรือกด "ไปด้วย" ในลิงก์นี้แล้ว (ไม่ล็อกอิน = false)
--    checkin_qr = QR เดียวกับของผู้จอง เฉพาะสมาชิก + การจอง CONFIRMED · คนอื่นยังไม่เห็นข้อมูลส่วนตัว
-- ---------------------------------------------------------------------
drop function if exists public.get_share_card(text);

create function public.get_share_card(p_token text)
returns table (booking_datetime timestamptz, pax smallint, status public.booking_status, zone_name text,
               bar_name text, bar_slug extensions.citext, address text, lat numeric, lng numeric,
               host_first_name text, going_count bigint, deposit_required numeric,
               is_member boolean, checkin_qr text)
language sql stable security definer set search_path = '' as $$
  select bk.booking_datetime, bk.pax, bk.status, z.name, b.name, b.slug, b.address, b.lat, b.lng,
         split_part(u.display_name, ' ', 1),
         (select count(*) from public.booking_share_joins j where j.share_id = s.id),
         bk.deposit_required,
         m.is_member,
         case when m.is_member and bk.status = 'CONFIRMED' then 'NIGHTOUT:' || bk.id else null end
  from public.booking_shares s
  join public.bookings    bk on bk.id = s.booking_id
  join public.bars        b  on b.id  = bk.bar_id
  join public.table_zones z  on z.id  = bk.zone_id
  join public.users       u  on u.id  = bk.user_id
  cross join lateral (
    select (auth.uid() is not null
            and (bk.user_id = auth.uid()
                 or exists (select 1 from public.booking_share_joins mj
                             where mj.share_id = s.id and mj.user_id = auth.uid()))) as is_member
  ) m
  where s.share_token = p_token and s.revoked_at is null
$$;

revoke all on function public.get_share_card(text) from public;
grant execute on function public.get_share_card(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. job: + แจ้งเตือน 15 นาทีก่อนเวลาจอง / เตือน 5 นาทีก่อนปลดโต๊ะ (EXPIRED / NO_SHOW / COMPLETED เหมือนเดิม)
-- ---------------------------------------------------------------------
create or replace function public.run_booking_timeouts() returns jsonb
language plpgsql set search_path = '' as $$
declare v_expired integer; v_noshow integer; v_completed integer; v_run bigint;
        v_reminded integer := 0; v_warned integer := 0; r record;
begin
  insert into public.job_runs (job) values ('booking_timeouts') returning id into v_run;
  perform set_config('app.user_id', '', true);
  perform set_config('app.reason', 'timeout', true);
  update public.bookings set status = 'EXPIRED'
   where status in ('PENDING', 'AWAITING_DEPOSIT') and (expires_at < now() or auto_cancel_at < now());
  get diagnostics v_expired = row_count;

  -- แจ้งเตือน 15 นาทีก่อนเวลาจอง: ผู้จอง (ลิงก์หน้าการจอง) + เพื่อนที่กด "ไปด้วย" (ลิงก์แชร์ที่มี QR เดียวกัน)
  -- ข้ามคนที่ได้แจ้งแล้ว (dedupe ต่อการจองต่อคน) → ตัวนับ reminded เป็นจำนวนที่ส่งจริง
  for r in
    select distinct on (x.booking_id, x.user_id) x.*
    from (
      select bk.id as booking_id, bk.bar_id, bk.booking_datetime, b.name as bar_name, bk.user_id,
             '/bookings/' || bk.id as link, 0 as prio
      from public.bookings bk
      join public.bars b on b.id = bk.bar_id
      where bk.status = 'CONFIRMED'
        and bk.booking_datetime > now() and bk.booking_datetime <= now() + interval '15 minutes'
      union all
      select bk.id, bk.bar_id, bk.booking_datetime, b.name, j.user_id,
             '/share/' || s.share_token, 1
      from public.bookings bk
      join public.bars                b on b.id = bk.bar_id
      join public.booking_shares      s on s.booking_id = bk.id and s.revoked_at is null
      join public.booking_share_joins j on j.share_id = s.id and j.user_id is not null
      where bk.status = 'CONFIRMED'
        and bk.booking_datetime > now() and bk.booking_datetime <= now() + interval '15 minutes'
    ) x
    where not exists (select 1 from public.notifications n
                       where n.dedupe_key = 'BOOKING_REMINDER:' || x.booking_id || ':' || x.user_id)
    order by x.booking_id, x.user_id, x.prio, x.link
  loop
    perform public.app_notify(r.user_id, 'BOOKING_REMINDER', 'อีก 15 นาทีถึงเวลาจอง',
      r.bar_name || ' · ' || public.app_fmt(r.booking_datetime) || ' · ใครถึงก่อนให้สแกน QR ได้เลย',
      r.link, r.booking_id, r.bar_id, 'BOOKING_REMINDER:' || r.booking_id || ':' || r.user_id);
    v_reminded := v_reminded + 1;
  end loop;

  -- เตือนผู้จอง 5 นาทีก่อนปลดโต๊ะ — เฉพาะที่ยังไม่ได้ต่อเวลา (ยังกด "ขอต่อเวลา 15 นาที" ได้)
  for r in
    select bk.id, bk.bar_id, bk.user_id, b.name as bar_name
    from public.bookings bk
    join public.bars b on b.id = bk.bar_id
    where bk.status = 'CONFIRMED' and bk.extended_at is null
      and bk.auto_cancel_at > now() and bk.auto_cancel_at <= now() + interval '5 minutes'
      and not exists (select 1 from public.notifications n
                       where n.dedupe_key = 'BOOKING_RELEASE_WARNING:' || bk.id)
  loop
    perform public.app_notify(r.user_id, 'BOOKING_RELEASE_WARNING', 'อีก 5 นาทีจะปลดโต๊ะ',
      r.bar_name || ' · กด "ขอต่อเวลา 15 นาที" ได้ 1 ครั้ง', '/bookings/' || r.id, r.id, r.bar_id,
      'BOOKING_RELEASE_WARNING:' || r.id);
    v_warned := v_warned + 1;
  end loop;

  update public.bookings set status = 'NO_SHOW' where status = 'CONFIRMED' and auto_cancel_at < now();
  get diagnostics v_noshow = row_count;
  update public.bookings set status = 'COMPLETED' where status = 'CHECKED_IN' and reserved_until < now();
  get diagnostics v_completed = row_count;
  update public.job_runs set finished_at = now(), processed = v_expired + v_noshow + v_completed + v_reminded + v_warned
   where id = v_run;
  return jsonb_build_object('expired', v_expired, 'no_show', v_noshow, 'completed', v_completed,
                            'reminded', v_reminded, 'warned', v_warned);
end $$;

-- ---------------------------------------------------------------------
-- 7. trigger ผลข้างเคียงของสถานะ (เหมือน …001700 ทุกบรรทัด) — เปลี่ยนเฉพาะ NO_SHOW = ปลดโต๊ะ (Forfeited):
--    ข้อความแจ้งลูกค้า + แจ้งทีมร้าน (โต๊ะว่างรับ walk-in) + แจ้งแอดมิน · trigger bookings_status_effects เดิมใช้ต่อ
--    + ค่าสำรองเมื่อร้านไม่มีแถว settings: refund_before_hours 24 → 6 (ตรงกับค่าเริ่มต้นใหม่)
-- ---------------------------------------------------------------------
create or replace function public.handle_booking_status_effects() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_bar public.bars; v_settings public.bar_booking_settings; v_title text; v_link text := '/bookings/' || new.id;
  v_base numeric; v_rule public.commission_rules; v_amount numeric; v_pct numeric;
begin
  select * into v_bar from public.bars where id = new.bar_id;

  -- มัดจำที่แพลตฟอร์มถือไว้ (HELD)
  if new.status in ('CHECKED_IN', 'NO_SHOW') then
    update public.deposits set settlement = 'PAYOUT_PENDING', settled_at = now()
     where booking_id = new.id and status = 'VERIFIED' and settlement = 'HELD';
  elsif new.status in ('CANCELLED_BY_MERCHANT', 'REJECTED') then
    update public.deposits set settlement = 'REFUND_PENDING', settled_at = now()
     where booking_id = new.id and status = 'VERIFIED' and settlement = 'HELD';
  elsif new.status = 'CANCELLED_BY_CUSTOMER' then
    select * into v_settings from public.bar_booking_settings where bar_id = new.bar_id;
    update public.deposits
       set settlement = case when now() <= new.booking_datetime - make_interval(hours => coalesce(v_settings.refund_before_hours, 6))
                             then 'REFUND_PENDING'::public.deposit_settlement else 'PAYOUT_PENDING'::public.deposit_settlement end,
           settled_at = now()
     where booking_id = new.id and status = 'VERIFIED' and settlement = 'HELD';
  end if;

  -- สถิติ + ค่าคอม
  if new.status in ('CHECKED_IN', 'NO_SHOW') then
    if new.status = 'CHECKED_IN' then
      update public.bar_stats set checkin_count = checkin_count + 1 where bar_id = new.bar_id;
    end if;
    select coalesce(avg_price_per_person, 0) * new.pax into v_base from public.bar_stats where bar_id = new.bar_id;
    v_base := coalesce(v_base, 0);
    select * into v_rule from public.commission_rules
     where bar_id = new.bar_id and effective_from <= new.booking_datetime
       and (effective_to is null or effective_to > new.booking_datetime)
     order by effective_from desc limit 1;
    if new.status = 'CHECKED_IN' then
      if v_rule.id is null then
        select coalesce((value #>> '{}')::numeric, 10) into v_pct from public.platform_settings where key = 'default_commission_percent';
        v_amount := round(v_base * coalesce(v_pct, 10) / 100, 2);
      else
        v_amount := case v_rule.calculation_type when 'PERCENTAGE' then round(v_base * v_rule.rate / 100, 2)
                                                 when 'FIXED' then v_rule.rate
                                                 else v_rule.rate * new.pax end;
      end if;
    else
      v_amount := case when v_rule.id is not null and v_rule.charge_on_no_show then round(v_base * coalesce(v_rule.no_show_rate, 0) / 100, 2) else 0 end;
    end if;
    insert into public.billing_events (booking_id, bar_id, event_type, commission_rule_id, base_amount, amount, status, period)
    values (new.id, new.bar_id, case when new.status = 'CHECKED_IN' then 'CHECK_IN'::public.billing_event_type else 'NO_SHOW'::public.billing_event_type end,
            v_rule.id, v_base, v_amount, case when v_amount > 0 then 'PENDING'::public.billing_status else 'WAIVED'::public.billing_status end,
            date_trunc('month', new.booking_datetime at time zone 'Asia/Bangkok')::date)
    on conflict (booking_id, event_type) do nothing;
  end if;

  -- แจ้งลูกค้า
  v_title := case new.status
    when 'CONFIRMED'             then case when old.status = 'DEPOSIT_SUBMITTED' then 'NightOut ตรวจสลิปแล้ว โต๊ะของคุณยืนยันแล้ว' else 'ร้านยืนยันการจองแล้ว' end
    when 'AWAITING_DEPOSIT'      then 'สลิปไม่ผ่าน กรุณาส่งใหม่'
    when 'REJECTED'              then 'ร้านไม่สามารถรับการจองนี้ได้'
    when 'CANCELLED_BY_MERCHANT' then 'ร้านยกเลิกการจอง'
    when 'CHECKED_IN'            then 'เช็กอินสำเร็จ ขอให้สนุกนะ!'
    when 'COMPLETED'             then 'ขอบคุณที่ใช้บริการ — รีวิวร้านได้แล้ว'
    when 'NO_SHOW'               then 'ปลดโต๊ะแล้ว (Forfeited) — เลยเวลาเก็บโต๊ะ Table Fee ถูกริบตามเงื่อนไข'
    when 'EXPIRED'               then 'การจองหมดเวลา'
    else null end;
  if v_title is not null then
    perform public.app_notify(new.user_id, 'BOOKING_' || new.status, v_title,
      v_bar.name || ' · ' || public.app_fmt(new.booking_datetime),
      case when new.status = 'AWAITING_DEPOSIT' then v_link || '/deposit'
           when new.status = 'COMPLETED' then '/reviews/new?booking=' || new.id else v_link end,
      new.id, new.bar_id);
  end if;
  -- ปลดโต๊ะ (Forfeited): ทีมร้านรู้ว่าโต๊ะว่างรับ walk-in ได้ + แจ้งแอดมิน
  if new.status = 'NO_SHOW' then
    perform public.app_notify_team(new.bar_id, 'BOOKING_FORFEITED', 'ปลดโต๊ะแล้ว (Forfeited) — โต๊ะว่างรับ walk-in ได้',
      new.code || ' · ' || public.app_fmt(new.booking_datetime), '/merchant/bookings/' || new.id, new.id);
    perform public.app_notify_admins('BOOKING_FORFEITED', 'ปลดโต๊ะ (Forfeited) · ' || v_bar.name,
      new.code || ' · นัด ' || public.app_fmt(new.booking_datetime) || ' · สายเกินเวลาเก็บโต๊ะ',
      '/bookings?status=NO_SHOW', new.id, new.bar_id);
  end if;
  if new.status = 'CONFIRMED' and old.status = 'DEPOSIT_SUBMITTED' then
    perform public.app_notify_team(new.bar_id, 'BOOKING_CONFIRMED', 'NightOut ยืนยันมัดจำแล้ว',
      new.code || ' · ' || public.app_fmt(new.booking_datetime), '/merchant/bookings', new.id);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 8. booking_detail: เหมือน …001700 + extended_at (Postgres เพิ่มคอลัมน์ได้แค่ท้ายสุด)
-- ---------------------------------------------------------------------
create or replace view public.booking_detail with (security_invoker = true) as
select
  bk.id, bk.code, bk.status, bk.user_id, (bk.user_id = auth.uid()) as is_mine,
  bk.booking_datetime, bk.reserved_from, bk.reserved_until, bk.pax, bk.customer_note, bk.request_pr,
  bk.deposit_required, bk.deposit_policy_snapshot, bk.grace_minutes, bk.auto_cancel_at, bk.expires_at,
  bk.confirmed_at, bk.checked_in_at, bk.completed_at, bk.cancelled_at, bk.cancel_reason,
  case when b.id is null then null else jsonb_build_object(
    'id', b.id, 'slug', b.slug, 'name', b.name, 'address', b.address, 'lat', b.lat, 'lng', b.lng,
    'cover_image_url', b.cover_image_url, 'cover_style', b.cover_style) end            as bar,
  case when z.id is null then null else jsonb_build_object('id', z.id, 'name', z.name) end as zone,
  case when t.id is null then null else jsonb_build_object('id', t.id, 'name', t.name, 'seats', t.seats) end as "table",
  case when bp.id is null then null else jsonb_build_object(
    'id', bp.promotion_id, 'title', bp.title_snapshot, 'perk', bp.perk_snapshot, 'redeemed_at', bp.redeemed_at) end as promotion,
  case when ps.id is null then null else jsonb_build_object(
    'items', ps.items, 'subtotal', ps.subtotal, 'service_charge_rate', ps.service_charge_rate, 'vat_rate', ps.vat_rate,
    'other_fees', ps.other_fees, 'estimated_total', ps.estimated_total, 'per_person', ps.per_person) end as price_estimate,
  case when pk.id is null then null else jsonb_build_object(
    'package_id', pk.package_id, 'name', pk.package_name, 'items', pk.items, 'price', pk.package_price, 'fees', pk.fees) end as package,
  public.booking_deposit_summary(bk.id)                          as deposit,
  case when ci.id is null then null else jsonb_build_object(
    'checked_in_at', ci.checked_in_at, 'method', ci.method, 'actual_pax', ci.actual_pax) end as checkin,
  coalesce((select jsonb_agg(jsonb_build_object(
              'from_status', h.from_status, 'to_status', h.to_status, 'reason', h.reason, 'created_at', h.created_at)
            order by h.created_at, h.id)
            from public.booking_status_history h where h.booking_id = bk.id), '[]'::jsonb) as status_history,
  bk.created_at,
  bk.updated_at,
  public.booking_customer_name(bk.user_id, bk.bar_id)            as customer_name,
  (select s.share_token from public.booking_shares s where s.booking_id = bk.id and s.revoked_at is null
   order by s.created_at limit 1)                                as share_token,
  exists (select 1 from public.reviews r where r.booking_id = bk.id) as has_review,
  bk.extended_at                                                 -- …20261013000500: ต่อเวลาแล้วเมื่อไร (null = ยังไม่ต่อ)
from public.bookings bk
left join public.bars                      b  on b.id  = bk.bar_id
left join public.table_zones               z  on z.id  = bk.zone_id
left join public.tables                    t  on t.id  = bk.table_id
left join public.booking_promotions        bp on bp.booking_id = bk.id
left join public.booking_price_snapshots   ps on ps.booking_id = bk.id
left join public.booking_package_snapshots pk on pk.booking_id = bk.id
left join public.checkins                  ci on ci.booking_id = bk.id;

-- ---------------------------------------------------------------------
-- 9. Dashboard แอดมิน + จำนวนโต๊ะที่ถูกปลดวันนี้ (เวลาปลด = auto_cancel_at ตามวันไทย)
--    เปลี่ยนชนิดผลลัพธ์ → drop แล้วสร้างใหม่ (6 คอลัมน์เดิม + forfeited_today)
-- ---------------------------------------------------------------------
drop function if exists public.admin_dashboard();

create function public.admin_dashboard()
returns table (bookings_today integer, bars_pending integer, reviews_reported integer,
               promo_slips_pending integer, deposits_to_verify integer, payouts_pending integer,
               forfeited_today integer)
language sql stable set search_path = '' as $$
  select
    (select count(*) from public.bookings
      where (booking_datetime at time zone 'Asia/Bangkok')::date = (now() at time zone 'Asia/Bangkok')::date)::integer,
    (select count(*) from public.bars where status in ('PENDING_REVIEW'))::integer,
    (select count(distinct review_id) from public.review_reports where status = 'OPEN')::integer,
    (select count(*) from public.promoted_listings where status = 'PAYMENT_SUBMITTED')::integer,
    (select count(*) from public.deposits where status = 'SUBMITTED')::integer,
    (select count(*) from public.deposits where settlement = 'PAYOUT_PENDING')::integer,
    (select count(*) from public.bookings
      where status = 'NO_SHOW'
        and (auto_cancel_at at time zone 'Asia/Bangkok')::date = (now() at time zone 'Asia/Bangkok')::date)::integer
  where public.is_admin()
$$;

revoke execute on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;

-- ---------------------------------------------------------------------
-- 10. สิทธิ์: ฟังก์ชันเขียนเรียกได้เฉพาะ service_role (NestJS) · trigger function ไม่ให้ใครเรียกตรง
-- ---------------------------------------------------------------------
revoke all on function public.app_extend_booking(uuid, uuid) from public, anon, authenticated;
grant execute on function public.app_extend_booking(uuid, uuid) to service_role;
revoke all on function public.app_join_share(uuid, text) from public, anon, authenticated;
grant execute on function public.app_join_share(uuid, text) to service_role;
revoke all on function public.booking_check_in_window() from public, anon, authenticated;
