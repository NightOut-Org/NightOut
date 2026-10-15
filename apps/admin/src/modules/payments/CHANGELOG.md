# CHANGELOG — admin/modules/payments

## 2026-10-15 — ปรับ UX/UI หน้าการชำระเงิน
- หัวหน้า: ย้ายป้ายโหมด (ชำระออนไลน์/สลิป) ไปเป็น tag ข้างชื่อหน้า · ย่อคำอธิบาย · เอา Statistic 4 ตัวที่อัดอยู่มุมขวาออก แทนด้วยการ์ดจำนวนรายการ 4 ใบ (ต้องคืนเงิน · รอชำระ · ชำระแล้ววันนี้ · จับคู่ไม่ได้) กดแล้วไปแท็บนั้น · ใบที่มีงานค้างขอบ/ตัวเลขสีแดง (ยังไม่มียอดเงินรวมเหมือนเดิม) — `components/summaryCards.tsx`
- แท็บอยู่ใน Card เดียว · จำนวนต่อแท็บแยกจากชื่อ (แท็บงานค้างใช้ Badge แดง) · แท็บ "ต้องคืนเงิน" มีแถบบอกขั้นตอนคืนเงิน
- ตาราง 10 คอลัมน์ → 6: การจอง (รหัส + สถานะ + ร้าน) · ลูกค้า · ยอด (ยอดที่ได้รับจริงไม่ตรง = ตัวแดง) · สถานะชำระ (+ เวลาชำระ/เปิด หรือเหตุที่ล้มเหลว) · เงินหลังชำระ (คืนเงิน หรือสถานะเงินมัดจำ) · ปุ่มคืนเงิน · ตรึงคอลัมน์ซ้าย/ขวาเฉพาะจอ ≥ md
- แถวกางออก (ทุกแถว): เลขอ้างอิงผู้ให้บริการ (คัดลอกได้) · เวลาเปิด/หมดเวลาชำระ · เวลาจอง/จำนวนคน · เลขอ้างอิงการคืนเงิน + webhook ที่ได้รับ — `components/paymentEvents.tsx`
- ไฟล์: `page.tsx`, `components/summaryCards.tsx` (ใหม่), `components/paymentEvents.tsx` · ไม่มี endpoint/migration ใหม่

## 2026-10-13 — ชั้นชำระเงินกลาง (payment intents + mock)
- โมดูลใหม่ — `/payments` "การชำระเงิน" (เมนูถัดจาก "เงินมัดจำ" · Admin + Super Admin): โหมดที่เปิด (สลิป / ผู้ให้บริการ) · แท็บ ต้องคืนเงิน / ทั้งหมด / ชำระแล้ว / รอชำระ / ไม่สำเร็จ·หมดเวลา / จับคู่ไม่ได้ · แสดงจำนวนรายการ (ไม่มียอดรวม) · webhook ที่ได้รับต่อรายการ (`components/paymentEvents.tsx`) · ปุ่ม "บันทึกว่าคืนเงินแล้ว" (`components/markRefundedButton.tsx` → `POST /admin/payments/:id/refunded` · audit `payment.refunded` + แจ้งลูกค้า)
- `api.ts`: views `admin_payment_intents` · `admin_payment_unmatched` · `GET /payments/config` · action บันทึกคืนเงิน · ไฟล์: `page.tsx`, `api.ts`, `components/*` · (นอกโมดูล: `router/index.tsx`, `configs/menu.tsx`, `services/api/backoffice.ts` `AdminViewRows`, `ui/utils/labels.ts` ป้าย audit `payment.*`)

