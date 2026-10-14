# bar — ประวัติการแก้ไข

## 2026-10-13 — แอดมินแก้ข้อมูลร้าน + เมนู/ราคาแทนร้าน
- endpoint ใหม่ `PUT /admin/bars/:id/details` `{info?, menu?}` → `BarMediaService.saveAdminDetails()` → rpc `admin_save_bar_details` (ธุรกรรมเดียว · `info` เฉพาะ field ที่แก้ — ไม่มีที่อยู่/หมุด · `menu` ทั้งชุด รูปเมนูคงเดิม · ไฟล์รูปของรายการที่เอาออก backend ลบจาก Storage ผ่าน `cleanup()` เดิม · audit ต่อส่วน + แจ้งทีมร้าน 1 ครั้ง `BAR_EDITED_BY_ADMIN`)
- migration `20261013001010_bar_admin_edit_details` (`admin_save_bar_details` · helper `bar_info_apply` / `bar_menu_apply` · view `admin_bar_details`) — เปลี่ยนสไตล์แทนร้านแตะเฉพาะสไตล์ที่แสดงอยู่ (ลิงก์ไปสไตล์ที่ซ่อนไม่หาย)
- ไฟล์: `bar.admin.controller.ts`, `bar.dto.ts` (`AdminBarDetailsDto`), `bar-media.service.ts`, `bar.module.ts` (doc comment)

## 2026-10-13 — ลงพื้นที่ตรวจ Safety (Inspector) + แยกวิธีตรวจ (หลักฐาน / ลงพื้นที่)
- endpoint ใหม่ `POST /admin/bars/:id/safety-inspections` (`bar.admin.controller.ts` · DTO `SafetyInspectionDto` · rpc `admin_inspect_safety`) — แอดมินทุกคนบันทึกผลลงพื้นที่ 1 ครั้ง: ผ่าน → "มี" / ไม่พบ → "ไม่มี" (ADMIN_VERIFIED + `verify_method = ON_SITE`) / ไม่ได้ตรวจ → ไม่เปลี่ยน + หมายเหตุ + รูป ≤ 3 ต่อข้อ · บันทึกชื่อผู้ตรวจ + วันเวลา (แก้ไม่ได้ ตรวจใหม่ได้ · ย้อนได้ ≤ 30 วัน) · คิด Safety Score ใหม่ · ปิดรายงานจากลูกค้า · audit `safety.inspect` · แจ้งเจ้าของ/ผู้จัดการ `SAFETY_INSPECTED`
- endpoint ใหม่ `GET /merchant/bars/:barId/safety/inspection` (`bar.merchant.controller.ts` · rpc `bar_safety_inspection_latest` ในนามผู้เรียก) — ผลลงพื้นที่ล่าสุด ไม่มีชื่อผู้ตรวจ · ไม่ใช่เจ้าของ/ผู้จัดการ = `null`
- **คง** `POST /admin/safety/:id/verify` (ปุ่ม "ยืนยันแล้ว" = ตรวจจากหลักฐาน — owner override 2026-10-13) · `admin_verify_safety` ตัวใหม่บันทึก `verify_method = EVIDENCE` · ยืนยันได้เฉพาะข้อ SELF_DECLARED + YES ที่แนบหลักฐาน (ตรวจแล้ว/ร้านเปลี่ยนค่า → 409 `SAFETY_ALREADY_VERIFIED` · ไม่มีหลักฐาน → 400 `SAFETY_EVIDENCE_REQUIRED`) · ไม่ทับผลลงพื้นที่
- error ใหม่ `INSPECTOR_IS_BAR_MEMBER` (403 · แอดมินที่อยู่ในทีมร้าน รวมคำเชิญค้าง ตรวจ/ยืนยันร้านตัวเองไม่ได้) · `INVALID_INSPECTION` / `INVALID_INSPECTION_PHOTO` / `INVALID_INSPECTION_TIME` (400)
- migration `20261013000800_bar_safety_inspections`: enum `safety_verify_method` + `bar_safety_features.verify_method` (แถว ADMIN_VERIFIED เดิม = EVIDENCE · trigger `bar_safety_features_verify_method` ล้างค่าเมื่อร้านแก้เอง) · ตาราง `safety_inspections` / `safety_inspection_items` · `safety_inspection_photo_ok` · view `admin_safety_queue` (+ คอลัมน์) / `admin_bar_safety` / `admin_safety_inspections` · `bar_detail` / `my_bar_detail` (`safety[]` + `verify_method` · คอลัมน์เดิม) · storage `bar-verifications`: แอดมินเขียนได้เฉพาะ `<bar_id>/inspections/` · ทีมร้านเขียนโฟลเดอร์นั้นไม่ได้
- deploy: migration นี้ไม่ลบฟังก์ชันใด (เก็บ `admin_verify_safety` ไว้) → `db:push` ก่อนหรือพร้อม merge `demo → main` ได้ · แล้วรัน `db:types`
- ไฟล์: `bar.admin.controller.ts`, `bar.merchant.controller.ts`, `bar.dto.ts`, `bar.module.ts` (docblock) · เทสต์ `test/app.test.ts` (ไม่มี token → 401)

