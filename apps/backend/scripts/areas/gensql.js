// สร้าง migration ข้อมูลพื้นที่ (จังหวัด/อำเภอ/ตำบล + ย่าน)
const fs = require('fs');
const D = process.argv[2];
const OUT = process.argv[3];
const q = (s) => `'${String(s).trim().replace(/'/g, "''")}'`;
const pt = (lat, lng) => `extensions.st_setsrid(extensions.st_makepoint(${(+lng).toFixed(5)}, ${(+lat).toFixed(5)}), 4326)::extensions.geography`;
const a1 = JSON.parse(fs.readFileSync(`${D}/adm1.json`, 'utf8'));
const a2 = JSON.parse(fs.readFileSync(`${D}/adm2.json`, 'utf8'));
const a3 = JSON.parse(fs.readFileSync(`${D}/adm3.json`, 'utf8'));
const tw = new Map(fs.readFileSync(`${D}/tw.psv`, 'utf8').trim().split(/\r?\n/).map((l) => l.split('|')));
const seeds = JSON.parse(fs.readFileSync(`${D}/seeds.json`, 'utf8'));
const osm = JSON.parse(fs.readFileSync(`${D}/osm-final.json`, 'utf8'));

const L = [];
L.push(`-- NightOut · ข้อมูลพื้นที่ทั้งประเทศ (สร้างด้วย apps/backend/scripts/areas/README.md · ห้ามแก้มือ)`);
L.push(`-- จังหวัด ${a1.length} · อำเภอ/เขต ${a2.length} · ตำบล/แขวง ${a3.length}: OCHA COD-AB Thailand (Royal Thai Survey Department, OCHA ROAP) · CC BY-IGO`);
L.push(`--   https://data.humdata.org/dataset/cod-ab-tha · ขอบเขตลดความละเอียด 0.0002° (ST_SimplifyPreserveTopology) แล้วเก็บเป็น TWKB precision 4 (base64)`);
L.push(`-- ย่าน OSM ${osm.length}: © OpenStreetMap contributors · ODbL · place=suburb|quarter|neighbourhood ชื่อไทย (ตัดชุมชน/หมู่บ้าน/ชื่อซ้ำกับอำเภอ-ตำบล)`);
L.push(`-- ย่าน SEED ${seeds.length}: ทีม NightOut คัดเอง (10 ย่านเดิม + ย่านดังที่ OSM ไม่มี)`);
L.push('');
const batch = (head, rows, size = 500) => {
  for (let i = 0; i < rows.length; i += size) L.push(`${head}\n${rows.slice(i, i + size).join(',\n')};`);
};
batch(
  'insert into public.provinces (code, name_th, name_en, center) values',
  a1.map((r) => `(${q(r.adm1_pcode)}, ${q(r.adm1_name1)}, ${q(r.adm1_name)}, ${pt(r.center_lat, r.center_lon)})`),
);
batch(
  'insert into public.amphoes (code, province_code, name_th, name_en, center) values',
  a2.map((r) => `(${q(r.adm2_pcode)}, ${q(r.adm1_pcode)}, ${q(r.adm2_name1)}, ${q(r.adm2_name)}, ${pt(r.center_lat, r.center_lon)})`),
);
batch(
  'insert into public.tambons (code, amphoe_code, name_th, name_en, center, geom) values',
  a3.map((r) => {
    const g = tw.get(r.adm3_pcode);
    if (!g) throw new Error('no geom ' + r.adm3_pcode);
    return `(${q(r.adm3_pcode)}, ${q(r.adm2_pcode)}, ${q(r.adm3_name1)}, ${q(r.adm3_name)}, ${pt(r.center_lat, r.center_lon)}, extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromtwkb(decode('${g}', 'base64')), 4326)))`;
  }),
  250,
);
L.push('');
L.push('-- ย่านตั้งต้น (SEED): 10 ย่านเดิมอัปเดตจุดกลาง/รัศมี · ย่านใหม่เพิ่มต่อท้าย');
L.push(`insert into public.districts (slug, name_th, sort_order, center, radius_m, priority, source) values`);
L.push(
  seeds.map((s, i) => `  (${q(s.slug)}, ${q(s.name_th)}, ${i + 1}, ${pt(s.lat, s.lng)}, ${s.radius_m}, 30, 'SEED')`).join(',\n') +
    `\non conflict (slug) do update set name_th = excluded.name_th, center = excluded.center, radius_m = excluded.radius_m,\n  priority = excluded.priority, source = excluded.source;`,
);
L.push('');
const PRIO = { suburb: 20, quarter: 15, neighbourhood: 10 };
const RAD = { suburb: 2500, quarter: 1500, neighbourhood: 500 };
batch(
  'insert into public.districts (slug, name_th, sort_order, center, radius_m, priority, source, osm_id) values',
  osm.map((o) => `(${q('osm-' + o.osm_id)}, ${q(o.name_th)}, 1000, ${pt(o.lat, o.lng)}, ${RAD[o.place]}, ${PRIO[o.place]}, 'OSM', ${q(o.osm_id)})`),
);
L.push('');
L.push('-- ย่านผูกกับอำเภอ/จังหวัดตามจุดกลาง');
L.push(`update public.districts d set amphoe_code = t.amphoe_code, province_th = p.name_th
  from public.tambons t
  join public.amphoes a on a.code = t.amphoe_code
  join public.provinces p on p.code = a.province_code
 where d.center is not null
   and t.code = public.tambon_at(extensions.st_y(d.center::extensions.geometry), extensions.st_x(d.center::extensions.geometry));`);
L.push('');
fs.writeFileSync(OUT, L.join('\n'));
console.log('written', (fs.statSync(OUT).size / 1e6).toFixed(2), 'MB');
