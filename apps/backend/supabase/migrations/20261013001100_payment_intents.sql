-- =====================================================================
-- payment · ชั้นชำระเงินกลาง ไม่ผูกผู้ให้บริการ (เจ้าของอนุมัติ 2026-10-13)
--   1) payment_intents — 1 แถว = เปิดหน้าชำระเงินของผู้ให้บริการ 1 ครั้ง (mock / beam / …)
--      app_payment_start (เริ่ม/ใช้รายการเดิม) → NestJS สร้าง checkout ที่ผู้ให้บริการ → app_payment_attach
--      deposits.payment_intent_id (null = โอน + สลิปเดิม)
--   2) payment_events — log webhook ทุกตัว กันซ้ำด้วย (provider, event_id) · payload ที่ adapter ตัดข้อมูลส่วนตัวแล้ว
--   3) payment_apply_event (webhook · ไม่มี actor) — PAID ยอดตรง + การจองยังรอชำระ
--      → deposits VERIFIED/HELD + booking CONFIRMED (E-Ticket) · ไม่งั้น "ต้องคืนเงิน" (คืนทำมือ) + แจ้งลูกค้า/แอดมิน
--      ไม่รู้ยอดจริง (ไม่ส่งยอด / ไม่ใช่ THB) = ไม่ยืนยันโต๊ะเด็ดขาด · หารายการไม่เจอ = แจ้งแอดมิน (admin_payment_unmatched)
--   4) state machine: AWAITING_DEPOSIT → CONFIRMED (SYSTEM เท่านั้น — app_team_set_booking_status มี whitelist ของตัวเอง)
--      + trigger ปิดรายการ PENDING เมื่อการจองออกจาก AWAITING_DEPOSIT (หมดเวลา / ยกเลิก / ส่งสลิป)
--   5) แจ้งเตือนเมื่อจ่ายสำเร็จ: ลูกค้า "ชำระ Table Fee สำเร็จ — E-Ticket พร้อมใช้แล้ว" · ทีมร้าน (ไม่มียอดเงิน — Staff/PR ห้ามเห็นเงิน)
--      admin_payment_mark_refunded (แอดมินคืนเงินที่ระบบผู้ให้บริการแล้วมาบันทึก) · my_payment_intents (อ่านของตัวเอง)
--      booking_deposit_summary + method/provider · admin_deposits + payment_intent_id/payment_provider (คอลัมน์ท้าย)
--      views admin_payment_intents / admin_payment_unmatched (Backoffice /payments)
--   6) flow โอน + แนบสลิปยังอยู่ครบ — NestJS เลือกเองตาม env PAYMENT_PROVIDER (ไม่ตั้ง = สลิป)
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. ตาราง
-- ---------------------------------------------------------------------
create table if not exists public.payment_intents (     -- 1 แถว = เปิดหน้าชำระเงินของผู้ให้บริการ 1 ครั้ง
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null,
  bar_id          uuid not null references public.bars(id),
  user_id         uuid not null references public.users(id),
  provider        text not null check (provider ~ '^[a-z][a-z0-9_]{1,29}$'),   -- mock / beam / …
  provider_ref    text check (char_length(provider_ref) <= 200),              -- id ฝั่งผู้ให้บริการ (session/charge)
  amount          numeric(10,2) not null check (amount > 0),                   -- = bookings.deposit_required ตอนเริ่ม
  currency        text not null default 'THB' check (currency = 'THB'),
  status          text not null default 'PENDING' check (status in ('PENDING','PAID','FAILED','EXPIRED','CANCELLED')),
  checkout_url    text check (char_length(checkout_url) <= 2000),
  return_url      text check (char_length(return_url) <= 500),
  expires_at      timestamptz not null,
  paid_at         timestamptz,
  paid_amount     numeric(10,2),                                               -- ยอดที่ผู้ให้บริการแจ้งมาจริง
  closed_at       timestamptz,                                                 -- FAILED / EXPIRED / CANCELLED เมื่อไร
  failure_code    text check (char_length(failure_code) <= 60),
  failure_message text check (char_length(failure_message) <= 300),
  refund_status   text not null default 'NONE' check (refund_status in ('NONE','REQUIRED','REFUNDED')),
  refund_reason   text check (char_length(refund_reason) <= 300),              -- ทำไมต้องคืน (ระบบเขียน)
  refund_note     text check (char_length(refund_note) <= 300),                -- แอดมินคืนอย่างไร
  refund_ref      text check (char_length(refund_ref) <= 120),
  refunded_by     uuid references public.users(id) on delete set null,          -- เหมือน deposits.verified_by
  refunded_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint payment_intents_booking_same_bar foreign key (booking_id, bar_id) references public.bookings (id, bar_id),
  constraint payment_intents_paid_has_time check (status <> 'PAID' or paid_at is not null),
  constraint payment_intents_refund_needs_paid check (refund_status = 'NONE' or status = 'PAID')
);
drop trigger if exists payment_intents_updated_at on public.payment_intents;
create trigger payment_intents_updated_at before update on public.payment_intents
  for each row execute function public.set_updated_at();
