# bars — ประวัติการแก้ไข

## 2026-10-15 — คอลัมน์ปุ่มตรึงขวา + ไอคอนอย่างเดียว
- คอลัมน์ปุ่ม (แก้ข้อมูล / รูปร้าน / ตำแหน่ง) `fixed: 'right'` เลื่อนตารางแนวนอนแล้วปุ่มยังอยู่ · ปุ่มเหลือแค่ไอคอน ชื่อปุ่มอยู่ใน Tooltip + `aria-label` (มีชื่อร้าน) · คอลัมน์แคบลง 330 → 128 (`scroll.x` 1320 → 1120) — `page.tsx`

## 2026-10-13 — แก้ข้อมูลร้าน + เมนู/ราคาแทนร้าน
- ปุ่ม "แก้ข้อมูล" ในคอลัมน์ปุ่ม (คู่ "รูปร้าน" / "ตำแหน่ง") → `?edit=<id>` เปิด Drawer `components/barDetailsDrawer.tsx` (แท็บ ข้อมูลร้าน | เมนูและราคา · SaveBar บันทึกครั้งเดียว · มือถือเต็มจอ · บันทึกแล้วแจ้งทีมร้าน + Audit Log)
- `components/barInfoForm.tsx`: ชื่อ · คำอธิบาย · เบอร์ · ย่าน · สไตล์ (เลือกได้เฉพาะที่แสดงอยู่ · ที่ซ่อนแสดงเป็นป้าย "(ซ่อนอยู่)") · เวลาเปิด-ปิด 7 วัน · ลิงก์โซเชียล ≤ 10 · ที่อยู่ดูอย่างเดียว (แก้ผ่านตรวจหมุด) · `components/menuEditor.tsx`: ตารางแก้หมวด/ชื่อ/ราคา/แสดง · เพิ่ม/ลบรายการ (รูปเมนูดูป้าย "มีรูป" · จัดการที่ `/bar-media`)
- `utils/useBarDetailsDraft.ts`: เทียบกับค่าจาก server (เวลาเปิด-ปิดเติมวันที่ขาดเป็น 18:00–02:00 ก่อนเทียบ → เปิดแล้วไม่ขึ้นว่าแก้) · ส่งเฉพาะ field ที่แก้ + เมนูทั้งชุด
- `useUnsavedGuard` ตัวเดียวที่หน้า (สวิตช์แสดง/ระงับ หรือ Drawer ยังไม่บันทึก) — Drawer ไม่เรียกเอง เพราะ router มี blocker ได้ตัวเดียว · ปิด Drawer ตอนยังไม่บันทึก = ถามก่อนทิ้ง
- `api.ts` + `useBarDetails(id)` (view `admin_bar_details`) · `useDistricts()` (`/admin/master/districts`) · `useStyleOptions()` (view `admin_styles`) · `barDetailsAction` (`PUT bars/:id/details`) · ป้าย Audit Log `bar.admin_edit_info` · `bar.admin_edit_menu` · `bar.media.update`
- endpoint/migration: `PUT /admin/bars/:id/details` · `20261013001010_bar_admin_edit_details`
- ไฟล์: `page.tsx`, `api.ts`, `components/barDetailsDrawer.tsx`, `components/barInfoForm.tsx`, `components/menuEditor.tsx`, `utils/useBarDetailsDraft.ts`

## 2026-10-13 — ป้าย Blacklist
- ร้านที่ติด Blacklist มีป้ายแดง "Blacklist" ข้างชื่อ (ลิงก์ `/bar-blacklist?bar=<id>`) และคอลัมน์ "แสดง" เป็นข้อความ "ติด Blacklist" แทนสวิตช์ (เปลี่ยนสถานะได้หลังปลดที่หน้า Blacklist ร้าน · DB กันด้วย `BAR_BLACKLISTED`)
- `api.ts` + `useBlacklistedBars` (view `admin_bar_blacklist` กรอง `is_blacklisted`)
- ไฟล์: `page.tsx`, `api.ts`

