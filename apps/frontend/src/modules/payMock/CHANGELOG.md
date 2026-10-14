# CHANGELOG — frontend/modules/payMock

## 2026-10-13 — ชั้นชำระเงินกลาง (payment intents + mock)
- โมดูลใหม่ — route `/pay/mock/:intentId` (ต้องล็อกอิน · MainLayout) หน้าชำระเงินจำลองของ `PAYMENT_PROVIDER=mock`: แสดงร้าน / ยอด / เวลาหมดอายุ + ปุ่ม "จ่ายสำเร็จ" / "จ่ายไม่สำเร็จ" → `POST /payments/mock/:id/complete` แล้วกลับ `/bookings/:id/deposit?payment=return` · mock ปิดอยู่ = ไม่แสดงปุ่ม · ไม่ตัดเงินจริง
- ไฟล์: `page.tsx`, `api.ts` · route ใน `router/index.tsx`

