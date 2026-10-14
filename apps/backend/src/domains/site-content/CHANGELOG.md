# site-content — ประวัติการแก้ไข

## 2026-10-14 — เปลี่ยนชื่อ NightList ที่ค้างในข้อมูลเป็น NightOut
- ชื่อบัญชีใต้ QR PromptPay ยังขึ้น "NightList Co., Ltd." เพราะ migration เปลี่ยนชื่อแบรนด์ (`…20261005000100`) แก้แค่โค้ด ไม่ได้แก้ข้อมูลในตาราง
- migration `20261014000200_site_content_rename_nightout_data`: แทน NightList → NightOut ใน `platform_settings` (`deposit_promptpay` / `promotion_promptpay`) · `bars.perks` ร้านเดโม · `bar_promotions.description` · `notifications.title/body` เก่า (เฉพาะแถวที่มีคำนี้ · รันซ้ำได้)
- ไฟล์: `supabase/migrations/20261014000200_site_content_rename_nightout_data.sql`

## 2026-10-12 — บันทึกหน้าแรกครั้งเดียว
- ใหม่ `PUT /admin/home-page` `{ content?, categories?, popular? }` (`admin_save_home_page`) · ลบ `PATCH /admin/home-content` · `PATCH /admin/home-categories/:slot` · `PUT /admin/home-popular`
- migration `20261012000600_site_content_save_home_page` · ไฟล์: `site-content.admin.controller.ts` · `site-content.dto.ts` (`SaveHomePageDto`) · เทสต์ `test/app.test.ts`

## 2026-10-08 — ร้านยอดนิยมหน้าแรก
- migration ใหม่ `20261008000300_site_content_home_popular.sql`: `home_content` + `popular_eyebrow` / `popular_title` · ตาราง `home_popular_bars` · view `public_home_popular` (เฉพาะร้าน APPROVED) / `admin_home_popular` · rpc `admin_save_home_popular` · `admin_save_home_content` / `home_content_check` ตัวใหม่
- endpoint ใหม่ `PUT /admin/home-popular` `{bar_ids}` (สูงสุด 8 · ไม่ซ้ำ · แทนที่ทั้งรายการ · audit log)
- `GET /public/home` ส่ง `popular_bar_ids` และ `content.popular_eyebrow` / `popular_title` เพิ่ม
- ไฟล์: `site-content.admin.controller.ts`, `site-content.public.controller.ts`, `site-content.dto.ts`

## 2026-10-08 — ลบไอคอนของการ์ดหมวดหน้าแรก
- หน้าแรกและ Backoffice ไม่ใช้ไอคอนหมวดแล้ว จึงลบคอลัมน์ `home_categories.icon` ออกจาก DB
- migration ใหม่ `20261008000100_site_content_drop_category_icon.sql`: drop คอลัมน์ · สร้าง view `public_home_categories` / `admin_home_categories` ใหม่ (สิทธิ์เดิม) · `home_category_check` / `admin_save_home_category` ไม่ตรวจ/ไม่เขียน icon
- `GET /public/home` ไม่ส่ง `icon` ใน `categories` แล้ว · `PATCH /admin/home-categories/:slot` ไม่รับ `icon`
- ไฟล์: `site-content.public.controller.ts`
