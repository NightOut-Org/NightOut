# account — ประวัติการแก้ไข

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
