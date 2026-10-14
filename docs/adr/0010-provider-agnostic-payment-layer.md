# ADR 0010: ชั้นชำระเงินกลางที่ไม่ผูกผู้ให้บริการ (payment intents + adapter + webhook + mock)

- **สถานะ:** Accepted
- **วันที่:** 2026-10-13

## Context
REQUIREMENTS ข้อ 0 / ข้อ 3 กำหนดให้ทุกการจองจ่าย "ค่าธรรมเนียมจองโต๊ะ (Table Fee)" ผ่าน Payment Gateway แบบ Escrow (ผู้จองจ่ายยอดรวมคนเดียว · NightOut ถือเงินจนเช็กอิน) แทนการโอน PromptPay + แนบสลิป + แอดมินตรวจ แต่เจ้าของบอก (2026-10-13) ว่า "อาจจะไม่ได้ใช้ Beam · ยังไม่มีคีย์" — ยังไม่รู้ว่าจะใช้ผู้ให้บริการเจ้าไหน และยังทดสอบกับเจ้าจริงไม่ได้

ข้อจำกัด
- ห้ามมีโค้ดส่วนไหนพึ่ง Beam (หรือเจ้าใดเจ้าหนึ่ง) แบบถอดไม่ได้
- ระหว่างยังไม่มีคีย์ ระบบต้องรับเงินได้ต่อ → flow สลิปเดิมต้องใช้ได้ครบ
- เงินที่จ่ายออนไลน์ต้องเข้าระบบ escrow เดิม (`deposits.settlement`) เพื่อให้การโอนให้ร้าน / คืนลูกค้า / ยอดขายทำงานเหมือนเดิม
- webhook เป็นทางเดียวที่เงินเข้าจริง → ต้องกันปลอม กันซ้ำ และห้ามยืนยันโต๊ะเมื่อไม่แน่ใจเรื่องยอดเงิน

## Decision
- **payment intents ใน DB** (`payment_intents` · migration `20261013001100_payment_intents`): 1 แถว = เปิดหน้าชำระเงินของผู้ให้บริการ 1 ครั้ง · PENDING ได้ครั้งละ 1 รายการต่อการจอง (กดซ้ำ = ใช้รายการเดิม) · ยอด = `bookings.deposit_required` · หมดเวลาตาม `expires_at` ของการจอง · การจองออกจาก AWAITING_DEPOSIT → trigger ปิดรายการที่ค้าง
- **adapter ต่อผู้ให้บริการ** (`apps/backend/src/domains/payment/providers/`): interface `PaymentProvider` (สร้าง checkout · ตรวจลายเซ็น + แปลง webhook เป็น event กลาง PAID / FAILED / EXPIRED / CANCELLED / IGNORED) · `mock` = หน้าชำระเงินจำลอง `/pay/mock/:intentId` สำหรับเครื่อง dev · `beam` = stub `ready = false` · เปลี่ยน/เพิ่มเจ้าใหม่แตะแค่ `providers/` + `paymentProviderLabel`
- **เลือกด้วย env** `PAYMENT_PROVIDER` (ว่าง = สลิป) — provider ที่ยังไม่พร้อม (`beam`) หรือ `mock` บน deploy ที่ไม่ได้ตั้ง `PAYMENT_ALLOW_MOCK_IN_PRODUCTION=true` + `PAYMENT_WEBHOOK_SECRET` → เตือนใน log แล้วกลับเป็นโหมดสลิป (ไม่ crash)
- **flow สลิปอยู่ต่อจนกว่าจะตั้ง `PAYMENT_PROVIDER`** · ตั้งแล้ว `POST /bookings/:id/deposit` ตอบ 409 `SLIP_FLOW_DISABLED` และหน้า `/bookings/:id/deposit` เป็นหน้าชำระเงิน (`GET /payments/config` บอกโหมด)
- **webhook** `POST /api/payments/webhook/:provider`: ตรวจลายเซ็นจาก raw body (`rawBody: true` ใน `bootstrap.ts`) ก่อนแตะ DB · ลายเซ็นผิด 401 · payload ≤ 60 KB · `payment_events` กันซ้ำด้วย (provider, event_id)
- **`payment_apply_event`** (service_role) เป็นที่เดียวที่เปลี่ยนเงินเป็นสถานะ: PAID ยอดตรงเป็น THB + การจองยังรอชำระ → `deposits` VERIFIED/HELD (`payment_intent_id`) + booking AWAITING_DEPOSIT → CONFIRMED โดยระบบ (E-Ticket ออกทันที) · **PAID ที่ไม่รู้ยอดจริง (ไม่ส่งยอด / ไม่ใช่ THB) หรือยอดไม่ตรง ไม่ยืนยันโต๊ะเด็ดขาด** · เงินเข้าหลังการจองหมดเวลา/ยกเลิก หรือยอดไม่ตรง → `refund_status = REQUIRED` + แจ้งลูกค้าและแอดมิน · หารายการไม่เจอ → บันทึกไว้ให้แอดมินดู (`admin_payment_unmatched`)
- **คืนเงินทำมือ**: ยังไม่เรียก refund API ของผู้ให้บริการ — แอดมินคืนที่ระบบผู้ให้บริการแล้วกด "บันทึกว่าคืนเงินแล้ว" (`/payments` สำหรับเงินที่ผูกการจองไม่ได้ · `/deposits` "รอคืนลูกค้า" สำหรับ deposit ปกติ)
- ทีมร้านได้แจ้งเตือน "ลูกค้าชำระ Table Fee แล้ว" โดยไม่มียอดเงิน (Staff/PR ห้ามเห็นเงิน)

## Consequences
- **ได้:** สลับผู้ให้บริการได้โดยไม่แตะ DB / หน้าเว็บ · ทดสอบ flow ครบวงจรในเครื่องด้วย mock · escrow, การโอนให้ร้าน, ยอดขาย ใช้ตาราง `deposits` เดิม · webhook ซ้ำ/ปลอม/ยอดผิดไม่ทำให้โต๊ะถูกยืนยันผิด
- **เสีย / ต้องระวัง:**
  - ต้องเขียน adapter ของเจ้าจริงเมื่อมีคีย์ (ตอนนี้ `beam` เป็น stub)
  - การคืนเงินยังเป็นงานมือของแอดมิน
  - **ปิด `PAYMENT_PROVIDER` ระหว่างที่ยังมีรายการ PENDING → webhook ที่มาช้าจะตอบ 404 (`PAYMENT_PROVIDER_UNKNOWN`)** → ปิดหลังรายการที่ค้างหมดเวลาแล้วเท่านั้น
  - ยังไม่มีทางสำรองเมื่อผู้ให้บริการล่มในโหมดออนไลน์ (หน้าเว็บขึ้น "เปิดหน้าชำระเงินไม่สำเร็จ" · สลิปยังปิด) — รอเจ้าของตัดสิน (REQUIREMENTS ❓ "Beam ขัดข้อง/ล่ม")
- ไฟล์หลัก: `apps/backend/src/domains/payment/*` · `apps/backend/supabase/migrations/20261013001100_payment_intents.sql` · `packages/contracts/src/payment.ts` · `packages/utils/src/payment.ts` · `apps/frontend/src/modules/deposit/*` · `apps/frontend/src/modules/payMock/*` · `apps/admin/src/modules/payments/*`
