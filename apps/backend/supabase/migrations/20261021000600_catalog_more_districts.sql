-- NightOut · ย่านเพิ่ม 36 ย่าน (ทีมคัด) + รองรับย่านที่ยาวเป็นแนว (เช่น พหลโยธิน) — ADR 0011
-- พิกัดแต่ละจุดมาจากข้อมูลเขตการปกครองทางการ (OCHA) หรือ OpenStreetMap (ห้าง/สถานี/ชุมชนที่ยืนยันแล้ว) · ที่มาของแต่ละจุดอยู่ใน
-- apps/backend/scripts/areas/extra-districts.json (ฟิลด์ src) · สร้างด้วย gen-extra-districts.js · ห้ามแก้มือ
-- ย่านหลายจุด = districts.area (พื้นที่รวมวงกลมรอบทุกจุด) · ย่านจุดเดียวยังใช้ center + radius_m เหมือนเดิม

alter table public.districts add column area extensions.geometry(MultiPolygon, 4326);
create index districts_area on public.districts using gist (area);

-- หมุดอยู่ในย่านไหน: มี area = อยู่ในพื้นที่ · ไม่มี = อยู่ในรัศมีจากจุดกลาง · ชนะกันด้วย priority → radius_m แคบสุด → ใกล้จุดกลางสุด
create or replace function public.district_near(p_lat double precision, p_lng double precision)
returns uuid language sql stable set search_path = '' as $$
  with pt as (select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g)
  select d.id from public.districts d, pt
   where d.active and d.center is not null
     and case when d.area is not null
              then extensions.st_covers(d.area, pt.g::extensions.geometry)
              else extensions.st_dwithin(d.center, pt.g, d.radius_m) end
   order by d.priority desc, d.radius_m, extensions.st_distance(d.center, pt.g), d.sort_order
   limit 1;
$$;

