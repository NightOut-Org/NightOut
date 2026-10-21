# CHANGELOG — apps/backend/src/domains/catalog

## 2026-10-21 — ค้นหาตำบล/แขวง
- ใหม่ `GET /public/tambons?q=` / `?code=` → rpc `search_tambons` (migration `20261021000100_catalog_search_tambons` · index trigram) · สูงสุด 20 รายการ
- ไฟล์: `catalog.public.controller.ts` · `catalog.dto.ts`

## 2026-10-21 — catalog ส่งรายชื่ออำเภอ/จังหวัดทั้งประเทศ
- `GET /public/catalog` เพิ่ม `amphoes` (code, name_th, province_code · 928) และ `provinces` (code, name_th · 77) · `districts` มี `sort_order` (ทีมคัดเอง < 1000) — ให้หน้าเว็บค้นพื้นที่ได้ครบแม้ยังไม่มีร้านในพื้นที่นั้น · ทุกตารางต่ำกว่า max rows 1,000 ของ PostgREST
- ไฟล์: `catalog.public.controller.ts`

## 2026-10-20 — พื้นที่ร้านครบทั้งประเทศ (หาจากหมุด)
- ใหม่ `GET /public/area?lat&lng` → rpc `area_at_point` (ตำบล/อำเภอ/จังหวัด + ย่านของพิกัด)
- `GET /public/catalog` ส่ง `areas` (view `bar_areas`) เพิ่ม · `districts` มี `province_th` เรียงตาม `sort_order` แล้วชื่อ
- migration `20261020000300_catalog_admin_areas` · `20261020000400_catalog_admin_areas_data` · `20261020000500_catalog_bar_areas` (ADR 0011) · สคริปต์สร้างข้อมูล `apps/backend/scripts/areas` · `seed.sql` ไม่มี districts แล้ว (อยู่ใน migration)
- ไฟล์: `catalog.public.controller.ts` · `catalog.dto.ts`

## 2026-10-17 — catalog ส่งไอคอนสไตล์
- `GET /public/catalog`: `styles` เพิ่ม `icon` (ชื่อไอคอน Phosphor ที่แอดมินตั้งที่ /styles) ให้หน้าโปรไฟล์แสดงไอคอนคู่ชื่อสไตล์ (`catalog.public.controller.ts`)

## 2026-10-13 — อันดับร้านจริง · จัดการสไตล์ร้าน · คำนวณดาว/อันดับ
- `GET /public/ranking?period=WEEKLY|MONTHLY&category=&limit=` → rpc `public_ranking` (อ่านในนามผู้เรียก · รอบล่าสุดของ `tier_scores` · เรียงโหวตแล้วคะแนนรวม · ไม่รวมร้านใหม่/ร้านที่ไม่แสดง · ยังไม่เคยคำนวณ = `[]`)
- ใหม่ `catalog.admin.controller.ts` (SupabaseJwtGuard + AdminGuard): `PUT /admin/styles` → rpc `admin_save_styles` (เพิ่ม/เปลี่ยนชื่อ/ไอคอน/ซ่อน/เรียงลำดับ · ลบไม่ได้) · `POST /admin/ranking/recompute` → rpc `admin_recompute_ranking` → `run_tier_scores` (ปุ่ม "คำนวณใหม่")
- ใหม่ `catalog.dto.ts` (`RankingQueryDto`, `SaveStylesDto`) · `catalog.module.ts` ลงทะเบียน controller admin + guard
- สูตร (เจ้าของตัดสิน 2026-10-13): รีวิว 50 · เช็กอิน 30 · Safety 20 · ไม่มีเช็กอิน = (รีวิว + Safety) × 100 / 70 · โฆษณาไม่มีผล · job ทุกคืน `POST /jobs/tier` อยู่ `src/jobs/jobs.controller.ts` (นอก `domains/`)
- migration `20261013001020_catalog_styles_manage` (`admin_save_styles` · view `admin_styles` · unique index ชื่อสไตล์) · `20261013001030_catalog_ranking_scores` (`run_tier_scores` · `admin_recompute_ranking` · `public_ranking` · view `admin_ranking` · pg_cron `nightout-tier` ในหัวไฟล์)
- เทสต์ `test/app.test.ts` (401 ไม่มี token / `/jobs/tier` ต้องมี job secret / `period=YEARLY` → 400) · ไฟล์: `catalog.public.controller.ts`, `catalog.admin.controller.ts`, `catalog.dto.ts`, `catalog.module.ts`
