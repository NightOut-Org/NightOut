-- =====================================================================
-- account · สมัครด้วย Google / Facebook (Phase 1 MVP — REQUIREMENTS ข้อ 3)
-- 1) ล็อกอิน OAuth ครั้งแรก Supabase สร้าง auth.users → trigger ไม่สร้าง public.users (ยังไม่มีวันเกิด/ยังไม่ยอมรับเงื่อนไข)
-- 2) NestJS ดึงวันเกิดจาก Google People API / Facebook Graph เอง (ผู้ใช้แก้ไม่ได้) → อายุไม่ผ่าน = ลบ auth.users (ไม่สร้างบัญชี)
-- 3) ผู้ใช้กดยอมรับ ToS + PDPA → app_complete_oauth_signup สร้างบัญชี (age_verification_method = GOOGLE / FACEBOOK)
-- =====================================================================

-- สร้างแถวผู้ใช้ + ความชอบ + consent + ช่องแจ้งเตือนในแอป — ใช้ร่วมกันทั้งสมัครด้วยอีเมลและ OAuth
-- (เรียกจาก trigger / ฟังก์ชันที่ตรวจแล้วเท่านั้น · ไม่ grant ให้ใคร)
create or replace function public.app_create_customer_profile(
  p_id uuid,
  p_email text,
  p_display_name text,
  p_birthdate date,
  p_method public.age_verification_method,
  p_terms_version text,
  p_privacy_version text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, email, display_name, birthdate, role, age_verified, age_verified_at, age_verification_method)
  values (p_id, p_email,
          coalesce(nullif(btrim(p_display_name), ''), split_part(p_email, '@', 1)),
          p_birthdate, 'CUSTOMER', true, now(), p_method);

  insert into public.user_preferences (user_id) values (p_id);

  insert into public.user_consents (user_id, consent_type, version, granted) values
    (p_id, 'TERMS',            coalesce(p_terms_version, 'v1'),   true),
    (p_id, 'PRIVACY',          coalesce(p_privacy_version, 'v1'), true),
    (p_id, 'AGE_CONFIRMATION', 'v1',                              true);

  insert into public.notification_channels (user_id, channel, opted_in_at) values (p_id, 'IN_APP', now());
end $$;

revoke all on function public.app_create_customer_profile(uuid, text, text, date, public.age_verification_method, text, text)
  from public, anon, authenticated;

-- สมัครด้วยอีเมล = เหมือนเดิม (วันเกิดจากฟอร์ม · SELF_DECLARED)
-- ล็อกอินด้วย Google / Facebook ครั้งแรก = ยังไม่สร้าง public.users (รอ NestJS ยืนยันอายุ + ผู้ใช้ยอมรับเงื่อนไข)
-- role = CUSTOMER เสมอ (ห้ามอ่าน role จาก raw_user_meta_data)
create or replace function public.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if coalesce(new.raw_app_meta_data->>'provider', 'email') <> 'email' then
    return new;
  end if;

  if (m->>'birthdate') is null then
    raise exception 'AGE_UNDER_20' using errcode = 'check_violation';
  end if;

  perform public.app_create_customer_profile(
    new.id, new.email, m->>'display_name', (m->>'birthdate')::date, 'SELF_DECLARED',
    m->>'terms_version', m->>'privacy_version');
  return new;
end $$;

-- ผู้ใช้กดยอมรับ ToS + PDPA หลังล็อกอิน Google / Facebook ครั้งแรก
-- p_birthdate มาจาก NestJS (ดึงจากผู้ให้บริการ) เท่านั้น — เรียกได้เฉพาะ service_role
-- เรียกซ้ำหลังสร้างแล้ว = คืนบัญชีเดิม (กดซ้ำ/เน็ตหลุด)
create or replace function public.app_complete_oauth_signup(
  p_actor uuid,
  p_birthdate date,
  p_method public.age_verification_method,
  p_display_name text,
  p_terms_version text,
  p_privacy_version text
) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_email text;
begin
  if p_method not in ('GOOGLE', 'FACEBOOK') then
    raise exception 'OAUTH_PROVIDER_UNSUPPORTED' using errcode = '22023';
  end if;

  if exists (select 1 from public.users where id = p_actor) then
    return jsonb_build_object('id', p_actor, 'created', false);
  end if;

  select email into v_email from auth.users where id = p_actor;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_email is null or v_email = '' then
    raise exception 'OAUTH_EMAIL_MISSING' using errcode = '22023';
  end if;
  if p_birthdate > (current_date - interval '20 years')::date then
    raise exception 'AGE_UNDER_20' using errcode = 'check_violation';
  end if;

  perform public.app_create_customer_profile(
    p_actor, v_email, left(p_display_name, 60), p_birthdate, p_method, p_terms_version, p_privacy_version);

  perform public.app_audit(p_actor, 'account.oauth_signup', 'users', p_actor,
    jsonb_build_object('age_verification_method', p_method, 'terms_version', p_terms_version, 'privacy_version', p_privacy_version));

  return jsonb_build_object('id', p_actor, 'created', true);
end $$;

revoke all on function public.app_complete_oauth_signup(uuid, date, public.age_verification_method, text, text, text)
  from public, anon, authenticated;
grant execute on function public.app_complete_oauth_signup(uuid, date, public.age_verification_method, text, text, text)
  to service_role;
