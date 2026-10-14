# backoffice — ประวัติการแก้ไข

## 2026-10-13 — ชั้นชำระเงินกลาง (payment intents + mock)
- views ใหม่ `admin_payment_intents` · `admin_payment_unmatched` (migration `20261013001100_payment_intents`) อ่านผ่าน `GET /admin/views/:view` (อยู่ใน `ADMIN_VIEWS`) + เทสต์ `assertAdminView` ใน `backoffice.test.ts`

## 2026-10-13 — view ของเครื่องมือแอดมิน (Group 6)
- `GET /admin/views/:view` อ่าน `admin_bar_details` (`…20261013001010`) · `admin_styles` (`…001020`) · `admin_ranking` (`…001030`) ได้ (ADMIN + MFA · อยู่ใน `ADMIN_VIEWS`) · `GET /admin/master/districts` (เพิ่ม `districts` ใน `ADMIN_MASTER_TABLES`)
- เทสต์ `backoffice.test.ts` (`assertAdminView` รับ 3 view ใหม่สำหรับ ADMIN)

## 2026-10-13 — view ลงพื้นที่ตรวจ Safety
- `GET /admin/views/:view` อ่านได้เพิ่ม `admin_bar_safety` (checklist ทุกข้อของร้าน + วิธี/ผู้/วันที่ตรวจ + ผลลงพื้นที่ล่าสุด) · `admin_safety_inspections` (ประวัติการตรวจ + รายข้อ) — แอดมินทุกคน (ไม่ใช่ view เฉพาะ Super Admin) · เพิ่มใน `ADMIN_VIEWS` (`packages/contracts/src/backoffice.ts`)
- `admin_safety_queue` มีคอลัมน์ต่อท้าย `bar_id` · `last_result` · `last_inspected_at` · `verified_by_name` · `verify_method` · `awaiting_visit` (คอลัมน์เดิมไม่เปลี่ยน)
- migration `20261013000800_bar_safety_inspections` · เทสต์ใน `backoffice.test.ts`

## 2026-10-13 — view Blacklist ร้าน
- `admin_bar_blacklist` (migration `…20261013000700`) อ่านผ่าน `GET /admin/views/admin_bar_blacklist` — แอดมินทุกคน (ไม่ใช่ view เฉพาะ Super Admin) · เพิ่มใน `ADMIN_VIEWS` (`packages/contracts/src/backoffice.ts`)
- เทสต์ใน `backoffice.test.ts`

## 2026-10-13 — ตำแหน่งร้าน (หมุด) + แอดมินตรวจหมุด
- `GET /admin/views/:view` อ่าน view ใหม่ได้ 2 ตัว (เพิ่มใน `ADMIN_VIEWS` ของ contracts — controller ไม่ต้องแก้): `admin_bar_locations` (1 แถว/ร้าน: ตำแหน่งปัจจุบัน · `is_default_pin` · คำขอที่รอตรวจ) · `admin_bar_location_requests` (ประวัติคำขอ/การตั้งแทน) — ใช้ใน Backoffice `/bar-locations` + `/merchants`
- migration `20261013000600_bar_location_pins` (view `security_invoker` + `where is_admin()`)

## 2026-10-13 — แดชบอร์ด: ปลดโต๊ะวันนี้ (Forfeited)
- rpc `admin_dashboard` เพิ่ม `forfeited_today` (การจองสถานะ NO_SHOW ที่ `auto_cancel_at` ตรงวันนี้ตามเวลาไทย · drop + create) — `GET /admin/dashboard` คืน field ใหม่เอง (controller ไม่ต้องแก้)
- แอดมินได้แจ้งเตือน `BOOKING_FORFEITED` ทุกครั้งที่ระบบปลดโต๊ะ (ลิงก์ `/bookings?status=NO_SHOW`)
- migration `20261013000500_booking_timing_rules`

## 2026-10-13 — Audit Log ไม่แสดงงานของ Super Admin ให้แอดมิน · view ค่าคอมเฉพาะ Super Admin
- ใหม่ `is_super_admin()` (SUPER_ADMIN + aal2) · `audit_logs.admin_read` + view `admin_audit_logs`: แอดมินเห็นทุกแถว ยกเว้น `actor_role = SUPER_ADMIN` · Super Admin เห็นทั้งหมด (ตกลงกับเจ้าของ 2026-10-13)
- `GET /admin/views/:view` ตรวจ `SUPER_ADMIN_VIEWS` (`assertAdminView`) — `admin_billing_events` ให้ ADMIN ได้ 403 `SUPER_ADMIN_REQUIRED` · เทสต์ `backoffice.test.ts`
- migration `20261013000200_backoffice_super_admin_reads`

