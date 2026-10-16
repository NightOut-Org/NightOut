-- =====================================================================
-- NightOut · account — รูปโปรไฟล์ (นอก MVP — อนุมัติ 2026-10-16)
--   - bucket avatars (public · JPG/PNG/WebP ≤ 5MB) : <user_id>/<ไฟล์> · หน้าเว็บย่อเป็น 400×400 WebP ก่อนอัปโหลด
--   - users.avatar_path = path ใน bucket · users.avatar_url = URL ถาวร (backend คำนวณจาก path)
--   - app_set_avatar / app_remove_avatar: ผู้ใช้ตั้ง/ลบรูปของตัวเอง · คืน removed_paths ให้ backend ลบไฟล์เก่าจาก Storage
--   - admin_remove_user_avatar: แอดมินลบรูปไม่เหมาะสม (เหตุผล 3–300 ตัวอักษร · audit + แจ้งเจ้าของบัญชี)
--   - admin_users: เพิ่มคอลัมน์ avatar_url (ต่อท้าย)
-- =====================================================================
set search_path = public, extensions;

alter table public.users add column if not exists avatar_path text;

-- ---------------------------------------------------------------------
-- 1. Storage
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.is_admin());

-- ---------------------------------------------------------------------
-- 2. ผู้ใช้ตั้ง / ลบรูปของตัวเอง
-- ---------------------------------------------------------------------
create or replace function public.app_set_avatar(p_actor uuid, p_path text, p_url text)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users;
begin
  u := public.app_assert_user(p_actor);
  if p_path is null
     or p_path !~ ('^' || p_actor::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$')
     or not exists (select 1 from storage.objects o where o.bucket_id = 'avatars' and o.name = p_path) then
    raise exception 'AVATAR_INVALID' using errcode = '22023';
  end if;
  if p_url is null or p_url !~ '^https?://' then raise exception 'AVATAR_INVALID' using errcode = '22023'; end if;
  update public.users set avatar_path = p_path, avatar_url = p_url where id = p_actor;
  perform public.app_audit(p_actor, 'user.avatar_set', 'users', p_actor, jsonb_build_object('avatar_path', p_path));
  return jsonb_build_object(
    'avatar_url', p_url,
    'removed_paths', case when u.avatar_path is null or u.avatar_path = p_path then '[]'::jsonb else jsonb_build_array(u.avatar_path) end);
end $$;

create or replace function public.app_remove_avatar(p_actor uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare u public.users;
begin
  u := public.app_assert_user(p_actor);
  update public.users set avatar_path = null, avatar_url = null where id = p_actor;
  if u.avatar_path is not null then
    perform public.app_audit(p_actor, 'user.avatar_remove', 'users', p_actor, jsonb_build_object('avatar_path', u.avatar_path));
  end if;
  return jsonb_build_object(
    'avatar_url', null,
    'removed_paths', case when u.avatar_path is null then '[]'::jsonb else jsonb_build_array(u.avatar_path) end);
end $$;

-- ---------------------------------------------------------------------
-- 3. แอดมินลบรูปไม่เหมาะสม
-- ---------------------------------------------------------------------
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
    'ทีม NightOut ลบรูปโปรไฟล์ของคุณ · เหตุผล: ' || v_reason || ' · อัปโหลดรูปใหม่ได้ที่หน้าโปรไฟล์', '/profile');
  return jsonb_build_object(
    'id', p_user,
    'removed_paths', case when u.avatar_path is null then '[]'::jsonb else jsonb_build_array(u.avatar_path) end);
end $$;

-- ---------------------------------------------------------------------
-- 4. Backoffice /users เห็นรูป (เพิ่มคอลัมน์ต่อท้าย · นิยามเดิมจาก …20261006000100)
-- ---------------------------------------------------------------------
create or replace view public.admin_users with (security_invoker = true) as
select
  u.id, u.email, u.display_name, u.role, u.created_at, u.deleted_at,
  coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'slug', b.slug, 'name', b.name, 'role', s.role)
                             order by b.name)
            from public.bar_staff s join public.bars b on b.id = s.bar_id
            where s.user_id = u.id and s.revoked_at is null), '[]'::jsonb) as bars,
  u.phone_e164, u.banned_at, u.ban_reason,
  (select count(*) from public.user_flags f where f.user_id = u.id and f.kind = 'FAKE_SLIP' and f.cleared_at is null)::integer
    as fake_slip_count,
  coalesce((select jsonb_agg(p.phone_e164 order by p.phone_e164) from public.banned_phones p where p.user_id = u.id), '[]'::jsonb)
    as banned_phones,
  u.avatar_url
from public.users u
where public.is_admin();

-- ---------------------------------------------------------------------
-- 5. สิทธิ์
-- ---------------------------------------------------------------------
revoke all on function public.app_set_avatar(uuid, text, text) from public, anon, authenticated;
revoke all on function public.app_remove_avatar(uuid) from public, anon, authenticated;
revoke all on function public.admin_remove_user_avatar(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.app_set_avatar(uuid, text, text) to service_role;
grant execute on function public.app_remove_avatar(uuid) to service_role;
grant execute on function public.admin_remove_user_avatar(uuid, uuid, text) to service_role;
