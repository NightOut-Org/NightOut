-- =====================================================================
-- booking · ผังโต๊ะของร้าน /merchant/floor (เจ้าของอนุมัติ 2026-10-13: โพลทุก 10 วิ ไม่ใช้ Realtime)
--   1) ตาราง table_occupancies — ทีมร้านตั้งโต๊ะเป็น "กำลังใช้" เอง (ลูกค้านั่งโดยไม่มีการจองในระบบ)
--      1 แถว = 1 รอบการใช้โต๊ะ · ไม่เก็บข้อมูลลูกค้า ไม่มีคิว (ไม่ใช่ Walk-in queue / Waitlist ⛔)
--      เกิน 12 ชม. ไม่ตั้งว่าง = หมดอายุ (ผังไม่แสดง · ปิดเป็น STALE ตอนตั้งใหม่ — ไม่มี job)
--   2) bar_table_board(p_bar, p_night) — อ่านผังโต๊ะ + การจองของคืนนั้น
--      ทีมร้านทุกบทบาท (รวม STAFF) + แอดมิน (ADMIN + MFA · หน้า Backoffice ดูอย่างเดียว — เจ้าของอนุมัติ 2026-10-13)
--      สถานะโต๊ะคำนวณ ณ เวลา server เสมอ: IN_USE (เช็กอินแล้ว / ตั้งเอง) > RESERVED (การจองที่ยังไม่เช็กอิน
--      เริ่มภายใน 60 นาที หรือเลยเวลานัดแต่ยังไม่หมด reserved_until) > FREE · p_night เปลี่ยนแค่รายการ bookings
--      "คืน" = 06:00 ถึง 06:00 ของวันถัดไป เวลาไทย · ไม่มียอดเงิน (Table Fee) และไม่มีเบอร์โทร
--      ค่าคงที่ตรงกับ packages/utils/src/table-board.ts (TABLE_BOARD_RESERVED_LEAD_MINUTES · TABLE_OCCUPANCY_STALE_HOURS)
--   3) app_team_set_table_occupancy — ตั้ง "กำลังใช้" / "ว่าง" · ทีมร้านทุกบทบาท · audit table.occupy / table.release
--   4) trigger bookings_checkin_close_occupancy — การจองที่เช็กอินแล้วมาถึงโต๊ะ (เช็กอิน / ย้ายเข้ามา)
--      ปิดรอบ "กำลังใช้" ที่ตั้งเองบนโต๊ะนั้น (end_reason = CHECKED_IN)
--   ไฟล์นี้สร้างของใหม่เท่านั้น — ไม่แก้ฟังก์ชัน/วิวเดิม (app_team_move_booking ใช้ย้ายโต๊ะตามเดิม)
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. ตาราง table_occupancies
-- ---------------------------------------------------------------------
create table public.table_occupancies (
  id          uuid primary key default gen_random_uuid(),
  bar_id      uuid not null references public.bars(id) on delete cascade,   -- คัดลอกจากโซนของโต๊ะใน app_team_set_table_occupancy (ผู้เขียนคนเดียว)
  table_id    uuid not null references public.tables(id) on delete cascade,
  pax         smallint check (pax between 1 and 50),
  note        text check (char_length(note) <= 100),
  started_at  timestamptz not null default now(),
  started_by  uuid not null references public.users(id),
  ended_at    timestamptz,
  ended_by    uuid references public.users(id),
  end_reason  text check (end_reason in ('MANUAL', 'CHECKED_IN', 'STALE')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  check ((ended_at is null) = (end_reason is null))
);
create trigger table_occupancies_updated_at before update on public.table_occupancies
  for each row execute function public.set_updated_at();
-- โต๊ะหนึ่งมีรอบที่ยังเปิดได้รอบเดียว
create unique index table_occupancies_one_open on public.table_occupancies (table_id) where ended_at is null;
create index table_occupancies_table_id_fk   on public.table_occupancies (table_id, started_at desc);
create index table_occupancies_bar_id_fk     on public.table_occupancies (bar_id, started_at desc);
create index table_occupancies_started_by_fk on public.table_occupancies (started_by);
create index table_occupancies_ended_by_fk   on public.table_occupancies (ended_by);

alter table public.table_occupancies enable row level security;
create policy table_occupancies_read_team on public.table_occupancies for select to authenticated using (public.is_bar_member(bar_id));
-- …001600 สร้าง admin_read ให้ตารางที่มีตอนนั้นเท่านั้น — ตารางใหม่ต้องเพิ่มเอง
create policy admin_read on public.table_occupancies for select to authenticated using (public.is_admin());
revoke all on public.table_occupancies from anon;
revoke insert, update, delete, truncate on public.table_occupancies from authenticated;
grant select on public.table_occupancies to authenticated;

-- ---------------------------------------------------------------------
-- 2. อ่านผังโต๊ะ — ทีมร้านทุกบทบาท + แอดมิน (ADMIN + MFA) · ไม่มียอดเงิน / เบอร์โทร
-- ---------------------------------------------------------------------
create or replace function public.bar_table_board(p_bar uuid, p_night date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_now     timestamptz := now();
  v_night   date := coalesce(p_night, ((now() at time zone 'Asia/Bangkok') - interval '6 hours')::date);
  v_from    timestamptz := (v_night + time '06:00') at time zone 'Asia/Bangkok';
  v_until   timestamptz := (v_night + 1 + time '06:00') at time zone 'Asia/Bangkok';
  v_tonight boolean := v_now >= v_from and v_now < v_until;
  -- สถานะโต๊ะ / การจองถัดไป คิดจาก "คืนปัจจุบัน" เสมอ (ไม่ขึ้นกับ p_night)
  v_cur_until timestamptz := ((((now() at time zone 'Asia/Bangkok') - interval '6 hours')::date + 1) + time '06:00') at time zone 'Asia/Bangkok';
  v_zones   jsonb;
  v_books   jsonb;
begin
  if p_bar is null or not (public.is_bar_member(p_bar) or public.is_admin()) then
    raise exception 'NOT_BAR_MEMBER' using errcode = '42501';
  end if;
  if not exists (select 1 from public.bars where id = p_bar) then
    raise exception 'BAR_NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', z.id,
           'name', z.name,
           'capacity_pax', z.capacity_pax,
           'allow_zone_only_booking', z.allow_zone_only_booking,
           'sort_order', z.sort_order,
           'tables', coalesce((
             select jsonb_agg(s.tj order by s.tname)
             from (
               select t.name as tname, jsonb_build_object(
                 'id', t.id,
                 'name', t.name,
                 'seats', t.seats,
                 'status', case when cb.id is not null or oc.id is not null then 'IN_USE'
                                when rb.id is not null then 'RESERVED'
                                else 'FREE' end,
                 'status_source', case when cb.id is not null then 'BOOKING'
                                       when oc.id is not null then 'MANUAL'
                                       when rb.id is not null then 'BOOKING' end,
                 'current_booking_id', coalesce(cb.id, case when oc.id is null then rb.id end),
                 'next_booking_id', nb.id,
                 'next_booking_at', nb.booking_datetime,
                 'occupancy', case when oc.id is null then null else jsonb_build_object(
                   'id', oc.id,
                   'pax', oc.pax,
                   'note', oc.note,
                   'started_at', oc.started_at,
                   'started_by_name', (select u.display_name from public.users u where u.id = oc.started_by)) end
               ) as tj
               from public.tables t
               -- เช็กอินอยู่
               left join lateral (
                 select x.id from public.bookings x
                  where x.table_id = t.id and x.status = 'CHECKED_IN'
                  order by x.checked_in_at desc nulls last limit 1
               ) cb on true
               -- ทีมร้านตั้ง "กำลังใช้" เอง (ไม่เกิน 12 ชม.)
               left join lateral (
                 select o.id, o.pax, o.note, o.started_at, o.started_by from public.table_occupancies o
                  where o.table_id = t.id and o.ended_at is null and o.started_at > v_now - interval '12 hours'
                  limit 1
               ) oc on true
               -- จองไว้: เริ่มภายใน 60 นาที หรือเลยเวลานัดแต่ยังไม่หมด reserved_until
               left join lateral (
                 select x.id from public.bookings x
                  where x.table_id = t.id
                    and x.status in ('PENDING', 'AWAITING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'CONFIRMED')
                    and x.booking_datetime - interval '60 minutes' <= v_now and v_now < x.reserved_until
                  order by x.booking_datetime limit 1
               ) rb on true
               -- การจองถัดไปคืนนี้ที่ยังไม่เช็กอิน (ไม่นับ current)
               left join lateral (
                 select x.id, x.booking_datetime from public.bookings x
                  where x.table_id = t.id
                    and x.status in ('PENDING', 'AWAITING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'CONFIRMED')
                    and x.reserved_until > v_now and x.booking_datetime < v_cur_until
                    and x.id is distinct from coalesce(cb.id, case when oc.id is null then rb.id end)
                  order by x.booking_datetime limit 1
               ) nb on true
               where t.zone_id = z.id and t.active
             ) s), '[]'::jsonb)
         ) order by z.sort_order, z.name), '[]'::jsonb)
    into v_zones
    from public.table_zones z
   where z.bar_id = p_bar and z.active;

  -- การจองของคืนนั้น (+ ที่เช็กอินค้างอยู่ตอนนี้ เฉพาะคืนปัจจุบัน) · ชื่อโซน/โต๊ะรวมที่ปิดใช้แล้ว
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.id,
           'code', b.code,
           'status', b.status,
           'zone_id', b.zone_id,
           'zone_name', bz.name,
           'table_id', b.table_id,
           'table_name', bt.name,
           'booking_datetime', b.booking_datetime,
           'reserved_from', b.reserved_from,
           'reserved_until', b.reserved_until,
           'auto_cancel_at', b.auto_cancel_at,
           'extended_at', b.extended_at,
           'checked_in_at', b.checked_in_at,
           'completed_at', b.completed_at,
           'pax', b.pax,
           'customer_name', u.display_name,
           'request_pr', b.request_pr,
           'customer_note', b.customer_note,
           'promotion_title', bp.title_snapshot
         ) order by b.booking_datetime, b.code), '[]'::jsonb)
    into v_books
    from public.bookings b
    join public.table_zones bz on bz.id = b.zone_id
    left join public.tables bt on bt.id = b.table_id
    left join public.users u on u.id = b.user_id
    left join public.booking_promotions bp on bp.booking_id = b.id
   where b.bar_id = p_bar
     and b.status in ('PENDING', 'AWAITING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW')
     and (b.reserved_period && tstzrange(v_from, v_until, '[)') or (v_tonight and b.status = 'CHECKED_IN'));

  return jsonb_build_object(
    'bar_id', p_bar,
    'night', v_night,
    'night_start', v_from,
    'night_end', v_until,
    'server_now', v_now,
    'zones', v_zones,
    'bookings', v_books);
