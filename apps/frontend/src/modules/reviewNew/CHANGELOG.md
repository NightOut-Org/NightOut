# CHANGELOG — frontend/modules/reviewNew

## 2026-10-13 — เรียก Table Fee แทนมัดจำ
- "รีวิวได้หลังจองและชำระ Table Fee แล้วเท่านั้น" · ไฟล์: `page.tsx`

## 2026-10-11 — รีวิวได้เมื่อมัดจำผ่าน (ไม่ต้องเช็กอิน)
- เงื่อนไขเปิดฟอร์มรีวิวใช้ `isReviewableStatus()` จาก `@nightout/utils` (CONFIRMED/CHECKED_IN/COMPLETED/NO_SHOW) แทนเช็กอินเท่านั้น · ข้อความเตือนเป็น "รีวิวได้หลังจองและมัดจำผ่านแล้วเท่านั้น" — ตาม requirement 2026-10-11
- ไฟล์: `page.tsx`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `addReview` — ย้ายมาจาก `services/api/<domain>.ts` / `services/queries/<domain>.ts` (ลบแล้ว) · เรียก `Rest` ตรง
- หน้าในโมดูล import จาก `./api` แทน `@/services/data` · พฤติกรรมเดิม (ชื่อฟังก์ชัน, query key)