## 2026-10-13 — ตำแหน่งร้าน (หมุด) + แอดมินตรวจหมุด
- ปุ่ม "ตำแหน่ง" ข้างปุ่ม "รูปร้าน" → `/bar-locations?tab=all&bar=<id>` เปิดหมุดของร้านนั้น
- ไฟล์: `page.tsx`

## 2026-10-12 — สวิตช์แสดง/ระงับแบบแก้ก่อน แล้วกดบันทึกครั้งเดียว
- สลับสวิตช์ "แสดง" ได้หลายร้าน แก้แค่ในหน้า (แถวที่แก้มีป้าย "ยังไม่บันทึก" · ซ่อนยังต้องใส่เหตุผล ดูเหตุผลได้ที่ป้าย) แล้วกด "บันทึก" ที่หัวหน้าครั้งเดียว · "คืนค่า" ทิ้งการแก้ · สลับกลับเป็นค่าเดิมไม่นับว่าแก้
- ระหว่างบันทึก สวิตช์ทั้งตาราง disabled · บันทึกพลาด = การแก้ยังอยู่ กดใหม่ได้ · ออกจากหน้าตอนยังไม่บันทึก = ถามก่อน
- endpoint ใหม่ `PATCH /admin/bars/status` (`admin_set_bars_status` · migration `20261012000100_bar_save_page_batch`) แทนการยิง `PATCH /admin/bars/:id/status` ต่อแถว
- ไฟล์: `page.tsx` · `components/showSwitch.tsx` (ไม่เรียก API เอง) · `utils/useBarStatusDraft.ts` (ใหม่) · `api.ts` (`barsStatusAction` แทน `barStatusAction`)

## 2026-10-09 — ปุ่มรูปร้าน
- คอลัมน์ท้ายตารางมีปุ่ม "รูปร้าน" → `/bar-media?bar=<id>` เปิดรูปของร้านนั้นเลย
- ไฟล์: `page.tsx`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useBars` · `barStatusAction` — ชื่อ view / path / body ของหน้านี้ย้ายมาอยู่ที่เดียว (เดิมเขียนในหน้าผ่าน `useAdminView('admin_x', …)` / `act.mutate({ method, path, body })`) · body มี type จาก `@nightout/contracts`
- หน้า / form / modal ของโมดูลเรียกผ่าน `./api` · พฤติกรรมเดิม (query key, ข้อความแจ้งผล, invalidate `['admin']`)

## 2026-10-08 — ตัด Editor's Pick · สวิตช์ "แสดง" · ป้ายแนะนำดูอย่างเดียว
- เอาคอลัมน์ Editor's Pick ออก (ฟีเจอร์ถูกตัดทั้งโปรเจกต์)
- ปุ่ม "ระงับ" / "เปิดใช้งาน" รวมเป็นสวิตช์ "แสดง" (`components/showSwitch.tsx`): เปิด = APPROVED · ปิด = SUSPENDED ต้องใส่เหตุผลก่อน · ร้านร่าง/รอตรวจ/ไม่อนุมัติไม่มีสวิตช์ (จัดการที่ /merchants)
- ร้านที่กำลังโปรโมทขึ้นป้าย "แนะนำ ถึง <วันหมด>" ข้างชื่อ (ดูอย่างเดียว · กดไป /promotions) จาก `admin_bars.promoted_until`
- แก้ดาวในคอลัมน์ "ดาว" เรียงแนวตั้งและไม่มีสีทอง: `@source` ใน `src/styles/index.css` ชี้ path ผิด (ขาด ../ หนึ่งชั้น) Tailwind เลยไม่สร้าง class ของ `packages/ui` — กระทบทุกคอมโพเนนต์จาก @nightout/ui ในหลังบ้าน (หน้า /ranking ด้วย)
- คอลัมน์ "ดาว" แสดงเป็นตัวเลข + ดาวดวงเดียว (เช่น 4 ★) แทนดาว 5 ดวง · เรียงตามดาวได้
- ไฟล์: `page.tsx`, `components/showSwitch.tsx` (ใหม่) · ป้ายสถานะ APPROVED เปลี่ยนเป็น "แสดง" ใน `ui/utils/labels.ts` · เพิ่ม `date()` ใน `ui/utils/format.ts`
