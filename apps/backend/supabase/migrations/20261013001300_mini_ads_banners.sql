-- =====================================================================
-- NightOut · mini-ads — Native Mini-Ads: แบนเนอร์เล็กที่ทีม NightOut ลงให้ผู้ลงโฆษณา (Backoffice /mini-ads)
--   - mini_ads: โฆษณา 1 ชิ้น = ภาพ 16:9 + ผู้ลงโฆษณา + หัวข้อ + คำอธิบาย + ปุ่ม + ลิงก์ · ตำแหน่ง HOME (หน้าแรก) / SEARCH (หน้าค้นหา)
--       กำลังแสดง = active และ starts_at <= now() < ends_at (ช่วงยาวสุด 366 วัน)
--       ภาพต้องอยู่ใน bucket site-media/ads/ (URL public ของ Supabase) หรือ /images/… ของเว็บ — ห้ามโฮสต์ภาพภายนอก
--         (ภาพภายนอกถูกสลับหลังติ๊กยืนยันได้ + ส่ง IP ผู้ชมให้คนนอก) · ลิงก์ = https://… หรือ /path ในเว็บ (ห้าม // และ \)
--   - ห้ามแบรนด์ / สินค้าเครื่องดื่มแอลกอฮอล์ (รวมสินค้าที่ใช้ชื่อ/โลโก้ร่วม) และถ้อยคำชวนดื่ม (พ.ร.บ.ควบคุมเครื่องดื่มแอลกอฮอล์ ม.32)
--       แอดมินต้องติ๊กยืนยันตอนสร้าง และทุกครั้งที่แก้เนื้อหา (ผู้ลงโฆษณา/หัวข้อ/คำอธิบาย/ปุ่ม/ภาพ/ลิงก์)
--       เก็บ no_alcohol_confirmed_at / _by · ทุกการเขียนบันทึก audit (mini_ad.create | update | delete)
--   - mini_ad_daily_stats: นับเห็น/คลิกรวม ต่อโฆษณา ต่อวัน (เวลาไทย) ต่อตำแหน่ง — ไม่เก็บ user id / IP / ข้อมูลส่วนบุคคล
--   - ไม่มีผลต่ออันดับ / คะแนน / ผลค้นหา / ป้ายร้าน — ไม่มีฟังก์ชันหรือ view ของ catalog/ranking อ้างตารางนี้
--   - แยกจากโฆษณาร้านแบบจ่ายเงิน (promoted_listings · ป้าย "แนะนำ · โฆษณา") — ไม่ใช้ enum/ตารางร่วมกัน
--   - ใครจัดการ: แอดมินทุกบทบาท (ADMIN / SUPER_ADMIN + MFA ตรวจที่ NestJS) — admin_save_mini_ad / admin_delete_mini_ad
--       ไฟล์ภาพที่ไม่มีโฆษณาไหนใช้แล้ว → คืน removed_paths ให้ NestJS ลบออกจาก site-media
--   - หน้าเว็บอ่านผ่าน rpc mini_ads_live(placement) (security definer · เฉพาะที่กำลังแสดง · ไม่มี note/ผู้ยืนยัน)
--       นับผ่าน mini_ad_track (service_role · ไม่มี actor แบบ community_add_view)
--   - Backoffice อ่าน view admin_mini_ads (is_admin() = แอดมิน + aal2)
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. ตาราง
-- ---------------------------------------------------------------------
create table public.mini_ads (
  id                       uuid primary key default gen_random_uuid(),
  advertiser_name          text not null,
  title                    text not null,
  description              text not null default '',
  cta_label                text not null default 'ดูเพิ่มเติม',
  image_url                text not null,
  link_url                 text not null,
  placements               text[] not null,
  starts_at                timestamptz not null,
  ends_at                  timestamptz not null,
  active                   boolean not null default true,
  note                     text,                                   -- บันทึกภายใน (แอดมินเท่านั้น)
  no_alcohol_confirmed_at  timestamptz not null,                   -- ติ๊กยืนยัน "ไม่ใช่แบรนด์แอลกอฮอล์" ล่าสุด
  no_alcohol_confirmed_by  uuid references public.users(id) on delete set null,
  created_by               uuid references public.users(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint mini_ads_placements_ok check (cardinality(placements) between 1 and 2 and placements <@ array['HOME','SEARCH']::text[]),
  constraint mini_ads_period_ok check (ends_at > starts_at and ends_at <= starts_at + interval '366 days')
);
create index mini_ads_no_alcohol_confirmed_by_idx on public.mini_ads (no_alcohol_confirmed_by);
create index mini_ads_created_by_idx on public.mini_ads (created_by);
create index mini_ads_live_idx on public.mini_ads (ends_at) where active;
create trigger mini_ads_updated_at before update on public.mini_ads for each row execute function public.set_updated_at();

-- PK ขึ้นต้นด้วย ad_id = index ของ FK ไปในตัว
create table public.mini_ad_daily_stats (
  ad_id        uuid not null references public.mini_ads(id) on delete cascade,
  day          date not null,                                     -- วันตามเวลาไทย
  placement    text not null check (placement in ('HOME','SEARCH')),
  impressions  integer not null default 0 check (impressions >= 0),
  clicks       integer not null default 0 check (clicks >= 0),
  primary key (ad_id, day, placement)
);

-- ---------------------------------------------------------------------
-- 2. RLS — หน้าเว็บอ่านผ่าน rpc เท่านั้น (ไม่ grant ให้ anon) · …001600 สร้าง admin_read ให้ตารางที่มีตอนนั้นเท่านั้น — ตารางใหม่ต้องเพิ่มเอง
-- ---------------------------------------------------------------------
alter table public.mini_ads enable row level security;
alter table public.mini_ad_daily_stats enable row level security;
create policy admin_read on public.mini_ads for select to authenticated using (public.is_admin());
create policy admin_read on public.mini_ad_daily_stats for select to authenticated using (public.is_admin());
revoke all on public.mini_ads, public.mini_ad_daily_stats from anon;
revoke insert, update, delete, truncate on public.mini_ads, public.mini_ad_daily_stats from authenticated;
grant select on public.mini_ads, public.mini_ad_daily_stats to authenticated;

-- ---------------------------------------------------------------------
-- 3. ตัวช่วย
-- ---------------------------------------------------------------------
create or replace function public.mini_ad_is_live(a public.mini_ads) returns boolean
language sql stable set search_path = '' as $$
  select a.active and a.starts_at <= now() and now() < a.ends_at
$$;

-- ตรวจทั้งแถว (null-safe: ค่า null = INVALID_MINI_AD ไม่ใช่ 23502) · regex ตรงกับ contracts/mini-ads.ts
create or replace function public.mini_ad_check(r public.mini_ads) returns void
language plpgsql stable set search_path = '' as $$
begin
  if coalesce(char_length(btrim(r.advertiser_name)), 0) not between 1 and 60
     or coalesce(char_length(btrim(r.title)), 0) not between 1 and 60
     or r.description is null or char_length(r.description) > 120
     or coalesce(char_length(btrim(r.cta_label)), 0) not between 1 and 20
     or r.image_url is null or char_length(r.image_url) > 500
     or r.image_url !~ '^(https?://[^/\s\\]+/storage/v1/object/public/site-media/ads/[A-Za-z0-9._-]+|/images/[^\s\\]+)$'
     or r.link_url is null or char_length(r.link_url) > 500
     or r.link_url !~ '^(https://[^/\s\\]+[^\s\\]*|/([^/\s\\][^\s\\]*)?)$'
     or r.placements is null or cardinality(r.placements) not between 1 and 2
     or not (r.placements <@ array['HOME','SEARCH']::text[])
     or r.starts_at is null or r.ends_at is null
     or r.ends_at <= r.starts_at or r.ends_at > r.starts_at + interval '366 days'
     or r.active is null
     or char_length(r.note) > 300
  then
    raise exception 'INVALID_MINI_AD' using errcode = '22023';
  end if;
end $$;

-- path ใน site-media (ads/…) ของ URL ที่ไม่มีโฆษณาไหนใช้แล้ว → NestJS ลบไฟล์
create or replace function public.mini_ad_unused_image_paths(p_urls text[]) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(distinct x.m[1]), '{}')
  from unnest(p_urls) u
  cross join lateral (select regexp_match(u, '/storage/v1/object/public/site-media/(ads/[A-Za-z0-9._-]+)$') m) x
  where x.m is not null
    and not exists (select 1 from public.mini_ads a where a.image_url = u)
