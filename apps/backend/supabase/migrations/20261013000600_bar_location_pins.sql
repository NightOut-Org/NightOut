-- =====================================================================
-- bar · ตำแหน่งร้าน (หมุด) + แอดมินตรวจหมุด (Map Pin Review)
--   - bars + ที่จอดรถ (parking_note) · รถไฟฟ้าใกล้สุด (transit_line / transit_station / transit_walk_minutes)
--          + location_reviewed_at / location_reviewed_by (หมุดผ่านการตรวจล่าสุด · null = ยังไม่เคยตรวจ)
--     backfill: ร้านที่แสดง/ระงับอยู่และหมุดไม่ใช่ค่าเริ่มต้นเดิม (13.756300, 100.501800) = ถือว่าตรวจแล้วตอนอนุมัติ
--   - ตาราง bar_location_requests — คำขอแก้ตำแหน่งของร้าน (ค้างได้ 1 คำขอ/ร้าน) + แถวประวัติเมื่อแอดมินตั้งแทน
--     ทีมร้านทุกบทบาทอ่านได้ · แอดมินอ่านได้ทุกแถว · เขียนผ่านฟังก์ชันเท่านั้น
--   - helper: bar_location_from_json (ตรวจ + ทำให้เป็นรูปเดียวกัน 7 key) · bar_location_snapshot · bar_location_apply
--   - ร้าน (เจ้าของ/ผู้จัดการ): app_request_bar_location · app_cancel_bar_location_request
--       ร้านที่แสดง/ระงับอยู่ → คำขอรอแอดมินตรวจ (ระหว่างรอลูกค้าเห็นหมุดเดิม · ส่งใหม่ = แทนคำขอเดิม · แจ้งแอดมิน)
--       ร้านที่ยังไม่เคยแสดง → บันทึกทันที (ตรวจพร้อมการอนุมัติร้าน)
--   - แอดมิน: admin_review_bar_location (อนุมัติ / ปรับหมุดแล้วอนุมัติ / ตีกลับพร้อมเหตุผล)
--            admin_set_bar_location (ตั้งแทนร้าน ทุกสถานะ · มีผลทันที) — audit + แจ้งทีมร้านทุกครั้ง
--   - แทนที่ (ลายเซ็นเดิม):
--       app_merchant_join    — ต้องปักหมุด (lat/lng ในไทย) + ที่อยู่ · ที่จอดรถ/รถไฟฟ้าใส่ได้ · เลิกใส่หมุดค่าเริ่มต้น
--       admin_set_bar_status — อนุมัติร้านครั้งแรก = ตรวจหมุดไปพร้อมกัน · หมุดค่าเริ่มต้นเดิม → BAR_LOCATION_NOT_SET
--       app_update_bar_info  — ไม่แก้ address แล้ว (ที่อยู่/หมุดแก้ผ่าน app_request_bar_location)
--   - view: bar_detail / my_bar_detail + คอลัมน์ท้าย (ที่จอดรถ · รถไฟฟ้า · คำขอล่าสุด)
--           admin_bar_locations (1 แถว/ร้าน) · admin_bar_location_requests (ประวัติ) — Backoffice /bar-locations
--   ลำดับล็อกทุกฟังก์ชัน: แถว bars ก่อน แล้วค่อย bar_location_requests
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. bars — ที่จอดรถ / รถไฟฟ้าใกล้สุด / สถานะการตรวจหมุด
-- ---------------------------------------------------------------------
alter table public.bars
  add column parking_note text check (parking_note is null or char_length(parking_note) between 1 and 200),
  add column transit_line text check (transit_line in ('BTS','MRT','ARL','SRT')),
  add column transit_station text check (transit_station is null or char_length(transit_station) between 1 and 60),
  add column transit_walk_minutes smallint check (transit_walk_minutes between 1 and 60),
  add column location_reviewed_at timestamptz,                      -- หมุดผ่านการตรวจล่าสุด (null = ยังไม่เคยตรวจ)
  add column location_reviewed_by uuid references public.users(id) on delete set null,
  add constraint bars_transit_pair check ((transit_line is null) = (transit_station is null)),
  add constraint bars_transit_walk check (transit_walk_minutes is null or transit_station is not null);
create index bars_location_reviewed_by_fk on public.bars (location_reviewed_by);

-- ร้านที่แสดง/ระงับอยู่และหมุดไม่ใช่ค่าเริ่มต้น = ถือว่าตรวจแล้วตอนอนุมัติ
update public.bars set location_reviewed_at = coalesce(approved_at, created_at)
 where status in ('APPROVED','SUSPENDED') and not (lat = 13.756300 and lng = 100.501800);

-- ---------------------------------------------------------------------
-- 2. bar_location_requests — คำขอแก้ตำแหน่ง (ร้าน) + แถวประวัติ (แอดมินตั้งแทน)
-- ---------------------------------------------------------------------
create table public.bar_location_requests (
  id                   uuid primary key default gen_random_uuid(),
  bar_id               uuid not null references public.bars(id) on delete cascade,
  source               text not null default 'MERCHANT' check (source in ('MERCHANT','ADMIN')),
  status               text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  lat                  numeric(9,6) not null check (lat between 5.5 and 20.6),
  lng                  numeric(9,6) not null check (lng between 97.3 and 105.7),
  address              text not null check (char_length(address) between 3 and 300),
  parking_note         text check (parking_note is null or char_length(parking_note) between 1 and 200),
  transit_line         text check (transit_line in ('BTS','MRT','ARL','SRT')),
  transit_station      text check (transit_station is null or char_length(transit_station) between 1 and 60),
  transit_walk_minutes smallint check (transit_walk_minutes between 1 and 60),
  previous             jsonb not null,                -- ค่าใน bars ตอนส่ง (bar_location_snapshot)
  applied              jsonb,                         -- ค่าที่ใช้จริงตอนอนุมัติ (แอดมินอาจปรับ)
  admin_edited         boolean not null default false,
  reason               text check (reason is null or char_length(reason) <= 500),  -- เหตุผลตีกลับ / ยกเลิก / หมายเหตุแอดมิน
  requested_by         uuid references public.users(id) on delete set null,
  reviewed_by          uuid references public.users(id) on delete set null,
  reviewed_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check ((transit_line is null) = (transit_station is null)),
  check (transit_walk_minutes is null or transit_station is not null),
  check ((status = 'PENDING') = (reviewed_at is null)),
  check ((status = 'APPROVED') = (applied is not null)),
  check (status <> 'REJECTED' or reason is not null)
);
create unique index bar_location_requests_one_pending on public.bar_location_requests (bar_id) where status = 'PENDING';
create index bar_location_requests_bar_id_fk on public.bar_location_requests (bar_id, created_at desc);
create index bar_location_requests_requested_by_fk on public.bar_location_requests (requested_by);
create index bar_location_requests_reviewed_by_fk on public.bar_location_requests (reviewed_by);
create trigger bar_location_requests_updated_at before update on public.bar_location_requests
  for each row execute function public.set_updated_at();

