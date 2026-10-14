# @nightout/mock — ประวัติการแก้ไข

## 2026-10-13 — ดีลวันนี้
- `models.ts`: `BarPromotion` เพิ่ม `validFrom` / `validTo` (YYYY-MM-DD · map จาก `valid_from` / `valid_to` ของ `bar_detail` / `my_bar_detail`) ให้ป้าย "ดีลวันนี้" ตัดสินวันตรงกับ DB

## 2026-10-13 — ชั้นชำระเงินกลาง (payment intents + mock)
- `models.ts`: `Booking.deposit` เพิ่ม `method` (`SLIP` = โอน + สลิป · `ONLINE` = ชำระผ่านผู้ให้บริการ) และ `provider` (mock / beam …) จาก `booking_deposit_summary` ใหม่ — ให้หน้าเว็บแสดง "ชำระผ่าน …" แทน "สลิป ตรวจแล้ว"

## 2026-10-13 — วิธีตรวจ Safety
- `SafetyFeature.verifyMethod` (EVIDENCE ตรวจหลักฐาน / ON_SITE ลงพื้นที่ · ไม่มี = ถือเป็นตรวจหลักฐาน) · `verifySafety()` ตั้ง `verifyMethod = 'EVIDENCE'` + `verifiedAt` (ปุ่ม "ยืนยันแล้ว" ไม่ใช่การลงพื้นที่)
- เทสต์ใหม่ใน `src/mock.test.ts` · ไฟล์: `src/models.ts`, `src/service.ts`

## 2026-10-13 — ค้นหาตามงบ: จำนวนคน + ร้านไม่มีข้อมูลราคา
- `BarFilter` + `people` → `listBars` เหลือเฉพาะร้านที่มีโซนจุได้ทั้งกลุ่ม (`fitsGroup` จาก `@nightout/utils`)
- ตั้ง `maxBudget` แล้วร้านที่ `avgPerPerson = 0` (ไม่มีข้อมูลราคา) ไม่แสดง — เดิมผ่านทุกงบ ทำให้ "ไม่เกินคนละ ฿400" มีร้านที่ไม่รู้ราคา
- เทสต์ใหม่ใน `src/mock.test.ts` · ไฟล์: `src/service.ts`

## 2026-10-13 — ตำแหน่งร้าน (หมุด) + แอดมินตรวจหมุด
- `Bar` + `parkingNote` · `transit` (`BarTransit` สาย / สถานี / เดินกี่นาที) · `locationReviewedAt` + `locationRequest` (`BarLocationRequest` คำขอแก้ตำแหน่งล่าสุด — เฉพาะร้านของฉัน จาก `my_bar_detail`)
- ไฟล์: `src/models.ts`

## 2026-10-13 — เวลาปลดโต๊ะจาก DB + ต่อเวลา
- `Booking.autoCancelAt` / `extendedAt` (จาก `booking_detail.auto_cancel_at` / `extended_at`) · `autoCancelAt(b)` ใช้ค่าจาก DB ก่อน (รวมเวลาที่ลูกค้าต่อ 15 นาที) ไม่มีค่อยคำนวณจาก grace ของร้าน
- ไฟล์: `src/models.ts`, `src/service.ts`

## 2026-10-13 — โปรตัวอย่างไม่ใช่แอลกอฮอล์ · วันที่ตรวจ Safety
- โปรตัวอย่าง "โปรเบียร์ก่อน 2 ทุ่ม" → "มาก่อน 2 ทุ่ม มิกเซอร์ 4 จ่าย 3" · Ladies Night พุธ: "ค็อกเทลแก้วแรกฟรี" → "ของทานเล่นฟรี 1 จาน" (พ.ร.บ.ควบคุมเครื่องดื่มแอลกอฮอล์ ม.30) · `apps/backend/supabase/seed.sql` แก้ข้อความเดียวกัน (ไม่ gen ใหม่ทั้งไฟล์ เพราะค่าวันที่เลื่อนทุกบรรทัด)
- `SafetyFeature.verifiedAt` — วันที่ทีมงานลงพื้นที่ตรวจล่าสุด (ป้าย Safety แสดงวันที่)
- ไฟล์: `src/seed.ts`, `src/models.ts`

## 2026-10-11 — รีวิวได้เมื่อมัดจำผ่าน (ไม่ต้องเช็กอิน)
- `reviewableBooking()` / `addReview()` ใช้ `isReviewableStatus()` (มัดจำผ่านแล้วรีวิวได้ ไม่ต้องเช็กอิน)
- ไฟล์: `src/service.ts`

## 2026-10-09 — รูปร้าน + รูปเมนู
- `models.ts`: `Bar.gallery` (`BarPhoto` = id · path · url) · `MenuItem.imagePath` / `imageUrl` — ค่ามาจาก `media` / `menu[].image_path` ของ `bar_detail` · `my_bar_detail`

## 2026-10-08 — ตัด editorsPick
- ลบ `editorsPick` ออกจาก `Bar` และข้อมูลร้านเดโม (Editor's Pick ถูกตัดทั้งโปรเจกต์)
- ไฟล์: `src/models.ts`, `src/seed.ts`
