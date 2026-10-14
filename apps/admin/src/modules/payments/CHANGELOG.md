# CHANGELOG — admin/modules/payments

## 2026-10-13 — ชั้นชำระเงินกลาง (payment intents + mock)
- โมดูลใหม่ — `/payments` "การชำระเงิน" (เมนูถัดจาก "เงินมัดจำ" · Admin + Super Admin): โหมดที่เปิด (สลิป / ผู้ให้บริการ) · แท็บ ต้องคืนเงิน / ทั้งหมด / ชำระแล้ว / รอชำระ / ไม่สำเร็จ·หมดเวลา / จับคู่ไม่ได้ · แสดงจำนวนรายการ (ไม่มียอดรวม) · webhook ที่ได้รับต่อรายการ (`components/paymentEvents.tsx`) · ปุ่ม "บันทึกว่าคืนเงินแล้ว" (`components/markRefundedButton.tsx` → `POST /admin/payments/:id/refunded` · audit `payment.refunded` + แจ้งลูกค้า)
- `api.ts`: views `admin_payment_intents` · `admin_payment_unmatched` · `GET /payments/config` · action บันทึกคืนเงิน · ไฟล์: `page.tsx`, `api.ts`, `components/*` · (นอกโมดูล: `router/index.tsx`, `configs/menu.tsx`, `services/api/backoffice.ts` `AdminViewRows`, `ui/utils/labels.ts` ป้าย audit `payment.*`)