## 2026-10-13 — Blacklist ร้าน + ข้อร้องเรียน "ร้านไม่มีโต๊ะ"
- endpoint ใหม่ (`bar.admin.controller.ts`): `POST /admin/bars/:id/blacklist` `{reason}` (rpc `admin_blacklist_bar`) · `POST /admin/bars/:id/blacklist/lift` `{reason}` (rpc `admin_unblacklist_bar` → กลับมาแสดง APPROVED) · `POST /admin/bar-strikes` `{booking_code, note}` (rpc `admin_report_no_table` — ลูกค้าร้องเรียน: บันทึกแทนร้าน + Override คืน Table Fee) · DTO `BarBlacklistDto` · `AdminReportNoTableDto` (`bar.dto.ts`)
- migration `…20261013000700_bar_blacklist_strikes`: `bars.blacklisted_at` / `blacklisted_by` / `blacklist_reason` · ตาราง `bar_strikes` (แอดมินอ่านเท่านั้น) · trigger ใหม่ `bars_blacklist_guard` (ติด Blacklist เปลี่ยน status / status_reason ทางอื่นไม่ได้ → `BAR_BLACKLISTED`) · `bars_owner_blacklist_notify` (เจ้าของที่มีร้านติด Blacklist สมัครร้านใหม่ → แจ้งแอดมิน) · แทนที่ `handle_bar_status_notify` (trigger `bars_status_notify` — ไม่แจ้งทีมร้านซ้ำตอน Blacklist / ปลด) · view `admin_bar_blacklist`
- Blacklist = SUSPENDED + `blacklisted_at` → ร้านหายจากหน้าบ้านและจองใหม่ไม่ได้ทันที (ทุกทางอ่านกรอง APPROVED อยู่แล้ว) · การจองเดิมยังอยู่ · เหตุผลบังคับ (ร้านเห็น) + audit + แจ้งทีมร้าน · NightOut ปรับเงินร้านไม่ได้
- เทสต์ 401 ใน `test/app.test.ts`

