## 2026-10-13 — ปุ่ม "ปลดโต๊ะ (Forfeited)" (คอมเมนต์ #76)
- ปุ่มแดง "ปลดโต๊ะ (Forfeited)" แสดงกับทีมร้านทุกบทบาทเมื่อ `canTeamForfeit` (CONFIRMED + เลยเวลาเก็บโต๊ะ) · Modal ยืนยันจาก `hooks/useConfirmForfeit` (Table Fee เป็นของร้าน + แจ้งลูกค้า · ไม่แสดงยอดเงิน)
- `forfeitBooking` เรียก `POST /merchant/bookings/:id/forfeit`
- ประวัติสถานะ: เหตุผล `team forfeit` แสดงผู้ทำเป็น "ร้าน" (`services/mappers/booking.ts` · `historyBy`)
- ไฟล์: `page.tsx` · `api.ts`

## 2026-10-13 — เหตุผลยกเลิก/คืน Table Fee + "ร้านไม่มีโต๊ะให้ลูกค้า"
- ยกเลิกการจอง (เจ้าของ/ผู้จัดการ) เปิด `modal/cancelModal.tsx` ต้องเลือกเหตุผลก่อน (เดิมยกเลิกทันทีโดยไม่มีเหตุผล) · กล่องคืน Table Fee (`modal/refundModal.tsx`) ใช้ตัวเลือกชุดเดียวกัน (`components/reasonPicker.tsx` + `utils/cancelReasons.ts`: ร้านไม่มีโต๊ะให้ลูกค้า · ร้านปิดกะทันหัน · ลูกค้าขอยกเลิก · อื่น ๆ)
- เหตุ "ร้านไม่มีโต๊ะให้ลูกค้า" (เฉพาะ CONFIRMED / CHECKED_IN) → `reportNoTable` (`POST /merchant/bookings/:id/no-table`) คืน Table Fee เต็ม + บันทึกประวัติร้าน + แจ้งทีม NightOut (แอดมินตัดสิน Blacklist) · STAFF ใช้ได้ผ่านกล่องคืน Table Fee · รายละเอียดยาวได้ 300 ตัวอักษร
- ไฟล์: `page.tsx`, `api.ts`, `modal/cancelModal.tsx`, `modal/refundModal.tsx`, `components/reasonPicker.tsx`, `utils/cancelReasons.ts`

## 2026-10-13 — ประวัติลูกค้า: ถูกปลดโต๊ะ
- ประวัติลูกค้า "ไม่มา N ครั้ง" → "ถูกปลดโต๊ะ N ครั้ง" / "ไม่เคยถูกปลดโต๊ะ" · สถานะ NO_SHOW แสดง "ปลดโต๊ะ (Forfeited)" · ไฟล์: `page.tsx`

## 2026-10-10 — สร้างหน้ารายละเอียดการจอง (ตาม Merchant 1i Sitemap)
- หน้าใหม่ `/merchant/bookings/:id` (เดิมเป็น Drawer): Bento — ข้อมูลการจอง (มาร้านนี้ครั้งที่ / เวลา–เวลาจบตามโซน) · มัดจำ (สถานะสลิป + สถานะเงิน) · โปรที่เลือก (cutoff + วัน) + ยอดประเมินจาก avg/คน · ประวัติสถานะ · จัดการหน้างาน (ย้ายโต๊ะ บอกจำนวนโต๊ะว่าง / ยืนยันการคืนเงิน)
- มือถือ: แถบปุ่มล่าง ย้ายโต๊ะ · คืนเงิน · ปุ่มหลัก (เช็กอิน/รับจอง) แทนแท็บล่าง · เปิดด้วย `?move=1` = เปิดหน้าต่างย้ายโต๊ะทันที
- ใช้ข้อมูลจาก store (`barBookings`) + endpoint เดิม `POST /merchant/bookings/:id/{status,move,refund}` · `GET …/table-options` · ไม่มี migration/endpoint ใหม่
- ไฟล์หลัก: `page.tsx` `api.ts` `modal/*` · route ใน `router/index.tsx`

## 2026-10-13 — เรียก Table Fee แทนมัดจำ
- การ์ดเงิน / ยืนยันคืนเงิน ใช้ "Table Fee" · ไฟล์: `page.tsx`, `modal/refundModal.tsx`