alter table public.bar_location_requests enable row level security;
-- ทีมร้านทุกบทบาทดูได้ (แก้ได้เฉพาะเจ้าของ/ผู้จัดการ — ตรวจในฟังก์ชัน)
create policy bar_location_requests_read on public.bar_location_requests for select to authenticated
  using (public.is_bar_member(bar_id));
-- …001600 สร้าง admin_read ให้ตารางที่มีตอนนั้นเท่านั้น — ตารางใหม่ต้องเพิ่มเอง
create policy admin_read on public.bar_location_requests for select to authenticated using (public.is_admin());
revoke all on public.bar_location_requests from anon;   -- default privileges ของ Supabase ให้ anon อ่านได้ — ไม่ต้องใช้
revoke insert, update, delete, truncate on public.bar_location_requests from authenticated;
grant select on public.bar_location_requests to authenticated;

-- ---------------------------------------------------------------------
-- 3. helper
-- ---------------------------------------------------------------------
-- ตรวจ + ทำให้เป็นรูปเดียวกัน → {lat, lng, address, parking_note, transit_line, transit_station, transit_walk_minutes}
-- (ครบ 7 key เสมอ · ทศนิยม 6 ตำแหน่ง = numeric(9,6) → เทียบ jsonb ด้วย = ได้ตรง)
create or replace function public.bar_location_from_json(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_lat numeric; v_lng numeric; v_walk integer;
  v_address text; v_parking text; v_line text; v_station text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'INVALID_BAR_LOCATION' using errcode = '22023';
  end if;
  -- บล็อกนี้ครอบเฉพาะการแปลงชนิด — การตรวจค่าทั้งหมดอยู่ข้างล่าง (ไม่งั้น LOCATION_OUTSIDE_THAILAND ถูกกลืนเป็น INVALID_BAR_LOCATION)
  begin
    v_lat  := round((p->>'lat')::numeric, 6);
    v_lng  := round((p->>'lng')::numeric, 6);
    v_walk := nullif(trim(coalesce(p->>'transit_walk_minutes', '')), '')::integer;
  exception when others then
    raise exception 'INVALID_BAR_LOCATION' using errcode = '22023';
  end;
  v_address := trim(coalesce(p->>'address', ''));
  v_parking := nullif(trim(coalesce(p->>'parking_note', '')), '');
  v_line    := nullif(trim(coalesce(p->>'transit_line', '')), '');
  v_station := nullif(trim(coalesce(p->>'transit_station', '')), '');

  if v_lat is null or v_lng is null or v_lat = 'NaN'::numeric or v_lng = 'NaN'::numeric then
    raise exception 'INVALID_BAR_LOCATION' using errcode = '22023';
  end if;
  -- กรอบประเทศไทย (= THAILAND_BOUNDS ใน @nightout/utils)
  if v_lat not between 5.5 and 20.6 or v_lng not between 97.3 and 105.7 then
    raise exception 'LOCATION_OUTSIDE_THAILAND' using errcode = '22023';
  end if;
  if char_length(v_address) not between 3 and 300
     or char_length(v_parking) > 200
     or (v_line is not null and v_line not in ('BTS','MRT','ARL','SRT'))
     or (v_line is null) <> (v_station is null)
     or char_length(v_station) > 60
     or (v_walk is not null and (v_walk not between 1 and 60 or v_station is null)) then
    raise exception 'INVALID_BAR_LOCATION' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'lat', v_lat, 'lng', v_lng, 'address', v_address, 'parking_note', v_parking,
    'transit_line', v_line, 'transit_station', v_station, 'transit_walk_minutes', v_walk);
end $$;

-- ค่าตำแหน่งปัจจุบันของร้าน (รูปเดียวกับ bar_location_from_json)
create or replace function public.bar_location_snapshot(p_bar uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'lat', b.lat, 'lng', b.lng, 'address', b.address, 'parking_note', b.parking_note,
    'transit_line', b.transit_line, 'transit_station', b.transit_station, 'transit_walk_minutes', b.transit_walk_minutes)
  from public.bars b where b.id = p_bar
$$;

-- เขียนตำแหน่งลง bars · p_reviewer = แอดมินที่ตรวจ (null = ยังไม่ผ่านการตรวจ — ร้านที่ยังไม่เคยแสดงแก้เอง)
create or replace function public.bar_location_apply(p_bar uuid, p_loc jsonb, p_reviewer uuid) returns void
language plpgsql set search_path = '' as $$
begin
  update public.bars set
    lat                  = (p_loc->>'lat')::numeric,
    lng                  = (p_loc->>'lng')::numeric,
    address              = p_loc->>'address',
    parking_note         = p_loc->>'parking_note',
    transit_line         = p_loc->>'transit_line',
    transit_station      = p_loc->>'transit_station',
    transit_walk_minutes = (p_loc->>'transit_walk_minutes')::smallint,
    location_reviewed_at = case when p_reviewer is null then null else now() end,
    location_reviewed_by = p_reviewer
  where id = p_bar;
end $$;