$$;

-- ---------------------------------------------------------------------
-- 4. แอดมินสร้าง / แก้ (p_id null = สร้าง · ไม่ null = แก้เฉพาะ key ที่ส่งมา)
-- ---------------------------------------------------------------------
create or replace function public.admin_save_mini_ad(p_actor uuid, p_id uuid, p jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  r public.mini_ads;
  before_row public.mini_ads;
  v_confirm boolean;
  v_creative boolean;
  v_removed text[] := '{}';
begin
  perform public.admin_assert(p_actor);
  if jsonb_typeof(p) is distinct from 'object' then
    raise exception 'INVALID_MINI_AD' using errcode = '22023';
  end if;

  if p_id is null then
    r.description := '';
    r.cta_label := 'ดูเพิ่มเติม';
    r.active := true;
  else
    select * into r from public.mini_ads where id = p_id for update;
    if not found then raise exception 'MINI_AD_NOT_FOUND' using errcode = 'P0002'; end if;
    before_row := r;
  end if;

  if p ? 'advertiser_name' then r.advertiser_name := btrim(p->>'advertiser_name'); end if;
  if p ? 'title' then r.title := btrim(p->>'title'); end if;
  if p ? 'description' then r.description := coalesce(btrim(p->>'description'), ''); end if;
  if p ? 'cta_label' then r.cta_label := btrim(p->>'cta_label'); end if;
  if p ? 'image_url' then r.image_url := btrim(p->>'image_url'); end if;
  if p ? 'link_url' then r.link_url := btrim(p->>'link_url'); end if;
  if p ? 'placements' then
    if jsonb_typeof(p->'placements') is distinct from 'array' then
      raise exception 'INVALID_MINI_AD' using errcode = '22023';
    end if;
    r.placements := array(select distinct x from jsonb_array_elements_text(p->'placements') x order by x);
  end if;
  begin
    if p ? 'starts_at' then r.starts_at := (p->>'starts_at')::timestamptz; end if;
    if p ? 'ends_at' then r.ends_at := (p->>'ends_at')::timestamptz; end if;
    if p ? 'active' then r.active := (p->>'active')::boolean; end if;
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
    raise exception 'INVALID_MINI_AD' using errcode = '22023';
  end;
  if p ? 'note' then r.note := nullif(btrim(p->>'note'), ''); end if;

  begin
    v_confirm := coalesce((p->>'confirm_no_alcohol')::boolean, false);
  exception when invalid_text_representation then
    v_confirm := false;
  end;
  v_creative := p_id is null
    or (r.advertiser_name, r.title, r.description, r.cta_label, r.image_url, r.link_url)
       is distinct from
       (before_row.advertiser_name, before_row.title, before_row.description, before_row.cta_label, before_row.image_url, before_row.link_url);
  if v_creative and not v_confirm then
    raise exception 'MINI_AD_NO_ALCOHOL_CONFIRM_REQUIRED' using errcode = '22023';
  end if;
  if v_creative or v_confirm then
    r.no_alcohol_confirmed_at := now();
    r.no_alcohol_confirmed_by := p_actor;
  end if;

  perform public.mini_ad_check(r);

  if p_id is null then
    insert into public.mini_ads (advertiser_name, title, description, cta_label, image_url, link_url, placements,
                                 starts_at, ends_at, active, note, no_alcohol_confirmed_at, no_alcohol_confirmed_by, created_by)
    values (r.advertiser_name, r.title, r.description, r.cta_label, r.image_url, r.link_url, r.placements,
            r.starts_at, r.ends_at, r.active, r.note, r.no_alcohol_confirmed_at, r.no_alcohol_confirmed_by, p_actor)
    returning * into r;
    perform public.admin_audit(p_actor, 'mini_ad.create', 'mini_ads', r.id, null, to_jsonb(r));
  else
    update public.mini_ads set
      advertiser_name = r.advertiser_name, title = r.title, description = r.description, cta_label = r.cta_label,
      image_url = r.image_url, link_url = r.link_url, placements = r.placements,
      starts_at = r.starts_at, ends_at = r.ends_at, active = r.active, note = r.note,
      no_alcohol_confirmed_at = r.no_alcohol_confirmed_at, no_alcohol_confirmed_by = r.no_alcohol_confirmed_by
    where id = p_id
    returning * into r;
    perform public.admin_audit(p_actor, 'mini_ad.update', 'mini_ads', r.id, to_jsonb(before_row), to_jsonb(r));
    v_removed := case when before_row.image_url is distinct from r.image_url
                      then public.mini_ad_unused_image_paths(array[before_row.image_url]) else '{}' end;
  end if;

  return jsonb_build_object('id', r.id, 'title', r.title, 'active', r.active, 'placements', to_jsonb(r.placements),
                            'starts_at', r.starts_at, 'ends_at', r.ends_at, 'removed_paths', to_jsonb(coalesce(v_removed, '{}')));
end $$;

-- ---------------------------------------------------------------------
-- 5. แอดมินลบ (ยอดเห็น/คลิกรวมเก็บใน audit before — stats ถูกลบตาม cascade)
-- ---------------------------------------------------------------------
create or replace function public.admin_delete_mini_ad(p_actor uuid, p_id uuid)
returns jsonb language plpgsql set search_path = '' as $$
declare before_row public.mini_ads; v_impr bigint; v_clicks bigint;
begin
  perform public.admin_assert(p_actor);
  select * into before_row from public.mini_ads where id = p_id for update;
  if not found then raise exception 'MINI_AD_NOT_FOUND' using errcode = 'P0002'; end if;

  select coalesce(sum(d.impressions), 0), coalesce(sum(d.clicks), 0) into v_impr, v_clicks
  from public.mini_ad_daily_stats d where d.ad_id = p_id;

  delete from public.mini_ads where id = p_id;
  perform public.admin_audit(p_actor, 'mini_ad.delete', 'mini_ads', p_id,
    to_jsonb(before_row) || jsonb_build_object('impressions', v_impr, 'clicks', v_clicks), null);

  return jsonb_build_object('id', p_id, 'deleted', true,
                            'removed_paths', to_jsonb(public.mini_ad_unused_image_paths(array[before_row.image_url])));
end $$;

-- ---------------------------------------------------------------------
-- 6. นับเห็น/คลิก (ไม่ระบุตัวตน · เรียกจาก NestJS ด้วย service_role)
-- ---------------------------------------------------------------------
create or replace function public.mini_ad_track(p_ad uuid, p_event text, p_placement text)
returns jsonb language plpgsql set search_path = '' as $$
begin
  if p_event is null or p_placement is null
     or p_event not in ('IMPRESSION', 'CLICK') or p_placement not in ('HOME', 'SEARCH') then
    raise exception 'MINI_AD_INVALID_EVENT' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.mini_ads a
    where a.id = p_ad and public.mini_ad_is_live(a) and p_placement = any (a.placements)
  ) then
    return jsonb_build_object('tracked', false);
  end if;

  insert into public.mini_ad_daily_stats as s (ad_id, day, placement, impressions, clicks)
  values (p_ad, (now() at time zone 'Asia/Bangkok')::date, p_placement,
          (p_event = 'IMPRESSION')::int, (p_event = 'CLICK')::int)
  on conflict (ad_id, day, placement) do update
    set impressions = s.impressions + excluded.impressions, clicks = s.clicks + excluded.clicks;
  return jsonb_build_object('tracked', true);