create unique index if not exists payment_intents_one_pending  on public.payment_intents (booking_id) where status = 'PENDING';
create unique index if not exists payment_intents_provider_ref on public.payment_intents (provider, provider_ref) where provider_ref is not null;
create index if not exists payment_intents_booking_id_bar_id_fk on public.payment_intents (booking_id, bar_id);
create index if not exists payment_intents_bar_id_fk      on public.payment_intents (bar_id);
create index if not exists payment_intents_user_id_fk     on public.payment_intents (user_id);
create index if not exists payment_intents_refunded_by_fk on public.payment_intents (refunded_by);
create index if not exists payment_intents_created        on public.payment_intents (created_at desc);

create table if not exists public.payment_events (       -- log webhook ทุกตัว · กันซ้ำด้วย (provider, event_id)
  id           bigint generated always as identity primary key,
  provider     text not null,
  event_id     text not null check (char_length(event_id) between 1 and 200),
  event_type   text not null check (event_type in ('PAID','FAILED','EXPIRED','CANCELLED','IGNORED')),
  raw_type     text check (char_length(raw_type) <= 100),
  intent_id    uuid references public.payment_intents(id),
  provider_ref text check (char_length(provider_ref) <= 200),
  amount       numeric(10,2),
  payload      jsonb not null default '{}'::jsonb check (octet_length(payload::text) <= 65536),  -- adapter ตัดข้อมูลบัตร/ส่วนตัวออกแล้ว
  result       text not null default 'PENDING'
               check (result in ('PENDING','CONFIRMED','REFUND_REQUIRED','FAILED','EXPIRED','CANCELLED','IGNORED','NOT_FOUND')),
  received_at  timestamptz not null default now(),
  constraint payment_events_provider_event unique (provider, event_id)
);
create index if not exists payment_events_intent_id_fk on public.payment_events (intent_id);

alter table public.deposits add column if not exists payment_intent_id uuid references public.payment_intents(id);  -- null = โอน + สลิป
create unique index if not exists deposits_payment_intent_id_key on public.deposits (payment_intent_id) where payment_intent_id is not null;

-- RLS: ลูกค้าเห็นรายการของตัวเอง · แอดมินเห็นทั้งหมด (…001600 สร้าง admin_read ให้ตารางที่มีตอนนั้นเท่านั้น) · เขียนผ่านฟังก์ชันเท่านั้น
alter table public.payment_intents enable row level security;
alter table public.payment_events  enable row level security;
drop policy if exists payment_intents_read_own on public.payment_intents;
create policy payment_intents_read_own on public.payment_intents for select to authenticated using (user_id = auth.uid());
drop policy if exists admin_read on public.payment_intents;
create policy admin_read on public.payment_intents for select to authenticated using (public.is_admin());
drop policy if exists admin_read on public.payment_events;
create policy admin_read on public.payment_events for select to authenticated using (public.is_admin());
revoke insert, update, delete, truncate on public.payment_intents, public.payment_events from anon, authenticated;
revoke select on public.payment_intents, public.payment_events from anon;
grant select on public.payment_intents, public.payment_events to authenticated;

