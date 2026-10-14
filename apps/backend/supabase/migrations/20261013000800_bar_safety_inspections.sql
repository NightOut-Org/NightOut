-- =====================================================================
-- bar · ลงพื้นที่ตรวจ Safety (Inspector) — แอดมินทุกคนตรวจได้ (เจ้าของตัดสิน 2026-10-13 · ไม่มี role แยก)
--   - แยก "วิธีตรวจ" ของข้อที่ ADMIN_VERIFIED: bar_safety_features.verify_method (enum safety_verify_method)
--       EVIDENCE = ปุ่ม "ยืนยันแล้ว" เดิม (ตรวจจากหลักฐานที่ร้านแนบ ไม่ได้ลงพื้นที่ — admin_verify_safety ยังใช้ต่อ)
--       ON_SITE  = ลงพื้นที่ตรวจตาม checklist (admin_inspect_safety)
--       trigger bar_safety_features_verify_method: SELF_DECLARED → null · ADMIN_VERIFIED ที่ไม่ระบุ → EVIDENCE
--       (แถวเดิม / seed ไม่มีทางอ้างว่าลงพื้นที่) · check: ADMIN_VERIFIED ⇔ มี verify_method
--   - ตารางใหม่: safety_inspections (1 แถว = ลงพื้นที่ 1 ครั้ง · ชื่อผู้ตรวจ snapshot + วันเวลา · แก้/ลบไม่ได้ ตรวจใหม่ = แถวใหม่)
--                safety_inspection_items (ผลต่อข้อ PASS ผ่าน → มี · FAIL ไม่พบ → ไม่มี · NA ไม่ได้ตรวจ → ไม่เปลี่ยน + หมายเหตุ + รูป ≤ 3)
--   - ฟังก์ชัน: admin_inspect_safety (เขียน · service_role) · bar_safety_inspection_latest (อ่าน · เจ้าของ/ผู้จัดการ · ไม่มีชื่อผู้ตรวจ)
--               safety_inspection_photo_ok (รูปต้องอยู่ bar-verifications/<bar_id>/inspections/ และอัปโหลดแล้วจริง)
--               admin_verify_safety (แทนที่ — บันทึก verify_method = EVIDENCE · เฉพาะข้อ SELF_DECLARED + YES ที่แนบหลักฐาน
--                 · ไม่ทับผลลงพื้นที่ · แอดมินในทีมร้านยืนยันร้านตัวเองไม่ได้)
--   - view: admin_safety_queue (+ bar_id · last_result · last_inspected_at · verified_by_name · verify_method · awaiting_visit ต่อท้าย)
--           admin_bar_safety (checklist ทุกข้อของร้านสำหรับ Drawer) · admin_safety_inspections (ประวัติการตรวจ)
--           bar_detail / my_bar_detail (นิยามเดิม …20261013000600) — safety[] เพิ่ม key verify_method (คอลัมน์ไม่เปลี่ยน)
--   - Storage bar-verifications: แอดมินอัปโหลดได้เฉพาะ <bar_id>/inspections/ · ทีมร้านเขียนโฟลเดอร์นั้นไม่ได้อีก
--   ไฟล์นี้ไม่ลบอะไร (admin_verify_safety ยังอยู่) — db:push ก่อนหรือพร้อม merge demo → main ได้
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. วิธีตรวจของข้อที่ ADMIN_VERIFIED
-- ---------------------------------------------------------------------
create type public.safety_verify_method as enum ('EVIDENCE', 'ON_SITE');

alter table public.bar_safety_features add column verify_method public.safety_verify_method;

-- แถวเดิมที่ทีมยืนยันแล้ว = มาจากปุ่ม "ยืนยันแล้ว" (ตรวจหลักฐาน) — ไม่แตะ updated_at (ลำดับคิวเดิม)
alter table public.bar_safety_features disable trigger bar_safety_features_updated_at;
update public.bar_safety_features set verify_method = 'EVIDENCE' where source = 'ADMIN_VERIFIED';
alter table public.bar_safety_features enable trigger bar_safety_features_updated_at;

alter table public.bar_safety_features add constraint bar_safety_features_verify_method_check
  check ((source = 'ADMIN_VERIFIED') = (verify_method is not null));