-- ---------------------------------------------------------------------
-- 4. ร้าน (เจ้าของ / ผู้จัดการ) — ส่งตำแหน่ง / ยกเลิกคำขอ
-- ---------------------------------------------------------------------
-- p = {lat, lng, address, parking_note?, transit_line?, transit_station?, transit_walk_minutes?}
create or replace function public.app_request_bar_location(p_actor uuid, p_bar uuid, p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare b public.bars; v_loc jsonb; v_before jsonb; v_id uuid;
begin
  perform public.app_assert_user(p_actor);
  perform public.app_assert_manager(p_actor, p_bar);
  v_loc := public.bar_location_from_json(p);
  select * into b from public.bars where id = p_bar for update;
  if not found then raise exception 'BAR_NOT_FOUND' using errcode = 'P0002'; end if;
  v_before := public.bar_location_snapshot(p_bar);
  if v_loc = v_before then raise exception 'LOCATION_UNCHANGED' using errcode = '22023'; end if;

  -- ร้านยังไม่เคยแสดง → บันทึกทันที (ตรวจพร้อมการอนุมัติร้าน)
  if b.status not in ('APPROVED', 'SUSPENDED') then
    -- คำขอที่ค้างจากตอนร้านยังแสดงอยู่ (เช่นถูกตั้งเป็น REJECTED ภายหลัง) — ยกเลิก ไม่งั้นอนุมัติทีหลังจะทับหมุดใหม่
    update public.bar_location_requests
       set status = 'CANCELLED', reason = 'ร้านแก้ตำแหน่งใหม่แทน', reviewed_at = now()
     where bar_id = p_bar and status = 'PENDING';
    perform public.bar_location_apply(p_bar, v_loc, null);
    perform public.app_audit(p_actor, 'bar.location.update', 'bars', p_bar,
                             jsonb_build_object('before', v_before, 'after', v_loc));
    return jsonb_build_object('bar_id', p_bar, 'status', 'APPLIED', 'request_id', null);
  end if;

  -- ร้านที่แสดง/ระงับอยู่ → คำขอรอแอดมินตรวจ (bars ไม่ถูกแตะ — ลูกค้าเห็นหมุดเดิมจนกว่าจะอนุมัติ)
  update public.bar_location_requests
     set status = 'CANCELLED', reason = 'ร้านส่งตำแหน่งใหม่แทน', reviewed_at = now()
   where bar_id = p_bar and status = 'PENDING';
  insert into public.bar_location_requests (bar_id, source, status, lat, lng, address, parking_note,
                                            transit_line, transit_station, transit_walk_minutes, previous, requested_by)
  values (p_bar, 'MERCHANT', 'PENDING', (v_loc->>'lat')::numeric, (v_loc->>'lng')::numeric, v_loc->>'address',
          v_loc->>'parking_note', v_loc->>'transit_line', v_loc->>'transit_station',
          (v_loc->>'transit_walk_minutes')::smallint, v_before, p_actor)
  returning id into v_id;
  perform public.app_audit(p_actor, 'bar.location.request', 'bar_location_requests', v_id, v_loc);
  perform public.app_notify_admins('BAR_LOCATION_REQUEST', 'ร้านขอแก้ตำแหน่ง · ' || b.name, v_loc->>'address',
                                   '/bar-locations?bar=' || p_bar, null, p_bar);
  return jsonb_build_object('bar_id', p_bar, 'status', 'PENDING', 'request_id', v_id);
end $$;

-- ยกเลิกคำขอที่รอตรวจ (ลูกค้ายังเห็นหมุดเดิมต่อ)
create or replace function public.app_cancel_bar_location_request(p_actor uuid, p_bar uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  perform public.app_assert_user(p_actor);
  perform public.app_assert_manager(p_actor, p_bar);
  perform 1 from public.bars where id = p_bar for update;
  if not found then raise exception 'BAR_NOT_FOUND' using errcode = 'P0002'; end if;
  update public.bar_location_requests
     set status = 'CANCELLED', reason = 'ร้านยกเลิกคำขอ', reviewed_at = now()
   where bar_id = p_bar and status = 'PENDING'
  returning id into v_id;
  if v_id is null then raise exception 'LOCATION_REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.app_audit(p_actor, 'bar.location.cancel', 'bar_location_requests', v_id, null);
  return jsonb_build_object('bar_id', p_bar, 'request_id', v_id, 'cancelled', true);
end $$;

-- ---------------------------------------------------------------------
-- 5. แอดมิน — ตรวจคำขอ / ตั้งตำแหน่งแทนร้าน (audit + แจ้งทีมร้านทุกครั้ง)
-- ---------------------------------------------------------------------
-- p_approve true = อนุมัติ (p_location = แอดมินปรับก่อนอนุมัติ · null = ตามที่ร้านขอ) · false = ตีกลับ (ต้องมี p_reason)
create or replace function public.admin_review_bar_location(p_actor uuid, p_request uuid, p_approve boolean,
                                                            p_reason text default null, p_location jsonb default null)
returns jsonb language plpgsql set search_path = '' as $$
declare
  r public.bar_location_requests; v_bar uuid; v_req jsonb; v_loc jsonb; v_before jsonb;
  v_edited boolean; v_reason text;
begin
  perform public.admin_assert(p_actor);
  select bar_id into v_bar from public.bar_location_requests where id = p_request;
  if not found then raise exception 'LOCATION_REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  perform 1 from public.bars where id = v_bar for update;          -- ล็อกร้านก่อนคำขอ (ลำดับเดียวกับฝั่งร้าน)
  select * into r from public.bar_location_requests where id = p_request for update;
  if not found then raise exception 'LOCATION_REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  if r.status <> 'PENDING' then raise exception 'LOCATION_REQUEST_ALREADY_REVIEWED' using errcode = 'P0001'; end if;

  -- ตีกลับ
  if p_approve is not true then
    v_reason := left(nullif(btrim(coalesce(p_reason, ''), E' \t\r\n'), ''), 500);
    if v_reason is null then raise exception 'LOCATION_REJECT_REASON_REQUIRED' using errcode = '22023'; end if;
    update public.bar_location_requests
       set status = 'REJECTED', reason = v_reason, reviewed_by = p_actor, reviewed_at = now()
     where id = p_request;
    perform public.admin_audit(p_actor, 'bar.location.reject', 'bar_location_requests', p_request, null,
                               jsonb_build_object('reason', v_reason));
    perform public.app_notify_team(r.bar_id, 'BAR_LOCATION_REJECTED', 'ตำแหน่งร้านที่ส่งไม่ผ่านการตรวจ',
                                   v_reason, '/merchant/location');
    return jsonb_build_object('id', p_request, 'bar_id', r.bar_id, 'status', 'REJECTED', 'admin_edited', false);
  end if;

  -- อนุมัติ (แอดมินอาจปรับก่อน)
  v_req := jsonb_build_object(
    'lat', r.lat, 'lng', r.lng, 'address', r.address, 'parking_note', r.parking_note,
    'transit_line', r.transit_line, 'transit_station', r.transit_station, 'transit_walk_minutes', r.transit_walk_minutes);
  v_loc := case when p_location is null or jsonb_typeof(p_location) = 'null' then v_req
                else public.bar_location_from_json(p_location) end;
  v_edited := v_loc <> v_req;
  v_before := public.bar_location_snapshot(r.bar_id);
  perform public.bar_location_apply(r.bar_id, v_loc, p_actor);
  update public.bar_location_requests
     set status = 'APPROVED', applied = v_loc, admin_edited = v_edited, reviewed_by = p_actor, reviewed_at = now()
   where id = p_request;
  perform public.admin_audit(p_actor, 'bar.location.approve', 'bar_location_requests', p_request, v_before,
                             v_loc || jsonb_build_object('admin_edited', v_edited));
  perform public.app_notify_team(r.bar_id, 'BAR_LOCATION_APPROVED', 'ตำแหน่งร้านผ่านการตรวจแล้ว',
    case when v_edited then 'ทีม NightOut ปรับหมุด/ข้อมูลเล็กน้อยก่อนอนุมัติ — ดูได้ที่หน้าตำแหน่งร้าน'
         else 'หมุดใหม่แสดงบนแผนที่แล้ว' end,
    '/merchant/location');
  return jsonb_build_object('id', p_request, 'bar_id', r.bar_id, 'status', 'APPROVED', 'admin_edited', v_edited);
end $$;

-- แอดมินตั้งตำแหน่งแทนร้าน (ทุกสถานะร้าน รวมร้านใหม่ก่อนอนุมัติ) · มีผลทันที + ถือว่าตรวจแล้ว
-- ส่งค่าเดิม = ยืนยันหมุดเดิม (เช่นร้านเก่าที่ยังไม่เคยตรวจ) · คำขอที่ค้างถูกยกเลิก · เก็บแถวประวัติ source = ADMIN
create or replace function public.admin_set_bar_location(p_actor uuid, p_bar uuid, p jsonb, p_note text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare v_loc jsonb; v_before jsonb; v_note text; v_id uuid;
begin
  perform public.admin_assert(p_actor);
  v_loc := public.bar_location_from_json(p);
  perform 1 from public.bars where id = p_bar for update;
  if not found then raise exception 'BAR_NOT_FOUND' using errcode = 'P0002'; end if;
  v_before := public.bar_location_snapshot(p_bar);
  v_note := left(nullif(btrim(coalesce(p_note, ''), E' \t\r\n'), ''), 500);

  update public.bar_location_requests
     set status = 'CANCELLED', reason = 'ทีม NightOut ตั้งตำแหน่งแทนแล้ว', reviewed_by = p_actor, reviewed_at = now()
   where bar_id = p_bar and status = 'PENDING';
  perform public.bar_location_apply(p_bar, v_loc, p_actor);
  insert into public.bar_location_requests (bar_id, source, status, lat, lng, address, parking_note,
                                            transit_line, transit_station, transit_walk_minutes, previous, applied,
                                            reason, requested_by, reviewed_by, reviewed_at)
  values (p_bar, 'ADMIN', 'APPROVED', (v_loc->>'lat')::numeric, (v_loc->>'lng')::numeric, v_loc->>'address',
          v_loc->>'parking_note', v_loc->>'transit_line', v_loc->>'transit_station',
          (v_loc->>'transit_walk_minutes')::smallint, v_before, v_loc, v_note, p_actor, p_actor, now())
  returning id into v_id;
  perform public.admin_audit(p_actor, 'bar.location.set', 'bars', p_bar, v_before,
                             v_loc || jsonb_build_object('note', v_note));
  if v_loc = v_before then
    perform public.app_notify_team(p_bar, 'BAR_LOCATION_SET', 'ทีม NightOut ตรวจตำแหน่งร้านของคุณแล้ว',
                                   coalesce(v_note, 'หมุดเดิมถูกต้อง'), '/merchant/location');
  else
    perform public.app_notify_team(p_bar, 'BAR_LOCATION_SET', 'ทีม NightOut แก้ตำแหน่งร้านของคุณ',
                                   coalesce(v_note, v_loc->>'address'), '/merchant/location');
  end if;
  return jsonb_build_object('bar_id', p_bar, 'request_id', v_id);
end $$;

-- ---------------------------------------------------------------------
-- 6. แทนที่ฟังก์ชันเดิม (ลายเซ็นเดิมทุกตัว)
-- ---------------------------------------------------------------------
-- สมัครเป็นร้าน {name, category, district_id, license, lat, lng, address, parking_note?, transit_line?, transit_station?,
-- transit_walk_minutes?} → ร้านสถานะ PENDING_REVIEW + ผู้สมัครเป็นเจ้าของ (นิยามเดิม …001700 + หมุดจริงจากผู้สมัคร)
-- ผู้สมัครได้ role MERCHANT ทันทีเพื่อเตรียมเมนู/โต๊ะ ระหว่างรอตรวจ (ลูกค้ายังไม่เห็นร้านจนกว่าแอดมินอนุมัติ)
-- หมุดยังไม่นับว่าตรวจแล้ว (location_reviewed_at = null) — ตรวจพร้อมการอนุมัติร้าน (admin_set_bar_status)
create or replace function public.app_merchant_join(p_actor uuid, p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare u public.users; v_id uuid; v_slug text; v_loc jsonb;
begin
  u := public.app_assert_user(p_actor);
  if exists (select 1 from public.bars b join public.bar_staff s on s.bar_id = b.id
             where s.user_id = p_actor and s.role = 'OWNER' and s.revoked_at is null and b.status in ('DRAFT','PENDING_REVIEW')) then
    raise exception 'APPLICATION_PENDING' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p->>'name', ''))) not between 1 and 80 then
    raise exception 'INVALID_BAR_INFO' using errcode = '22023';
  end if;
  v_loc := public.bar_location_from_json(p);   -- INVALID_BAR_LOCATION / LOCATION_OUTSIDE_THAILAND
  loop
    v_slug := 'bar-' || substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 8);
    exit when not exists (select 1 from public.bars where slug = v_slug::extensions.citext);
  end loop;
  insert into public.bars (owner_id, slug, name, category, address, district_id, lat, lng,
                           parking_note, transit_line, transit_station, transit_walk_minutes, status)
  values (p_actor, v_slug, trim(p->>'name'), (p->>'category')::public.bar_category, v_loc->>'address',
          nullif(p->>'district_id', '')::uuid, (v_loc->>'lat')::numeric, (v_loc->>'lng')::numeric,
          v_loc->>'parking_note', v_loc->>'transit_line', v_loc->>'transit_station',
          (v_loc->>'transit_walk_minutes')::smallint, 'PENDING_REVIEW')
  returning id into v_id;
  if coalesce(trim(p->>'license'), '') <> '' then
    insert into public.bar_verifications (bar_id, document_type, storage_path, note)
    values (v_id, 'LICENSE_NUMBER', '', trim(p->>'license'));
  end if;
  update public.users set role = 'MERCHANT' where id = p_actor and role in ('CUSTOMER','STAFF');
  perform public.app_notify_admins('BAR_APPLICATION', 'มีร้านสมัครใหม่รอตรวจ', trim(p->>'name') || ' · ' || u.email, '/merchants', null, v_id);
  return jsonb_build_object('id', v_id, 'slug', v_slug, 'status', 'PENDING_REVIEW');
