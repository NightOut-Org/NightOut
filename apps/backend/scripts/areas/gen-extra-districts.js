// สร้าง migration ใส่ย่านเพิ่มจาก extra-districts.json (ผ่าน resolve-extra.js แล้ว)
// ใช้: node gen-extra-districts.js <extra-resolved.json> <migration ปลายทาง>.sql
// ย่านจุดเดียว = จุดกลาง + รัศมี · หลายจุด (เช่น พหลโยธิน ที่ยาวเป็นแนว) = พื้นที่รวมวงกลมทุกจุด (districts.area)
const fs = require('fs');
const [, , src, out] = process.argv;
const rows = JSON.parse(fs.readFileSync(src, 'utf8'));
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const pt = (a) => `extensions.st_setsrid(extensions.st_makepoint(${a.lng}, ${a.lat}), 4326)`;

// ย่านที่ยาวเป็นแนว (densify_m): เติมจุดกึ่งกลางระหว่างจุดที่ห่างกันเกินค่านี้ — ถนนช่วงนั้นเกือบตรง จุดที่เติมคลาดจากถนนไม่เกินครึ่งกิโลเมตร
const km = (a, b) => {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
function densify(anchors, maxM) {
  const out = [anchors[0]];
  for (let i = 1; i < anchors.length; i++) {
    const a = out[out.length - 1];
    const b = anchors[i];
    const parts = Math.ceil((km(a, b) * 1000) / maxM);
    for (let k = 1; k < parts; k++) {
      const t = k / parts;
      out.push({ lat: +(a.lat + (b.lat - a.lat) * t).toFixed(5), lng: +(a.lng + (b.lng - a.lng) * t).toFixed(5), r: b.r, src: 'ประมาณตามแนวถนนระหว่างสองจุด' });
    }
    out.push(b);
  }
  return out;
}
for (const d of rows) if (d.densify_m) d.anchors = densify(d.anchors, d.densify_m);

const values = rows.map((d, i) => {
  const first = d.anchors[0];
  const radius = d.rank_m ?? Math.max(...d.anchors.map((a) => a.r));
  const area =
    d.anchors.length > 1
      ? `extensions.st_multi(extensions.st_union(array[\n      ${d.anchors.map((a) => `extensions.st_buffer(${pt(a)}::extensions.geography, ${a.r})::extensions.geometry`).join(',\n      ')}\n    ]))`
      : 'null';
  return `  (${q(d.slug)}, ${q(d.name_th)}, ${100 + i}, ${pt(first)}::extensions.geography, ${radius}, 30, 'SEED', ${area})`;
});

const sql = `-- NightOut · ย่านเพิ่ม ${rows.length} ย่าน (ทีมคัด) + รองรับย่านที่ยาวเป็นแนว (เช่น พหลโยธิน) — ADR 0011
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
${values.join(',\n')}
on conflict (slug) do update set name_th = excluded.name_th, sort_order = excluded.sort_order, center = excluded.center,
  radius_m = excluded.radius_m, priority = excluded.priority, source = excluded.source, area = excluded.area;

-- ย่านผูกกับอำเภอ/จังหวัดตามจุดกลาง (เหมือน …20261020000400)
update public.districts d set amphoe_code = t.amphoe_code, province_th = p.name_th
  from public.tambons t
  join public.amphoes a on a.code = t.amphoe_code
  join public.provinces p on p.code = a.province_code
 where d.slug in (${rows.map((d) => q(d.slug)).join(', ')})
   and t.code = public.tambon_at(extensions.st_y(d.center::extensions.geometry), extensions.st_x(d.center::extensions.geometry));

-- วอล์คกิ้งสตรีทพัทยา (…20261020000400) แคบลง ไม่ให้กลืนถนนพัทยาสายสอง ซึ่งเป็นใจกลางย่านพัทยา
update public.districts set radius_m = 400 where slug = 'pattaya-walking-street';

-- คำนวณย่านของร้านเดิมใหม่ (trigger bars_set_area)
update public.bars set lat = lat;
`;
fs.writeFileSync(out, sql);
console.log('written', rows.length, 'ย่าน', (sql.length / 1024).toFixed(1), 'KB');
