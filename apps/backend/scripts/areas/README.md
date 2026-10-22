# ข้อมูลพื้นที่ (สร้าง migration 20261020000400)

1. ดาวน์โหลด `tha_admin_boundaries.xlsx` + `tha_admin_boundaries.shp.zip` จาก https://data.humdata.org/dataset/cod-ab-tha (OCHA · CC BY-IGO) ไว้ในโฟลเดอร์ทำงาน (นอก repo)
2. แตก xlsx แล้ว `node xlsx2json.js <xl-dir> sheet2|sheet3|sheet4 adm1|adm2|adm3.json`
3. โหลด `tha_admin3.shp` เข้า Postgres ในเครื่องด้วย ogr2ogr (อยู่ใน image supabase/postgres) เป็น `scratch_areas.adm3` แล้ว export `adm3_pcode|base64(ST_AsTWKB(ST_SimplifyPreserveTopology(geom,0.0002),4))` เป็น `tw.psv`
4. ย่าน OSM: Overpass `nwr["place"~"^(neighbourhood|suburb|quarter)$"](area TH); out center tags;` → `osm.json` → `node osmfilter.js osm.json seeds.json osm-kept.json` แล้วตัดชื่อที่ซ้ำกับอำเภอ/ตำบลเป็น `osm-final.json`
5. `node gensql.js <โฟลเดอร์ทำงาน> <migration ใหม่>.sql` (ย่านที่ทีมคัดเอง = `seeds.json`)

## ย่านเพิ่มที่ทีมคัด (extra-districts.json)
- `extra-districts.json`: ย่าน + จุดอ้างอิง (anchors) · จุดแบบ `tambon/amphoe` ใช้จุดกลางตำบลทางการ (ใช้เฉพาะตำบลที่ไม่ใหญ่/กระจายมาก) · จุดแบบ `lat/lng` ต้องยืนยันจาก OpenStreetMap (ห้าง สถานี ชุมชน) และใส่ที่มาใน `src` · `rank_m` = รัศมีตัดสินเมื่อซ้อนกัน · `densify_m` = เติมจุดระหว่าง anchor ให้ห่างไม่เกินค่านี้ (ย่านยาวเป็นแนว)
- `node resolve-extra.js <โฟลเดอร์ adm3.json> extra-resolved.json` แล้ว `node gen-extra-districts.js extra-resolved.json <migration ใหม่>.sql`