end $$;

-- ร้าน: อนุมัติ / ไม่อนุมัติ / ระงับ / เปิดใช้งานอีกครั้ง (นิยามเดิม …001600)
-- + อนุมัติครั้งแรก (จากสถานะที่ยังไม่เคยแสดง) = ตรวจหมุดไปพร้อมกัน → location_reviewed_at/by
--   หมุดยังเป็นค่าเริ่มต้นของระบบเดิม → BAR_LOCATION_NOT_SET · สลับ แสดง ↔ ระงับ (admin_set_bars_status) ไม่กระทบ
create or replace function public.admin_set_bar_status(p_actor uuid, p_bar uuid, p_status public.bar_status, p_reason text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare old_status public.bar_status; v_lat numeric; v_lng numeric; v_first boolean;
begin
  perform public.admin_assert(p_actor);
  select status, lat, lng into old_status, v_lat, v_lng from public.bars where id = p_bar for update;
  if not found then raise exception 'BAR_NOT_FOUND' using errcode = 'P0002'; end if;
  v_first := p_status = 'APPROVED' and old_status not in ('APPROVED', 'SUSPENDED');
  if v_first and v_lat = 13.756300 and v_lng = 100.501800 then
    raise exception 'BAR_LOCATION_NOT_SET' using errcode = 'P0001';
  end if;
  update public.bars set status = p_status, status_reason = p_reason,
         approved_at = case when p_status = 'APPROVED' then coalesce(approved_at, now()) else approved_at end,
         location_reviewed_at = case when v_first then now() else location_reviewed_at end,
         location_reviewed_by = case when v_first then p_actor else location_reviewed_by end
   where id = p_bar;
  perform public.admin_audit(p_actor, 'bar.status', 'bars', p_bar,
    jsonb_build_object('status', old_status), jsonb_build_object('status', p_status, 'reason', p_reason));
  return jsonb_build_object('id', p_bar, 'status', p_status);
end $$;

-- {name, description, phone, district_id, style_keys[], hours[{day_of_week,open_time,close_time,is_closed}], links[{type,url}]}
-- (นิยามเดิม …001700 ตัดการแก้ address ออก — ที่อยู่/หมุดแก้ผ่าน app_request_bar_location เท่านั้น)
create or replace function public.app_update_bar_info(p_actor uuid, p_bar uuid, p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare h jsonb; l jsonb; i integer := 0;
begin
  perform public.app_assert_user(p_actor);
  perform public.app_assert_manager(p_actor, p_bar);
  update public.bars set
    name        = case when p ? 'name' then trim(p->>'name') else name end,
    description = case when p ? 'description' then nullif(trim(p->>'description'), '') else description end,
    -- address: ไม่แก้ที่นี่แล้ว (ที่อยู่/หมุดผ่าน app_request_bar_location → แอดมินตรวจ)
    phone       = case when p ? 'phone' then nullif(trim(p->>'phone'), '') else phone end,
    district_id = case when p ? 'district_id' then nullif(p->>'district_id', '')::uuid else district_id end
  where id = p_bar;
  if p ? 'style_keys' then
    delete from public.bar_styles where bar_id = p_bar;
    insert into public.bar_styles (bar_id, style_id)
    select p_bar, s.id from public.styles s where s.key in (select jsonb_array_elements_text(p->'style_keys'));
  end if;
  if p ? 'hours' then
    delete from public.bar_hours where bar_id = p_bar;
    for h in select * from jsonb_array_elements(p->'hours') loop
      insert into public.bar_hours (bar_id, day_of_week, open_time, close_time, is_closed)
      values (p_bar, (h->>'day_of_week')::smallint,
              case when coalesce((h->>'is_closed')::boolean, false) then null else (h->>'open_time')::time end,
              case when coalesce((h->>'is_closed')::boolean, false) then null else (h->>'close_time')::time end,
              coalesce((h->>'is_closed')::boolean, false));
    end loop;
  end if;
  if p ? 'links' then
    delete from public.bar_links where bar_id = p_bar;
    for l in select * from jsonb_array_elements(p->'links') loop
      begin
        insert into public.bar_links (bar_id, type, url, sort_order) values (p_bar, (l->>'type')::public.link_type, l->>'url', i);
      exception when check_violation then
        raise exception 'INVALID_LINK' using errcode = '22023', detail = l->>'type';
      end;
      i := i + 1;
    end loop;
  end if;
  perform public.app_audit(p_actor, 'bar.update_info', 'bars', p_bar, p - 'hours' - 'links');
  return jsonb_build_object('id', p_bar);
end $$;

-- ---------------------------------------------------------------------
-- 7. view — bar_detail / my_bar_detail + คอลัมน์ท้าย (create or replace ได้ สิทธิ์เดิมคงอยู่)
-- ---------------------------------------------------------------------
-- bar_detail (นิยามเดิม …20261008000400) + ที่จอดรถ / รถไฟฟ้าใกล้สุด ต่อท้าย safety
create or replace view public.bar_detail with (security_invoker = true) as
select
  c.*,
  b.description,
  b.address,
  b.phone,
  b.perks,
  coalesce((select jsonb_agg(jsonb_build_object(
              'day_of_week', h.day_of_week,
              'open_time',   to_char(h.open_time,  'HH24:MI'),
              'close_time',  to_char(h.close_time, 'HH24:MI'),
              'is_closed',   h.is_closed) order by h.day_of_week)
            from public.bar_hours h where h.bar_id = b.id), '[]'::jsonb)                             as hours,
  coalesce((select jsonb_agg(jsonb_build_object(
              'date',       sh.date,
              'open_time',  to_char(sh.open_time,  'HH24:MI'),
              'close_time', to_char(sh.close_time, 'HH24:MI'),
              'is_closed',  sh.is_closed,
              'note',       sh.note) order by sh.date)
            from public.bar_special_hours sh where sh.bar_id = b.id and sh.date >= current_date), '[]'::jsonb) as special_hours,
  coalesce((select jsonb_agg(jsonb_build_object(
              'id', m.id, 'kind', m.kind, 'storage_path', m.storage_path, 'caption', m.caption,
              'width', m.width, 'height', m.height, 'duration_sec', m.duration_sec) order by m.sort_order, m.created_at)
            from public.bar_media m where m.bar_id = b.id), '[]'::jsonb)                             as media,
  coalesce((select jsonb_agg(jsonb_build_object('type', l.type, 'url', l.url) order by l.sort_order, l.created_at)
            from public.bar_links l where l.bar_id = b.id), '[]'::jsonb)                             as links,
  case when bs.bar_id is null then null else jsonb_build_object(
    'deposit_amount',          bs.deposit_amount,
    'deposit_unit',            bs.deposit_unit,
    'deposit_policy',          bs.deposit_policy,
    'refund_before_hours',     bs.refund_before_hours,
    'grace_minutes',           bs.grace_minutes,
    'pending_timeout_minutes', bs.pending_timeout_minutes,
    'deposit_timeout_minutes', bs.deposit_timeout_minutes,
    'max_pax_per_booking',     bs.max_pax_per_booking,
    'min_advance_minutes',     bs.min_advance_minutes,
    'max_advance_days',        bs.max_advance_days) end                                             as booking_settings,
  coalesce((select jsonb_agg(jsonb_build_object(
              'fee_type', f.fee_type, 'label', f.label, 'calc', f.calc, 'value', f.value) order by f.apply_order, f.created_at)
            from public.bar_fees f where f.bar_id = b.id and f.active), '[]'::jsonb)                 as fees,
  coalesce((select jsonb_agg(jsonb_build_object(
              'id', mi.id, 'category', mc.name, 'name', mi.name, 'description', mi.description,
              'price', mi.price, 'unit_label', mi.unit_label, 'image_path', mi.image_path,
              'is_available', mi.is_available) order by mc.sort_order nulls last, mi.sort_order, mi.name)
            from public.menu_items mi left join public.menu_categories mc on mc.id = mi.category_id
            where mi.bar_id = b.id), '[]'::jsonb)                                                    as menu,
  coalesce((select jsonb_agg(jsonb_build_object(
              'id', pp.id, 'name', pp.name, 'description', pp.description, 'pax_min', pp.pax_min, 'pax_max', pp.pax_max,
              'total_price', pp.total_price, 'fees_included', pp.fees_included,
              'items', coalesce((select jsonb_agg(jsonb_build_object(
                          'menu_item_id', pi.menu_item_id, 'name', pi.name_snapshot,
                          'quantity', pi.quantity, 'unit_price', pi.unit_price_snapshot) order by pi.sort_order, pi.name_snapshot)
                        from public.price_package_items pi where pi.package_id = pp.id), '[]'::jsonb))
            order by pp.pax_min, pp.name)
            from public.price_packages pp where pp.bar_id = b.id and pp.active), '[]'::jsonb)         as packages,
  coalesce((select jsonb_agg(jsonb_build_object(
              'id', pr.id, 'title', pr.title, 'description', pr.description, 'perk_type', pr.perk_type,
              'discount_percent', pr.discount_percent, 'days_of_week', to_jsonb(pr.days_of_week),
              'valid_from', pr.valid_from, 'valid_to', pr.valid_to,
              'cutoff_time', to_char(pr.cutoff_time, 'HH24:MI'), 'min_pax', pr.min_pax) order by pr.sort_order, pr.title)
            from public.bar_promotions pr
            where pr.bar_id = b.id and pr.active and pr.moderation_status = 'APPROVED'
              and (pr.valid_to is null or pr.valid_to >= current_date)), '[]'::jsonb)               as promotions,
  coalesce((select jsonb_agg(jsonb_build_object(
              'id', z.id, 'name', z.name, 'capacity_pax', z.capacity_pax,
              'default_duration_minutes', z.default_duration_minutes,
              'allow_zone_only_booking', z.allow_zone_only_booking,
              'tables', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'seats', t.seats) order by t.name)
                                  from public.tables t where t.zone_id = z.id and t.active), '[]'::jsonb))
            order by z.sort_order, z.name)
            from public.table_zones z where z.bar_id = b.id and z.active), '[]'::jsonb)              as zones,
  coalesce((select jsonb_agg(jsonb_build_object(
              'key', sf.key, 'name_th', sf.name_th, 'icon', sf.icon,
              'value', coalesce(bsf.value, 'UNKNOWN'), 'source', bsf.source, 'verified_at', bsf.verified_at)
            order by sf.sort_order, sf.key)
            from public.safety_features sf
            left join public.bar_safety_features bsf on bsf.feature_key = sf.key and bsf.bar_id = b.id), '[]'::jsonb) as safety,
  b.parking_note,
  b.transit_line,
  b.transit_station,
  b.transit_walk_minutes