-- ---------------------------------------------------------------------
-- 2. state machine: เหมือน …000600 + AWAITING_DEPOSIT → CONFIRMED
--    (CONFIRMED = ชำระผ่านผู้ให้บริการสำเร็จ · payment_apply_event)
-- ---------------------------------------------------------------------
create or replace function public.booking_transition_allowed(f public.booking_status, t public.booking_status) returns boolean
language sql immutable set search_path = '' as $$
  select case f
    when 'PENDING'           then t in ('AWAITING_DEPOSIT','CONFIRMED','REJECTED','CANCELLED_BY_CUSTOMER','EXPIRED')
    -- CONFIRMED = ชำระผ่านผู้ให้บริการสำเร็จ (payment_apply_event)
    when 'AWAITING_DEPOSIT'  then t in ('DEPOSIT_SUBMITTED','CONFIRMED','CANCELLED_BY_CUSTOMER','EXPIRED')
    when 'DEPOSIT_SUBMITTED' then t in ('CONFIRMED','AWAITING_DEPOSIT','REJECTED','CANCELLED_BY_CUSTOMER')
    when 'CONFIRMED'         then t in ('CHECKED_IN','NO_SHOW','CANCELLED_BY_CUSTOMER','CANCELLED_BY_MERCHANT')
    when 'CHECKED_IN'        then t in ('COMPLETED')
    else false end
$$;

-- ---------------------------------------------------------------------
-- 3. การจองออกจาก AWAITING_DEPOSIT (หมดเวลา / ยกเลิก / ส่งสลิป / จ่ายผ่านรายการอื่น) → ปิดรายการที่ยัง PENDING
--    รายการที่จ่ายสำเร็จเป็น PAID ก่อน update การจองแล้ว จึงไม่โดน
-- ---------------------------------------------------------------------
create or replace function public.payment_close_on_booking_end() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.payment_intents
     set status = case when new.status = 'EXPIRED' then 'EXPIRED' else 'CANCELLED' end,
         closed_at = now(), failure_code = coalesce(failure_code, 'BOOKING_' || new.status)
   where booking_id = new.id and status = 'PENDING';
  return new;
end $$;
drop trigger if exists bookings_close_payment_intents on public.bookings;
create trigger bookings_close_payment_intents after update of status on public.bookings
  for each row when (old.status = 'AWAITING_DEPOSIT' and new.status is distinct from old.status)
  execute function public.payment_close_on_booking_end();

