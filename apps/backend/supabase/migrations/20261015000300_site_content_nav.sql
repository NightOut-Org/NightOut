-- =====================================================================
-- NightOut · site-content — เมนู navbar ของเว็บลูกค้าที่แอดมินจัดเองได้ (Backoffice /home-content · นอก MVP — อนุมัติ 2026-10-15)
--   - site_nav_items : 1 แถว = 1 เมนู (key ตายตัว · ลิงก์/ไอคอนอยู่ในโค้ดหน้าเว็บ) แก้ได้: ชื่อที่แสดง · ลำดับ · ซ่อน/แสดง
--                      ตั้งแยก 2 ชุด: desktop (navbar แคปซูล) / mobile (แถบเมนูล่าง)
--   - "หน้าหลัก" (home) ซ่อนไม่ได้ทั้ง 2 ชุด
--   - หน้าบ้านอ่านผ่าน view public_site_nav (GET /public/site-nav) · Backoffice อ่าน admin_site_nav
--   - admin_save_site_nav เรียกจาก NestJS (service_role) เท่านั้น · audit log
-- ค่าตั้งต้น = ลำดับที่เคย hard-code ใน apps/frontend/src/configs/nav.ts (เกี่ยวกับเรา ไม่ขึ้นบนมือถือ)
-- =====================================================================
set search_path = public, extensions;

create table public.site_nav_items (
  key              text primary key check (key in ('home', 'search', 'community', 'ranking', 'bookings', 'about')),
  label            text not null,
  desktop_order    smallint not null,
  desktop_visible  boolean not null default true,
  mobile_order     smallint not null,
  mobile_visible   boolean not null default true,
  updated_at       timestamptz not null default now()
);
create trigger site_nav_items_updated_at before update on public.site_nav_items for each row execute function public.set_updated_at();

insert into public.site_nav_items (key, label, desktop_order, desktop_visible, mobile_order, mobile_visible) values
  ('home',      'หน้าหลัก',     0, true, 0, true),
  ('search',    'ค้นหา',        1, true, 1, true),
  ('community', 'ชุมชน',        2, true, 2, true),
  ('ranking',   'จัดอันดับ',     3, true, 3, true),
  ('bookings',  'การจอง',       4, true, 4, true),
  ('about',     'เกี่ยวกับเรา',   5, true, 5, false);

-- RLS: เนื้อหาสาธารณะ อ่านได้ทุกคน · เขียนผ่าน service role เท่านั้น
alter table public.site_nav_items enable row level security;
create policy site_nav_items_read on public.site_nav_items for select using (true);
create policy admin_read on public.site_nav_items for select to authenticated using (public.is_admin());
grant select on public.site_nav_items to anon, authenticated;
revoke insert, update, delete, truncate on public.site_nav_items from anon, authenticated;

-- ---------------------------------------------------------------------
-- view
-- ---------------------------------------------------------------------
create view public.public_site_nav with (security_invoker = true) as
select n.key, n.label, n.desktop_order, n.desktop_visible, n.mobile_order, n.mobile_visible
from public.site_nav_items n
order by n.desktop_order;

grant select on public.public_site_nav to anon, authenticated;

create view public.admin_site_nav with (security_invoker = true) as
select n.key, n.label, n.desktop_order, n.desktop_visible, n.mobile_order, n.mobile_visible, n.updated_at
from public.site_nav_items n
where public.is_admin();

revoke all on public.admin_site_nav from anon;
grant select on public.admin_site_nav to authenticated;

-- ---------------------------------------------------------------------
-- เขียน — ส่งครบทุกเมนู: [{ key, label, desktop_order, desktop_visible, mobile_order, mobile_visible }]
--   ลำดับแต่ละชุดต้องเป็น 0..n-1 ไม่ซ้ำ · home แสดงเสมอ · ชื่อ 1–20 ตัวอักษร
-- ---------------------------------------------------------------------
create or replace function public.admin_save_site_nav(p_actor uuid, p_items jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  n_total integer;
  before_rows jsonb;
  after_rows jsonb;
  n_changed integer;
begin
  perform public.admin_assert(p_actor);
  select count(*) into n_total from public.site_nav_items;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) <> n_total then
    raise exception 'INVALID_SITE_NAV' using errcode = '22023';
  end if;
  if exists (
       select 1 from jsonb_array_elements(p_items) x
       where jsonb_typeof(x) <> 'object'
          or char_length(btrim(coalesce(x->>'label', ''))) not between 1 and 20
          or jsonb_typeof(x->'desktop_visible') <> 'boolean' or jsonb_typeof(x->'mobile_visible') <> 'boolean'
          or jsonb_typeof(x->'desktop_order') <> 'number' or jsonb_typeof(x->'mobile_order') <> 'number'
          or (x->>'key' = 'home' and not ((x->>'desktop_visible')::boolean and (x->>'mobile_visible')::boolean)))
     -- key ครบ ไม่ซ้ำ และมีอยู่จริง
     or (select count(distinct x->>'key') from jsonb_array_elements(p_items) x
         where x->>'key' in (select n.key from public.site_nav_items n)) <> n_total
     -- ลำดับแต่ละชุด = 0..n-1 ไม่ซ้ำ
     or (select array_agg((x->>'desktop_order')::numeric order by (x->>'desktop_order')::numeric) from jsonb_array_elements(p_items) x)
        <> (select array_agg(i::numeric order by i) from generate_series(0, n_total - 1) i)
     or (select array_agg((x->>'mobile_order')::numeric order by (x->>'mobile_order')::numeric) from jsonb_array_elements(p_items) x)
        <> (select array_agg(i::numeric order by i) from generate_series(0, n_total - 1) i) then
    raise exception 'INVALID_SITE_NAV' using errcode = '22023';
  end if;

  select jsonb_agg(to_jsonb(n) - 'updated_at' order by n.key) into before_rows from public.site_nav_items n;

  with u as (
    update public.site_nav_items n set
      label = btrim(x->>'label'),
      desktop_order = (x->>'desktop_order')::smallint,
      desktop_visible = (x->>'desktop_visible')::boolean,
      mobile_order = (x->>'mobile_order')::smallint,
      mobile_visible = (x->>'mobile_visible')::boolean
    from jsonb_array_elements(p_items) x
    where n.key = x->>'key'
      and (n.label, n.desktop_order, n.desktop_visible, n.mobile_order, n.mobile_visible)
          is distinct from (btrim(x->>'label'), (x->>'desktop_order')::smallint, (x->>'desktop_visible')::boolean,
                            (x->>'mobile_order')::smallint, (x->>'mobile_visible')::boolean)
    returning 1
  )
  select count(*) into n_changed from u;

  if n_changed > 0 then
    select jsonb_agg(to_jsonb(n) - 'updated_at' order by n.key) into after_rows from public.site_nav_items n;
    perform public.admin_audit(p_actor, 'site_nav.update', 'site_nav_items', null, before_rows, after_rows);
  end if;

  return jsonb_build_object('updated', n_changed);
end $$;

revoke all on function public.admin_save_site_nav(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_site_nav(uuid, jsonb) to service_role;