from public.bar_cards c
join public.bars b on b.id = c.id
left join public.bar_booking_settings bs on bs.bar_id = b.id;

-- my_bar_detail (นิยามเดิม …20261009000100) + ที่จอดรถ / รถไฟฟ้า / หมุดตรวจล่าสุด / คำขอล่าสุด (ทุกสถานะ) ต่อท้าย media
create or replace view public.my_bar_detail with (security_invoker = true) as
select
  b.id, b.slug, b.name, b.category, b.lat, b.lng, b.cover_image_url, b.cover_style,
  case when d.id is null then null else jsonb_build_object('id', d.id, 'slug', d.slug, 'name_th', d.name_th) end as district,
  coalesce((select jsonb_agg(s.key order by s.sort_order, s.key)
            from public.bar_styles bs join public.styles s on s.id = bs.style_id where bs.bar_id = b.id), '[]'::jsonb) as styles,
  exists (select 1 from public.bar_pr_counts p where p.bar_id = b.id) as has_pr,
  (select jsonb_build_object(
            'male',   coalesce(max(p.pr_count) filter (where p.gender = 'MALE'),   0),
            'female', coalesce(max(p.pr_count) filter (where p.gender = 'FEMALE'), 0),
            'lgbtq',  coalesce(max(p.pr_count) filter (where p.gender = 'LGBTQ'),  0))
   from public.bar_pr_counts p where p.bar_id = b.id) as pr_counts,
  st.current_stars, st.current_tier, coalesce(st.is_new, true) as is_new, st.rating_avg,
  coalesce(st.rating_count, 0) as rating_count, coalesce(st.checkin_count, 0) as checkin_count,
  st.avg_price_per_person, st.safety_score, st.score, ls.current_crowd, ls.crowd_updated_at,
  public.bar_is_promoted(b.id) as is_promoted,
  b.description, b.address, b.phone, b.perks,
  coalesce((select jsonb_agg(jsonb_build_object(
              'day_of_week', h.day_of_week, 'open_time', to_char(h.open_time, 'HH24:MI'),
              'close_time', to_char(h.close_time, 'HH24:MI'), 'is_closed', h.is_closed) order by h.day_of_week)
            from public.bar_hours h where h.bar_id = b.id), '[]'::jsonb) as hours,
  coalesce((select jsonb_agg(jsonb_build_object('type', l.type, 'url', l.url) order by l.sort_order, l.created_at)
            from public.bar_links l where l.bar_id = b.id), '[]'::jsonb) as links,
  case when bs.bar_id is null then null else jsonb_build_object(
    'deposit_amount', bs.deposit_amount, 'deposit_unit', bs.deposit_unit, 'deposit_policy', bs.deposit_policy,
    'refund_before_hours', bs.refund_before_hours, 'grace_minutes', bs.grace_minutes,
    'pending_timeout_minutes', bs.pending_timeout_minutes, 'deposit_timeout_minutes', bs.deposit_timeout_minutes,
    'max_pax_per_booking', bs.max_pax_per_booking, 'min_advance_minutes', bs.min_advance_minutes,
    'max_advance_days', bs.max_advance_days) end as booking_settings,
  coalesce((select jsonb_agg(jsonb_build_object('fee_type', f.fee_type, 'label', f.label, 'calc', f.calc, 'value', f.value)
            order by f.apply_order, f.created_at) from public.bar_fees f where f.bar_id = b.id and f.active), '[]'::jsonb) as fees,
  coalesce((select jsonb_agg(jsonb_build_object(
              'id', mi.id, 'category', mc.name, 'name', mi.name, 'description', mi.description, 'price', mi.price,
              'unit_label', mi.unit_label, 'image_path', mi.image_path, 'is_available', mi.is_available)
            order by mi.sort_order, mi.name)
            from public.menu_items mi left join public.menu_categories mc on mc.id = mi.category_id
            where mi.bar_id = b.id), '[]'::jsonb) as menu,
  coalesce((select jsonb_agg(jsonb_build_object(
              'id', pp.id, 'name', pp.name, 'description', pp.description, 'pax_min', pp.pax_min, 'pax_max', pp.pax_max,
              'total_price', pp.total_price, 'fees_included', pp.fees_included,
              'items', coalesce((select jsonb_agg(jsonb_build_object('menu_item_id', pi.menu_item_id, 'name', pi.name_snapshot,
                                   'quantity', pi.quantity, 'unit_price', pi.unit_price_snapshot) order by pi.sort_order, pi.name_snapshot)
                                 from public.price_package_items pi where pi.package_id = pp.id), '[]'::jsonb))
            order by pp.pax_min, pp.name)
            from public.price_packages pp where pp.bar_id = b.id and pp.active), '[]'::jsonb) as packages,
  coalesce((select jsonb_agg(jsonb_build_object(
              'id', pr.id, 'title', pr.title, 'description', pr.description, 'perk_type', pr.perk_type,
              'discount_percent', pr.discount_percent, 'days_of_week', to_jsonb(pr.days_of_week),
              'valid_from', pr.valid_from, 'valid_to', pr.valid_to, 'cutoff_time', to_char(pr.cutoff_time, 'HH24:MI'),
              'min_pax', pr.min_pax, 'active', pr.active, 'moderation_status', pr.moderation_status)
            order by pr.sort_order, pr.created_at)
            from public.bar_promotions pr where pr.bar_id = b.id), '[]'::jsonb) as promotions,
  coalesce((select jsonb_agg(jsonb_build_object(
              'id', z.id, 'name', z.name, 'capacity_pax', z.capacity_pax,
              'default_duration_minutes', z.default_duration_minutes, 'allow_zone_only_booking', z.allow_zone_only_booking,
              'tables', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'seats', t.seats) order by t.name)
                                  from public.tables t where t.zone_id = z.id and t.active), '[]'::jsonb))
            order by z.sort_order, z.name)
            from public.table_zones z where z.bar_id = b.id and z.active), '[]'::jsonb) as zones,
  coalesce((select jsonb_agg(jsonb_build_object(
              'key', sf.key, 'name_th', sf.name_th, 'icon', sf.icon, 'value', coalesce(bsf.value, 'UNKNOWN'),
              'source', bsf.source, 'verified_at', bsf.verified_at) order by sf.sort_order, sf.key)
            from public.safety_features sf
            left join public.bar_safety_features bsf on bsf.feature_key = sf.key and bsf.bar_id = b.id), '[]'::jsonb) as safety,
  b.status, b.status_reason, m.role as staff_role,
  (select jsonb_build_object('bank_code', pa.bank_code, 'account_name', pa.account_name,
                             'account_no_last4', pa.account_no_last4, 'verified_at', pa.verified_at)
   from public.bar_payout_accounts pa where pa.bar_id = b.id and pa.is_default) as payout_account,
  b.created_at, b.updated_at,
  coalesce((select jsonb_agg(jsonb_build_object(
              'id', md.id, 'kind', md.kind, 'storage_path', md.storage_path, 'caption', md.caption,
              'width', md.width, 'height', md.height, 'duration_sec', md.duration_sec) order by md.sort_order, md.created_at)
            from public.bar_media md where md.bar_id = b.id), '[]'::jsonb) as media,
  b.parking_note, b.transit_line, b.transit_station, b.transit_walk_minutes, b.location_reviewed_at,
  (select jsonb_build_object('id', r.id, 'status', r.status, 'source', r.source, 'lat', r.lat, 'lng', r.lng,
            'address', r.address, 'parking_note', r.parking_note, 'transit_line', r.transit_line,
            'transit_station', r.transit_station, 'transit_walk_minutes', r.transit_walk_minutes,
            'applied', r.applied, 'admin_edited', r.admin_edited, 'reason', r.reason,
            'created_at', r.created_at, 'reviewed_at', r.reviewed_at)
   from public.bar_location_requests r where r.bar_id = b.id
   order by r.created_at desc limit 1) as location_request
