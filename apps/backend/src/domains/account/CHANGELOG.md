# account — ประวัติการแก้ไข

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
