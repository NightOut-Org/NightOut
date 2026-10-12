# bar — ประวัติการแก้ไข

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
