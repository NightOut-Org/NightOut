-- NightOut · ข้อความที่ DB สร้าง (แจ้งเตือน · เหตุผล · audit) เลิกใช้ " · " คั่น — กฎข้อความ UI (CLAUDE.md · ตกลง 2026-10-20)
-- ประกาศฟังก์ชันตัวล่าสุดซ้ำทั้งตัว เปลี่ยนเฉพาะสตริงที่มีตัวคั่น (สร้างด้วยสคริปต์ · พฤติกรรมอื่นเหมือนเดิม · สิทธิ์/trigger เดิมคงอยู่เพราะ create or replace)
-- แจ้งเตือนที่ส่งไปแล้วไม่ถูกแก้ย้อนหลัง
-- 29 ฟังก์ชัน: app_create_booking_core admin_moderate_bar_promotion app_cancel_booking app_order_promotion app_set_bar_promotions app_set_safety_evidence app_submit_deposit app_team_move_booking app_team_refund_deposit admin_community_moderate app_save_safety app_extend_booking app_join_share run_booking_timeouts app_merchant_join app_request_bar_location admin_blacklist_bar admin_report_no_table app_team_report_no_table bars_owner_blacklist_notify handle_bar_status_notify admin_inspect_safety app_community_add_comment admin_ban_user admin_save_bar_details admin_payment_mark_refunded handle_booking_status_effects payment_apply_event admin_remove_user_avatar