-- ---------------------------------------------------------------------
-- 4. ลูกค้ากด "ไปหน้าชำระเงิน" — เริ่มรายการใหม่ หรือใช้รายการเดิมที่ยังไม่หมดเวลา
--    ลำดับล็อกทั้งกลุ่มนี้: bookings ก่อน แล้วค่อย payment_intents (กัน deadlock กับ payment_apply_event)
-- ---------------------------------------------------------------------
create or replace function public.app_payment_start(p_actor uuid, p_booking uuid, p_provider text, p_return_url text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users; bk public.bookings; pi public.payment_intents; v_reused boolean := false; v_bar text;
begin
  u := public.app_assert_user(p_actor);
  perform public.booking_ban_check(p_actor);
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9_]{1,29}$' then
    raise exception 'PAYMENT_PROVIDER_UNKNOWN' using errcode = '22023';
  end if;

  select * into bk from public.bookings where id = p_booking for update;
  if not found or bk.user_id <> p_actor then raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002'; end if;
  if bk.deposit_required <= 0 then raise exception 'NO_DEPOSIT_REQUIRED' using errcode = 'P0001'; end if;
  if bk.status <> 'AWAITING_DEPOSIT' then raise exception 'BOOKING_NOT_AWAITING_PAYMENT' using errcode = 'P0001'; end if;
  if bk.expires_at is not null and bk.expires_at <= now() then
    raise exception 'PAYMENT_WINDOW_CLOSED' using errcode = 'P0001';
  end if;

  -- ปิดรายการค้าง: หมดเวลา / เปลี่ยนผู้ให้บริการ / สร้าง checkout ไม่สำเร็จเกิน 2 นาที
  update public.payment_intents
     set status = case when provider <> p_provider then 'CANCELLED' else 'EXPIRED' end,
         closed_at = now(),
         failure_code = case when provider <> p_provider then 'PROVIDER_CHANGED'
                             when checkout_url is null then 'CHECKOUT_NOT_CREATED'
                             else 'EXPIRED' end
   where booking_id = bk.id and status = 'PENDING'
     and (expires_at <= now() or provider <> p_provider
          or (checkout_url is null and created_at < now() - interval '2 minutes'));

  select * into pi from public.payment_intents where booking_id = bk.id and status = 'PENDING' for update;
  if found then
    if pi.checkout_url is null then raise exception 'PAYMENT_IN_PROGRESS' using errcode = 'P0001'; end if;
    v_reused := true;
  else
    insert into public.payment_intents (booking_id, bar_id, user_id, provider, amount, expires_at, return_url)
    values (bk.id, bk.bar_id, p_actor, p_provider, bk.deposit_required,
            least(coalesce(bk.expires_at, now() + interval '30 minutes'), now() + interval '30 minutes'),
            left(nullif(btrim(p_return_url), ''), 500))
    returning * into pi;
    perform public.app_audit(p_actor, 'payment.start', 'payment_intents', pi.id, jsonb_build_object(
      'booking_id', bk.id, 'provider', pi.provider, 'amount', pi.amount));
  end if;

  select name into v_bar from public.bars where id = bk.bar_id;
  return jsonb_build_object('intent_id', pi.id, 'provider', pi.provider, 'amount', pi.amount, 'expires_at', pi.expires_at,
    'checkout_url', pi.checkout_url, 'reused', v_reused, 'booking_id', bk.id, 'booking_code', bk.code,
    'bar_name', v_bar, 'customer_email', u.email);
end $$;

