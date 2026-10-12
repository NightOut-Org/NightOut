# CHANGELOG — team (จัดการทีมงาน /team)

## 2026-10-12 — ลำดับ + แสดงบนเว็บ แก้ก่อน แล้วกดบันทึกครั้งเดียว
- ลากเรียงลำดับ (Super Admin) และสลับ "แสดงบนเว็บ" แก้แค่ในหน้า (หัวคอลัมน์ "ลำดับ*" / ป้าย "ยังไม่บันทึก") แล้วกด "บันทึก" ที่หัวหน้าครั้งเดียว · "คืนค่า" ทิ้งการแก้ · เพิ่ม/แก้รายคน (Drawer) และลบ ยังบันทึกทันทีเหมือนเดิม
- ระหว่างบันทึกหรือกำลังลบ ตารางล็อก (ลาก/สวิตช์/แก้/ลบ disabled) · บันทึกพลาด = การแก้ยังอยู่ · ออกจากหน้าตอนยังไม่บันทึก = ถามก่อน
- endpoint ใหม่ `PATCH /admin/team-members` (`admin_save_team_page` · migration `20261012000200_site_team_save_page`) แทน `PUT /admin/team-members/order` และ PATCH `active` ทีละแถว
- ไฟล์: `page.tsx` · `utils/useTeamDraft.ts` (ใหม่ แทน `utils/useTeamOrder.ts`) · `api.ts` (`saveTeamPageAction` แทน `reorderTeamAction`)

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useTeamMembers` · `createTeamMemberAction` · `updateTeamMemberAction` · `deleteTeamMemberAction` · `reorderTeamAction` — ชื่อ view / path / body ของหน้านี้ย้ายมาอยู่ที่เดียว (เดิมเขียนในหน้าผ่าน `useAdminView('admin_x', …)` / `act.mutate({ method, path, body })`) · body มี type จาก `@nightout/contracts`
- หน้า / form / modal ของโมดูลเรียกผ่าน `./api` · พฤติกรรมเดิม (query key, ข้อความแจ้งผล, invalidate `['admin']`)

## 2026-10-08 — ลากเรียงลำดับทีมงาน (แทนปุ่มขึ้น/ลง)
- คอลัมน์ "ลำดับ" เปลี่ยนจากปุ่มลูกศรขึ้น/ลง เป็นปุ่มจับ (ไอคอน `DotsSixVertical`) ลากทั้งแถวขึ้นลงได้ — ใช้ dnd-kit ตาม demo "Drag sorting with handler" ของ antd · ลากได้เฉพาะที่ปุ่มจับ · คีย์บอร์ด: Tab ไปที่ปุ่มจับ → Space ยก → ลูกศร → Space วาง (Esc ยกเลิก)
- ปล่อยแล้วแถวอยู่ตำแหน่งใหม่ทันทีระหว่างรอ API (`PUT /admin/team-members/order`) · API พลาด = กลับลำดับเดิม · ระหว่างบันทึกล็อกการลาก · ยังเฉพาะซูเปอร์แอดมิน
- เพิ่ม dependency `@dnd-kit/core` `@dnd-kit/sortable` `@dnd-kit/modifiers` `@dnd-kit/utilities` ให้ `apps/admin` (เวอร์ชันเดียวกับที่ `@ant-design/pro-components` ใช้อยู่ใน lockfile)
- ไฟล์: `page.tsx`, `components/sortableRow.tsx` (ใหม่), `utils/useTeamOrder.ts` (ใหม่)

## 2026-10-08 — สิทธิ์จัดการทีมงาน: Super Admin / Admin เฉพาะแถวตัวเอง
- ปุ่ม "เพิ่มทีมงาน", ปุ่มลบ และคอลัมน์ "ลำดับ" (เลื่อนขึ้น/ลง) แสดงเฉพาะซูเปอร์แอดมิน (`useAdminAuth().isSuperAdmin`)
- แอดมินทั่วไป: ปุ่มแก้และสวิตช์ "แสดงบนเว็บ" ใช้ได้เฉพาะแถวที่อีเมลในช่องทางติดต่อตรงกับอีเมลบัญชี (`isOwnMember` ใน `utils/contacts.ts`) แถวอื่นถูกปิดพร้อม tooltip บอกเหตุผล · ใต้หัวข้อแสดง "แอดมินแก้/ซ่อนได้เฉพาะแถวของตัวเอง"
- Drawer รับ `lockEmail` → แอดมินทั่วไปแก้ช่องอีเมลไม่ได้ (อีเมลคือตัวผูกแถวกับบัญชี)
- เป็นแค่การซ่อน/ปิดปุ่ม — สิทธิ์จริงตรวจที่ API + DB (migration `20261008000200_site_team_super_admin_rules`)
- ไฟล์: `page.tsx`, `form/teamMemberDrawer.tsx`, `utils/contacts.ts`