end $$;
revoke all on function public.bar_table_board(uuid, date) from public, anon;
grant execute on function public.bar_table_board(uuid, date) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. ตั้งโต๊ะเป็น "กำลังใช้" (ไม่มีการจอง) / "ว่าง" — ทีมร้านทุกบทบาท · ไม่แจ้งเตือน (ทุกคนเห็นบนผัง)
-- ---------------------------------------------------------------------
create or replace function public.app_team_set_table_occupancy(p_actor uuid, p_table uuid, p_in_use boolean,
                                                               p_pax integer default null, p_note text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare
  t public.tables; z public.table_zones; o public.table_occupancies;
  v_bar uuid;
  v_note text := left(nullif(btrim(p_note), ''), 100);
begin
  perform public.app_assert_user(p_actor);
  -- เช็กสิทธิ์ทีมร้านก่อน lock แถว (คนนอกร้าน lock โต๊ะร้านอื่นไม่ได้ และไม่รู้ว่าโต๊ะเปิดใช้อยู่หรือไม่)
  select z0.bar_id into v_bar from public.tables t0 join public.table_zones z0 on z0.id = t0.zone_id where t0.id = p_table;
  if v_bar is null then raise exception 'TABLE_NOT_ON_BOARD' using errcode = 'P0002'; end if;
  perform public.app_team_role(p_actor, v_bar);
  select * into t from public.tables where id = p_table for update;
  if not found or not t.active then raise exception 'TABLE_NOT_ON_BOARD' using errcode = 'P0002'; end if;
  select * into z from public.table_zones where id = t.zone_id;
  if not z.active or z.bar_id is distinct from v_bar then raise exception 'TABLE_NOT_ON_BOARD' using errcode = 'P0002'; end if;

  if p_in_use then
    if p_pax is not null and (p_pax < 1 or p_pax > 50) then
      raise exception 'PAX_OUT_OF_RANGE' using errcode = '22023';
    end if;
    -- ลืมตั้งว่างเกิน 12 ชม. → ปิดรอบเก่าเป็น STALE ก่อน
    update public.table_occupancies set ended_at = now(), end_reason = 'STALE'
     where table_id = t.id and ended_at is null and started_at <= now() - interval '12 hours';
    if exists (select 1 from public.bookings where table_id = t.id and status = 'CHECKED_IN')
       or exists (select 1 from public.table_occupancies where table_id = t.id and ended_at is null) then
      raise exception 'TABLE_ALREADY_IN_USE' using errcode = 'P0001';
    end if;
    begin
      insert into public.table_occupancies (bar_id, table_id, pax, note, started_by)
      values (z.bar_id, t.id, p_pax, v_note, p_actor)
      returning * into o;
    exception when unique_violation then
      raise exception 'TABLE_ALREADY_IN_USE' using errcode = 'P0001';
    end;
    perform public.app_audit(p_actor, 'table.occupy', 'tables', t.id, jsonb_build_object(
      'bar_id', z.bar_id, 'zone', z.name, 'table', t.name, 'occupancy_id', o.id, 'pax', p_pax, 'note', v_note));
  else
    update public.table_occupancies set ended_at = now(), ended_by = p_actor, end_reason = 'MANUAL'
     where table_id = t.id and ended_at is null
    returning * into o;
    if not found then
      if exists (select 1 from public.bookings where table_id = t.id and status = 'CHECKED_IN') then
        raise exception 'TABLE_HAS_GUEST' using errcode = 'P0001';
      end if;
      raise exception 'TABLE_NOT_IN_USE' using errcode = 'P0001';
    end if;
    perform public.app_audit(p_actor, 'table.release', 'tables', t.id, jsonb_build_object(
      'bar_id', z.bar_id, 'zone', z.name, 'table', t.name, 'occupancy_id', o.id,
      'minutes', round(extract(epoch from (o.ended_at - o.started_at)) / 60)));
  end if;

  return jsonb_build_object('table_id', t.id, 'in_use', p_in_use, 'occupancy_id', o.id,
                            'started_at', o.started_at, 'ended_at', o.ended_at);
end $$;
revoke all on function public.app_team_set_table_occupancy(uuid, uuid, boolean, integer, text) from public, anon, authenticated;
grant execute on function public.app_team_set_table_occupancy(uuid, uuid, boolean, integer, text) to service_role;

-- ---------------------------------------------------------------------
-- 4. การจองที่เช็กอินแล้วมาถึงโต๊ะ (เช็กอิน QR/รหัส/กดเอง หรือย้ายการจองที่เช็กอินแล้วเข้ามา)
--    → ปิดรอบ "กำลังใช้" ที่ตั้งเองบนโต๊ะนั้น · ผู้เขียน bookings ทุกตัวเป็น rpc ที่ตั้ง app.user_id แล้ว
-- ---------------------------------------------------------------------
create or replace function public.close_table_occupancy_on_check_in() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.table_occupancies
     set ended_at = now(), ended_by = nullif(current_setting('app.user_id', true), '')::uuid, end_reason = 'CHECKED_IN'
   where table_id = new.table_id and ended_at is null;
  return null;
end $$;
drop trigger if exists bookings_checkin_close_occupancy on public.bookings;
create trigger bookings_checkin_close_occupancy after update of status, table_id on public.bookings
  for each row when (new.status = 'CHECKED_IN' and new.table_id is not null
                     and (old.status is distinct from 'CHECKED_IN' or old.table_id is distinct from new.table_id))
  execute function public.close_table_occupancy_on_check_in();
revoke all on function public.close_table_occupancy_on_check_in() from public, anon, authenticated;