-- ---------------------------------------------------------------------
-- 5. NestJS สร้าง checkout ที่ผู้ให้บริการแล้ว → ผูก provider_ref + checkout_url (หรือบันทึกว่าสร้างไม่สำเร็จ)
-- ---------------------------------------------------------------------
create or replace function public.app_payment_attach(p_actor uuid, p_intent uuid, p_provider_ref text, p_checkout_url text,
                                                     p_expires_at timestamptz default null, p_error text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare pi public.payment_intents;
begin
  perform public.app_assert_user(p_actor);
  select * into pi from public.payment_intents where id = p_intent and user_id = p_actor for update;
  if not found then raise exception 'PAYMENT_INTENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if pi.status <> 'PENDING' then raise exception 'PAYMENT_INTENT_NOT_PENDING' using errcode = 'P0001'; end if;

  if p_error is not null then
    update public.payment_intents
       set status = 'FAILED', closed_at = now(), failure_code = 'CHECKOUT_CREATE_FAILED', failure_message = left(p_error, 300)
     where id = pi.id;
    return jsonb_build_object('intent_id', pi.id, 'status', 'FAILED');
  end if;
  if nullif(btrim(p_checkout_url), '') is null then
    raise exception 'PAYMENT_PROVIDER_ERROR' using errcode = '22023';
  end if;

  begin
    update public.payment_intents
       set provider_ref = left(nullif(btrim(p_provider_ref), ''), 200),
           checkout_url = left(btrim(p_checkout_url), 2000),
           expires_at = least(pi.expires_at, coalesce(p_expires_at, pi.expires_at))
     where id = pi.id
    returning * into pi;
  exception when unique_violation then
    raise exception 'PAYMENT_PROVIDER_ERROR' using errcode = 'P0001';
  end;
  return jsonb_build_object('intent_id', pi.id, 'provider', pi.provider, 'amount', pi.amount, 'expires_at', pi.expires_at,
    'checkout_url', pi.checkout_url, 'reused', false, 'status', 'PENDING');
end $$;

-- ---------------------------------------------------------------------
-- 6. webhook (ไม่มี actor — เหมือน run_booking_timeouts) · NestJS ตรวจลายเซ็น + แปลง event ด้วย adapter ก่อนเรียก
--    PAID ของรายการที่เราปิดไปแล้ว (เงินเข้าจริง) ยังยืนยันได้ถ้าการจองยังรอชำระและไม่มีมัดจำอื่น
-- ---------------------------------------------------------------------
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
        p_provider || ' · ' || coalesce(p_provider_ref, p_event_id) || coalesce(' · ' || p_amount || ' บาท', ''), '/payments');
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
        v_bar || ' · ' || bk.code || ' · NightOut จะคืนเงิน ' || pi.amount || ' บาทให้เต็มจำนวน', '/bookings/' || bk.id || '/deposit', bk.id, bk.bar_id);
      perform public.app_notify_admins('PAYMENT_REFUND_REQUIRED', 'ชำระแล้วแต่ยืนยันการจองไม่ได้ — ต้องคืนเงิน',
        v_bar || ' · ' || bk.code || ' · ' || pi.amount || ' บาท · ' || v_reason, '/payments', bk.id, bk.bar_id);
      v_result := 'REFUND_REQUIRED';
    end if;
    perform public.app_audit(null, 'payment.' || lower(v_result), 'payment_intents', pi.id, jsonb_build_object(
      'booking_id', bk.id, 'provider', p_provider, 'event_id', p_event_id, 'amount', coalesce(p_amount, pi.amount), 'reason', v_reason));
  end if;

  update public.payment_events set result = v_result where id = v_event;
  return jsonb_build_object('duplicate', false, 'intent_id', v_intent, 'result', v_result);
end $$;

-- ---------------------------------------------------------------------
-- 7. แอดมินคืนเงินที่ระบบผู้ให้บริการแล้ว มาบันทึก (เฉพาะรายการ "ต้องคืนเงิน")
--    คืนมัดจำระดับการจอง (ยกเลิก ≥ 6 ชม. / ร้านไม่มีโต๊ะ) ยังเป็น deposits REFUND_PENDING → admin_settle_deposit เดิม
-- ---------------------------------------------------------------------
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
    v_bar || ' · ' || pi.amount || ' บาท', '/bookings/' || pi.booking_id || '/deposit', pi.booking_id, pi.bar_id);
  return jsonb_build_object('id', pi.id, 'refund_status', 'REFUNDED', 'refunded_at', pi.refunded_at);
end $$;