## 2026-10-13 — ตำแหน่งร้าน (หมุด) + แอดมินตรวจหมุด
- migration `20261013000600_bar_location_pins`: `bars` + ที่จอดรถ / รถไฟฟ้าใกล้สุด / `location_reviewed_at|by` · ตาราง `bar_location_requests` (ค้างได้ 1 คำขอ/ร้าน + แถวประวัติเมื่อแอดมินตั้งแทน) · ฟังก์ชันใหม่ `app_request_bar_location` · `app_cancel_bar_location_request` · `admin_review_bar_location` · `admin_set_bar_location` (+ helper `bar_location_from_json` / `bar_location_snapshot` / `bar_location_apply`) · แทนที่ `app_merchant_join` (ต้องปักหมุด — เลิกใส่ 13.7563, 100.5018 ให้ทุกร้าน) · `admin_set_bar_status` (อนุมัติร้านใหม่ = ตรวจหมุด · หมุดค่าเริ่มต้นเดิม → `BAR_LOCATION_NOT_SET`) · `app_update_bar_info` (ไม่แก้ `address`) · view `bar_detail` / `my_bar_detail` + คอลัมน์ท้าย · view `admin_bar_locations` / `admin_bar_location_requests`
- endpoint ใหม่: `PUT /merchant/bars/:barId/location` (เจ้าของ/ผู้จัดการ · ร้านที่แสดงอยู่ = คำขอรอแอดมินตรวจ ระหว่างรอลูกค้าเห็นหมุดเดิม · ร้านที่ยังไม่แสดง = บันทึกทันที) · `DELETE /merchant/bars/:barId/location-request` · `POST /admin/bar-location-requests/:id/review` (อนุมัติ / ปรับหมุดแล้วอนุมัติ / ตีกลับพร้อมเหตุผล) · `PUT /admin/bars/:id/location` (ตั้งแทนร้าน มีผลทันที) · ทุกการกระทำ audit + แจ้งทีมร้าน/แอดมิน
- ค้นหาที่อยู่: `GET /geocode/search` · `GET /geocode/reverse` (ต้องล็อกอิน · 30 ครั้ง/นาที/IP) → `GeocodeService` (`geocode.service.ts` ใหม่) เป็นตัวกลางไป OSM Nominatim เฉพาะไทย · cache 24 ชม. · ≤ 1 ครั้ง/วินาที + คิวจำกัด (เกิน = `GEOCODER_BUSY`) · ล่ม = `GEOCODER_UNAVAILABLE` (503 ทั้งคู่ เพราะ 429 ถูกแปลงเป็น `TOO_MANY_REQUESTS`) — ADR 0009
- env ใหม่ (`src/config/env.ts` + `.env.example`): `GEOCODER_URL` · `GEOCODER_USER_AGENT` · `GEOCODER_EMAIL` · `GEOCODER_MIN_INTERVAL_MS` (มีค่าเริ่มต้นทุกตัว)
- `@ApiDoc` ของ `POST /merchant/join` · `PATCH …/info` · `PUT …/store` · `PATCH /admin/bars/:id/status` บอกกติกาหมุดใหม่
- ไฟล์: `bar.me.controller.ts` · `bar.merchant.controller.ts` · `bar.admin.controller.ts` · `bar.dto.ts` · `bar.module.ts` · `geocode.service.ts` · เทสต์ `geocode.service.test.ts` + `test/bar-location.test.ts` (401 ทุกเส้นเมื่อไม่มี token)

## 2026-10-13 — โปรของร้านเดโมไม่ใช่แอลกอฮอล์
- migration `20261013000400_bar_promotions_no_alcohol` แก้โปรของร้านเดโมที่ข้อความตรงกับ seed เดิมทุกตัวอักษร ("โปรเบียร์ก่อน 2 ทุ่ม", "ค็อกเทลแก้วแรกฟรี") — โปรที่ร้านตั้งเองไม่ถูกแตะ
- ตัวอย่างใน `@ApiDoc` ของ `PUT …/promotions` ไม่ใช้เบียร์ · comment เรื่องบัญชีรับเงินให้ตรง requirement (เจ้าของ/ผู้จัดการแก้ได้)
- ไฟล์: `bar.merchant.controller.ts`

## 2026-10-12 — บันทึกหน้าตั้งค่าการจองครั้งเดียว
- ใหม่ `PUT /merchant/bars/:barId/settings` `{ booking?, payout? }` (`app_save_settings_page` · เลขบัญชีเข้ารหัสที่ API เหมือนเดิม) · ลบ `PATCH …/booking-settings` และ `PUT …/payout-account`
- migration `20261012000700_bar_save_settings_page` · ไฟล์: `bar.merchant.controller.ts` · `bar.dto.ts` (`SettingsPageDto`) · เทสต์ `test/app.test.ts`

## 2026-10-12 — บันทึกหน้าโปรโมชันครั้งเดียว
- ใหม่ `PUT /merchant/bars/:barId/promotions-page` `{ items?, fees? }` (`app_save_promotions_page` → `app_set_bar_promotions` + `app_set_fees` ในธุรกรรมเดียว) · เส้นเดิม `PUT …/promotions` / `PUT …/fees` คงไว้
- migration `20261012000500_bar_save_promotions_page` · ไฟล์: `bar.merchant.controller.ts` · `bar.dto.ts` (`PromotionsPageDto`)

