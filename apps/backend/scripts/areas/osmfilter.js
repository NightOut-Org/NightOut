// กรองชื่อย่านจาก OSM → [{osm_id, name_th, place, lat, lng, radius_m}]
const fs = require('fs');
const [, , src, seedPath, out] = process.argv;
const els = JSON.parse(fs.readFileSync(src, 'utf8')).elements;
const seeds = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const THAI = /[฀-๿]/;
const BAD = /^(ชุมชน|หมู่บ้าน|โครงการ|คอนโด|หอพัก|แฟลต|อาคาร|ซอย|ตลาด|นิคม|เคหะ|การเคหะ|ศูนย์|วัด|โรง|มหาวิทยาลัย|สถาน|ค่าย)/;
const RADIUS = { suburb: 2500, quarter: 1500, neighbourhood: 900 };
const RANK = { suburb: 3, quarter: 2, neighbourhood: 1 };
const dist = (a, b) => {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
let rows = [];
const why = {};
for (const e of els) {
  const t = e.tags || {};
  let name = (t['name:th'] || (THAI.test(t.name || '') ? t.name : '') || '').trim();
  const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon;
  const skip = (k) => (why[k] = (why[k] || 0) + 1);
  if (!name) { skip('no-thai'); continue; }
  name = name.replace(/\s+/g, ' ');
  if (/[A-Za-z]/.test(name)) { skip('latin'); continue; }
  if (BAD.test(name)) { skip('bad-prefix'); continue; }
  if (name.includes(' ')) { skip('space'); continue; }
  if (name.length < 2 || name.length > 30) { skip('len'); continue; }
  if (lat == null) { skip('nocoord'); continue; }
  rows.push({ osm_id: `${e.type[0]}${e.id}`, name_th: name, place: t.place, lat: +lat.toFixed(5), lng: +lng.toFixed(5), radius_m: RADIUS[t.place] });
}
// ตัดซ้ำ: ชื่อเดียวกันห่างกัน < 3 กม. เหลือตัวที่ระดับใหญ่กว่า · ตัดที่ซ้ำกับย่านตั้งต้น (SEED)
rows.sort((a, b) => RANK[b.place] - RANK[a.place]);
const kept = [];
for (const r of rows) {
  if (seeds.some((s) => (s.name_th === r.name_th || r.name_th.startsWith(s.name_th) || s.name_th.startsWith(r.name_th)) && dist(s, r) < 4000)) { why['dup-seed'] = (why['dup-seed'] || 0) + 1; continue; }
  if (kept.some((k) => k.name_th === r.name_th && dist(k, r) < 3000)) { why['dup'] = (why['dup'] || 0) + 1; continue; }
  kept.push(r);
}
kept.sort((a, b) => a.osm_id.localeCompare(b.osm_id));
fs.writeFileSync(out, JSON.stringify(kept));
console.log('in', els.length, 'kept', kept.length, why);
const c = {}; for (const k of kept) c[k.place] = (c[k.place] || 0) + 1; console.log(c);