-- ร้านแก้ค่าเอง (SELF_DECLARED) → ล้างวิธีตรวจ · ADMIN_VERIFIED ที่ไม่ระบุวิธี (seed / ฟังก์ชันเก่า) → EVIDENCE
create or replace function public.bar_safety_features_verify_method() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.source = 'ADMIN_VERIFIED' then
    new.verify_method := coalesce(new.verify_method, 'EVIDENCE'::public.safety_verify_method);
  else
    new.verify_method := null;
  end if;
  return new;
end $$;
create trigger bar_safety_features_verify_method before insert or update on public.bar_safety_features
  for each row execute function public.bar_safety_features_verify_method();

-- ---------------------------------------------------------------------
-- 2. ตารางผลลงพื้นที่ตรวจ
-- ---------------------------------------------------------------------
create table public.safety_inspections (                 -- 1 แถว = แอดมินลงพื้นที่ตรวจร้าน 1 ครั้ง (บันทึกแล้วไม่แก้ — ตรวจใหม่ = แถวใหม่)
  id                  uuid primary key default gen_random_uuid(),
  bar_id              uuid not null references public.bars(id) on delete cascade,
  inspector_id        uuid references public.users(id) on delete set null,
  inspector_name      text not null check (char_length(inspector_name) between 1 and 60),  -- snapshot display_name ตอนตรวจ
  inspected_at        timestamptz not null default now(),
  note                text check (char_length(note) <= 1000),
  pass_count          smallint not null default 0 check (pass_count >= 0),
  fail_count          smallint not null default 0 check (fail_count >= 0),
  na_count            smallint not null default 0 check (na_count >= 0),
  safety_score_before smallint check (safety_score_before between 0 and 100),
  safety_score_after  smallint check (safety_score_after between 0 and 100),
  created_at          timestamptz not null default now()
);
create index safety_inspections_bar_latest on public.safety_inspections (bar_id, inspected_at desc);   -- FK + ครั้งล่าสุดของร้าน
create index safety_inspections_inspector_id_fk on public.safety_inspections (inspector_id);

create table public.safety_inspection_items (
  id            uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.safety_inspections(id) on delete cascade,
  feature_key   text not null references public.safety_features(key) on update cascade,
  result        text not null check (result in ('PASS', 'FAIL', 'NA')),
  note          text check (char_length(note) <= 500),
  photo_paths   text[] not null default '{}' check (cardinality(photo_paths) <= 3),  -- bar-verifications/<bar_id>/inspections/…
  value_before  public.safety_value,      -- null = ร้านยังไม่เคยมีแถวของข้อนี้
  value_after   public.safety_value,
  unique (inspection_id, feature_key)     -- ครอบ FK inspection_id
);
create index safety_inspection_items_feature_key_fk on public.safety_inspection_items (feature_key);

