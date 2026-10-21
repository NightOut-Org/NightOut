# CHANGELOG — frontend/modules/deposit

## 2026-10-20 — เลิกใช้ " · " คั่นข้อมูลในข้อความ UI
- ออกแบบข้อความที่แก้ใหม่ให้เข้ากับคอมโพเนนต์: แถวข้อมูลมีไอคอนบอกชนิด (`MetaList`) · สถานะเด่นเป็นชิป (`StatusChip` / `DraftChip`) · กติกาเป็นรายการมีไอคอน (`RuleList`) · ป้ายโฆษณา 2 ช่อง (`AdBadge`)
- ข้อมูลหลายค่าบรรทัดเดียวใช้ `MetaList` (`ui/components/metaList.tsx`) เว้นระยะแยกค่า · ข้อความยาวใช้วรรค/วงเล็บแทนจุดกลาง ไม่เปลี่ยนพฤติกรรม
- ไฟล์: หน้าและคอมโพเนนต์ในโมดูลนี้ที่เคยมี " · " ในข้อความ

## 2026-10-13 — ชั้นชำระเงินกลาง (payment intents + mock)
- หน้า `/bookings/:id/deposit` เลือกโหมดจาก `GET /payments/config`: ตั้ง `PAYMENT_PROVIDER` → `components/providerCheckout.tsx` (ยอด Table Fee + ปุ่ม "ไปหน้าชำระเงิน" → `POST /bookings/:id/checkout` · กลับมา `?payment=return` แล้วรอผล · สำเร็จ → "ชำระ Table Fee สำเร็จ" + ปุ่มดู E-Ticket · ไม่สำเร็จ / ต้องคืนเงิน แสดงสถานะ) · ไม่ตั้ง = `components/slipTransfer.tsx` (PromptPay QR + แนบสลิปเดิม ย้ายออกมาจาก page)
- `hooks/usePaymentStatus.ts`: poll `GET /bookings/:id/payments` ทุก 3 วิ (สูงสุด 2 นาที · ใช้ `useNow`) แล้ว `refresh()` store เมื่อจ่ายสำเร็จ · skeleton ระหว่างโหลด
- `api.ts`: เพิ่ม hook/ฟังก์ชันของ `GET /payments/config` · `GET /bookings/:id/payments` · `POST /bookings/:id/checkout` (เก็บ `submitDeposit` เดิม) · ไฟล์: `page.tsx`, `api.ts`, `components/providerCheckout.tsx`, `components/slipTransfer.tsx`, `hooks/usePaymentStatus.ts` · (นอกโมดูล: `ui/components/depositCard.tsx` แสดง "ชำระผ่าน …" · `services/mappers/booking.ts` method/provider · `ui/utils/format.ts` `timeHHmm`)

## 2026-10-13 — เรียก Table Fee แทนมัดจำ
- หัวหน้า "ชำระ Table Fee" · ยอด "ค่าธรรมเนียมจองโต๊ะ (Table Fee)" · "นโยบาย Table Fee ของร้าน" (flow สลิปเดิม — จะเปลี่ยนตอนทำระบบชำระเงิน)
- ไฟล์: `page.tsx`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `submitDeposit` — ย้ายมาจาก `services/api/<domain>.ts` / `services/queries/<domain>.ts` (ลบแล้ว) · เรียก `Rest` ตรง
- หน้าในโมดูล import จาก `./api` แทน `@/services/data` · พฤติกรรมเดิม (ชื่อฟังก์ชัน, query key)