from public.bars b
join public.bar_staff m on m.bar_id = b.id and m.user_id = auth.uid() and m.accepted_at is not null and m.revoked_at is null
left join public.districts            d  on d.id = b.district_id
left join public.bar_stats            st on st.bar_id = b.id
left join public.bar_live_status      ls on ls.bar_id = b.id
left join public.bar_booking_settings bs on bs.bar_id = b.id;

-- ---------------------------------------------------------------------
-- 8. view ของ Backoffice /bar-locations (security_invoker + where is_admin())
-- ---------------------------------------------------------------------
-- admin_bar_locations — 1 แถวต่อร้าน (ทุกสถานะ) + คำขอที่รอตรวจ (ถ้ามี)
create view public.admin_bar_locations with (security_invoker = true) as
select
  b.id, b.slug, b.name, b.status,
  case when d.id is null then null else jsonb_build_object('id', d.id, 'slug', d.slug, 'name_th', d.name_th) end as district,
  case when o.id is null then null else jsonb_build_object('id', o.id, 'email', o.email, 'display_name', o.display_name) end as owner,
  b.lat, b.lng, b.address, b.parking_note, b.transit_line, b.transit_station, b.transit_walk_minutes,
  b.location_reviewed_at,
  case when rv.id is null then null else jsonb_build_object('id', rv.id, 'display_name', rv.display_name) end as location_reviewed_by,
  (b.lat = 13.756300 and b.lng = 100.501800) as is_default_pin,      -- หมุดค่าเริ่มต้นของระบบเดิม (ร้านไม่ได้ปักเอง)
  (pr.id is not null) as location_pending,
  case when pr.id is null then null else jsonb_build_object(
    'id', pr.id, 'lat', pr.lat, 'lng', pr.lng, 'address', pr.address, 'parking_note', pr.parking_note,
    'transit_line', pr.transit_line, 'transit_station', pr.transit_station, 'transit_walk_minutes', pr.transit_walk_minutes,
    'created_at', pr.created_at,
    'requested_by', case when ru.id is null then null
                         else jsonb_build_object('id', ru.id, 'email', ru.email, 'display_name', ru.display_name) end) end as pending_request,
  pr.created_at as pending_since,
  b.updated_at