end $$;

-- ---------------------------------------------------------------------
-- 7. หน้าเว็บอ่าน — เฉพาะที่กำลังแสดง + คอลัมน์เนื้อหา (ไม่มี note / ผู้ยืนยัน) · NestJS สุ่มลำดับ
-- ---------------------------------------------------------------------
create or replace function public.mini_ads_live(p_placement text)
returns table (id uuid, advertiser_name text, title text, description text, cta_label text, image_url text, link_url text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.advertiser_name, a.title, a.description, a.cta_label, a.image_url, a.link_url
  from public.mini_ads a
  where public.mini_ad_is_live(a) and p_placement = any (a.placements)
  order by a.starts_at desc, a.id
  limit 10
$$;

-- ---------------------------------------------------------------------
-- 8. Backoffice view (ทุกสถานะ + ยอดรวม)
-- ---------------------------------------------------------------------
create view public.admin_mini_ads with (security_invoker = true) as
select a.id, a.advertiser_name, a.title, a.description, a.cta_label, a.image_url, a.link_url, a.placements,
       a.starts_at, a.ends_at, a.active, a.note, a.no_alcohol_confirmed_at,
       case when u.id is null then null else jsonb_build_object('id', u.id, 'display_name', u.display_name, 'email', u.email) end as confirmed_by,
       coalesce(s.impressions, 0)::bigint as impressions, coalesce(s.clicks, 0)::bigint as clicks,
       a.created_at, a.updated_at
from public.mini_ads a
left join public.users u on u.id = a.no_alcohol_confirmed_by
left join lateral (select sum(d.impressions) as impressions, sum(d.clicks) as clicks
                   from public.mini_ad_daily_stats d where d.ad_id = a.id) s on true
where public.is_admin();
revoke all on public.admin_mini_ads from anon;
grant select on public.admin_mini_ads to authenticated;

-- ---------------------------------------------------------------------
-- 9. สิทธิ์เรียกฟังก์ชัน
-- ---------------------------------------------------------------------
revoke all on function public.admin_save_mini_ad(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.admin_delete_mini_ad(uuid, uuid) from public, anon, authenticated;
revoke all on function public.mini_ad_track(uuid, text, text) from public, anon, authenticated;
revoke all on function public.mini_ad_check(public.mini_ads) from public, anon, authenticated;
revoke all on function public.mini_ad_is_live(public.mini_ads) from public, anon, authenticated;
revoke all on function public.mini_ad_unused_image_paths(text[]) from public, anon, authenticated;
grant execute on function public.admin_save_mini_ad(uuid, uuid, jsonb) to service_role;
grant execute on function public.admin_delete_mini_ad(uuid, uuid) to service_role;
grant execute on function public.mini_ad_track(uuid, text, text) to service_role;
grant execute on function public.mini_ad_check(public.mini_ads) to service_role;
grant execute on function public.mini_ad_is_live(public.mini_ads) to service_role;
grant execute on function public.mini_ad_unused_image_paths(text[]) to service_role;

revoke all on function public.mini_ads_live(text) from public;
grant execute on function public.mini_ads_live(text) to anon, authenticated, service_role;
