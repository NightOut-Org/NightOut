// หา "จุดกลาง" ของแต่ละ anchor ใน extra-districts.json จากข้อมูลทางการ (OCHA adm3.json) — ไม่ใช้พิกัดจากความจำ
// ใช้: node resolve-extra.js <โฟลเดอร์ที่มี adm3.json> [ชื่อไฟล์ผล .json]
const fs = require('fs');
const path = require('path');
const D = process.argv[2];
const OUT = process.argv[3];
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'extra-districts.json'), 'utf8'));
const a3 = JSON.parse(fs.readFileSync(path.join(D, 'adm3.json'), 'utf8'));
const problems = [];
const out = spec.map((d) => ({
  ...d,
  anchors: d.anchors.map((a) => {
    if (a.lat != null && a.lng != null) return a; // จุดพิกัดตรง (ยืนยันจาก OSM แล้ว — ดูฟิลด์ src)
    const hits = a3.filter(
      (r) => r.adm3_name1.trim() === a.tambon && r.adm2_name1.trim() === a.amphoe && (!a.province || r.adm1_name1.trim() === a.province),
    );
    if (hits.length !== 1) {
      problems.push(`${d.name_th}: ตำบล${a.tambon} อ.${a.amphoe} → ${hits.length} แห่ง` + (hits.length ? ' (' + hits.map((h) => h.adm1_name1).join(', ') + ')' : ''));
      return { ...a, lat: null, lng: null };
    }
    return { ...a, lat: +(+hits[0].center_lat).toFixed(5), lng: +(+hits[0].center_lon).toFixed(5), province: hits[0].adm1_name1.trim(), tambon_code: hits[0].adm3_pcode };
  }),
}));
console.log(problems.length ? 'ปัญหา:\n' + problems.join('\n') : 'ทุก anchor หาเจอ 1 แห่ง');
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
