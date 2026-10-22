-- NightOut · "พื้นที่ที่ชอบ" เลือกได้ทุกระดับ (ย่าน · จังหวัด · อำเภอ/เขต · ตำบล/แขวง) — ADR 0011
-- เดิมเก็บได้แต่ย่าน (preferred_district_ids) → ชื่ออย่าง "รังสิต" (ตำบล) ในช่องความชอบหาไม่เจอ
-- preferred_area_codes = รหัส pcode ของ OCHA (TH10 จังหวัด · TH1039 อำเภอ/เขต · TH103902 ตำบล/แขวง) · ย่านยังอยู่ใน preferred_district_ids

alter table public.user_preferences
  add column preferred_area_codes text[] not null default '{}';

-- ---------------------------------------------------------------------
-- app_update_profile — รับ area_codes[] (ส่งมาทั้งชุด · ตรวจว่ามีรหัสนั้นจริง · ไม่ซ้ำ · ≤ 20)
-- ตัวเดิมอยู่ …20261002001700 · ส่วนอื่นเหมือนเดิมทุกอย่าง
-- ---------------------------------------------------------------------
create or replace function public.app_update_profile(p_actor uuid, p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_codes text[];
begin
  perform public.app_assert_user(p_actor);
  if p ? 'display_name' then
    if char_length(trim(p->>'display_name')) not between 1 and 60 then raise exception 'INVALID_DISPLAY_NAME' using errcode = '22023'; end if;
    update public.users set display_name = trim(p->>'display_name') where id = p_actor;
  end if;
  if coalesce((p->>'onboarded')::boolean, false) then
    update public.users set onboarded_at = coalesce(onboarded_at, now()) where id = p_actor;
  end if;
  if p ? 'area_codes' then
    if jsonb_typeof(p->'area_codes') <> 'array' then raise exception 'INVALID_AREA_CODES' using errcode = '22023'; end if;
    select coalesce(array_agg(distinct c), '{}') into v_codes from jsonb_array_elements_text(p->'area_codes') c;
    if cardinality(v_codes) > 20 or cardinality(v_codes) <> jsonb_array_length(p->'area_codes') then
      raise exception 'INVALID_AREA_CODES' using errcode = '22023';
    end if;
    if exists (
      select 1 from unnest(v_codes) c
       where not (
         (c ~ '^TH[0-9]{2}$'  and exists (select 1 from public.provinces x where x.code = c)) or
         (c ~ '^TH[0-9]{4}$'  and exists (select 1 from public.amphoes   x where x.code = c)) or
         (c ~ '^TH[0-9]{6}$'  and exists (select 1 from public.tambons   x where x.code = c))
       )
    ) then
      raise exception 'INVALID_AREA_CODES' using errcode = '22023';
    end if;
  end if;
  insert into public.user_preferences (user_id) values (p_actor) on conflict do nothing;
  update public.user_preferences set
    preferred_style_ids    = case when p ? 'style_ids' then coalesce(array(select jsonb_array_elements_text(p->'style_ids')::uuid), '{}') else preferred_style_ids end,
    preferred_district_ids = case when p ? 'district_ids' then coalesce(array(select jsonb_array_elements_text(p->'district_ids')::uuid), '{}') else preferred_district_ids end,
    preferred_area_codes   = case when p ? 'area_codes' then v_codes else preferred_area_codes end,
    budget_per_person      = case when p ? 'budget_per_person' then nullif(p->>'budget_per_person', '')::numeric else budget_per_person end,
    usual_pax              = case when p ? 'usual_pax' then nullif(p->>'usual_pax', '')::smallint else usual_pax end,
    theme                  = case when p ? 'theme' then (p->>'theme')::public.theme_mode else theme end
  where user_id = p_actor;
  return jsonb_build_object('id', p_actor);
end $$;

-- ---------------------------------------------------------------------
-- search_tambons — ขอชื่อหลายรหัสพร้อมกัน (โปรไฟล์แสดงตำบลที่ชอบ) · เดิม p_code เดียว → p_codes[]
-- ---------------------------------------------------------------------
drop function if exists public.search_tambons(text, text, integer);
create or replace function public.search_tambons(p_q text default null, p_codes text[] default null, p_limit integer default 20)
returns table (code text, name_th text, amphoe_code text, amphoe_th text, province_code text, province_th text)
language sql stable set search_path = '' as $$
  select t.code, t.name_th, a.code, a.name_th, p.code, p.name_th
    from public.tambons t
    join public.amphoes a on a.code = t.amphoe_code
    join public.provinces p on p.code = a.province_code
   where (p_codes is not null and t.code = any (p_codes))
      or (p_codes is null and length(btrim(coalesce(p_q, ''))) >= 2
          and t.name_th ilike '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%')
   order by (t.name_th = btrim(coalesce(p_q, ''))) desc,
            (t.name_th ilike replace(replace(replace(btrim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%') desc,
            t.name_th, p.name_th
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;
revoke all on function public.search_tambons(text, text[], integer) from public, anon, authenticated;
grant execute on function public.search_tambons(text, text[], integer) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- run_retention_jobs — ล้าง preferred_area_codes ของบัญชีที่ลบแล้วด้วย (ตัวเดิม …20261002001400)
-- ---------------------------------------------------------------------
create or replace function public.run_retention_jobs() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_account_days integer := coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'account_retention_days'), 30);
  v_phone_days   integer := coalesce((select (value #>> '{}')::integer from public.platform_settings where key = 'contact_phone_retention_days'), 90);
  v_users  integer;
  v_phones integer;
  v_run    bigint;
begin
  insert into public.job_runs (job) values ('retention') returning id into v_run;

  with targets as (
    select id from public.users
    where deleted_at is not null and anonymized_at is null
      and deleted_at < now() - make_interval(days => v_account_days)
  ), wiped as (
    update public.users u set
      email             = 'deleted+' || u.id || '@nightout.invalid',
      display_name      = 'ผู้ใช้ที่ลบบัญชี',
      phone_e164        = null,
      phone_verified_at = null,
      avatar_url        = null,
      birthdate         = date '1900-01-01',
      anonymized_at     = now()
    from targets t where u.id = t.id
    returning u.id
  ), channels as (
    delete from public.notification_channels c using wiped w where c.user_id = w.id
  ), prefs as (
    update public.user_preferences p set preferred_style_ids = '{}', preferred_district_ids = '{}', preferred_area_codes = '{}', budget_per_person = null
    from wiped w where p.user_id = w.id
  ), phones as (
    update public.bookings b set contact_phone = null
    from wiped w where b.user_id = w.id and b.contact_phone is not null
  )
  select count(*) into v_users from wiped;

  update public.bookings set contact_phone = null
  where contact_phone is not null
    and booking_datetime < now() - make_interval(days => v_phone_days);
  get diagnostics v_phones = row_count;

  update public.job_runs set finished_at = now(), processed = v_users + v_phones where id = v_run;
  return jsonb_build_object('users_anonymized', v_users, 'contact_phones_cleared', v_phones);
end $$;
