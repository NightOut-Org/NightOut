# payment — ประวัติการแก้ไข

## 2026-10-21 — เลิกใช้ " · " คั่นข้อความที่ผู้ใช้เห็น (ส่วนที่เหลือ)
- ข้อความแจ้งเตือนการชำระออนไลน์/คืนเงิน: `payment_apply_event` `admin_payment_mark_refunded`
- migration `20261021000200_notify_text_no_dots` ประกาศฟังก์ชันตัวล่าสุดซ้ำทั้งตัว เปลี่ยนเฉพาะสตริงที่มีตัวคั่นเป็นวรรค (ตรวจแล้ว 29 ฟังก์ชันต่างกันแค่ข้อความ/คอมเมนต์ · แจ้งเตือนที่ส่งไปแล้วไม่แก้ย้อนหลัง)

## 2026-10-13 — ชั้นชำระเงินกลาง (payment intents + mock)
- โดเมนใหม่ `payment` — ชั้นชำระ Table Fee ที่ไม่ผูกผู้ให้บริการ (เจ้าของตัดสิน 2026-10-13: ยังไม่มีคีย์ / อาจไม่ใช้ Beam) · `payment.module.ts` · `payment.service.ts` (เลือกโหมดจาก env · เปิด checkout · ตรวจลายเซ็นแล้วส่ง event ให้ `payment_apply_event` · จำกัด payload 60 KB · ลิงก์ checkout ของผู้ให้บริการจริงต้องเป็น https)
- adapter `providers/`: `payment-provider.ts` (interface) · `mock.provider.ts` (หน้าชำระเงินจำลอง `/pay/mock/:intentId` + ลายเซ็น HMAC) · `beam.provider.ts` (stub `ready = false` → ยังใช้สลิป) · `create-provider.ts` (เลือก provider · mock บน deploy ต้องตั้ง `PAYMENT_ALLOW_MOCK_IN_PRODUCTION=true` + `PAYMENT_WEBHOOK_SECRET` ไม่งั้นเตือนใน log แล้วกลับเป็นสลิป)
- endpoint: public `GET /payments/config` · `POST /payments/webhook/:provider` (raw body) · me `POST /bookings/:id/checkout` · `GET /bookings/:id/payments` · `GET /payments/intents/:id` · `POST /payments/mock/:id/complete` (เฉพาะ mock) · admin `POST /admin/payments/:id/refunded` — ทุกเส้นมี `@ApiDoc`
- migration `20261013001100_payment_intents`: ตาราง `payment_intents` · `payment_events` (กันซ้ำ provider + event_id) · `deposits.payment_intent_id` · rpc `app_payment_start` · `app_payment_attach` · `payment_apply_event` (PAID ยอดตรง THB + การจองยังรอชำระ → deposits VERIFIED/HELD + booking CONFIRMED · ยอดไม่ตรง / การจองปิดแล้ว / ไม่รู้ยอด → "ต้องคืนเงิน" + แจ้งลูกค้า/แอดมิน) · `admin_payment_mark_refunded` · `my_payment_intents` · trigger `bookings_close_payment_intents` (`payment_close_on_booking_end`) · views `admin_payment_intents` / `admin_payment_unmatched`
- env ใหม่ (`config/env.ts` · `.env.example`): `PAYMENT_PROVIDER` (ว่าง = สลิป · mock · beam) · `PAYMENT_WEBHOOK_SECRET` · `PAYMENT_ALLOW_MOCK_IN_PRODUCTION` · `WEB_APP_URL` · `bootstrap.ts` เปิด `rawBody` ให้ตรวจลายเซ็น webhook · `app.module.ts` ลง `PaymentModule`
- เทสต์ `payment.test.ts` · ADR `docs/adr/0010-provider-agnostic-payment-layer.md`