-- RLS: แอดมินอ่านตรงได้ (view admin_*) · ร้านอ่านผ่าน bar_safety_inspection_latest (security definer) · เขียนผ่าน service role เท่านั้น
do $$ declare t text; begin
  foreach t in array array['safety_inspections', 'safety_inspection_items'] loop
    execute format('alter table public.%I enable row level security', t);
    -- …001600 สร้าง admin_read ให้ตารางที่มีตอนนั้นเท่านั้น — ตารางใหม่ต้องเพิ่มเอง
    execute format('create policy admin_read on public.%I for select to authenticated using (public.is_admin())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. รูปจากการลงพื้นที่ต้องอยู่ในโฟลเดอร์ inspections ของร้านนั้น และอัปโหลดขึ้น Storage แล้วจริง
-- ---------------------------------------------------------------------
create or replace function public.safety_inspection_photo_ok(p_bar uuid, p_path text) returns boolean
language sql stable set search_path = '' as $$
  select p_path is not null
     and p_path ~ ('^' || p_bar::text || '/inspections/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$')
     and exists (select 1 from storage.objects o where o.bucket_id = 'bar-verifications' and o.name = p_path)
$$;

-- ---------------------------------------------------------------------
-- 4. ปุ่ม "ยืนยันแล้ว" (เดิม …20261002001600) — ตรวจจากหลักฐานที่ร้านแนบ ไม่ได้ลงพื้นที่ → verify_method EVIDENCE
--    ยืนยันได้เฉพาะข้อที่ร้านแจ้ง "มี" เอง (SELF_DECLARED + YES) และแนบหลักฐานแล้ว
--    → ไม่ทับผลลงพื้นที่ (ON_SITE) / ข้อที่ตรวจแล้ว (คิวค้าง · กดซ้ำ · แอดมินอีกคนเพิ่งตรวจ) = SAFETY_ALREADY_VERIFIED
--    แอดมินที่อยู่ในทีมของร้าน (รวมคำเชิญที่ยังไม่ตอบ) ยืนยันร้านตัวเองไม่ได้ — กันรับรองตัวเอง (เหมือน admin_inspect_safety)
-- ---------------------------------------------------------------------
create or replace function public.admin_verify_safety(p_actor uuid, p_feature uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare f record;
begin
  perform public.admin_assert(p_actor);
  select x.bar_id, x.feature_key, x.value, x.source, x.evidence_path into f
    from public.bar_safety_features x where x.id = p_feature for update;
  if not found then raise exception 'SAFETY_FEATURE_NOT_FOUND' using errcode = 'P0002'; end if;
  if exists (select 1 from public.bar_staff s where s.bar_id = f.bar_id and s.user_id = p_actor and s.revoked_at is null) then
    raise exception 'INSPECTOR_IS_BAR_MEMBER' using errcode = '42501';
  end if;
  if f.source <> 'SELF_DECLARED' or f.value <> 'YES' then
    raise exception 'SAFETY_ALREADY_VERIFIED' using errcode = 'P0001';
  end if;
  if f.evidence_path is null then
    raise exception 'SAFETY_EVIDENCE_REQUIRED' using errcode = '22023';
  end if;

  update public.bar_safety_features
     set source = 'ADMIN_VERIFIED', verify_method = 'EVIDENCE', verified_by = p_actor, verified_at = now()
   where id = p_feature;
  update public.safety_reports set status = 'CONFIRMED', resolved_by = p_actor, resolved_at = now()
   where bar_id = f.bar_id and feature_key = f.feature_key and status = 'OPEN';
  perform public.recompute_safety_score(f.bar_id);
  perform public.admin_audit(p_actor, 'safety.verify', 'bar_safety_features', p_feature, null,
    jsonb_build_object('bar_id', f.bar_id, 'feature_key', f.feature_key, 'value', f.value, 'verify_method', 'EVIDENCE'));
  return jsonb_build_object('id', p_feature, 'source', 'ADMIN_VERIFIED', 'verify_method', 'EVIDENCE');
end $$;

-- ---------------------------------------------------------------------
-- 5. บันทึกผลลงพื้นที่ตรวจ 1 ครั้ง (ธุรกรรมเดียว)
--   p_items = [{ "key": text, "result": "PASS"|"FAIL"|"NA", "note"?: text, "photo_paths"?: text[] }]
--   PASS → YES · FAIL → NO (ADMIN_VERIFIED · ON_SITE · verified_by/at = ผู้ตรวจ/เวลาลงพื้นที่) · NA → ไม่เปลี่ยน (บันทึกในประวัติ)
--   ปิดรายงานจากลูกค้าของข้อที่ตรวจ · คิด Safety Score ใหม่ · audit · แจ้งเจ้าของ/ผู้จัดการ
-- ---------------------------------------------------------------------
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
    v_bar_name || ' · ผ่าน ' || n_pass || ' · ไม่พบ ' || n_fail || ' · ไม่ได้ตรวจ ' || n_na
      || case when n_fail > 0 then ' — ข้อที่ไม่พบเปลี่ยนเป็น "ไม่มี" แล้ว' else '' end,
    '/merchant/safety', null, p_bar, 'SAFETY_INSPECTED:' || v_id || ':' || s.user_id)
  from public.bar_staff s
  where s.bar_id = p_bar and s.role in ('OWNER', 'MANAGER') and s.accepted_at is not null and s.revoked_at is null;

  return jsonb_build_object('id', v_id, 'bar_id', p_bar, 'inspected_at', v_at, 'pass_count', n_pass,
                            'fail_count', n_fail, 'na_count', n_na, 'safety_score', v_after);
end $$;

-- ---------------------------------------------------------------------
-- 6. ผลลงพื้นที่ครั้งล่าสุดของร้าน — เจ้าของ/ผู้จัดการเท่านั้น (บทบาทอื่น/คนนอก = null) · ไม่มีชื่อผู้ตรวจ
-- ---------------------------------------------------------------------
create or replace function public.bar_safety_inspection_latest(p_bar uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', s.id, 'inspected_at', s.inspected_at, 'note', s.note,
           'pass_count', s.pass_count, 'fail_count', s.fail_count, 'na_count', s.na_count, 'safety_score', s.safety_score_after,
           'items', coalesce((select jsonb_agg(jsonb_build_object('feature_key', i.feature_key, 'name_th', sf.name_th, 'result', i.result,
                                     'note', i.note, 'photo_paths', to_jsonb(i.photo_paths)) order by sf.sort_order, sf.key)
                              from public.safety_inspection_items i join public.safety_features sf on sf.key = i.feature_key
                              where i.inspection_id = s.id), '[]'::jsonb))
  from public.safety_inspections s
  where s.bar_id = p_bar and public.is_bar_manager(p_bar)
  order by s.inspected_at desc, s.created_at desc
  limit 1
$$;

-- ---------------------------------------------------------------------
-- 7. view ของ Backoffice
-- ---------------------------------------------------------------------
-- admin_safety_queue (นิยามเดิม …20261002001600) + คอลัมน์ต่อท้าย: ร้าน · ผลลงพื้นที่ล่าสุด (ไม่นับ "ไม่ได้ตรวจ") · ผู้ยืนยัน · วิธีตรวจ · รอลงพื้นที่
create or replace view public.admin_safety_queue with (security_invoker = true) as
select
  f.id, f.feature_key, sf.name_th, f.value, f.source, f.evidence_path, f.note, f.verified_at, f.updated_at,
  jsonb_build_object('id', b.id, 'name', b.name) as bar,
  (select count(*) from public.safety_reports sr
    where sr.bar_id = f.bar_id and sr.feature_key = f.feature_key and not sr.is_accurate and sr.status = 'OPEN')::integer as open_inaccurate_reports,
  f.bar_id,
  li.result       as last_result,
  li.inspected_at as last_inspected_at,
  vu.display_name as verified_by_name,
  f.verify_method,
  -- รอลงพื้นที่ = ร้านแจ้ง "มี" และยังไม่มีผลลงพื้นที่ (ร้านแจ้งเอง / ตรวจหลักฐานแล้ว) — Backoffice กรองที่ server
  (f.value = 'YES' and f.verify_method is distinct from 'ON_SITE') as awaiting_visit
from public.bar_safety_features f
join public.bars            b  on b.id  = f.bar_id
join public.safety_features sf on sf.key = f.feature_key
left join public.users      vu on vu.id = f.verified_by
left join lateral (
  select i.result, s.inspected_at
  from public.safety_inspection_items i
  join public.safety_inspections s on s.id = i.inspection_id
  where s.bar_id = f.bar_id and i.feature_key = f.feature_key and i.result <> 'NA'
  order by s.inspected_at desc, s.created_at desc
  limit 1) li on true
where public.is_admin();

-- checklist ทุกข้อของร้าน (ร้านยังไม่แจ้ง = UNKNOWN · source null) — Drawer ลงพื้นที่ตรวจ
create view public.admin_bar_safety with (security_invoker = true) as
select
  b.id as bar_id, sf.key as feature_key, sf.name_th, sf.icon, sf.weight, sf.sort_order,
  coalesce(f.value, 'UNKNOWN'::public.safety_value) as value,
  f.source, f.verify_method, f.evidence_path, f.note, f.verified_at, vu.display_name as verified_by_name, f.updated_at,
  (select count(*) from public.safety_reports sr
    where sr.bar_id = b.id and sr.feature_key = sf.key and not sr.is_accurate and sr.status = 'OPEN')::integer as open_inaccurate_reports,
  li.result       as last_result,
  li.inspected_at as last_inspected_at
from public.bars b
cross join public.safety_features sf
left join public.bar_safety_features f on f.bar_id = b.id and f.feature_key = sf.key
left join public.users vu on vu.id = f.verified_by
left join lateral (
  select i.result, s.inspected_at
  from public.safety_inspection_items i
  join public.safety_inspections s on s.id = i.inspection_id
  where s.bar_id = b.id and i.feature_key = sf.key and i.result <> 'NA'
  order by s.inspected_at desc, s.created_at desc
  limit 1) li on true
where public.is_admin();

-- ประวัติการลงพื้นที่ตรวจ (ทุกร้าน · กรองด้วย bar_id)
create view public.admin_safety_inspections with (security_invoker = true) as
select
  s.id, s.bar_id, jsonb_build_object('id', b.id, 'name', b.name) as bar,
  s.inspector_id, s.inspector_name, s.inspected_at, s.note,
  s.pass_count, s.fail_count, s.na_count, s.safety_score_before, s.safety_score_after,
  coalesce((select jsonb_agg(jsonb_build_object(
              'feature_key', i.feature_key, 'name_th', sf.name_th, 'result', i.result, 'note', i.note,
              'photo_paths', to_jsonb(i.photo_paths), 'value_before', i.value_before, 'value_after', i.value_after)
            order by sf.sort_order, sf.key)
            from public.safety_inspection_items i join public.safety_features sf on sf.key = i.feature_key
            where i.inspection_id = s.id), '[]'::jsonb) as items,
  s.created_at
from public.safety_inspections s
join public.bars b on b.id = s.bar_id
where public.is_admin();

revoke all on public.admin_safety_queue, public.admin_bar_safety, public.admin_safety_inspections from anon;
grant select on public.admin_safety_queue, public.admin_bar_safety, public.admin_safety_inspections to authenticated;

-- ---------------------------------------------------------------------
-- 8. view หน้าบ้าน — safety[] เพิ่ม verify_method (ตรวจหลักฐานแล้ว / ทีมงานลงพื้นที่ตรวจ) · คอลัมน์ไม่เปลี่ยน สิทธิ์เดิมคงอยู่
-- ---------------------------------------------------------------------
-- bar_detail (นิยามเดิม …20261013000600)
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
              'value', coalesce(bsf.value, 'UNKNOWN'), 'source', bsf.source, 'verified_at', bsf.verified_at,
              'verify_method', bsf.verify_method)
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

