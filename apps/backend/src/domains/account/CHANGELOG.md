# account — ประวัติการแก้ไข

## 2026-10-12 — บันทึกชั้นบัญชีหลายคนครั้งเดียว
- ใหม่ `PATCH /admin/users/roles` `{ changes: [{ id, role }] }` (`admin_set_users_role` → `admin_set_user_role` ทีละคน · Super Admin · ธุรกรรมเดียว) — ประกาศก่อน `PATCH /admin/users/:id` กัน "roles" ถูกจับเป็น id · ลบ `PATCH /admin/users/:id/role`
- `POST /admin/users/:id/unban` คงเดิม (ข้อยกเว้นที่บันทึกทันที)
- migration `20261012000300_account_set_users_role` · ไฟล์: `account.admin.controller.ts` · `account.dto.ts` (`SetUsersRoleDto` แทน `SetUserRoleDto`) · เทสต์ `test/app.test.ts`
