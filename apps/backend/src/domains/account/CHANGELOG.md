# account — ประวัติการแก้ไข

## 2026-10-21 — พื้นที่ที่ชอบเลือกได้ทุกระดับ
- `user_preferences.preferred_area_codes text[]` เก็บรหัสจังหวัด/อำเภอ/ตำบล (ย่านยังอยู่ `preferred_district_ids`) · `app_update_profile` รับ `area_codes` (ตรวจรูปแบบ → `INVALID_AREA_CODES`) · `run_retention_jobs` ล้างค่านี้ด้วย
- migration `20261021000500_account_preferred_areas`

## 2026-10-21 — แจ้งเตือนถูกลบตามเมื่อลบร้าน/การจอง
- FK `notifications.bar_id` / `booking_id` เปลี่ยนเป็น `on delete cascade` (เดิม `set null` ทำให้แถวค้างในกระดิ่ง) — ไม่ต้องตามล้างแบบ `…000300` อีก
- migration `20261021000400_account_notifications_cascade` · ทดสอบกับ Postgres ในเครื่อง: ลบร้านแล้วแจ้งเตือนของร้านหาย แจ้งเตือนอื่นอยู่ครบ

## 2026-10-21 — ล้างแจ้งเตือนที่ค้างจากร้าน/การจองที่ถูกลบ
- ลบร้านเดโม (`…20261020000100`) ไม่ได้ลบ `notifications` และ FK `bar_id`/`booking_id` เป็น `on delete set null` → แจ้งเตือนเดิมค้างในกระดิ่งพร้อมลิงก์ที่เปิดไม่ได้
- migration `20261021000300_account_notifications_orphan_cleanup` ลบครั้งเดียวเฉพาะแถวที่เป้าหมายไม่มีแล้ว (ลิงก์ร้านที่ `bar_id` ว่าง · การจอง/ลิงก์แชร์/ร้านในลิงก์ที่ไม่มีแล้ว) — ทดสอบกับ Postgres ในเครื่อง: ลบ 7 แบบที่ค้าง เก็บ 6 แบบที่ไม่เคยผูกร้าน/การจอง

## 2026-10-21 — แจ้งเตือนของร้านอื่นโผล่ในโหมดร้าน
- `GET /me/overview` ส่ง `bar_id` ของแจ้งเตือนเพิ่ม ให้หน้าเว็บกรองแจ้งเตือนร้านตามร้านที่กำลังจัดการได้ (`account.me.controller.ts`)

## 2026-10-21 — เลิกใช้ " · " คั่นข้อความที่ผู้ใช้เห็น (ส่วนที่เหลือ)
- ข้อความแจ้งเตือนแบนบัญชี/ลบรูปโปรไฟล์: `admin_ban_user` `admin_remove_user_avatar`
- migration `20261021000200_notify_text_no_dots` ประกาศฟังก์ชันตัวล่าสุดซ้ำทั้งตัว เปลี่ยนเฉพาะสตริงที่มีตัวคั่นเป็นวรรค (ตรวจแล้ว 29 ฟังก์ชันต่างกันแค่ข้อความ/คอมเมนต์ · แจ้งเตือนที่ส่งไปแล้วไม่แก้ย้อนหลัง)

## 2026-10-20 — เปลี่ยนชั้นบัญชีเป็นร้าน/พนักงานต้องมีร้าน
- `admin_set_user_role` ไม่ให้ตั้ง MERCHANT ถ้าบัญชียังไม่เป็นเจ้าของ/ผู้จัดการในทีมร้าน และไม่ให้ตั้ง STAFF ถ้ายังไม่อยู่ในทีมร้าน → `ROLE_NEEDS_BAR` (เดิมสร้างบัญชีชั้นร้านที่ไม่มีข้อมูลร้านได้)
- migration `20261020000200_account_role_requires_bar` · `account.admin.controller.ts` (@ApiDoc ของ `PATCH /admin/users/roles`)

