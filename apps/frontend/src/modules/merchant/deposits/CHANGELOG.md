## 2026-10-10 — Bento ตาม Merchant 1i Sitemap

## 2026-10-20 — เลิกใช้ " · " คั่นข้อมูลในข้อความ UI
- ออกแบบข้อความที่แก้ใหม่ให้เข้ากับคอมโพเนนต์: แถวข้อมูลมีไอคอนบอกชนิด (`MetaList`) · สถานะเด่นเป็นชิป (`StatusChip` / `DraftChip`) · กติกาเป็นรายการมีไอคอน (`RuleList`) · ป้ายโฆษณา 2 ช่อง (`AdBadge`)
- ข้อมูลหลายค่าบรรทัดเดียวใช้ `MetaList` (`ui/components/metaList.tsx`) เว้นระยะแยกค่า · ข้อความยาวใช้วรรค/วงเล็บแทนจุดกลาง ไม่เปลี่ยนพฤติกรรม
- ไฟล์: หน้าและคอมโพเนนต์ในโมดูลนี้ที่เคยมี " · " ในข้อความ

- การ์ดสรุป 4 ใบมีไอคอน (ถือไว้ · รอโอนเข้าร้าน · โอนแล้วเดือนนี้ + บัญชีรับเงิน · เครดิต) · ตารางในการ์ด + ชิปกรอง + คอลัมน์สถานะการจอง (จาก store) · ปุ่ม "ส่งออก CSV" (แถวที่กรองอยู่ · มี BOM ให้ Excel อ่านไทย)
- มือถือ: การ์ดถือไว้ใหญ่ + 3 ใบเล็ก + รายการ
- ไฟล์หลัก: `page.tsx`

## 2026-10-13 — เฉพาะเจ้าของ/ผู้จัดการ · เรียก Table Fee
- route อยู่ใต้ `<RequireBarRole roles={['OWNER','MANAGER']}>` — Staff เข้าเองเจอ 403 · DB คืนแถวว่างให้ Staff (`bar_deposit_ledger` → `is_bar_manager`)
- หัวหน้า/เมนู "Table Fee" แทน "เงินมัดจำ"
- ไฟล์: `page.tsx`, `router/index.tsx`, `router/middleware.tsx`, `layouts/merchant.tsx`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useBarLedger` (`GET /merchant/bars/:barId/deposit-ledger`) — ย้ายมาจาก `services/api/<domain>.ts` / `services/queries/<domain>.ts` (ลบแล้ว) · เรียก `Rest` ตรง
- หน้าในโมดูล import จาก `./api` แทน `@/services/data` · พฤติกรรมเดิม (ชื่อฟังก์ชัน, query key)

## 2026-10-08 — Responsive Merchant

- การ์ดยอดมัดจำเรียงคอลัมน์เดียวบนมือถือ
