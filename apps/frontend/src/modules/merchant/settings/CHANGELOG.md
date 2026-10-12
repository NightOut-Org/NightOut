## 2026-10-12 — ตั้งค่าการจอง: แก้กลับเป็นค่าเดิมเอง = ไม่นับว่าแก้
- ส่วนตั้งค่าการจอง (มัดจำ · เวลารอ · PR) เทียบกับค่าจาก server ทุกครั้งแทนการติดธง "เคยแก้" → "ยังไม่บันทึก n ส่วน" / ปุ่มคืนค่า หายเมื่อค่ากลับมาตรง
- ไฟล์: `page.tsx` (`SettingsForm` + `toBookingBody` ใช้ทั้งเทียบและบันทึก) · `hooks/useFormDirty.ts`

## 2026-10-12 — ตั้งค่า + บัญชีรับเงิน บันทึกครั้งเดียว
- ปุ่มบันทึกเดิมยิง 2 เส้นต่อกัน (เส้นที่ 2 พลาด = เส้นแรกบันทึกไปแล้ว) → คำขอเดียว `PUT …/settings` ธุรกรรมเดียว ส่งเฉพาะส่วนที่แก้ (ตั้งค่าการจอง / บัญชีใหม่เมื่อกรอกเลขบัญชี)
- ปุ่มบันทึก disabled เมื่อไม่มีอะไรเปลี่ยน · "คืนค่า" + บอกจำนวนส่วนที่ยังไม่บันทึก · ระหว่างบันทึกฟอร์มทั้งหน้า (รวมปุ่ม PR) disabled · กดยกเลิกเปลี่ยนบัญชี = ล้างช่องบัญชี · ออกจากหน้าตอนยังไม่บันทึก = ถามก่อน
- endpoint ใหม่ `PUT /merchant/bars/:barId/settings` (`app_save_settings_page` · migration `20261012000700_bar_save_settings_page`)
- ไฟล์: `page.tsx` · `api.ts` (`saveSettings` แทน `updateBookingSettings` / `setPayoutAccount`)

## 2026-10-10 — Bento ตาม Merchant 1i Store/Growth
- Bento 2×2: มัดจำ · บัญชีรับเงิน (การ์ดบัญชีปัจจุบัน + ปุ่ม "เปลี่ยน") · Grace period แบบปุ่มเลือก · PR ปุ่ม −/+ (ชาย/หญิง/LGBTQ+) · ปุ่มบันทึกบนหัวหน้า
- ไฟล์หลัก: `page.tsx`

# CHANGELOG — frontend/modules/merchant/settings

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `updateBookingSettings` · `setPayoutAccount` (`PATCH /merchant/bars/:barId/booking-settings` · `PUT /merchant/bars/:barId/payout-account`) — ย้ายมาจาก `services/api/<domain>.ts` / `services/queries/<domain>.ts` (ลบแล้ว) · เรียก `Rest` ตรง
- หน้าในโมดูล import จาก `./api` แทน `@/services/data` · พฤติกรรมเดิม (ชื่อฟังก์ชัน, query key)