-- ---------------------------------------------------------------------
-- 8. ลูกค้าอ่านรายการชำระของตัวเอง (ใหม่สุดก่อน · ≤ 20) · PENDING ที่เลยเวลาแสดงเป็น EXPIRED
-- ---------------------------------------------------------------------
create or replace function public.my_payment_intents(p_booking uuid default null, p_intent uuid default null)
returns table (id uuid, booking_id uuid, booking_code text, bar_name text, provider text, status text, amount numeric,
               checkout_url text, expires_at timestamptz, paid_at timestamptz, failure_code text, failure_message text,
               refund_status text, applied boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select pi.id, pi.booking_id, bk.code, b.name, pi.provider,
         case when pi.status = 'PENDING' and pi.expires_at <= now() then 'EXPIRED' else pi.status end,
         pi.amount,
         case when pi.status = 'PENDING' and pi.expires_at > now() then pi.checkout_url end,
         pi.expires_at, pi.paid_at, pi.failure_code, pi.failure_message, pi.refund_status,
         exists (select 1 from public.deposits d where d.payment_intent_id = pi.id),
         pi.created_at
  from public.payment_intents pi
  join public.bookings bk on bk.id = pi.booking_id
  join public.bars b on b.id = pi.bar_id
  where pi.user_id = auth.uid()
    and (p_booking is null or pi.booking_id = p_booking)
    and (p_intent is null or pi.id = p_intent)
  order by pi.created_at desc
  limit 20
$$;

-- ---------------------------------------------------------------------
-- 9. booking_deposit_summary: เหมือน …20261006000300 + method (SLIP / ONLINE) + provider
-- ---------------------------------------------------------------------
create or replace function public.booking_deposit_summary(p_booking uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when d.id is null then null else jsonb_build_object(
    'id', d.id, 'amount', d.amount, 'status', d.status, 'reject_reason', d.reject_reason,
    'settlement', d.settlement, 'verified_at', d.verified_at, 'created_at', d.created_at,
    'refund_reason', d.refund_reason,
    'method', case when d.payment_intent_id is null then 'SLIP' else 'ONLINE' end,
    'provider', (select pi.provider from public.payment_intents pi where pi.id = d.payment_intent_id)) end
  from public.bookings b
  left join lateral (
    select * from public.deposits where booking_id = b.id order by created_at desc limit 1) d on true
  where b.id = p_booking
    and (b.user_id = auth.uid() or public.is_bar_member(b.bar_id) or public.is_admin())
$$;

-- ---------------------------------------------------------------------
-- 10. handle_booking_status_effects: เหมือน …20261013000500 + จ่ายผ่านผู้ให้บริการ (AWAITING_DEPOSIT → CONFIRMED)
--     ลูกค้า "ชำระ Table Fee สำเร็จ — E-Ticket พร้อมใช้แล้ว" · ทีมร้านไม่มียอดเงิน (Staff/PR ห้ามเห็นเงิน)
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
  if new.status = 'CONFIRMED' and old.status = 'AWAITING_DEPOSIT' then   -- ชำระผ่านผู้ให้บริการ (20261013001100)
    perform public.app_notify_team(new.bar_id, 'BOOKING_CONFIRMED', 'ลูกค้าชำระ Table Fee แล้ว — ยืนยันการจองอัตโนมัติ',
      new.code || ' · ' || public.app_fmt(new.booking_datetime), '/merchant/bookings/' || new.id, new.id);
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 11. Views (Backoffice)
--     admin_deposits: เหมือน …20261006000300 + payment_intent_id, payment_provider (Postgres เพิ่มคอลัมน์ได้แค่ท้ายสุด)
-- ---------------------------------------------------------------------
create or replace view public.admin_deposits with (security_invoker = true) as
select
  d.id, d.amount, d.slip_path, d.slip_ref, d.status, d.reject_reason, d.settlement,
  d.verified_at, d.settled_at, d.created_at,
  jsonb_build_object('id', bk.id, 'code', bk.code, 'status', bk.status, 'booking_datetime', bk.booking_datetime, 'pax', bk.pax) as booking,
  jsonb_build_object('id', b.id, 'name', b.name) as bar,
  case when u.id is null then null else jsonb_build_object('id', u.id, 'display_name', u.display_name, 'email', u.email) end as customer,
  (select jsonb_build_object('bank_code', pa.bank_code, 'account_name', pa.account_name, 'account_no_last4', pa.account_no_last4)
   from public.bar_payout_accounts pa where pa.bar_id = b.id and pa.is_default) as payout_account,
  d.reject_code,
  (select count(*) from public.user_flags f where f.user_id = u.id and f.kind = 'FAKE_SLIP' and f.cleared_at is null)::integer
    as customer_fake_slip_count,
  (u.banned_at is not null) as customer_banned,
  d.refund_reason, d.refund_requested_at,
  (select x.display_name from public.users x where x.id = d.refund_requested_by) as refund_requested_by_name,
  d.payment_intent_id,                                            -- …20261013001100: null = โอน + สลิป
  (select pi.provider from public.payment_intents pi where pi.id = d.payment_intent_id) as payment_provider
from public.deposits d
join public.bookings bk on bk.id = d.booking_id
join public.bars     b  on b.id  = d.bar_id
left join public.users u on u.id = bk.user_id
where public.is_admin();

-- รายการชำระ Table Fee ผ่านผู้ให้บริการ (ไม่มี payload / contact_phone)
create or replace view public.admin_payment_intents with (security_invoker = true) as
select
  pi.id, pi.provider, pi.provider_ref, pi.amount, pi.currency,
  case when pi.status = 'PENDING' and pi.expires_at <= now() then 'EXPIRED' else pi.status end as status,
  pi.status as raw_status,
  (pi.checkout_url is not null) as checkout_created,
  pi.expires_at, pi.paid_at, pi.paid_amount, pi.closed_at, pi.failure_code, pi.failure_message,
  d.id as deposit_id, d.settlement as deposit_settlement, (d.id is not null) as applied,
  pi.refund_status, pi.refund_reason, pi.refund_note, pi.refund_ref, pi.refunded_at,
  (select x.display_name from public.users x where x.id = pi.refunded_by) as refunded_by_name,
  pi.created_at, pi.updated_at,
  jsonb_build_object('id', bk.id, 'code', bk.code, 'status', bk.status, 'booking_datetime', bk.booking_datetime, 'pax', bk.pax) as booking,
  jsonb_build_object('id', b.id, 'name', b.name) as bar,
  case when u.id is null then null else jsonb_build_object('id', u.id, 'display_name', u.display_name, 'email', u.email) end as customer,
  coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'event_type', e.event_type, 'raw_type', e.raw_type,
                                                'result', e.result, 'amount', e.amount, 'received_at', e.received_at)
                             order by e.received_at desc)
            from (select * from public.payment_events e0 where e0.intent_id = pi.id order by e0.received_at desc limit 20) e),
           '[]'::jsonb) as events
