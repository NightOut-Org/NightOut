# CHANGELOG — admin/modules/users

## 2026-10-12 — ชั้นบัญชีแก้ก่อน แล้วกดบันทึกครั้งเดียว
- เลือกชั้นบัญชีในตารางได้หลายคน (Super Admin) แก้แค่ในหน้า (ป้าย "ยังไม่บันทึก" · เลือกกลับเป็นค่าเดิมไม่นับ) แล้วกด "บันทึก" ที่หัวหน้า → หน้าต่างยืนยันรวม 1 ครั้ง แสดงทุกคนที่เปลี่ยน + ผลกระทบ (หลุดจากร้านไหน / เข้าหลังบ้านได้ / บัญชีของตัวเอง) · "คืนค่า" ทิ้งการแก้
- ระหว่างบันทึก / ปลดแบน / ลบ ปุ่มในตารางล็อก · บันทึกพลาด = การแก้ยังอยู่ · ออกจากหน้าตอนยังไม่บันทึก = ถามก่อน
- ปลดแบน · ลบบัญชี · เพิ่ม/แก้ผ่าน modal ยังบันทึกทันที (ข้อยกเว้น)
- endpoint ใหม่ `PATCH /admin/users/roles` (`admin_set_users_role` · migration `20261012000300_account_set_users_role`) แทน `PATCH /admin/users/:id/role`
- ไฟล์: `page.tsx` · `utils/useRoleDraft.ts` (ใหม่ — draft + `roleNotes`) · `api.ts` (`setUsersRoleAction` แทน `setUserRoleAction`)

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useUsers` · `useBars` · `useAccountRoles` · `createUserAction` · `updateUserAction` · `deleteUserAction` · `setUserRoleAction` · `unbanUserAction` — ชื่อ view / path / body ของหน้านี้ย้ายมาอยู่ที่เดียว (เดิมเขียนในหน้าผ่าน `useAdminView('admin_x', …)` / `act.mutate({ method, path, body })`) · body มี type จาก `@nightout/contracts`
- หน้า / form / modal ของโมดูลเรียกผ่าน `./api` · พฤติกรรมเดิม (query key, ข้อความแจ้งผล, invalidate `['admin']`)
