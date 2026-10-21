# CHANGELOG — admin/modules/users

## 2026-10-21 — เลิกใช้ " · " คั่นข้อความที่ผู้ใช้เห็น (ส่วนที่เหลือ)
- กติกาหลายข้อที่เดิมต่อเป็นประโยคยาว แยกเป็นรายการ 1 ข้อ 1 บรรทัดด้วย `RuleList` ใหม่ (`ui/components/RuleList.tsx` · ไอคอน info / check / warn): ผลของการแบน (หัวข้อสั้น + รายการ)
- ข้อความในหน้า (หัวข้อ Drawer คำอธิบาย ป้าย ข้อความสำเร็จ) เปลี่ยนจากต่อด้วย " · " เป็นประโยค วงเล็บ หรือคำเชื่อม (และ / โดย / เมื่อ) · ชื่อ + จำนวนคน = "สมชาย (4 คน)" · ไม่เปลี่ยนพฤติกรรม
- ไฟล์: หน้าและคอมโพเนนต์ในโมดูลนี้ที่เคยมี " · " ในข้อความ

## 2026-10-16 — ลบรูปโปรไฟล์ไม่เหมาะสม
- คอลัมน์ชื่อแสดงรูปโปรไฟล์ (ไม่มีรูป = ตัวย่อชื่อ) · ปุ่ม "ลบรูปโปรไฟล์" (เฉพาะบัญชีที่มีรูป) → Modal เห็นรูป + เหตุผล 3–300 บังคับ (เจ้าของบัญชีเห็นในแจ้งเตือน · audit) · คอลัมน์จัดการกว้างขึ้นเป็น 180
- ไฟล์: `page.tsx` · `api.ts` (`removeUserAvatarAction`) · `modal/removeAvatarModal.tsx` (ใหม่) · endpoint `POST /admin/users/:id/avatar/remove`

## 2026-10-13 — แบน / ปลดแบนเองพร้อมเหตุผล
- คอลัมน์ "สถานะบัญชี" (เดิม "การจอง"): ถูกแบน = ป้ายแดง + วันที่ (tooltip เหตุผล) + ปุ่ม "ปลดแบน" · ไม่ถูกแบน = ป้ายเดิม + ปุ่ม "แบน" (ไม่แสดงกับบัญชีที่ลบแล้ว / ตัวเอง / ชั้นบัญชีที่เข้า Backoffice)
- ใหม่ `modal/banUserModal.tsx`: เหตุผล 3–300 (เจ้าของบัญชีเห็น) · ติ๊กแบนทุกเบอร์ที่เคยใช้ · เตือนเมื่อบัญชีอยู่ในทีมร้าน (ไม่ระงับร้าน) · ใหม่ `modal/unbanUserModal.tsx` (แทน `modal.confirm` เดิม · เหตุผลบังคับ) · error จาก server คง modal ไว้
- `api.ts` + `banUserAction` (`POST users/:id/ban`) · `unbanUserAction` (body บังคับ) · ป้าย Audit Log (`ui/utils/labels.ts`): `user.ban` · `user.unban`
- endpoint/migration: `POST /admin/users/:id/ban` · `20261013001000_account_manual_ban`
- ไฟล์: `page.tsx`, `api.ts`, `modal/banUserModal.tsx`, `modal/unbanUserModal.tsx`

## 2026-10-13 — คำอธิบายบทบาทผู้จัดการร้าน
- "ผู้จัดการร้าน — จัดการร้านได้ ยกเว้นบัญชีรับเงิน" ไม่ตรง requirement → "จัดการร้านได้ รวมบัญชีรับเงิน (เชิญ/นำออกเจ้าของไม่ได้)" · ไฟล์: `modal/createUserModal.tsx`

## 2026-10-12 — ชั้นบัญชีแก้ก่อน แล้วกดบันทึกครั้งเดียว
- เลือกชั้นบัญชีในตารางได้หลายคน (Super Admin) แก้แค่ในหน้า (ป้าย "ยังไม่บันทึก" · เลือกกลับเป็นค่าเดิมไม่นับ) แล้วกด "บันทึก" ที่หัวหน้า → หน้าต่างยืนยันรวม 1 ครั้ง แสดงทุกคนที่เปลี่ยน + ผลกระทบ (หลุดจากร้านไหน / เข้าหลังบ้านได้ / บัญชีของตัวเอง) · "คืนค่า" ทิ้งการแก้
- ระหว่างบันทึก / ปลดแบน / ลบ ปุ่มในตารางล็อก · บันทึกพลาด = การแก้ยังอยู่ · ออกจากหน้าตอนยังไม่บันทึก = ถามก่อน
- ปลดแบน · ลบบัญชี · เพิ่ม/แก้ผ่าน modal ยังบันทึกทันที (ข้อยกเว้น)
- endpoint ใหม่ `PATCH /admin/users/roles` (`admin_set_users_role` · migration `20261012000300_account_set_users_role`) แทน `PATCH /admin/users/:id/role`
- ไฟล์: `page.tsx` · `utils/useRoleDraft.ts` (ใหม่ — draft + `roleNotes`) · `api.ts` (`setUsersRoleAction` แทน `setUserRoleAction`)

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useUsers` · `useBars` · `useAccountRoles` · `createUserAction` · `updateUserAction` · `deleteUserAction` · `setUserRoleAction` · `unbanUserAction` — ชื่อ view / path / body ของหน้านี้ย้ายมาอยู่ที่เดียว (เดิมเขียนในหน้าผ่าน `useAdminView('admin_x', …)` / `act.mutate({ method, path, body })`) · body มี type จาก `@nightout/contracts`
- หน้า / form / modal ของโมดูลเรียกผ่าน `./api` · พฤติกรรมเดิม (query key, ข้อความแจ้งผล, invalidate `['admin']`)