## 2026-10-17 — สีของชั้นบัญชีจาก DB (นอก MVP — อนุมัติ 2026-10-17)
- migration `20261017000100_account_role_colors`: คอลัมน์ `roles.color` (#RRGGBB · ค่าตั้งต้น = สีเดิมของเว็บลูกค้า) + rpc `admin_save_role_colors` (Super Admin · ส่งเฉพาะชั้นที่แก้ · audit `role.color` · `INVALID_ROLE_COLORS`)
- endpoint ใหม่: `GET /me/roles` (ผู้ที่ล็อกอิน — ชื่อ + สีของทุกชั้น ให้ navbar และ /profile) · `PUT /admin/roles/colors` (`SuperAdminGuard`) · `GET /admin/roles` ส่ง `color` เพิ่ม
- ไฟล์: `account.me.controller.ts` · `account.admin.controller.ts` · `account.dto.ts` (`SaveRoleColorsDto`)

## 2026-10-16 — รูปโปรไฟล์ (นอก MVP — อนุมัติ 2026-10-16)
- `GET /me/profile` ตอบ `avatar_url` เพิ่ม · `PUT /me/avatar` `{path}` (rpc `app_set_avatar` — ตรวจ path ในโฟลเดอร์ตัวเอง + มีไฟล์จริง) · `DELETE /me/avatar` (rpc `app_remove_avatar`) · `POST /admin/users/:id/avatar/remove` `{reason}` (rpc `admin_remove_user_avatar` · audit + แจ้งเจ้าของ)
- `AccountAvatarService`: เรียก rpc แล้วลบไฟล์เก่าใน `removed_paths` จาก bucket `avatars` (แบบเดียวกับ mini-ads)
- migration `20261016000100_account_avatar`: `users.avatar_path` · bucket `avatars` + policy · 3 ฟังก์ชัน · view `admin_users` + `avatar_url`
- ไฟล์: `account-avatar.service.ts` (ใหม่) · `account.me.controller.ts` · `account.admin.controller.ts` · `account.dto.ts` · `account.module.ts`

## 2026-10-16 — แจ้งเตือนของคนอื่นโผล่ในกล่องแจ้งเตือน (บัญชีแอดมิน)
- `GET /me/overview` อ่าน `notifications` และ `review_reports` โดยไม่กรองเจ้าของ → บัญชีที่เป็นแอดมินได้แถวของทุกคนผ่าน policy `admin_read` (เช่น เจ้าของร้านที่เป็นแอดมินด้วยเห็นแจ้งเตือนการจองร้านอื่น) · เพิ่ม `user_id=eq.<me>` / `reporter_id=eq.<me>` (`account.me.controller.ts`)

## 2026-10-15 — สมัคร / เข้าสู่ระบบด้วย Google และ Facebook (ยืนยันอายุจากวันเกิดของบัญชี)
- ล็อกอิน OAuth ครั้งแรกยังไม่สร้างบัญชี: backend ดึงวันเกิดจาก Google People API / Facebook Graph เอง (ผู้ใช้แก้ไม่ได้ · ตรวจว่า token เป็นของบัญชีที่ล็อกอิน) → วันเกิดครบ + อายุ 20+ พักไว้ใน `app_metadata` ของ Auth 30 นาทีรอผู้ใช้ยอมรับ ToS + PDPA · ไม่มีวันเกิด/ปีเกิด หรืออายุ < 20 = ลบบัญชี Auth (ไม่สร้างบัญชี)
- endpoint ใหม่ `POST /me/oauth-signup/verify` · `POST /me/oauth-signup/complete` (rpc `app_complete_oauth_signup` · วิธียืนยันอายุ = GOOGLE / FACEBOOK) · `DELETE /me/oauth-signup` (ไม่ยอมรับ = ลบบัญชี Auth ที่ยังไม่มีโปรไฟล์)
- migration `20261015000100_account_oauth_age_method` (enum) · `20261015000200_account_oauth_signup` (`handle_new_auth_user` ข้ามบัญชี OAuth · `app_create_customer_profile` ใช้ร่วมกับสมัครด้วยอีเมล · `app_complete_oauth_signup`)
- ไฟล์: `account-oauth.service.ts` (ใหม่), `account.me.controller.ts`, `account.dto.ts`, `account.module.ts`, `supabase/supabase.service.ts` (`getAuthUserById` · `updateAuthAppMetadata`)

## 2026-10-13 — แบน / ปลดแบนบัญชีเองพร้อมเหตุผล
- endpoint ใหม่ `POST /admin/users/:id/ban` `{reason, ban_phones?}` → rpc `admin_ban_user` (ลูกค้า + บัญชีทีมร้าน · แบนตัวเอง/บัญชีทีมงานไม่ได้ · ถูกแบน = จองไม่ได้ + ชุมชนอ่านอย่างเดียว · การจองเดิม/ร้านไม่ถูกแตะ · audit + แจ้งเจ้าของบัญชี)
- `POST /admin/users/:id/unban` เหตุผลบังคับแล้ว (ส่ง `p_reason` ตรง ไม่แปลงเป็น null) · ปลดได้ทั้งแบนเองและแบนอัตโนมัติจากสลิปปลอม
- `GET /me/profile` คืน `ban_reason` เพิ่ม (หน้าเว็บแสดงเหตุผลในแถบแจ้ง/หน้าจอง)
- migration `20261013001000_account_manual_ban` (`admin_ban_user` · แทนที่ `admin_unban_user` · trigger `community_block_banned` บน 7 ตารางเขียนของชุมชน)
- ไฟล์: `account.admin.controller.ts`, `account.dto.ts` (`BanUserDto`), `account.me.controller.ts`

## 2026-10-12 — บันทึกชั้นบัญชีหลายคนครั้งเดียว
- ใหม่ `PATCH /admin/users/roles` `{ changes: [{ id, role }] }` (`admin_set_users_role` → `admin_set_user_role` ทีละคน · Super Admin · ธุรกรรมเดียว) — ประกาศก่อน `PATCH /admin/users/:id` กัน "roles" ถูกจับเป็น id · ลบ `PATCH /admin/users/:id/role`
- `POST /admin/users/:id/unban` คงเดิม (ข้อยกเว้นที่บันทึกทันที)
- migration `20261012000300_account_set_users_role` · ไฟล์: `account.admin.controller.ts` · `account.dto.ts` (`SetUsersRoleDto` แทน `SetUserRoleDto`) · เทสต์ `test/app.test.ts`