-- admin_moderate_bar_promotion(uuid,uuid,boolean,text) · เดิมใน 20261002001700_app_actions.sql
create or replace function public.admin_moderate_bar_promotion(p_actor uuid, p_promotion uuid, p_approve boolean, p_reason text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare pr public.bar_promotions;
begin
  perform public.admin_assert(p_actor);
  select * into pr from public.bar_promotions where id = p_promotion for update;
  if not found then raise exception 'PROMOTION_NOT_FOUND' using errcode = 'P0002'; end if;
  update public.bar_promotions
     set moderation_status = case when p_approve then 'APPROVED'::public.moderation_status else 'REJECTED'::public.moderation_status end,
         moderated_by = p_actor
   where id = p_promotion;
  perform public.app_notify_team(pr.bar_id, 'PROMOTION_TEXT_REVIEWED',
    case when p_approve then 'โปรโมชันผ่านการตรวจแล้ว' else 'โปรโมชันไม่ผ่านการตรวจ' end,
    pr.title || coalesce(' ' || nullif(trim(p_reason), ''), ''), '/merchant/promotions');
  perform public.admin_audit(p_actor, case when p_approve then 'bar_promotion.approve' else 'bar_promotion.reject' end,
    'bar_promotions', p_promotion, jsonb_build_object('moderation_status', pr.moderation_status),
    jsonb_build_object('approve', p_approve, 'reason', p_reason));
  return jsonb_build_object('id', p_promotion, 'moderation_status', case when p_approve then 'APPROVED' else 'REJECTED' end);
end $$;

-- app_cancel_booking(uuid,uuid,text) · เดิมใน 20261002001700_app_actions.sql
create or replace function public.app_cancel_booking(p_actor uuid, p_booking uuid, p_reason text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users; bk public.bookings;
begin
  u := public.app_assert_user(p_actor);
  select * into bk from public.bookings where id = p_booking for update;
  if not found or bk.user_id <> p_actor then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  if bk.status not in ('PENDING','AWAITING_DEPOSIT','DEPOSIT_SUBMITTED','CONFIRMED') then
    raise exception 'INVALID_BOOKING_TRANSITION' using errcode = 'P0001';
  end if;
  perform set_config('app.reason', coalesce(nullif(trim(p_reason), ''), 'customer cancelled'), true);
  update public.bookings set status = 'CANCELLED_BY_CUSTOMER', cancel_reason = nullif(trim(p_reason), '') where id = bk.id;
  perform public.app_notify_team(bk.bar_id, 'BOOKING_CANCELLED', 'ลูกค้ายกเลิกการจอง',
    u.display_name || ' ' || bk.code || ' ' || public.app_fmt(bk.booking_datetime), '/merchant/bookings', bk.id);
  return jsonb_build_object('id', bk.id, 'status', 'CANCELLED_BY_CUSTOMER');
end $$;

-- app_order_promotion(uuid,uuid,uuid,text) · เดิมใน 20261002001700_app_actions.sql
create or replace function public.app_order_promotion(p_actor uuid, p_bar uuid, p_package uuid, p_slip_path text)
returns jsonb language plpgsql set search_path = '' as $$
declare pk public.promotion_packages; v_id uuid;
begin
  perform public.app_assert_user(p_actor);
  perform public.app_assert_manager(p_actor, p_bar);
  select * into pk from public.promotion_packages where id = p_package and active;
  if not found then raise exception 'PACKAGE_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_slip_path is null or split_part(p_slip_path, '/', 1) <> p_bar::text then
    raise exception 'INVALID_SLIP_PATH' using errcode = '22023';
  end if;
  insert into public.promoted_listings (bar_id, package_id, placement, price_paid, starts_at, ends_at, status)
  values (p_bar, pk.id, pk.placement, pk.price, now(), now() + make_interval(days => pk.duration_days), 'PAYMENT_SUBMITTED')
  returning id into v_id;
  insert into public.promoted_listing_payments (promoted_listing_id, amount, slip_path) values (v_id, pk.price, p_slip_path);
  perform public.app_notify_admins('PROMOTION_SLIP', 'มีสลิปโปรโมทรอตรวจ',
    (select name from public.bars where id = p_bar) || ' ' || pk.name || ' ' || pk.duration_days || ' วัน', '/promotions', null, p_bar);
  return jsonb_build_object('id', v_id, 'status', 'PAYMENT_SUBMITTED');
end $$;

-- app_set_bar_promotions(uuid,uuid,jsonb) · เดิมใน 20261002001700_app_actions.sql
create or replace function public.app_set_bar_promotions(p_actor uuid, p_bar uuid, p_items jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare it jsonb; v_old public.bar_promotions; v_id uuid; i integer := 0; keep uuid[] := '{}';
        v_days smallint[]; v_cut time; v_title text; v_desc text; pending integer := 0;
begin
  perform public.app_assert_user(p_actor);
  perform public.app_assert_manager(p_actor, p_bar);
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_title := trim(coalesce(it->>'title', ''));
    if char_length(v_title) not between 1 and 60 then raise exception 'INVALID_PROMOTION' using errcode = '22023'; end if;
    v_desc := nullif(trim(it->>'description'), '');
    v_cut := nullif(it->>'cutoff_time', '')::time;
    v_days := case when jsonb_typeof(it->'days') = 'array' and jsonb_array_length(it->'days') > 0
                   then array(select jsonb_array_elements_text(it->'days')::smallint order by 1)
                   else '{0,1,2,3,4,5,6}'::smallint[] end;
    v_old := null;
    if it->>'id' ~ '^[0-9a-f-]{36}$' then
      select * into v_old from public.bar_promotions where id = (it->>'id')::uuid and bar_id = p_bar;
    end if;
    if v_old.id is not null then
      update public.bar_promotions set
        title = v_title, description = v_desc, cutoff_time = v_cut, days_of_week = v_days,
        active = coalesce((it->>'active')::boolean, true), sort_order = i,
        moderation_status = case when v_old.title is distinct from v_title or v_old.description is distinct from v_desc
                                   or v_old.cutoff_time is distinct from v_cut or v_old.days_of_week is distinct from v_days
                                 then 'PENDING'::public.moderation_status else v_old.moderation_status end
       where id = v_old.id returning id into v_id;
    else
      insert into public.bar_promotions (bar_id, title, description, perk_type, cutoff_time, days_of_week, active, sort_order)
      values (p_bar, v_title, v_desc, 'OTHER', v_cut, v_days, coalesce((it->>'active')::boolean, true), i)
      returning id into v_id;
    end if;
    keep := keep || v_id;
    i := i + 1;
  end loop;
  delete from public.bar_promotions where bar_id = p_bar and not (id = any (keep));
  select count(*) into pending from public.bar_promotions where bar_id = p_bar and moderation_status = 'PENDING';
  if pending > 0 then
    perform public.app_notify_admins('PROMOTION_TEXT_PENDING', 'มีโปรโมชันร้านรอตรวจถ้อยคำ',
      (select name from public.bars where id = p_bar) || ' ' || pending || ' รายการ', '/promotions', null, p_bar);
  end if;
  return jsonb_build_object('bar_id', p_bar, 'count', i, 'pending', pending);
end $$;

-- app_set_safety_evidence(uuid,uuid,text,text) · เดิมใน 20261002001700_app_actions.sql
create or replace function public.app_set_safety_evidence(p_actor uuid, p_bar uuid, p_key text, p_path text)
returns jsonb language plpgsql set search_path = '' as $$
begin
  perform public.app_assert_user(p_actor);
  perform public.app_assert_manager(p_actor, p_bar);
  if not exists (select 1 from public.safety_features where key = p_key) then raise exception 'SAFETY_FEATURE_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_path is null or split_part(p_path, '/', 1) <> p_bar::text then raise exception 'INVALID_EVIDENCE_PATH' using errcode = '22023'; end if;
  insert into public.bar_safety_features (bar_id, feature_key, evidence_path, source)
  values (p_bar, p_key, p_path, 'SELF_DECLARED')
  on conflict (bar_id, feature_key) do update set evidence_path = excluded.evidence_path;
  perform public.app_notify_admins('SAFETY_EVIDENCE', 'มีหลักฐาน Safety รอตรวจ',
    (select name from public.bars where id = p_bar) || ' ' || p_key, '/safety', null, p_bar);
  return jsonb_build_object('bar_id', p_bar, 'key', p_key, 'evidence_path', p_path);
end $$;

-- app_submit_deposit(uuid,uuid,text,text) · เดิมใน 20261006000100_slip_reject_reasons_fake_slip_ban.sql
create or replace function public.app_submit_deposit(p_actor uuid, p_booking uuid, p_slip_path text, p_slip_ref text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users; bk public.bookings; v_bar text; v_id uuid;
begin
  u := public.app_assert_user(p_actor);
  perform public.booking_ban_check(p_actor);
  select * into bk from public.bookings where id = p_booking for update;
  if not found or bk.user_id <> p_actor then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  if bk.status <> 'AWAITING_DEPOSIT' then raise exception 'BOOKING_NOT_AWAITING_DEPOSIT' using errcode = 'P0001'; end if;
  if bk.deposit_required <= 0 then raise exception 'NO_DEPOSIT_REQUIRED' using errcode = 'P0001'; end if;
  if p_slip_path is null or split_part(p_slip_path, '/', 1) <> p_actor::text then
    raise exception 'INVALID_SLIP_PATH' using errcode = '22023';
  end if;
  begin
    insert into public.deposits (booking_id, bar_id, amount, slip_path, slip_ref)
    values (bk.id, bk.bar_id, bk.deposit_required, p_slip_path, nullif(trim(p_slip_ref), ''))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'SLIP_ALREADY_USED' using errcode = 'P0001';
  end;
  perform set_config('app.reason', 'deposit submitted', true);
  update public.bookings set status = 'DEPOSIT_SUBMITTED' where id = bk.id;
  select name into v_bar from public.bars where id = bk.bar_id;
  perform public.app_notify_admins('DEPOSIT_SUBMITTED', 'มีสลิปมัดจำรอตรวจ',
    v_bar || ' ' || u.display_name || ' ' || bk.deposit_required || ' บาท', '/deposits', bk.id, bk.bar_id);
  perform public.app_notify_team(bk.bar_id, 'DEPOSIT_SUBMITTED', 'ลูกค้าโอนมัดจำแล้ว (รอ NightOut ตรวจ)',
    u.display_name || ' ' || bk.code, '/merchant/bookings', bk.id);
  return jsonb_build_object('id', v_id, 'booking_id', bk.id, 'status', 'SUBMITTED');
end $$;

-- app_team_move_booking(uuid,uuid,uuid,uuid,text) · เดิมใน 20261006000300_merchant_move_table_refund.sql
create or replace function public.app_team_move_booking(p_actor uuid, p_booking uuid, p_zone uuid, p_table uuid default null,
                                                        p_reason text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare
  u public.users; bk public.bookings; z public.table_zones; t public.tables;
  v_from_zone text; v_from_table text; v_has_tables boolean;
begin
  u := public.app_assert_user(p_actor);
  select * into bk from public.bookings where id = p_booking for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.app_team_role(p_actor, bk.bar_id);
  if bk.status not in ('PENDING','AWAITING_DEPOSIT','DEPOSIT_SUBMITTED','CONFIRMED','CHECKED_IN') then
    raise exception 'BOOKING_NOT_MOVABLE' using errcode = 'P0001';
  end if;

  select * into z from public.table_zones where id = p_zone and bar_id = bk.bar_id and active;
  if not found then raise exception 'ZONE_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_table is not null then
    select * into t from public.tables where id = p_table and zone_id = z.id and active;
    if not found then raise exception 'TABLE_NOT_FOUND' using errcode = 'P0002'; end if;
  else
    select exists (select 1 from public.tables x where x.zone_id = z.id and x.active) into v_has_tables;
    if v_has_tables and not z.allow_zone_only_booking then raise exception 'TABLE_REQUIRED' using errcode = '22023'; end if;
  end if;
  if z.id = bk.zone_id and p_table is not distinct from bk.table_id then
    raise exception 'BOOKING_SAME_TABLE' using errcode = '22023';
  end if;
  -- ข้ามโซน: ล็อกโซนปลายทาง + เช็กความจุ (ไม่นับการจองนี้เอง)
  if z.id <> bk.zone_id and public.zone_remaining_pax(z.id, bk.reserved_from, bk.reserved_until, bk.id) < bk.pax then
    raise exception 'ZONE_FULL' using errcode = 'P0001';
  end if;

  select name into v_from_zone from public.table_zones where id = bk.zone_id;
  select name into v_from_table from public.tables where id = bk.table_id;
  begin
    update public.bookings set zone_id = z.id, table_id = p_table where id = bk.id;
  exception when exclusion_violation then
    raise exception 'TABLE_TAKEN' using errcode = 'P0001';
  end;
  if bk.status = 'CHECKED_IN' then
    update public.checkins set table_id = p_table where booking_id = bk.id;
  end if;

  perform public.app_audit(p_actor, 'booking.move', 'bookings', bk.id, jsonb_build_object(
    'from_zone', v_from_zone, 'from_table', v_from_table, 'to_zone', z.name, 'to_table', t.name,
    'reason', nullif(btrim(p_reason), '')));
  perform public.app_notify(bk.user_id, 'BOOKING_MOVED', 'ร้านย้ายโต๊ะให้คุณ',
    (select name from public.bars where id = bk.bar_id) || ' ' || z.name || coalesce(' โต๊ะ ' || t.name, '')
      || ' ' || public.app_fmt(bk.booking_datetime),
    '/bookings/' || bk.id, bk.id, bk.bar_id);
  return jsonb_build_object('id', bk.id, 'zone_id', z.id, 'zone_name', z.name, 'table_id', p_table, 'table_name', t.name);
end $$;

-- app_team_refund_deposit(uuid,uuid,text) · เดิมใน 20261006000300_merchant_move_table_refund.sql
create or replace function public.app_team_refund_deposit(p_actor uuid, p_booking uuid, p_reason text)
returns jsonb language plpgsql set search_path = '' as $$
declare
  u public.users; bk public.bookings; d public.deposits; v_reason text := nullif(btrim(p_reason), ''); v_bar text;
begin
  u := public.app_assert_user(p_actor);
  if v_reason is null or char_length(v_reason) < 3 then raise exception 'REFUND_REASON_REQUIRED' using errcode = '22023'; end if;
  select * into bk from public.bookings where id = p_booking for update;
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.app_team_role(p_actor, bk.bar_id);

  select * into d from public.deposits
   where booking_id = bk.id and status = 'VERIFIED' and settlement in ('HELD', 'PAYOUT_PENDING') for update;
  if not found then
    if exists (select 1 from public.deposits where booking_id = bk.id and settlement in ('REFUND_PENDING', 'REFUNDED')) then
      raise exception 'REFUND_ALREADY_REQUESTED' using errcode = 'P0001';
    end if;
    raise exception 'NO_REFUNDABLE_DEPOSIT' using errcode = 'P0001';
  end if;

  perform set_config('app.reason', 'refund approved by bar: ' || v_reason, true);
  if bk.status in ('PENDING', 'CONFIRMED') then
    -- ยังไม่ได้ใช้โต๊ะ → ยกเลิกฝั่งร้าน (ปล่อยโต๊ะ) · trigger ตั้ง REFUND_PENDING + แจ้งลูกค้า
    update public.bookings set status = 'CANCELLED_BY_MERCHANT', cancel_reason = v_reason where id = bk.id;
  end if;
  update public.deposits
     set settlement = 'REFUND_PENDING', settled_at = now(),
         refund_reason = v_reason, refund_requested_by = p_actor, refund_requested_at = now()
   where id = d.id;

  select name into v_bar from public.bars where id = bk.bar_id;
  perform public.app_notify(bk.user_id, 'DEPOSIT_REFUND_APPROVED', 'ร้านอนุมัติคืนมัดจำให้คุณแล้ว',
    v_bar || ' ' || d.amount || ' บาท NightOut จะโอนคืนให้เร็วที่สุด', '/bookings/' || bk.id, bk.id, bk.bar_id);
  perform public.app_notify_admins('DEPOSIT_REFUND_PENDING', 'ร้านอนุมัติคืนมัดจำ — รอโอนคืนลูกค้า',
    v_bar || ' ' || bk.code || ' ' || d.amount || ' บาท ' || v_reason, '/deposits', bk.id, bk.bar_id);
  perform public.app_audit(p_actor, 'deposit.refund_request', 'deposits', d.id, jsonb_build_object(
    'booking_id', bk.id, 'from_settlement', d.settlement, 'booking_status', bk.status, 'reason', v_reason));
  return jsonb_build_object('id', d.id, 'booking_id', bk.id, 'settlement', 'REFUND_PENDING', 'amount', d.amount,
                            'booking_status', (select status from public.bookings where id = bk.id));
end $$;

-- admin_community_moderate(uuid,text,uuid,text,text) · เดิมใน 20261010000100_community_threads.sql
create or replace function public.admin_community_moderate(p_actor uuid, p_target text, p_id uuid, p_action text, p_reason text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_before text; v_status text; v_author uuid; v_thread uuid; v_title text;
begin
  perform public.admin_assert(p_actor);
  if p_target not in ('THREAD', 'COMMENT') or p_action not in ('KEEP', 'HIDE', 'REMOVE', 'RESTORE') then
    raise exception 'INVALID_COMMUNITY_MODERATION' using errcode = '22023';
  end if;

  if p_target = 'THREAD' then
    select status, author_id, id, title into v_before, v_author, v_thread, v_title from public.community_threads where id = p_id for update;
    if not found or v_before = 'DELETED' then raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002'; end if;
  else
    select c.status, c.author_id, c.thread_id, t.title into v_before, v_author, v_thread, v_title
      from public.community_comments c join public.community_threads t on t.id = c.thread_id where c.id = p_id for update of c;
    if not found or v_before = 'DELETED' then raise exception 'COMMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  end if;

  v_status := case p_action when 'KEEP' then v_before when 'HIDE' then 'HIDDEN' when 'REMOVE' then 'REMOVED' else 'PUBLISHED' end;
  if p_target = 'THREAD' then
    update public.community_threads set status = v_status where id = p_id;
    update public.community_reports set status = 'RESOLVED', resolved_by = p_actor, resolved_at = now()
     where thread_id = p_id and status = 'OPEN';
  else
    update public.community_comments set status = v_status where id = p_id;
    update public.community_reports set status = 'RESOLVED', resolved_by = p_actor, resolved_at = now()
     where comment_id = p_id and status = 'OPEN';
    perform public.community_refresh_counts(v_thread);
  end if;

  perform public.admin_audit(p_actor, 'community.' || lower(p_target) || '.' || lower(p_action),
                             case p_target when 'THREAD' then 'community_threads' else 'community_comments' end, p_id,
                             jsonb_build_object('status', v_before), jsonb_build_object('status', v_status, 'reason', p_reason));
  if p_action in ('HIDE', 'REMOVE') and v_before <> v_status then
    perform public.app_notify(v_author, 'COMMUNITY_MODERATED',
                              case p_target when 'THREAD' then 'กระทู้ของคุณถูก' else 'ความคิดเห็นของคุณถูก' end
                                || case p_action when 'HIDE' then 'ซ่อน' else 'ลบ' end,
                              coalesce(nullif(trim(p_reason), ''), 'ไม่เป็นไปตามกติกาชุมชน') || ' "' || left(v_title, 60) || '"',
                              case when p_target = 'THREAD' and p_action = 'REMOVE' then '/community/me' else '/community/t/' || v_thread end);
  end if;
  return jsonb_build_object('id', p_id, 'target', p_target, 'status', v_status);
end $$;

-- app_save_safety(uuid,uuid,jsonb) · เดิมใน 20261012000400_bar_save_safety.sql
create or replace function public.app_save_safety(p_actor uuid, p_bar uuid, p_items jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  it jsonb;
  v_key text;
  v_path text;
  n_value integer := 0;
  keys_ev text[] := '{}';
begin
  perform public.app_assert_user(p_actor);
  perform public.app_assert_manager(p_actor, p_bar);
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50
     or jsonb_array_length(p_items) <> (select count(distinct upper(x->>'key')) from jsonb_array_elements(p_items) x) then
    raise exception 'INVALID_SAFETY_ITEMS' using errcode = '22023';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_key := upper(it->>'key');
    if not exists (select 1 from public.safety_features where key = v_key) then
      raise exception 'SAFETY_FEATURE_NOT_FOUND' using errcode = 'P0002';
    end if;
    if not (it ? 'value') and not (it ? 'evidence_path') then
      raise exception 'INVALID_SAFETY_ITEMS' using errcode = '22023';
    end if;

    if it ? 'value' then
      perform public.app_set_safety(p_actor, p_bar, v_key, (it->>'value')::public.safety_value);
      n_value := n_value + 1;
    end if;

    if it ? 'evidence_path' then
      v_path := it->>'evidence_path';
      if v_path is null or split_part(v_path, '/', 1) <> p_bar::text then
        raise exception 'INVALID_EVIDENCE_PATH' using errcode = '22023';
      end if;
      insert into public.bar_safety_features (bar_id, feature_key, evidence_path, source)
      values (p_bar, v_key, v_path, 'SELF_DECLARED')
      on conflict (bar_id, feature_key) do update set evidence_path = excluded.evidence_path;
      keys_ev := keys_ev || v_key;
    end if;
  end loop;

  if cardinality(keys_ev) > 0 then
    perform public.app_audit(p_actor, 'bar.safety.evidence', 'bars', p_bar, jsonb_build_object('keys', to_jsonb(keys_ev)));
    perform public.app_notify_admins('SAFETY_EVIDENCE', 'มีหลักฐาน Safety รอตรวจ',
      (select name from public.bars where id = p_bar) || ' ' || array_to_string(keys_ev, ', '), '/safety', null, p_bar);
  end if;

  return jsonb_build_object('bar_id', p_bar, 'values_updated', n_value, 'evidence_added', cardinality(keys_ev));
end $$;

-- app_extend_booking(uuid,uuid) · เดิมใน 20261013000500_booking_timing_rules.sql
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
    bk.code || ' เก็บโต๊ะถึง ' || public.app_fmt(v_until), '/merchant/bookings/' || bk.id, bk.id);
  return jsonb_build_object('id', bk.id, 'auto_cancel_at', v_until, 'extended_at', v_at);
end $$;

-- app_join_share(uuid,text) · เดิมใน 20261013000500_booking_timing_rules.sql
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
        v_bar || ' ' || public.app_fmt(bk.booking_datetime), '/bookings/' || bk.id, bk.id, bk.bar_id,
        'SHARE_JOINED:' || s.id || ':' || p_actor);
      perform public.app_audit(p_actor, 'booking_share.join', 'booking_share_joins', v_join,
        jsonb_build_object('share_id', s.id, 'booking_id', bk.id));
    end if;
  end if;
  select count(*)::integer into v_going from public.booking_share_joins where share_id = s.id;
  return jsonb_build_object('joined', true, 'going_count', v_going);
end $$;

-- run_booking_timeouts() · เดิมใน 20261013000500_booking_timing_rules.sql
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
      r.bar_name || ' ' || public.app_fmt(r.booking_datetime) || ' ใครถึงก่อนให้สแกน QR ได้เลย',
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
      r.bar_name || ' กด "ขอต่อเวลา 15 นาที" ได้ 1 ครั้ง', '/bookings/' || r.id, r.id, r.bar_id,
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

-- app_merchant_join(uuid,jsonb) · เดิมใน 20261013000600_bar_location_pins.sql
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
  perform public.app_notify_admins('BAR_APPLICATION', 'มีร้านสมัครใหม่รอตรวจ', trim(p->>'name') || ' ' || u.email, '/merchants', null, v_id);
  return jsonb_build_object('id', v_id, 'slug', v_slug, 'status', 'PENDING_REVIEW');
end $$;

-- app_request_bar_location(uuid,uuid,jsonb) · เดิมใน 20261013000600_bar_location_pins.sql
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
  perform public.app_notify_admins('BAR_LOCATION_REQUEST', 'ร้านขอแก้ตำแหน่ง ' || b.name, v_loc->>'address',
                                   '/bar-locations?bar=' || p_bar, null, p_bar);
  return jsonb_build_object('bar_id', p_bar, 'status', 'PENDING', 'request_id', v_id);
end $$;

-- admin_blacklist_bar(uuid,uuid,text) · เดิมใน 20261013000700_bar_blacklist_strikes.sql
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
    v_reason || ' การจองที่ยืนยันแล้วยังต้องรับลูกค้าตามเดิม ติดต่อทีม NightOut เพื่อขอปลด', '/merchant/status');

  return jsonb_build_object('id', p_bar, 'status', 'SUSPENDED', 'blacklisted_at', v_at, 'upcoming_bookings', v_upcoming);
end $$;

-- admin_report_no_table(uuid,text,text) · เดิมใน 20261013000700_bar_blacklist_strikes.sql
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
      v_bar || ' ' || bk.code || ' ' || v_amount || ' บาท NightOut จะโอนคืนให้เร็วที่สุด',
      '/bookings/' || bk.id, bk.id, bk.bar_id);
  end if;
  -- ไม่แจ้งแอดมิน: ผู้ทำคือแอดมิน · แถวขึ้นที่ /bar-blacklist และ /deposits "รอคืนลูกค้า"
  perform public.app_notify_team(bk.bar_id, 'BAR_NO_TABLE',
    'NightOut บันทึกประวัติร้าน: ไม่มีโต๊ะให้ลูกค้า (ครั้งที่ ' || v_n || ' ใน 90 วัน)',
    bk.code || ' จากข้อร้องเรียนของลูกค้า: ' || v_note
      || case when v_amount is null then '' else ' คืน Table Fee ให้ลูกค้าเต็มจำนวน' end,
    '/merchant/bookings/' || bk.id, bk.id);

  return jsonb_build_object('booking_id', bk.id, 'booking_code', bk.code, 'booking_status', v_status,
                            'refund_amount', v_amount, 'strikes_90d', v_n);
end $$;

-- app_team_report_no_table(uuid,uuid,text) · เดิมใน 20261013000700_bar_blacklist_strikes.sql
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
  perform public.app_notify_admins('BAR_NO_TABLE', 'ร้านไม่มีโต๊ะให้ลูกค้า ' || v_bar,
    bk.code || ' นัด ' || public.app_fmt(bk.booking_datetime) || ' ครั้งที่ ' || v_n || ' ใน 90 วัน'
      || coalesce(' ' || v_note, ''),
    '/bar-blacklist?bar=' || bk.bar_id, bk.id, bk.bar_id);
  perform public.app_notify_team(bk.bar_id, 'BAR_NO_TABLE',
    'บันทึกประวัติร้าน: ไม่มีโต๊ะให้ลูกค้า (ครั้งที่ ' || v_n || ' ใน 90 วัน)',
    bk.code || case when v_refund is null then ' ยกเลิกการจองแล้ว' else ' คืน Table Fee ให้ลูกค้าเต็มจำนวน' end
      || ' ร้านที่ไม่มีโต๊ะให้ลูกค้าซ้ำอาจถูกระงับการแสดง (Blacklist)',
    '/merchant/bookings/' || bk.id, bk.id);

  return jsonb_build_object('booking_id', bk.id,
                            'booking_status', (select status from public.bookings where id = bk.id),
                            'refund_amount', (v_refund->>'amount')::numeric,
                            'strikes_90d', v_n);
end $$;

-- bars_owner_blacklist_notify() · เดิมใน 20261013000700_bar_blacklist_strikes.sql
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
      new.name || ' ร้านเดิมที่ติด Blacklist: ' || v_old || ' ตรวจก่อนอนุมัติ', '/merchants', null, new.id);
  end if;
  return new;
end $$;

-- handle_bar_status_notify() · เดิมใน 20261013000700_bar_blacklist_strikes.sql
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
    new.name || coalesce(' ' || new.status_reason, ''), '/merchant');
  return new;
end $$;

-- admin_inspect_safety(uuid,uuid,jsonb,text,timestamptz) · เดิมใน 20261013000800_bar_safety_inspections.sql
create or replace function public.admin_inspect_safety(p_actor uuid, p_bar uuid, p_items jsonb,
                                                       p_note text default null, p_inspected_at timestamptz default null)
returns jsonb language plpgsql set search_path = '' as $$
declare
  it         jsonb;
  v_bar_name text;
  v_at       timestamptz;
  v_name     text;
  v_before   smallint;
  v_after    smallint;
  v_id       uuid;
  v_key      text;
  v_result   text;
  v_note     text;
  v_photos   text[];
  v_old      public.safety_value;
  v_new      public.safety_value;
  v_changes  jsonb := '[]'::jsonb;
  n_pass     integer := 0;
  n_fail     integer := 0;
  n_na       integer := 0;
begin
  perform public.admin_assert(p_actor);

  -- ล็อกแถวร้าน = การตรวจร้านเดียวกันเข้าคิวทีละครั้ง (ร้านทุกสถานะตรวจได้)
  select b.name into v_bar_name from public.bars b where b.id = p_bar for update;
  if not found then raise exception 'BAR_NOT_FOUND' using errcode = 'P0002'; end if;

  -- ห้ามตรวจร้านที่ตัวเองอยู่ในทีม (รวมคำเชิญที่ยังไม่ตอบ) — กันรับรองตัวเอง
  if exists (select 1 from public.bar_staff s where s.bar_id = p_bar and s.user_id = p_actor and s.revoked_at is null) then
    raise exception 'INSPECTOR_IS_BAR_MEMBER' using errcode = '42501';
  end if;

  v_at := coalesce(p_inspected_at, now());

  -- ตรวจรูปแบบทีละขั้น (OR ใน Postgres ไม่รับประกันลำดับ · jsonb_array_length ใช้กับ array เท่านั้น)
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'INVALID_INSPECTION' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'INVALID_INSPECTION' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) x where jsonb_typeof(x) <> 'object') then
    raise exception 'INVALID_INSPECTION' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) <> (select count(distinct upper(btrim(x->>'key'))) from jsonb_array_elements(p_items) x) then
    raise exception 'INVALID_INSPECTION' using errcode = '22023';   -- ข้อซ้ำ / ไม่มี key
  end if;
  if not exists (select 1 from jsonb_array_elements(p_items) x where x->>'result' in ('PASS', 'FAIL')) then
    raise exception 'INVALID_INSPECTION' using errcode = '22023';   -- ต้องมี ผ่าน / ไม่พบ อย่างน้อย 1 ข้อ
  end if;
  if char_length(coalesce(p_note, '')) > 1000 then
    raise exception 'INVALID_INSPECTION' using errcode = '22023';
  end if;

  -- ห้ามอนาคต (เผื่อนาฬิกา 5 นาที) · ย้อนได้ไม่เกิน 30 วัน · ไม่ก่อนการตรวจครั้งล่าสุดของร้าน
  if v_at > now() + interval '5 minutes' or v_at < now() - interval '30 days'
     or exists (select 1 from public.safety_inspections s where s.bar_id = p_bar and s.inspected_at > v_at) then
    raise exception 'INVALID_INSPECTION_TIME' using errcode = '22023';
  end if;

  select u.display_name into v_name from public.users u where u.id = p_actor;
  select st.safety_score into v_before from public.bar_stats st where st.bar_id = p_bar;

  insert into public.safety_inspections (bar_id, inspector_id, inspector_name, inspected_at, note, safety_score_before)
  values (p_bar, p_actor, v_name, v_at, nullif(btrim(p_note), ''), v_before)
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_key := upper(btrim(it->>'key'));
    if not exists (select 1 from public.safety_features sf where sf.key = v_key) then
      raise exception 'SAFETY_FEATURE_NOT_FOUND' using errcode = 'P0002';
    end if;
    v_result := it->>'result';
    if coalesce(v_result, '') not in ('PASS', 'FAIL', 'NA') then
      raise exception 'INVALID_INSPECTION' using errcode = '22023';
    end if;
    v_note := nullif(btrim(it->>'note'), '');
    if coalesce(char_length(v_note), 0) > 500 then
      raise exception 'INVALID_INSPECTION' using errcode = '22023';
    end if;

    -- รูป: array ของ path ใน bar-verifications/<bar_id>/inspections/ ที่อัปโหลดแล้ว · ≤ 3 · ไม่ซ้ำ
    if it ? 'photo_paths' and jsonb_typeof(it->'photo_paths') not in ('array', 'null') then
      raise exception 'INVALID_INSPECTION_PHOTO' using errcode = '22023';
    end if;
    v_photos := coalesce(array(select jsonb_array_elements_text(
                  case when jsonb_typeof(it->'photo_paths') = 'array' then it->'photo_paths' else '[]'::jsonb end)), '{}');
    if cardinality(v_photos) > 3
       or cardinality(v_photos) <> (select count(distinct p) from unnest(v_photos) p)
       or exists (select 1 from unnest(v_photos) p where not coalesce(public.safety_inspection_photo_ok(p_bar, p), false)) then
      raise exception 'INVALID_INSPECTION_PHOTO' using errcode = '22023';
    end if;

    v_old := null;
    select f.value into v_old from public.bar_safety_features f
     where f.bar_id = p_bar and f.feature_key = v_key for update;
    v_new := case v_result when 'PASS' then 'YES'::public.safety_value when 'FAIL' then 'NO'::public.safety_value end;

    if v_new is not null then
      -- คงหลักฐาน / หมายเหตุของร้านไว้
      insert into public.bar_safety_features (bar_id, feature_key, value, source, verify_method, verified_by, verified_at)
      values (p_bar, v_key, v_new, 'ADMIN_VERIFIED', 'ON_SITE', p_actor, v_at)
      on conflict (bar_id, feature_key) do update
        set value = excluded.value, source = 'ADMIN_VERIFIED', verify_method = 'ON_SITE',
            verified_by = excluded.verified_by, verified_at = excluded.verified_at;

      -- รายงานของลูกค้าให้คะแนนค่าที่แสดงก่อนตรวจ (v_old) — ลูกค้าถูกเมื่อ is_accurate ตรงกับ "ผลตรวจยืนยันค่าเดิม"
      update public.safety_reports sr
         set status = (case when sr.is_accurate = (v_old is not distinct from v_new) then 'CONFIRMED' else 'DISMISSED' end)::public.safety_report_status,
             resolved_by = p_actor, resolved_at = now()
       where sr.bar_id = p_bar and sr.feature_key = v_key and sr.status = 'OPEN';

      if v_old is distinct from v_new then
        v_changes := v_changes || jsonb_build_object('key', v_key, 'from', v_old, 'to', v_new);
      end if;
    end if;

    insert into public.safety_inspection_items (inspection_id, feature_key, result, note, photo_paths, value_before, value_after)
    values (v_id, v_key, v_result, v_note, v_photos, v_old, coalesce(v_new, v_old));

    if v_result = 'PASS' then n_pass := n_pass + 1;
    elsif v_result = 'FAIL' then n_fail := n_fail + 1;
    else n_na := n_na + 1;
    end if;
  end loop;

  perform public.recompute_safety_score(p_bar);
  select st.safety_score into v_after from public.bar_stats st where st.bar_id = p_bar;
  update public.safety_inspections
     set pass_count = n_pass, fail_count = n_fail, na_count = n_na, safety_score_after = v_after
   where id = v_id;

  perform public.admin_audit(p_actor, 'safety.inspect', 'safety_inspections', v_id,
    jsonb_build_object('safety_score', v_before),
    jsonb_build_object('bar_id', p_bar, 'inspected_at', v_at, 'verify_method', 'ON_SITE',
                       'pass', n_pass, 'fail', n_fail, 'na', n_na, 'safety_score', v_after, 'changes', v_changes));

  -- แจ้งเจ้าของ + ผู้จัดการ (หน้า /merchant/safety เปิดได้เฉพาะ 2 บทบาทนี้)
  perform public.app_notify(s.user_id, 'SAFETY_INSPECTED', 'ทีม NightOut ลงพื้นที่ตรวจความปลอดภัยแล้ว',
    v_bar_name || ' ผ่าน ' || n_pass || ' ไม่พบ ' || n_fail || ' ไม่ได้ตรวจ ' || n_na
      || case when n_fail > 0 then ' — ข้อที่ไม่พบเปลี่ยนเป็น "ไม่มี" แล้ว' else '' end,
    '/merchant/safety', null, p_bar, 'SAFETY_INSPECTED:' || v_id || ':' || s.user_id)
  from public.bar_staff s
  where s.bar_id = p_bar and s.role in ('OWNER', 'MANAGER') and s.accepted_at is not null and s.revoked_at is null;

  return jsonb_build_object('id', v_id, 'bar_id', p_bar, 'inspected_at', v_at, 'pass_count', n_pass,
                            'fail_count', n_fail, 'na_count', n_na, 'safety_score', v_after);