from public.bars b
left join public.districts d  on d.id = b.district_id
left join public.users     o  on o.id = b.owner_id
left join public.users     rv on rv.id = b.location_reviewed_by
left join public.bar_location_requests pr on pr.bar_id = b.id and pr.status = 'PENDING'
left join public.users     ru on ru.id = pr.requested_by
where public.is_admin();

-- admin_bar_location_requests — ประวัติคำขอ / การตั้งแทนทุกครั้ง
create view public.admin_bar_location_requests with (security_invoker = true) as
select
  r.id, r.bar_id,
  jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'status', b.status) as bar,
  r.source, r.status, r.lat, r.lng, r.address, r.parking_note, r.transit_line, r.transit_station, r.transit_walk_minutes,
  r.previous, r.applied, r.admin_edited, r.reason,
  case when ru.id is null then null else jsonb_build_object('id', ru.id, 'email', ru.email, 'display_name', ru.display_name) end as requested_by,
  case when rv.id is null then null else jsonb_build_object('id', rv.id, 'display_name', rv.display_name) end as reviewed_by,
  r.created_at, r.reviewed_at
from public.bar_location_requests r
join public.bars b on b.id = r.bar_id
left join public.users ru on ru.id = r.requested_by
left join public.users rv on rv.id = r.reviewed_by
where public.is_admin();