insert into public.districts (slug, name_th, sort_order, center, radius_m, priority, source, area) values
  ('rangsit', 'รังสิต', 100, extensions.st_setsrid(extensions.st_makepoint(100.61844, 13.98895), 4326)::extensions.geography, 3500, 30, 'SEED', extensions.st_multi(extensions.st_union(array[
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.61844, 13.98895), 4326)::extensions.geography, 3500)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.60215, 13.99054), 4326)::extensions.geography, 2500)::extensions.geometry
    ]))),
  ('phahonyothin', 'พหลโยธิน', 101, extensions.st_setsrid(extensions.st_makepoint(100.54952, 13.79298), 4326)::extensions.geography, 4000, 30, 'SEED', extensions.st_multi(extensions.st_union(array[
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.54952, 13.79298), 4326)::extensions.geography, 1800)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.54469, 13.78021), 4326)::extensions.geography, 1800)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.55389, 13.80272), 4326)::extensions.geography, 1800)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.56204, 13.81668), 4326)::extensions.geography, 1800)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.57561, 13.83975), 4326)::extensions.geography, 1800)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.58879, 13.85604), 4326)::extensions.geography, 1800)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.60196, 13.87234), 4326)::extensions.geography, 1800)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.61014, 13.89024), 4326)::extensions.geography, 1800)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.61833, 13.90813), 4326)::extensions.geography, 1800)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.62651, 13.92603), 4326)::extensions.geography, 1800)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.62306, 13.94644), 4326)::extensions.geography, 1800)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.6196, 13.96686), 4326)::extensions.geography, 1800)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.61615, 13.98727), 4326)::extensions.geography, 1800)::extensions.geometry
    ]))),
  ('navamin', 'นวมินทร์', 102, extensions.st_setsrid(extensions.st_makepoint(100.64304, 13.80513), 4326)::extensions.geography, 2500, 30, 'SEED', null),
  ('ramintra', 'รามอินทรา', 103, extensions.st_setsrid(extensions.st_makepoint(100.66862, 13.81924), 4326)::extensions.geography, 3500, 30, 'SEED', null),
  ('chaengwattana', 'แจ้งวัฒนะ', 104, extensions.st_setsrid(extensions.st_makepoint(100.56491, 13.88238), 4326)::extensions.geography, 2500, 30, 'SEED', extensions.st_multi(extensions.st_union(array[
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.56491, 13.88238), 4326)::extensions.geography, 2500)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.5282, 13.90355), 4326)::extensions.geography, 2500)::extensions.geometry
    ]))),
  ('rattanathibet', 'รัตนาธิเบศร์', 105, extensions.st_setsrid(extensions.st_makepoint(100.49102, 13.87103), 4326)::extensions.geography, 2500, 30, 'SEED', extensions.st_multi(extensions.st_union(array[
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.49102, 13.87103), 4326)::extensions.geography, 2500)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.46881, 13.87066), 4326)::extensions.geography, 2500)::extensions.geometry
    ]))),
  ('salaya', 'ศาลายา', 106, extensions.st_setsrid(extensions.st_makepoint(100.32433, 13.8025), 4326)::extensions.geography, 3000, 30, 'SEED', extensions.st_multi(extensions.st_union(array[
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.32433, 13.8025), 4326)::extensions.geography, 3000)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.30597, 13.7988), 4326)::extensions.geography, 2500)::extensions.geometry
    ]))),
  ('samrong', 'สำโรง', 107, extensions.st_setsrid(extensions.st_makepoint(100.5966, 13.64502), 4326)::extensions.geography, 2500, 30, 'SEED', extensions.st_multi(extensions.st_union(array[
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.5966, 13.64502), 4326)::extensions.geography, 2500)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.61957, 13.64623), 4326)::extensions.geography, 2500)::extensions.geometry
    ]))),
  ('minburi', 'มีนบุรี', 108, extensions.st_setsrid(extensions.st_makepoint(100.721, 13.80563), 4326)::extensions.geography, 2500, 30, 'SEED', extensions.st_multi(extensions.st_union(array[
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.721, 13.80563), 4326)::extensions.geography, 2500)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.75023, 13.81106), 4326)::extensions.geography, 2500)::extensions.geometry
    ]))),
  ('lat-krabang', 'ลาดกระบัง', 109, extensions.st_setsrid(extensions.st_makepoint(100.74946, 13.72316), 4326)::extensions.geography, 3000, 30, 'SEED', null),
  ('bang-yai', 'บางใหญ่', 110, extensions.st_setsrid(extensions.st_makepoint(100.41153, 13.8768), 4326)::extensions.geography, 4000, 30, 'SEED', null),
  ('mahachai', 'มหาชัย', 111, extensions.st_setsrid(extensions.st_makepoint(100.27443, 13.54574), 4326)::extensions.geography, 3000, 30, 'SEED', null),
  ('rama3', 'พระราม 3', 112, extensions.st_setsrid(extensions.st_makepoint(100.53782, 13.69791), 4326)::extensions.geography, 2500, 30, 'SEED', null),
  ('phra-khanong', 'พระโขนง', 113, extensions.st_setsrid(extensions.st_makepoint(100.58993, 13.71058), 4326)::extensions.geography, 2000, 30, 'SEED', null),
  ('chiang-mai-chang-khlan', 'ช้างคลาน', 114, extensions.st_setsrid(extensions.st_makepoint(99.00071, 18.77608), 4326)::extensions.geography, 1800, 30, 'SEED', null),
  ('patong', 'ป่าตอง', 115, extensions.st_setsrid(extensions.st_makepoint(98.29759, 7.89236), 4326)::extensions.geography, 2500, 30, 'SEED', null),
  ('karon', 'กะรน', 116, extensions.st_setsrid(extensions.st_makepoint(98.29811, 7.84752), 4326)::extensions.geography, 2500, 30, 'SEED', null),
  ('rawai', 'ราไวย์', 117, extensions.st_setsrid(extensions.st_makepoint(98.32772, 7.77581), 4326)::extensions.geography, 2500, 30, 'SEED', null),
  ('phuket-old-town', 'เมืองเก่าภูเก็ต', 118, extensions.st_setsrid(extensions.st_makepoint(98.39788, 7.88474), 4326)::extensions.geography, 1800, 30, 'SEED', null),
  ('pattaya', 'พัทยา', 119, extensions.st_setsrid(extensions.st_makepoint(100.87763, 12.92778), 4326)::extensions.geography, 3000, 30, 'SEED', null),
  ('jomtien', 'จอมเทียน', 120, extensions.st_setsrid(extensions.st_makepoint(100.88437, 12.87727), 4326)::extensions.geography, 2500, 30, 'SEED', null),
  ('bangsaen', 'บางแสน', 121, extensions.st_setsrid(extensions.st_makepoint(100.92953, 13.27801), 4326)::extensions.geography, 3000, 30, 'SEED', null),
  ('si-racha', 'ศรีราชา', 122, extensions.st_setsrid(extensions.st_makepoint(100.93096, 13.17926), 4326)::extensions.geography, 3500, 30, 'SEED', null),
  ('hua-hin', 'หัวหิน', 123, extensions.st_setsrid(extensions.st_makepoint(99.95525, 12.57102), 4326)::extensions.geography, 3500, 30, 'SEED', null),
  ('chaweng', 'เฉวง', 124, extensions.st_setsrid(extensions.st_makepoint(100.05988, 9.52357), 4326)::extensions.geography, 3000, 30, 'SEED', null),
  ('lamai', 'ละไม', 125, extensions.st_setsrid(extensions.st_makepoint(100.04503, 9.46255), 4326)::extensions.geography, 2500, 30, 'SEED', null),
  ('ao-nang', 'อ่าวนาง', 126, extensions.st_setsrid(extensions.st_makepoint(98.83229, 8.04526), 4326)::extensions.geography, 3000, 30, 'SEED', null),
  ('khon-kaen', 'เมืองขอนแก่น', 127, extensions.st_setsrid(extensions.st_makepoint(102.82584, 16.43305), 4326)::extensions.geography, 3500, 30, 'SEED', null),
  ('korat', 'เมืองโคราช', 128, extensions.st_setsrid(extensions.st_makepoint(102.09055, 14.98124), 4326)::extensions.geography, 3500, 30, 'SEED', null),
  ('pak-chong', 'ปากช่อง', 129, extensions.st_setsrid(extensions.st_makepoint(101.4314, 14.71805), 4326)::extensions.geography, 3500, 30, 'SEED', null),
  ('hat-yai', 'หาดใหญ่', 130, extensions.st_setsrid(extensions.st_makepoint(100.47507, 7.01545), 4326)::extensions.geography, 2500, 30, 'SEED', extensions.st_multi(extensions.st_union(array[
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.47507, 7.01545), 4326)::extensions.geography, 2500)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.48296, 6.99186), 4326)::extensions.geography, 2500)::extensions.geometry
    ]))),
  ('udon-thani', 'เมืองอุดรธานี', 131, extensions.st_setsrid(extensions.st_makepoint(102.80014, 17.40596), 4326)::extensions.geography, 3500, 30, 'SEED', null),
  ('ubon', 'เมืองอุบลราชธานี', 132, extensions.st_setsrid(extensions.st_makepoint(104.84349, 15.24274), 4326)::extensions.geography, 2500, 30, 'SEED', extensions.st_multi(extensions.st_union(array[
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(104.84349, 15.24274), 4326)::extensions.geography, 2500)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(104.82328, 15.24031), 4326)::extensions.geography, 2500)::extensions.geometry
    ]))),
  ('phitsanulok', 'เมืองพิษณุโลก', 133, extensions.st_setsrid(extensions.st_makepoint(100.2641, 16.81401), 4326)::extensions.geography, 2500, 30, 'SEED', extensions.st_multi(extensions.st_union(array[
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.2641, 16.81401), 4326)::extensions.geography, 2500)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(100.23309, 16.84055), 4326)::extensions.geography, 2500)::extensions.geometry
    ]))),
  ('chiang-rai', 'เมืองเชียงราย', 134, extensions.st_setsrid(extensions.st_makepoint(99.8325, 19.90809), 4326)::extensions.geography, 2500, 30, 'SEED', extensions.st_multi(extensions.st_union(array[
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(99.8325, 19.90809), 4326)::extensions.geography, 2500)::extensions.geometry,
      extensions.st_buffer(extensions.st_setsrid(extensions.st_makepoint(99.83308, 19.88621), 4326)::extensions.geography, 2500)::extensions.geometry
    ]))),
  ('ayutthaya', 'อยุธยา', 135, extensions.st_setsrid(extensions.st_makepoint(100.56752, 14.357), 4326)::extensions.geography, 3000, 30, 'SEED', null)