## 2026-10-12 — บันทึกหน้า Safety ครั้งเดียว
- ใหม่ `PUT /merchant/bars/:barId/safety` `{ items: [{ key, value?, evidence_path? }] }` (`app_save_safety`) · ลบ `PUT …/safety/:key` และ `PUT …/safety/:key/evidence`
- migration `20261012000400_bar_save_safety` · ไฟล์: `bar.merchant.controller.ts` · `bar.dto.ts` (`SaveSafetyDto` แทน `SafetyDto` / `EvidenceDto`) · เทสต์ `test/app.test.ts`

## 2026-10-12 — endpoint บันทึกทั้งหน้าครั้งเดียว
- ใหม่ `PATCH /admin/bars/status` (`admin_set_bars_status`) — แสดง ↔ ระงับหลายร้านในธุรกรรมเดียว · `PATCH /admin/bars/:id/status` เหลือไว้ให้หน้า `/merchants` อนุมัติร้าน
- `PUT /admin/bars/:id/media` body ใหม่ `{ gallery?, menu_images? }` (`admin_save_bar_media`) · ลบ `PUT /admin/menu-items/:id/image`
- ใหม่ `POST /admin/bars/:id/media/discard` `{ paths }` — ลบไฟล์ที่อัปโหลดแต่บันทึกไม่สำเร็จ (เฉพาะไฟล์ที่ไม่มีแถวไหนอ้าง · `BarMediaService.discard`)
- ใหม่ `PUT /merchant/bars/:barId/store` `{ info?, media? }` (`app_save_bar_store`) · เส้นเดิม `PATCH …/info` และ `PUT …/media` คงไว้
- `BarMediaService`: เพิ่ม `saveStore` / `saveAdmin` · ลบ `setMenuItemImage` (สร้าง URL ปก + ลบ `removed_paths` จาก Storage เหมือนเดิม)
- migration `20261012000100_bar_save_page_batch` · ไฟล์: `bar.admin.controller.ts` · `bar.merchant.controller.ts` · `bar.dto.ts` · `bar-media.service.ts` · เทสต์ `test/app.test.ts`

## 2026-10-09 — รูปร้าน + รูปเมนู
- endpoint ใหม่: `PUT /merchant/bars/:barId/media` (`app_set_bar_media`) · `PUT /admin/bars/:id/media` (`admin_set_bar_media`) · `PUT /admin/menu-items/:id/image` (`admin_set_menu_item_image`) · `PUT …/menu` รับ `image_path` ต่อรายการ
- `BarMediaService` (ใหม่): สร้าง URL public ของรูปปก (DB ไม่รู้โดเมน Storage) · หลังเขียนลบไฟล์ใน `removed_paths` ออกจาก bucket `bar-media` แล้วไม่ส่ง `removed_paths` กลับหน้าเว็บ
- migration `20261009000100_bar_media_images`: storage policy แอดมินเขียน `bar-media` · `bar_media_path_ok` / `bar_media_unused` / `bar_media_save` / `menu_image_check` · `app_set_menu` ตัวใหม่ · `my_bar_detail` + `media` · view `admin_bar_media`
- `SupabaseService.removeObjects` (ลบไฟล์ด้วย service_role · ล้มไม่ทำให้งานหลักล้ม) · `publicUrl` ใช้ `storagePublicUrl` จาก `@nightout/utils`
- ไฟล์: `bar-media.service.ts` · `bar.merchant.controller.ts` · `bar.admin.controller.ts` · `bar.dto.ts` · `bar.module.ts` · `supabase/supabase.service.ts` · เทสต์ใน `test/app.test.ts`

## 2026-10-08 — ตัด Editor's Pick
- ลบ endpoint `PATCH /admin/bars/:id/editor-pick` และ `SetEditorPickDto`
- migration ใหม่ `20261008000400_bar_drop_editor_pick.sql`: ลบ `bar_stats.is_editor_pick` · ตาราง `editor_picks` · `admin_set_editor_pick` · drop + สร้างใหม่ `bar_cards`, `bar_detail`, `my_favorites`, `search_bars`, `nearby_bars`, `my_bar_detail`, `admin_bars` (สิทธิ์เดิม) · `admin_bars` + `promoted_until`
- seed: `scripts/seed-from-mock.ts` + `supabase/seed.sql` ไม่เขียน editor pick แล้ว
- ไฟล์: `bar.admin.controller.ts`, `bar.dto.ts`, `bar.module.ts`
