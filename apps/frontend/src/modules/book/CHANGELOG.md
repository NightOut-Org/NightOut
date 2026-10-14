# CHANGELOG — frontend/modules/book

## 2026-10-13 — ชั้นชำระเงินกลาง (payment intents + mock)
- ขั้นยืนยันการจอง: ข้อความยอด Table Fee ไม่ผูกกับการโอน ("ชำระเข้า NightOut" แทน "โอนเข้า NightOut") ใช้ได้ทั้งโหมดสลิปและชำระออนไลน์ · ไฟล์: `components/confirmStep.tsx`

## 2026-10-13 — บัญชีที่ถูกแบน: บอกเหตุผล
- `hooks/useBookingForm.ts` คืน `banReason` (จาก `currentProfile()`) · `components/confirmStep.tsx` Alert "บัญชีนี้ถูกระงับการจอง" แสดงเหตุผลที่แอดมินกรอก (ไม่ผูกกับสลิปปลอมแล้ว)
- ของกลางที่ใช้: `services/auth.tsx` (`AppUser.banReason` ← `GET /me/profile` `ban_reason`) · `services/sync.ts` (`SessionProfile.banReason` · สไตล์ที่ถูกซ่อนตัดออกจาก `styleIds` ของโปรไฟล์) · ใหม่ `ui/components/accountBannedBanner.tsx` (แถบแดง "บัญชีของคุณถูกระงับ" + เหตุผล ในหน้า `/community*` · `/profile` · `/bookings*`) วางใน `layouts/main.tsx` เหนือ `<Outlet />`
- แบนกลางคันเห็นแถบหลังโหลดใหม่ (DB บล็อกการจอง/การเขียนชุมชนเองอยู่แล้ว — migration `20261013001000_account_manual_ban`)
- ไฟล์: `hooks/useBookingForm.ts`, `components/confirmStep.tsx`

## 2026-10-13 — จำนวนคนสูงสุดใช้ค่ากลาง
- `PAX_OPTIONS` เป็น 1–`MAX_GROUP_SIZE` (12 จาก `@nightout/utils` ค่าเดียวกับหน้าค้นหา) แทนเลข 12 ในไฟล์ · พฤติกรรมเหมือนเดิม
- ไฟล์: `utils/times.ts`

## 2026-10-13 — บอกการต่อเวลา 15 นาที · คืน Table Fee ≥ 6 ชม.
- ขั้นยืนยัน: เวลาเก็บโต๊ะต่อท้าย "ขอต่อเวลาได้อีก 15 นาที 1 ครั้ง" (`BOOKING_EXTENSION_MINUTES`) · checkbox พูดถึงการริบเมื่อมาไม่ทันจนถูกปลดโต๊ะ (Forfeited) · เงื่อนไข `deposit-v3`
- ร้านที่ไม่มีค่าชั่วโมงคืนเงิน ใช้ `DEFAULT_REFUND_BEFORE_HOURS` (6) แทน 24
- ไฟล์: `components/confirmStep.tsx`, `hooks/useBookingForm.ts` (+ `services/barsRepo.ts` ค่าเริ่มต้นเดียวกัน)

## 2026-10-13 — เรียก Table Fee แทนมัดจำ
- หน้า Checkout ใช้ "ค่าธรรมเนียมจองโต๊ะ (Table Fee)" (`TABLE_FEE_LABEL`) · ขั้นที่ 2 ชื่อ "ยืนยัน & ชำระ" · ปุ่ม "ยืนยันและไปชำระ Table Fee" · ข้อความ checkbox และเงื่อนไขใช้คำใหม่ (`depositTermsText` v2)
- ไฟล์: `page.tsx`, `components/confirmStep.tsx`, `hooks/useBookingForm.ts`

## 2026-10-09 — ย้าย API เข้า module (ADR 0007 นำร่อง)
- เพิ่ม `api.ts`: `useZoneAvailability` (GET `/bars/:barId/zone-availability`) + `createBooking` (POST `/bookings`) — เรียก `Rest` ตรง · type จาก `@nightout/contracts`
- `hooks/useBookingForm.ts` import จาก `../api` และส่ง body แบบ snake_case ตาม `C.CreateBookingBody` ตรง (เลิกแปลง camelCase ในชั้น services) — พฤติกรรมเดิม
- ลบของเดิมออกจาก `services/api/booking.ts` (`createBooking`, `fetchZoneAvailability`) · `services/queries/booking.ts` (`useZoneAvailability`, `ZoneSlot`) · `queries/keys.ts` (`bookingKeys.zoneAvailability`)
