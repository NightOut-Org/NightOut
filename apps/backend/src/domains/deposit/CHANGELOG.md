# deposit — ประวัติการแก้ไข

## 2026-10-21 — เลิกใช้ " · " คั่นข้อความที่ผู้ใช้เห็น (ส่วนที่เหลือ)
- ข้อความแจ้งเตือนสลิป/คืน Table Fee: `app_submit_deposit` `app_team_refund_deposit`
- migration `20261021000200_notify_text_no_dots` ประกาศฟังก์ชันตัวล่าสุดซ้ำทั้งตัว เปลี่ยนเฉพาะสตริงที่มีตัวคั่นเป็นวรรค (ตรวจแล้ว 29 ฟังก์ชันต่างกันแค่ข้อความ/คอมเมนต์ · แจ้งเตือนที่ส่งไปแล้วไม่แก้ย้อนหลัง)

## 2026-10-13 — ชั้นชำระเงินกลาง (payment intents + mock)
- `deposit.me.controller.ts`: `POST /bookings/:id/deposit` ตอบ 409 `SLIP_FLOW_DISABLED` เมื่อเปิดชำระออนไลน์ (`PAYMENT_PROVIDER` ตั้งและพร้อม) — ไม่ตั้ง = flow สลิปเดิมครบ
- migration `20261013001100_payment_intents`: `booking_deposit_summary` เพิ่ม `method` (SLIP/ONLINE) + `provider` · view `admin_deposits` เพิ่มคอลัมน์ท้าย `payment_intent_id` · `payment_provider` (Backoffice แยกช่องทาง สลิป / ออนไลน์) · การชำระออนไลน์เขียนแถว `deposits` VERIFIED/HELD เสมอ (escrow + ยอดขายนับจาก deposits ได้เหมือนเดิม)

## 2026-10-13 — สมุด Table Fee ของร้านเฉพาะเจ้าของ/ผู้จัดการ
- rpc `bar_deposit_ledger` (`GET /merchant/bars/:barId/deposit-ledger`) คืนแถวเฉพาะ `is_bar_manager` — Staff ได้รายการว่าง
- ข้อความ error ใน contracts เรียก "Table Fee" แทน "มัดจำ"
- migration `20261013000100_bar_team_money_rbac`

