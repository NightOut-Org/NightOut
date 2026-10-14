-- =====================================================================
-- NightOut · account — แอดมินแบน / ปลดแบนบัญชีเอง (ลูกค้า + ทีมร้าน) · ชุมชนอ่านอย่างเดียวเมื่อถูกแบน
--   - admin_ban_user: ต้องมีเหตุผล 3–300 ตัวอักษร (เจ้าของบัญชีเห็นในแจ้งเตือน) · แบนตัวเอง / บัญชีที่เข้า Backoffice ได้ไม่ได้
--       ban_phones = แบนทุกเบอร์ที่บัญชีเคยใช้ (users.phone_e164 + bookings.contact_phone + user_flags.phone_e164)
--       ข้ามเบอร์รูปแบบผิด (ตรงกับ CHECK ของ banned_phones) — กันเบอร์เก่าที่ผิดรูปแบบทำให้แบนไม่สำเร็จ
--       ไม่แตะการจองเดิม / bar_staff / ร้าน (ระงับร้านที่ /bars)
--       ถูกแบน = จองไม่ได้ (booking_ban_check เดิม) + ชุมชนอ่านได้อย่างเดียว (trigger ด้านล่าง)
--   - admin_unban_user (แทนของ …20261006000100): เหตุผลบังคับ 3–300 ตัวอักษร · ข้อความแจ้งเตือนใหม่ (ปลดทั้งแบนเองและแบนอัตโนมัติจากสลิปปลอม)
--   - community_block_banned: trigger BEFORE INSERT บนตารางเขียนของชุมชน (กระทู้ ความเห็น ถูกใจ บันทึก ปักหมุด รายงาน)
--       เฉพาะ INSERT — แอดมินซ่อน/ลบโพสต์ของบัญชีที่ถูกแบนได้ · เจ้าของลบโพสต์/เลิกถูกใจของตัวเองได้ · ฉบับร่างไม่บล็อก
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. แบนบัญชีเอง
-- ---------------------------------------------------------------------
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
    'จองโต๊ะไม่ได้ และชุมชนอ่านได้อย่างเดียว · เหตุผล: ' || v_reason || ' · ติดต่อ NightOut หากคิดว่าเป็นความผิดพลาด',
    '/profile');
  return jsonb_build_object('id', p_user, 'banned', true, 'banned_at', v_at, 'phones_banned', v_phones);
end $$;

-- ---------------------------------------------------------------------
-- 2. ปลดแบน (แทนของ …20261006000100 — เหตุผลบังคับ + ข้อความแจ้งเตือนใหม่)
-- ---------------------------------------------------------------------
create or replace function public.admin_unban_user(p_actor uuid, p_user uuid, p_reason text default null)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users; v_phones integer; v_flags integer; v_reason text;
begin
  perform public.admin_assert(p_actor);
  v_reason := nullif(btrim(p_reason), '');
  if v_reason is null or char_length(v_reason) not between 3 and 300 then
    raise exception 'BAN_REASON_REQUIRED' using errcode = '22023';
  end if;
  select * into u from public.users where id = p_user for update;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  update public.users set banned_at = null, ban_reason = null where id = p_user;
  delete from public.banned_phones where user_id = p_user;
  get diagnostics v_phones = row_count;
  update public.user_flags set cleared_at = now(), cleared_by = p_actor
   where user_id = p_user and cleared_at is null;
  get diagnostics v_flags = row_count;
  perform public.admin_audit(p_actor, 'user.unban', 'users', p_user,
    jsonb_build_object('banned_at', u.banned_at, 'ban_reason', u.ban_reason),
    jsonb_build_object('reason', v_reason, 'phones_unbanned', v_phones, 'flags_cleared', v_flags));
  if u.banned_at is not null then
    perform public.app_notify(p_user, 'ACCOUNT_UNBANNED', 'บัญชีของคุณใช้งานได้ตามปกติแล้ว', 'จองโต๊ะและโพสต์ในชุมชนได้อีกครั้ง', '/profile');
  end if;
  return jsonb_build_object('id', p_user, 'banned', false, 'phones_unbanned', v_phones, 'flags_cleared', v_flags);
end $$;

-- ---------------------------------------------------------------------
-- 3. ชุมชนอ่านอย่างเดียวเมื่อถูกแบน (INSERT เท่านั้น · tg_argv[0] = คอลัมน์ผู้ใช้ของตารางนั้น)
-- ---------------------------------------------------------------------
create or replace function public.community_block_banned() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.users u
             where u.id = (to_jsonb(new) ->> tg_argv[0])::uuid and u.banned_at is not null) then
    raise exception 'COMMUNITY_BANNED' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists community_threads_block_banned on public.community_threads;
create trigger community_threads_block_banned before insert on public.community_threads
  for each row execute function public.community_block_banned('author_id');
drop trigger if exists community_comments_block_banned on public.community_comments;
create trigger community_comments_block_banned before insert on public.community_comments
  for each row execute function public.community_block_banned('author_id');
drop trigger if exists community_thread_likes_block_banned on public.community_thread_likes;
create trigger community_thread_likes_block_banned before insert on public.community_thread_likes
  for each row execute function public.community_block_banned('user_id');
drop trigger if exists community_comment_likes_block_banned on public.community_comment_likes;
create trigger community_comment_likes_block_banned before insert on public.community_comment_likes
  for each row execute function public.community_block_banned('user_id');
drop trigger if exists community_saves_block_banned on public.community_saves;
create trigger community_saves_block_banned before insert on public.community_saves
  for each row execute function public.community_block_banned('user_id');
drop trigger if exists community_pins_block_banned on public.community_pins;
create trigger community_pins_block_banned before insert on public.community_pins
  for each row execute function public.community_block_banned('user_id');
drop trigger if exists community_reports_block_banned on public.community_reports;
create trigger community_reports_block_banned before insert on public.community_reports
  for each row execute function public.community_block_banned('reporter_id');

-- ---------------------------------------------------------------------
-- 4. สิทธิ์
-- ---------------------------------------------------------------------
revoke all on function public.admin_ban_user(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.admin_unban_user(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.community_block_banned() from public, anon, authenticated;
grant execute on function public.admin_ban_user(uuid, uuid, text, boolean) to service_role;
grant execute on function public.admin_unban_user(uuid, uuid, text) to service_role;