on conflict (slug) do update set name_th = excluded.name_th, sort_order = excluded.sort_order, center = excluded.center,
  radius_m = excluded.radius_m, priority = excluded.priority, source = excluded.source, area = excluded.area;

-- ย่านผูกกับอำเภอ/จังหวัดตามจุดกลาง (เหมือน …20261020000400)
update public.districts d set amphoe_code = t.amphoe_code, province_th = p.name_th
  from public.tambons t
  join public.amphoes a on a.code = t.amphoe_code
  join public.provinces p on p.code = a.province_code
 where d.slug in ('rangsit', 'phahonyothin', 'navamin', 'ramintra', 'chaengwattana', 'rattanathibet', 'salaya', 'samrong', 'minburi', 'lat-krabang', 'bang-yai', 'mahachai', 'rama3', 'phra-khanong', 'chiang-mai-chang-khlan', 'patong', 'karon', 'rawai', 'phuket-old-town', 'pattaya', 'jomtien', 'bangsaen', 'si-racha', 'hua-hin', 'chaweng', 'lamai', 'ao-nang', 'khon-kaen', 'korat', 'pak-chong', 'hat-yai', 'udon-thani', 'ubon', 'phitsanulok', 'chiang-rai', 'ayutthaya')
   and t.code = public.tambon_at(extensions.st_y(d.center::extensions.geometry), extensions.st_x(d.center::extensions.geometry));

-- วอล์คกิ้งสตรีทพัทยา (…20261020000400) แคบลง ไม่ให้กลืนถนนพัทยาสายสอง ซึ่งเป็นใจกลางย่านพัทยา
update public.districts set radius_m = 400 where slug = 'pattaya-walking-street';

-- คำนวณย่านของร้านเดิมใหม่ (trigger bars_set_area)
update public.bars set lat = lat;