-- my_bar_detail (นิยามเดิม …20261013000600)
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
              'source', bsf.source, 'verified_at', bsf.verified_at,
              'verify_method', bsf.verify_method) order by sf.sort_order, sf.key)
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
-- 9. Storage bar-verifications — แอดมินอัปโหลดรูปลงพื้นที่ได้เฉพาะ <bar_id>/inspections/ · ทีมร้านเขียนโฟลเดอร์นั้นไม่ได้
--    (หลักฐานของร้าน <bar_id>/safety-<key>-<ts>.<ext> ไม่มีโฟลเดอร์ชั้น 2 → ไม่กระทบ · สิทธิ์อ่านเดิม: ทีมร้าน + แอดมิน)
-- ---------------------------------------------------------------------
drop policy if exists "bar-verifications: admin write inspections" on storage.objects;
create policy "bar-verifications: admin write inspections" on storage.objects for insert to authenticated
  with check (bucket_id = 'bar-verifications' and public.is_admin() and (storage.foldername(name))[2] = 'inspections');
drop policy if exists "bar-verifications: team write" on storage.objects;
create policy "bar-verifications: team write" on storage.objects for insert to authenticated
  with check (bucket_id = 'bar-verifications' and public.is_bar_member_path((storage.foldername(name))[1])
              and coalesce((storage.foldername(name))[2], '') <> 'inspections');

-- ---------------------------------------------------------------------
-- 10. สิทธิ์ฟังก์ชัน
-- ---------------------------------------------------------------------
revoke all on function public.admin_inspect_safety(uuid, uuid, jsonb, text, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_inspect_safety(uuid, uuid, jsonb, text, timestamptz) to service_role;
revoke all on function public.admin_verify_safety(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_verify_safety(uuid, uuid) to service_role;
revoke all on function public.safety_inspection_photo_ok(uuid, text) from public, anon, authenticated;
grant execute on function public.safety_inspection_photo_ok(uuid, text) to service_role;
revoke all on function public.bar_safety_features_verify_method() from public, anon, authenticated;
revoke all on function public.bar_safety_inspection_latest(uuid) from public, anon;
grant execute on function public.bar_safety_inspection_latest(uuid) to authenticated, service_role;
