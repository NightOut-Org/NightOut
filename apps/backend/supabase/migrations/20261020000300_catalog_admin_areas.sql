-- NightOut · พื้นที่ร้านครบทั้งประเทศ (นอก MVP — อนุมัติ 2026-10-20)
-- จังหวัด → อำเภอ/เขต → ตำบล/แขวง (รหัส pcode + ขอบเขต จาก OCHA COD-AB Thailand · CC BY-IGO · ข้อมูลอยู่ใน …20261020000400)
-- ย่าน (public.districts) = ชื่อที่คนเที่ยวเรียก · ทีมคัดเอง (SEED) + OpenStreetMap (OSM · ODbL) · มีจุดกลาง + รัศมี
-- ร้านไม่ต้องเลือกพื้นที่เอง: trigger หาตำบลจากหมุด (point-in-polygon) + ย่านที่ใกล้สุดในรัศมี (…20261020000500)

create table public.provinces (
  code       text primary key check (code ~ '^TH[0-9]{2}$'),
  name_th    text not null,
  name_en    text not null,
  center     extensions.geography(Point, 4326) not null,
  created_at timestamptz not null default now()
);

create table public.amphoes (                              -- อำเภอ / เขต (กทม.)
  code          text primary key check (code ~ '^TH[0-9]{4}$'),
  province_code text not null references public.provinces(code),
  name_th       text not null,
  name_en       text not null,
  center        extensions.geography(Point, 4326) not null,
  created_at    timestamptz not null default now()
);
create index amphoes_province on public.amphoes (province_code);

create table public.tambons (                              -- ตำบล / แขวง (กทม.)
  code        text primary key check (code ~ '^TH[0-9]{6}$'),
  amphoe_code text not null references public.amphoes(code),
  name_th     text not null,
  name_en     text not null,
  center      extensions.geography(Point, 4326) not null,
  geom        extensions.geometry(MultiPolygon, 4326) not null,  -- ลดความละเอียด ~22 ม. (TWKB precision 4)
  created_at  timestamptz not null default now()
);
create index tambons_amphoe on public.tambons (amphoe_code);
create index tambons_geom   on public.tambons using gist (geom);

-- ย่าน: ผูกกับอำเภอ + จุดกลาง/รัศมี · priority สูงชนะ (SEED 30 · OSM suburb 20 · quarter 15 · neighbourhood 10)
alter table public.districts
  add column amphoe_code text references public.amphoes(code),
  add column center      extensions.geography(Point, 4326),
  add column radius_m    integer  not null default 1500 check (radius_m between 100 and 10000),
  add column priority    smallint not null default 30,
  add column source      text     not null default 'SEED' check (source in ('SEED', 'OSM')),
  add column osm_id      text unique;
create index districts_amphoe on public.districts (amphoe_code);
create index districts_center on public.districts using gist (center);

alter table public.bars add column tambon_code text references public.tambons(code);
create index bars_tambon on public.bars (tambon_code);

-- ---------------------------------------------------------------------
-- RLS: อ่านได้ทุกคน (master data) · เขียนผ่าน migration เท่านั้น
-- ---------------------------------------------------------------------
alter table public.provinces enable row level security;
alter table public.amphoes   enable row level security;
alter table public.tambons   enable row level security;
create policy provinces_read on public.provinces for select using (true);
create policy amphoes_read   on public.amphoes   for select using (true);
create policy tambons_read   on public.tambons   for select using (true);
create policy admin_read     on public.provinces for select using (public.is_admin());
create policy admin_read     on public.amphoes   for select using (public.is_admin());
create policy admin_read     on public.tambons   for select using (public.is_admin());
revoke insert, update, delete, truncate on public.provinces, public.amphoes, public.tambons from anon, authenticated;
grant select on public.provinces, public.amphoes, public.tambons to anon, authenticated;

-- ---------------------------------------------------------------------
-- หาพื้นที่จากพิกัด
-- ---------------------------------------------------------------------
-- ตำบลที่หมุดอยู่ข้างใน · ขอบเขตถูกลดความละเอียด → หมุดที่ตกร่องระหว่างตำบล ใช้ตำบลที่ใกล้สุดในระยะ ~500 ม.
create or replace function public.tambon_at(p_lat double precision, p_lng double precision)
returns text language sql stable set search_path = '' as $$
  with pt as (select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326) as g)
  select coalesce(
    (select t.code from public.tambons t, pt
      where extensions.st_intersects(t.geom, pt.g) order by t.code limit 1),
    (select t.code from public.tambons t, pt
      where extensions.st_dwithin(t.geom, pt.g, 0.005)
      order by extensions.st_distance(t.geom, pt.g) limit 1)
  );
$$;

-- ย่านที่หมุดอยู่ในรัศมี · priority สูงก่อน แล้วย่านที่แคบสุด (อโศก ชนะ สุขุมวิท) แล้วใกล้จุดกลางสุด
create or replace function public.district_near(p_lat double precision, p_lng double precision)
returns uuid language sql stable set search_path = '' as $$
  with pt as (select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g)
  select d.id from public.districts d, pt
   where d.active and d.center is not null and extensions.st_dwithin(d.center, pt.g, d.radius_m)
   order by d.priority desc, d.radius_m, extensions.st_distance(d.center, pt.g), d.sort_order
   limit 1;
$$;

-- พื้นที่ของพิกัด (ตอนร้านปักหมุด) {tambon, amphoe, province, district} · นอกประเทศไทย = null ทุกช่อง
create or replace function public.area_at_point(p_lat double precision, p_lng double precision)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_tambon text;
  v_district uuid;
  r record;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'INVALID_LOCATION' using errcode = '22023';
  end if;
  v_tambon := public.tambon_at(p_lat, p_lng);
  v_district := public.district_near(p_lat, p_lng);
  select t.code as t_code, t.name_th as t_name, a.code as a_code, a.name_th as a_name,
         p.code as p_code, p.name_th as p_name
    into r
    from public.tambons t
    join public.amphoes a on a.code = t.amphoe_code
    join public.provinces p on p.code = a.province_code
   where t.code = v_tambon;
  return jsonb_build_object(
    'tambon',   case when r.t_code is null then null else jsonb_build_object('code', r.t_code, 'name_th', r.t_name) end,
    'amphoe',   case when r.a_code is null then null else jsonb_build_object('code', r.a_code, 'name_th', r.a_name) end,
    'province', case when r.p_code is null then null else jsonb_build_object('code', r.p_code, 'name_th', r.p_name) end,
    'district', (select jsonb_build_object('id', d.id, 'slug', d.slug, 'name_th', d.name_th)
                   from public.districts d where d.id = v_district)
  );
end;
$$;

revoke all on function public.tambon_at(double precision, double precision) from public, anon, authenticated;
revoke all on function public.district_near(double precision, double precision) from public, anon, authenticated;
revoke all on function public.area_at_point(double precision, double precision) from public, anon, authenticated;
-- อ่านอย่างเดียวจาก master data สาธารณะ — area_at_point (security invoker) เรียก 2 ตัวนี้ต่อ
grant execute on function public.tambon_at(double precision, double precision) to anon, authenticated, service_role;
grant execute on function public.district_near(double precision, double precision) to anon, authenticated, service_role;
grant execute on function public.area_at_point(double precision, double precision) to anon, authenticated, service_role;