-- ---------------------------------------------------------------------
-- 9. สิทธิ์
-- ---------------------------------------------------------------------
revoke all on public.admin_bar_locations, public.admin_bar_location_requests from anon;
grant select on public.admin_bar_locations, public.admin_bar_location_requests to authenticated;

-- ฟังก์ชันใหม่ + ตัวที่แทนที่ (ระบุซ้ำให้ชัด) — NestJS service_role เท่านั้น
revoke all on function
  public.bar_location_from_json(jsonb),
  public.bar_location_snapshot(uuid),
  public.bar_location_apply(uuid, jsonb, uuid),
  public.app_request_bar_location(uuid, uuid, jsonb),
  public.app_cancel_bar_location_request(uuid, uuid),
  public.admin_review_bar_location(uuid, uuid, boolean, text, jsonb),
  public.admin_set_bar_location(uuid, uuid, jsonb, text),
  public.app_merchant_join(uuid, jsonb),
  public.admin_set_bar_status(uuid, uuid, public.bar_status, text),
  public.app_update_bar_info(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function
  public.bar_location_from_json(jsonb),
  public.bar_location_snapshot(uuid),
  public.bar_location_apply(uuid, jsonb, uuid),
  public.app_request_bar_location(uuid, uuid, jsonb),
  public.app_cancel_bar_location_request(uuid, uuid),
  public.admin_review_bar_location(uuid, uuid, boolean, text, jsonb),
  public.admin_set_bar_location(uuid, uuid, jsonb, text),
  public.app_merchant_join(uuid, jsonb),
  public.admin_set_bar_status(uuid, uuid, public.bar_status, text),
  public.app_update_bar_info(uuid, uuid, jsonb)
  to service_role;