from public.payment_intents pi
join public.bookings bk on bk.id = pi.booking_id
join public.bars     b  on b.id  = pi.bar_id
left join public.users    u on u.id = pi.user_id
left join public.deposits d on d.payment_intent_id = pi.id
where public.is_admin();
revoke all on public.admin_payment_intents from anon;
grant select on public.admin_payment_intents to authenticated;

-- เงินเข้าแต่หารายการชำระไม่เจอ (payment_apply_event → NOT_FOUND + แจ้งแอดมินลิงก์ /payments) — ต้องมีที่ให้แอดมินเห็น
create or replace view public.admin_payment_unmatched with (security_invoker = true) as
select e.id, e.provider, e.event_id, e.raw_type, e.provider_ref, e.amount, e.received_at
from public.payment_events e
where e.intent_id is null and e.event_type = 'PAID' and public.is_admin();
revoke all on public.admin_payment_unmatched from anon;
grant select on public.admin_payment_unmatched to authenticated;

-- ---------------------------------------------------------------------
-- 12. สิทธิ์ฟังก์ชัน
-- ---------------------------------------------------------------------
revoke all on function public.app_payment_start(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.app_payment_start(uuid, uuid, text, text) to service_role;
revoke all on function public.app_payment_attach(uuid, uuid, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.app_payment_attach(uuid, uuid, text, text, timestamptz, text) to service_role;
revoke all on function public.payment_apply_event(text, text, text, text, uuid, text, numeric, timestamptz, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.payment_apply_event(text, text, text, text, uuid, text, numeric, timestamptz, text, text, jsonb) to service_role;
revoke all on function public.admin_payment_mark_refunded(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_payment_mark_refunded(uuid, uuid, text, text) to service_role;
revoke all on function public.payment_close_on_booking_end() from public, anon, authenticated;
revoke all on function public.my_payment_intents(uuid, uuid) from public, anon;
grant execute on function public.my_payment_intents(uuid, uuid) to authenticated, service_role;
revoke all on function public.booking_deposit_summary(uuid) from public, anon;
grant execute on function public.booking_deposit_summary(uuid) to authenticated, service_role;