end $$;

-- app_community_add_comment(uuid,uuid,text,uuid,jsonb) · เดิมใน 20261013000900_community_shop_team.sql
create or replace function public.app_community_add_comment(p_actor uuid, p_thread uuid, p_body text, p_parent uuid default null,
                                                            p_media jsonb default '[]'::jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  u public.users; t public.community_threads; p public.community_comments;
  v_parent uuid; v_id uuid; v_link text; v_media jsonb; v_body text := trim(coalesce(p_body, '')); v_draft text[];
  v_team uuid; v_who text;
begin
  u := public.app_assert_user(p_actor);
  if u.banned_at is not null then raise exception 'COMMUNITY_BANNED' using errcode = '42501'; end if;
  v_media := public.community_media_norm(p_actor, p_media);
  if char_length(v_body) > 2000 or (v_body = '' and jsonb_array_length(v_media) = 0) then
    raise exception 'INVALID_COMMUNITY_COMMENT' using errcode = '22023';
  end if;
  select * into t from public.community_threads where id = p_thread and status = 'PUBLISHED' for update;
  if not found then raise exception 'THREAD_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_parent is not null then
    select * into p from public.community_comments where id = p_parent and thread_id = p_thread and status = 'PUBLISHED';
    if not found then raise exception 'COMMENT_NOT_FOUND' using errcode = 'P0002'; end if;
    v_parent := coalesce(p.parent_id, p.id);
  end if;
  v_team := public.community_team_bar(p_actor, t.bar_id);

  insert into public.community_comments (thread_id, parent_id, author_id, body, team_bar_id)
  values (p_thread, v_parent, p_actor, v_body, v_team)
  returning id into v_id;
  perform public.community_media_set(p_actor, null, v_id, v_media);
  update public.community_threads set last_activity_at = now() where id = p_thread;
  perform public.community_refresh_counts(p_thread);
  select coalesce(array_agg(x), '{}') into v_draft
    from public.community_drafts d, unnest(public.community_media_paths(d.payload->'media')) x
   where d.user_id = p_actor and d.kind = 'REPLY' and d.thread_id = p_thread;
  delete from public.community_drafts where user_id = p_actor and kind = 'REPLY' and thread_id = p_thread;

  v_link := '/community/t/' || p_thread;
  v_who := u.display_name || coalesce(' (ทีมร้าน ' || (select b.name from public.bars b where b.id = v_team) || ')', '');
  if t.author_id <> p_actor then
    perform public.app_notify(t.author_id, 'COMMUNITY_REPLY', 'มีคนตอบกระทู้ของคุณ',
                              v_who || ' ตอบ "' || left(t.title, 60) || '"', v_link);
  end if;
  if p.id is not null and p.author_id <> p_actor and p.author_id <> t.author_id then
    perform public.app_notify(p.author_id, 'COMMUNITY_REPLY', 'มีคนตอบความคิดเห็นของคุณ',
                              v_who || ' ตอบใน "' || left(t.title, 60) || '"', v_link);
  end if;
  return jsonb_build_object('id', v_id, 'thread_id', p_thread, 'parent_id', v_parent,
                            'removed_paths', public.community_paths_unused(p_actor, v_draft));
end $$;

-- admin_ban_user(uuid,uuid,text,boolean) · เดิมใน 20261013001000_account_manual_ban.sql
create or replace function public.admin_ban_user(p_actor uuid, p_user uuid, p_reason text, p_ban_phones boolean default false)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users; v_reason text; v_phones integer := 0; v_at timestamptz := now();
begin
  perform public.admin_assert(p_actor);
  v_reason := nullif(btrim(p_reason), '');
  if v_reason is null or char_length(v_reason) not between 3 and 300 then
    raise exception 'BAN_REASON_REQUIRED' using errcode = '22023';
  end if;
  if p_user = p_actor then raise exception 'CANNOT_BAN_SELF' using errcode = '42501'; end if;
  select * into u from public.users where id = p_user for update;
  if not found or u.deleted_at is not null then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  if public.role_enters_backoffice(u.role) then raise exception 'CANNOT_BAN_ADMIN' using errcode = '42501'; end if;
  if u.banned_at is not null then raise exception 'USER_ALREADY_BANNED' using errcode = 'P0001'; end if;

  update public.users set banned_at = v_at, ban_reason = v_reason where id = p_user;

  if coalesce(p_ban_phones, false) then
    insert into public.banned_phones (phone_e164, user_id, reason, banned_by)
    select distinct x.p, p_user, v_reason, p_actor
    from (select u.phone_e164 as p
          union select b.contact_phone from public.bookings b where b.user_id = p_user
          union select f.phone_e164 from public.user_flags f where f.user_id = p_user) x
    where x.p ~ '^\+[1-9][0-9]{7,14}$'
    on conflict (phone_e164) do nothing;
    get diagnostics v_phones = row_count;
  end if;

  perform public.admin_audit(p_actor, 'user.ban', 'users', p_user,
    jsonb_build_object('banned_at', null),
    jsonb_build_object('reason', v_reason, 'manual', true, 'ban_phones', coalesce(p_ban_phones, false), 'phones_banned', v_phones));
  perform public.app_notify(p_user, 'ACCOUNT_BANNED', 'บัญชีของคุณถูกระงับ',
    'จองโต๊ะไม่ได้ และชุมชนอ่านได้อย่างเดียว เหตุผล: ' || v_reason || ' ติดต่อ NightOut หากคิดว่าเป็นความผิดพลาด',
    '/profile');
  return jsonb_build_object('id', p_user, 'banned', true, 'banned_at', v_at, 'phones_banned', v_phones);
end $$;

-- admin_save_bar_details(uuid,uuid,jsonb,jsonb) · เดิมใน 20261013001010_bar_admin_edit_details.sql
create or replace function public.admin_save_bar_details(p_actor uuid, p_bar uuid, p_info jsonb, p_menu jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare v_before jsonb; m jsonb; v_parts text[] := '{}';
begin
  perform public.admin_assert(p_actor);
  if p_info = 'null'::jsonb then p_info := null; end if;
  if p_menu = 'null'::jsonb then p_menu := null; end if;
  if p_info is null and p_menu is null then
    raise exception 'INVALID_BAR_DETAILS' using errcode = '22023', detail = 'empty';
  end if;
  if not exists (select 1 from public.bars where id = p_bar) then
    raise exception 'BAR_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_info is not null then
    v_before := public.bar_info_apply(p_bar, p_info);
    perform public.admin_audit(p_actor, 'bar.admin_edit_info', 'bars', p_bar, v_before, p_info);
    v_parts := v_parts || array(
      select t.label from (values (1, 'name', 'ชื่อร้าน'), (2, 'description', 'คำอธิบาย'), (3, 'phone', 'เบอร์โทร'),
                                  (4, 'district_id', 'ย่าน'), (5, 'style_keys', 'สไตล์ร้าน'), (6, 'hours', 'เวลาเปิด-ปิด'),
                                  (7, 'links', 'ลิงก์โซเชียล')) t(ord, key, label)
      where p_info ? t.key order by t.ord);
  end if;

  if p_menu is not null then
    m := public.bar_menu_apply(p_bar, p_menu);
    perform public.admin_audit(p_actor, 'bar.admin_edit_menu', 'bars', p_bar,
      jsonb_build_object('items', m->'before'), jsonb_build_object('items', p_menu, 'count', m->'count'));
    v_parts := v_parts || 'เมนูและราคา'::text;
  end if;

  perform public.app_notify_team(p_bar, 'BAR_EDITED_BY_ADMIN', 'ทีม NightOut แก้ข้อมูลร้านของคุณ',
    array_to_string(v_parts, ' ') || ' — ตรวจได้ที่หน้าร้านของคุณ',
    case when p_info is null then '/merchant/menu' else '/merchant/store' end);

  return jsonb_build_object('bar_id', p_bar, 'info_updated', p_info is not null,
                            'menu_count', (m->>'count')::integer,
                            'removed_paths', coalesce(m->'removed_paths', '[]'::jsonb));
end $$;

-- admin_payment_mark_refunded(uuid,uuid,text,text) · เดิมใน 20261013001100_payment_intents.sql
create or replace function public.admin_payment_mark_refunded(p_actor uuid, p_intent uuid, p_note text, p_ref text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare pi public.payment_intents; v_note text := nullif(btrim(p_note), ''); v_ref text := left(nullif(btrim(p_ref), ''), 120);
        v_bar text;
begin
  perform public.admin_assert(p_actor);
  if v_note is null or char_length(v_note) < 3 then
    raise exception 'PAYMENT_REFUND_NOTE_REQUIRED' using errcode = '22023';
  end if;
  select * into pi from public.payment_intents where id = p_intent for update;
  if not found then raise exception 'PAYMENT_INTENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if pi.refund_status <> 'REQUIRED' then raise exception 'PAYMENT_REFUND_NOT_REQUIRED' using errcode = 'P0001'; end if;

  update public.payment_intents
     set refund_status = 'REFUNDED', refund_note = left(v_note, 300), refund_ref = v_ref,
         refunded_by = p_actor, refunded_at = now()
   where id = pi.id
  returning * into pi;
  perform public.admin_audit(p_actor, 'payment.refunded', 'payment_intents', pi.id,
    jsonb_build_object('refund_status', 'REQUIRED'),
    jsonb_build_object('refund_status', 'REFUNDED', 'note', pi.refund_note, 'ref', pi.refund_ref));
  select name into v_bar from public.bars where id = pi.bar_id;
  perform public.app_notify(pi.user_id, 'PAYMENT_REFUNDED', 'NightOut คืน Table Fee ให้แล้ว',
    v_bar || ' ' || pi.amount || ' บาท', '/bookings/' || pi.booking_id || '/deposit', pi.booking_id, pi.bar_id);
  return jsonb_build_object('id', pi.id, 'refund_status', 'REFUNDED', 'refunded_at', pi.refunded_at);
end $$;

-- handle_booking_status_effects() · เดิมใน 20261013001100_payment_intents.sql
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
    when 'CONFIRMED'             then case when old.status = 'DEPOSIT_SUBMITTED' then 'NightOut ตรวจสลิปแล้ว โต๊ะของคุณยืนยันแล้ว'
                                           when old.status = 'AWAITING_DEPOSIT' then 'ชำระ Table Fee สำเร็จ — E-Ticket พร้อมใช้แล้ว'
                                           else 'ร้านยืนยันการจองแล้ว' end
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
      v_bar.name || ' ' || public.app_fmt(new.booking_datetime),
      case when new.status = 'AWAITING_DEPOSIT' then v_link || '/deposit'
           when new.status = 'COMPLETED' then '/reviews/new?booking=' || new.id else v_link end,
      new.id, new.bar_id);
  end if;
  -- ปลดโต๊ะ (Forfeited): ทีมร้านรู้ว่าโต๊ะว่างรับ walk-in ได้ + แจ้งแอดมิน
  if new.status = 'NO_SHOW' then
    perform public.app_notify_team(new.bar_id, 'BOOKING_FORFEITED', 'ปลดโต๊ะแล้ว (Forfeited) — โต๊ะว่างรับ walk-in ได้',
      new.code || ' ' || public.app_fmt(new.booking_datetime), '/merchant/bookings/' || new.id, new.id);
    perform public.app_notify_admins('BOOKING_FORFEITED', 'ปลดโต๊ะ (Forfeited) ' || v_bar.name,
      new.code || ' นัด ' || public.app_fmt(new.booking_datetime) || ' สายเกินเวลาเก็บโต๊ะ',
      '/bookings?status=NO_SHOW', new.id, new.bar_id);
  end if;
  if new.status = 'CONFIRMED' and old.status = 'DEPOSIT_SUBMITTED' then
    perform public.app_notify_team(new.bar_id, 'BOOKING_CONFIRMED', 'NightOut ยืนยันมัดจำแล้ว',
      new.code || ' ' || public.app_fmt(new.booking_datetime), '/merchant/bookings', new.id);
  end if;
  if new.status = 'CONFIRMED' and old.status = 'AWAITING_DEPOSIT' then   -- ชำระผ่านผู้ให้บริการ (20261013001100)
    perform public.app_notify_team(new.bar_id, 'BOOKING_CONFIRMED', 'ลูกค้าชำระ Table Fee แล้ว — ยืนยันการจองอัตโนมัติ',
      new.code || ' ' || public.app_fmt(new.booking_datetime), '/merchant/bookings/' || new.id, new.id);
  end if;
  return new;
end $$;

-- payment_apply_event(text,text,text,text,uuid,text,numeric,timestamptz,text,text,jsonb) · เดิมใน 20261013001100_payment_intents.sql
create or replace function public.payment_apply_event(
  p_provider text, p_event_id text, p_event_type text, p_raw_type text default null, p_intent uuid default null,
  p_provider_ref text default null, p_amount numeric default null, p_paid_at timestamptz default null,
  p_failure_code text default null, p_failure_message text default null, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare v_intent uuid; v_booking uuid; pi public.payment_intents; bk public.bookings;
        v_event bigint; v_result text; v_reason text; v_bar text;
begin
  perform set_config('app.user_id', '', true);
  if nullif(btrim(p_provider), '') is null or nullif(btrim(p_event_id), '') is null or p_event_type is null
     or p_event_type not in ('PAID','FAILED','EXPIRED','CANCELLED','IGNORED') then
    raise exception 'PAYMENT_WEBHOOK_INVALID' using errcode = '22023';
  end if;
  -- id ที่เราส่งให้ผู้ให้บริการก่อน แล้วค่อย provider_ref · ล็อกการจองก่อน intent (ลำดับเดียวกับ app_payment_start)
  select x.id, x.booking_id into v_intent, v_booking from public.payment_intents x
   where x.provider = p_provider
     and (x.id = p_intent or (p_provider_ref is not null and x.provider_ref = p_provider_ref))
   order by (x.id = p_intent) desc nulls last limit 1;
  if v_intent is not null then
    select * into bk from public.bookings where id = v_booking for update;
    select * into pi from public.payment_intents where id = v_intent for update;
  end if;

  insert into public.payment_events (provider, event_id, event_type, raw_type, intent_id, provider_ref, amount, payload)
  values (p_provider, btrim(p_event_id), p_event_type, left(p_raw_type, 100), v_intent, left(p_provider_ref, 200), p_amount,
          coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, event_id) do nothing
  returning id into v_event;
  if v_event is null then
    return jsonb_build_object('duplicate', true, 'intent_id', v_intent, 'result', 'DUPLICATE');
  end if;

  if v_intent is null then
    v_result := 'NOT_FOUND';
    if p_event_type = 'PAID' then
      perform public.app_notify_admins('PAYMENT_UNMATCHED', 'ได้รับเงินแต่หารายการชำระไม่เจอ',
        p_provider || ' ' || coalesce(p_provider_ref, p_event_id) || coalesce(' ' || p_amount || ' บาท', ''), '/payments');
    end if;
  elsif p_event_type = 'IGNORED' then
    v_result := 'IGNORED';
  elsif p_event_type in ('FAILED','EXPIRED','CANCELLED') then
    if pi.status = 'PENDING' then
      update public.payment_intents
         set status = p_event_type, closed_at = now(),
             failure_code = left(coalesce(nullif(btrim(p_failure_code), ''), p_event_type), 60),
             failure_message = left(nullif(btrim(p_failure_message), ''), 300)
       where id = pi.id;
      v_result := p_event_type;
    else
      v_result := 'IGNORED';
    end if;
  elsif pi.status = 'PAID' then
    v_result := 'IGNORED';                                          -- จ่ายแล้ว (event อื่นของรายการเดิม)
  else                                                              -- PAID (รวมรายการที่เราปิดไปแล้ว: เงินเข้าจริง)
    update public.payment_intents
       set status = 'PAID', paid_at = coalesce(p_paid_at, now()), paid_amount = p_amount,
           provider_ref = coalesce(pi.provider_ref, left(p_provider_ref, 200)), closed_at = null
     where id = pi.id;
    v_reason := case
      -- ไม่ยืนยันโต๊ะถ้าไม่รู้ยอดจริง (adapter ต้องส่งยอดเป็นบาท · ไม่ใช่ THB = ส่ง null)
      when p_amount is null then 'ผู้ให้บริการไม่ได้ส่งยอดที่ชำระมา — ตรวจยอดที่ระบบผู้ให้บริการ'
      when p_amount <> pi.amount
        then 'ยอดที่ชำระ (' || p_amount || ' บาท) ไม่ตรงกับ Table Fee (' || pi.amount || ' บาท)'
      when bk.status <> 'AWAITING_DEPOSIT' then 'การจองไม่ได้รอชำระแล้ว (' || bk.status || ')'
      when exists (select 1 from public.deposits d where d.booking_id = bk.id and d.status in ('SUBMITTED','VERIFIED'))
        then 'การจองนี้มี Table Fee ที่ชำระแล้วหรือรอตรวจอยู่'
      else null end;
    if v_reason is null then
      insert into public.deposits (booking_id, bar_id, amount, status, settlement, verified_at, settled_at, payment_intent_id)
      values (bk.id, bk.bar_id, pi.amount, 'VERIFIED', 'HELD', now(), now(), pi.id);
      perform set_config('app.reason', 'payment paid', true);
      update public.bookings set status = 'CONFIRMED' where id = bk.id;   -- trigger: แจ้งลูกค้า (E-Ticket พร้อม) + ทีมร้าน
      v_result := 'CONFIRMED';
    else
      update public.payment_intents set refund_status = 'REQUIRED', refund_reason = left(v_reason, 300) where id = pi.id;
      select name into v_bar from public.bars where id = pi.bar_id;
      perform public.app_notify(pi.user_id, 'PAYMENT_REFUND_REQUIRED', 'ได้รับ Table Fee แล้ว แต่ยืนยันการจองไม่ได้',
        v_bar || ' ' || bk.code || ' NightOut จะคืนเงิน ' || pi.amount || ' บาทให้เต็มจำนวน', '/bookings/' || bk.id || '/deposit', bk.id, bk.bar_id);
      perform public.app_notify_admins('PAYMENT_REFUND_REQUIRED', 'ชำระแล้วแต่ยืนยันการจองไม่ได้ — ต้องคืนเงิน',
        v_bar || ' ' || bk.code || ' ' || pi.amount || ' บาท ' || v_reason, '/payments', bk.id, bk.bar_id);
      v_result := 'REFUND_REQUIRED';
    end if;
    perform public.app_audit(null, 'payment.' || lower(v_result), 'payment_intents', pi.id, jsonb_build_object(
      'booking_id', bk.id, 'provider', p_provider, 'event_id', p_event_id, 'amount', coalesce(p_amount, pi.amount), 'reason', v_reason));
  end if;

  update public.payment_events set result = v_result where id = v_event;
  return jsonb_build_object('duplicate', false, 'intent_id', v_intent, 'result', v_result);
end $$;

-- admin_remove_user_avatar(uuid,uuid,text) · เดิมใน 20261016000100_account_avatar.sql
create or replace function public.admin_remove_user_avatar(p_actor uuid, p_user uuid, p_reason text)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users; v_reason text;
begin
  perform public.admin_assert(p_actor);
  v_reason := nullif(btrim(p_reason), '');
  if v_reason is null or char_length(v_reason) not between 3 and 300 then
    raise exception 'AVATAR_REMOVE_REASON_REQUIRED' using errcode = '22023';
  end if;
  select * into u from public.users where id = p_user for update;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  if u.avatar_path is null and u.avatar_url is null then raise exception 'AVATAR_NOT_FOUND' using errcode = 'P0002'; end if;

  update public.users set avatar_path = null, avatar_url = null where id = p_user;
  perform public.admin_audit(p_actor, 'user.avatar_remove', 'users', p_user,
    jsonb_build_object('avatar_path', u.avatar_path, 'avatar_url', u.avatar_url),
    jsonb_build_object('reason', v_reason));
  perform public.app_notify(p_user, 'AVATAR_REMOVED', 'รูปโปรไฟล์ของคุณถูกลบ',
    'ทีม NightOut ลบรูปโปรไฟล์ของคุณ เหตุผล: ' || v_reason || ' อัปโหลดรูปใหม่ได้ที่หน้าโปรไฟล์', '/profile');
  return jsonb_build_object(
    'id', p_user,
    'removed_paths', case when u.avatar_path is null then '[]'::jsonb else jsonb_build_array(u.avatar_path) end);
end $$;

-- app_create_booking_core(uuid,uuid,uuid,timestamptz,integer,uuid,text) · เดิม = app_create_booking ของ …001700 ที่ …20261006000200 เปลี่ยนชื่อ (ดึงจาก pg_get_functiondef)
CREATE OR REPLACE FUNCTION public.app_create_booking_core(p_actor uuid, p_bar uuid, p_zone uuid, p_datetime timestamp with time zone, p_pax integer, p_promotion uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  u public.users; b public.bars; s public.bar_booking_settings; z public.table_zones; pr public.bar_promotions;
  v_until timestamptz; v_table uuid; v_has_tables boolean; v_deposit numeric; v_status public.booking_status;
  v_code text; v_id uuid; v_local timestamp;
begin
  u := public.app_assert_user(p_actor);
  select * into b from public.bars where id = p_bar and status = 'APPROVED';
  if not found then raise exception 'BAR_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into s from public.bar_booking_settings where bar_id = p_bar;
  if p_pax is null or p_pax < 1 or p_pax > s.max_pax_per_booking then
    raise exception 'PAX_OUT_OF_RANGE' using errcode = '22023';
  end if;
  if p_datetime < now() + make_interval(mins => s.min_advance_minutes) then
    raise exception 'BOOKING_TOO_SOON' using errcode = '22023';
  end if;
  if p_datetime > now() + make_interval(days => s.max_advance_days) then
    raise exception 'BOOKING_TOO_FAR' using errcode = '22023';
  end if;
  select * into z from public.table_zones where id = p_zone and bar_id = p_bar and active;
  if not found then raise exception 'ZONE_NOT_FOUND' using errcode = 'P0002'; end if;
  v_until := p_datetime + make_interval(mins => z.default_duration_minutes);

  -- ล็อกโซน + นับความจุที่เหลือ (request พร้อมกันต่อคิวกันที่นี่)
  if public.zone_remaining_pax(p_zone, p_datetime, v_until) < p_pax then
    raise exception 'ZONE_FULL' using errcode = 'P0001';
  end if;
  select exists (select 1 from public.tables t where t.zone_id = p_zone and t.active) into v_has_tables;
  if v_has_tables then
    select t.id into v_table from public.tables t
     where t.zone_id = p_zone and t.active
       and not exists (select 1 from public.bookings x
                        where x.table_id = t.id
                          and x.status in ('PENDING','AWAITING_DEPOSIT','DEPOSIT_SUBMITTED','CONFIRMED','CHECKED_IN')
                          and x.reserved_period && tstzrange(p_datetime, v_until, '[)'))
     order by (t.seats >= p_pax) desc, case when t.seats >= p_pax then t.seats end asc nulls last, t.seats desc, t.name
     limit 1;
    if v_table is null then raise exception 'ZONE_FULL' using errcode = 'P0001'; end if;
  elsif not z.allow_zone_only_booking then
    raise exception 'ZONE_FULL' using errcode = 'P0001';
  end if;

  if p_promotion is not null then
    v_local := p_datetime at time zone 'Asia/Bangkok';
    select * into pr from public.bar_promotions
     where id = p_promotion and bar_id = p_bar and active and moderation_status = 'APPROVED'
       and (valid_from is null or valid_from <= v_local::date)
       and (valid_to is null or valid_to >= v_local::date);
    if not found
       or not (extract(dow from v_local)::smallint = any (pr.days_of_week))
       or (pr.cutoff_time is not null and v_local::time > pr.cutoff_time)
       or (pr.min_pax is not null and p_pax < pr.min_pax) then
      raise exception 'PROMOTION_NOT_AVAILABLE' using errcode = '22023';
    end if;
  end if;

  v_deposit := case when s.deposit_unit = 'PER_PERSON' then s.deposit_amount * p_pax else s.deposit_amount end;
  v_status := case when v_deposit > 0 then 'AWAITING_DEPOSIT' else 'PENDING' end;
  loop
    v_code := 'NL-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
    exit when not exists (select 1 from public.bookings where code = v_code);
  end loop;

  begin
    insert into public.bookings (code, user_id, bar_id, zone_id, table_id, booking_datetime, reserved_from, reserved_until,
                                 pax, status, customer_note, deposit_required, deposit_policy_snapshot, grace_minutes,
                                 auto_cancel_at, expires_at)
    values (v_code, p_actor, p_bar, p_zone, v_table, p_datetime, p_datetime, v_until,
            p_pax, v_status, nullif(trim(p_note), ''), v_deposit, s.deposit_policy, s.grace_minutes,
            p_datetime + make_interval(mins => s.grace_minutes),
            least(now() + make_interval(mins => case when v_status = 'AWAITING_DEPOSIT' then s.deposit_timeout_minutes
                                                     else s.pending_timeout_minutes end),
                  p_datetime + make_interval(mins => s.grace_minutes)))
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'ZONE_FULL' using errcode = 'P0001';
  end;

  if pr.id is not null then
    insert into public.booking_promotions (booking_id, promotion_id, title_snapshot, perk_snapshot)
    values (v_id, pr.id, pr.title, jsonb_build_object('perk_type', pr.perk_type, 'description', pr.description,
            'discount_percent', pr.discount_percent, 'cutoff_time', to_char(pr.cutoff_time, 'HH24:MI')));
  end if;
  insert into public.booking_shares (booking_id) values (v_id);

  perform public.app_notify(p_actor, 'BOOKING_CREATED', 'สร้างการจองแล้ว',
    b.name || ' ' || public.app_fmt(p_datetime) || ' ' || p_pax || ' คน', '/bookings/' || v_id, v_id, p_bar);
  perform public.app_notify_team(p_bar, 'BOOKING_NEW', 'มีการจองใหม่',
    u.display_name || ' ' || public.app_fmt(p_datetime) || ' ' || p_pax || ' คน', '/merchant/bookings', v_id);
  return jsonb_build_object('id', v_id, 'code', v_code, 'status', v_status, 'deposit_required', v_deposit);
end $function$;
