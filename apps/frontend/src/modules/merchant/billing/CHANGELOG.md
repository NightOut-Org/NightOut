## 2026-10-13 — ป้ายปลดโต๊ะ (Forfeited)
- รายการค่าคอมที่ยกเว้นเพราะลูกค้าไม่มา แสดง "ปลดโต๊ะ (Forfeited)" แทน "ไม่มาตามนัด" (หน้ายังปิดไว้จนถึง Phase 2) · ไฟล์: `page.tsx`

## 2026-10-10 — Bento ตาม Merchant 1i Store/Growth
- ซ้าย = การ์ดเดือน (ยอด + สถานะ สะสมอยู่/รอชำระ/ชำระแล้ว) กดเลือกเดือน · ขวา = billing events ของเดือนนั้น · ค้างชำระบนหัวหน้า
- มือถือ: การ์ดเดือนเลื่อนแนวนอน + รายการ
- ไฟล์หลัก: `page.tsx`

# CHANGELOG — frontend/modules/merchant/billing

## 2026-10-13 — ปิดหน้าไว้จนถึง Phase 2
- เอา route `/merchant/billing` และเมนู "ค่าคอม" ออก (เจ้าของตัดสิน 2026-10-13 — ค่าคอม/GP เริ่ม Phase 2) · โค้ดโมดูลยังอยู่ เปิดคืนได้โดยเพิ่ม route ใต้ `RequireBarRole`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useBillingEvents` (`GET /merchant/bars/:barId/billing-events`) — ย้ายมาจาก `services/api/<domain>.ts` / `services/queries/<domain>.ts` (ลบแล้ว) · เรียก `Rest` ตรง
- หน้าในโมดูล import จาก `./api` แทน `@/services/data` · พฤติกรรมเดิม (ชื่อฟังก์ชัน, query key)
