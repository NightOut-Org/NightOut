# booking — ประวัติการแก้ไข

## 2026-10-17 — booking_customer_name ต้องมีการจองจริง (ปิด IDOR)
- เดิมทีมร้านเรียก `rpc/booking_customer_name` ตรงผ่าน PostgREST ได้ ส่ง `p_bar` ร้านตัวเองคู่กับ `p_user` ของใครก็ได้ → อ่านชื่อที่แสดงของผู้ใช้ทุกคน · ตอนนี้ต้องมีการจองของ `p_user` ที่ร้าน `p_bar` ก่อนถึงคืนชื่อ (ผู้เรียกยังต้องเป็นเจ้าของการจองหรือทีมร้าน) · ถอนสิทธิ์ `anon` / `public`
- view `booking_detail` ได้ผลเหมือนเดิม (ส่ง user/ร้านของการจองจริงอยู่แล้ว)
- migration `20261017000200_booking_customer_name_scope`

## 2026-10-14 — ตั้งตัวรัน job ด้วย pg_cron + ปิด job ในเครื่อง dev
- ปัญหา: บน DB จริงไม่มี pg_cron ตั้งไว้ และ backend `pnpm dev` ทุกเครื่องที่ต่อ DB จริงยิง `rpc/run_booking_timeouts` ทุกนาทีซ้ำกัน (~3 ครั้ง/นาที) → API log เต็มโควตา Free Plan · เว็บจริงไม่มีตัวรัน job ถ้าไม่มีใครเปิด dev
- migration `20261014000100_booking_cron_jobs`: pg_cron เรียกฟังก์ชันใน DB ตรง (ไม่ผ่าน HTTP → ไม่เกิด API log) — `nightout-booking-timeouts` ทุกนาที · `nightout-tier` 00:05 เวลาไทย · `nightout-job-cleanup` ล้าง `cron.job_run_details` / `job_runs` เก่าทุกคืน
- `JOBS_LOCAL_INTERVAL_MS` ค่าเริ่มต้นเป็น 0 (ปิด `LocalJobsScheduler`) เปิดเองเฉพาะ DB ในเครื่องที่ไม่มี pg_cron · `/api/jobs/*` ยังเรียกมือได้
- ไฟล์: `supabase/migrations/20261014000100_booking_cron_jobs.sql` · `src/jobs/local-jobs.scheduler.ts` · `src/config/env.ts` · `.env.example`

## 2026-10-13 — ทีมร้านกด "ปลดโต๊ะ (Forfeited)" เอง (คอมเมนต์ #76)
- migration `20261013001500_booking_team_forfeit`: rpc `app_team_forfeit_booking(p_actor, p_booking)` — ทีมร้านทุกบทบาท (รวม STAFF/PR) ปลดโต๊ะได้เฉพาะการจอง CONFIRMED ที่เลย `auto_cancel_at` แล้ว → `NO_SHOW` ผลเหมือน job `run_booking_timeouts` (Table Fee ให้ร้าน + แจ้งลูกค้า/ทีมร้าน/แอดมินผ่าน trigger เดิม) · ประวัติ reason `team forfeit` · audit `booking.forfeit`
- endpoint ใหม่ `POST /merchant/bookings/:bookingId/forfeit` (`booking.merchant.controller.ts` · ตอบ `{id, status: "NO_SHOW"}`) · error `BOOKING_NOT_OVERDUE` / `BOOKING_NOT_CONFIRMED` / `NOT_BAR_MEMBER` · เทสต์ 401 ใน `test/app.test.ts`
- ไฟล์: `booking.merchant.controller.ts` · `supabase/migrations/20261013001500_booking_team_forfeit.sql`

## 2026-10-13 — ยอดขายเฉลี่ย (ประมาณการ) /merchant/analytics
- migration `20261013001400_booking_sales_stats`: rpc `bar_sales_stats(p_bar, p_days = 30)` (security definer · เฉพาะเจ้าของ/ผู้จัดการ `is_bar_manager` → `NOT_BAR_MANAGER` 42501 · ช่วง 1–366 วัน → `INVALID_STATS_RANGE` 22023 · grant `authenticated`) คืน `current` / `previous` + helper ภายใน `bar_sales_period` (security invoker · service_role เท่านั้น) · ไม่มีตารางใหม่ ไม่แก้ object เดิม
- Table Fee ที่ร้านได้ = แถว `deposits` VERIFIED ที่เงินไปทางร้าน (PAYOUT_PENDING / PAID_OUT / CREDIT · ทั้งสลิปและชำระออนไลน์) · ยอดใช้จ่ายโดยประมาณ = snapshot ราคาตอนจอง (ถ้ามี) หรือราคาต่อคนโดยประมาณ × จำนวนคน ของการจองที่เช็กอิน — ไม่ใช่บิลจริง
- endpoint ใหม่ `GET /merchant/bars/:barId/sales-stats?days=` (`SalesStatsQueryDto`) · Staff/PR = 403 · ไม่มี token = 401 (เทสต์ใน `test/app.test.ts`)
- ไฟล์: `booking.merchant.controller.ts`, `booking.dto.ts`, `booking.module.ts`

## 2026-10-13 — ผังโต๊ะ /merchant/floor
- migration `20261013001200_booking_table_board`: ตารางใหม่ `table_occupancies` (ทีมร้านตั้งโต๊ะเป็น "กำลังใช้" เองโดยไม่มีการจอง · 1 โต๊ะเปิดได้ 1 รอบ · เกิน 12 ชม. = หมดอายุ · RLS ทีมร้าน + `admin_read` · เขียนได้ผ่าน rpc เท่านั้น)
- rpc `bar_table_board(p_bar, p_night)` (security definer · ทีมร้านทุกบทบาท + แอดมิน `is_admin()`): โซน/โต๊ะพร้อมสถานะ FREE / RESERVED / IN_USE, การจองปัจจุบัน/ถัดไป และ "กำลังใช้" ที่ตั้งเอง คิด ณ เวลา server ของคืนปัจจุบันเสมอ + การจองของคืน 06:00–06:00 (`night` เปลี่ยนแค่รายการนี้) · ไม่มียอดเงิน / เบอร์โทร
- rpc `app_team_set_table_occupancy` (ทีมร้านทุกบทบาท · เช็กสิทธิ์ก่อน lock แถวโต๊ะ · error `TABLE_NOT_ON_BOARD` / `TABLE_ALREADY_IN_USE` / `TABLE_NOT_IN_USE` / `TABLE_HAS_GUEST` / `PAX_OUT_OF_RANGE` · audit `table.occupy` / `table.release`)
- trigger `bookings_checkin_close_occupancy` (`close_table_occupancy_on_check_in`): เช็กอิน หรือย้ายการจองที่เช็กอินแล้วมาที่โต๊ะ → ปิดรอบ "กำลังใช้" ที่ตั้งเองของโต๊ะนั้น
- endpoint ใหม่: `GET merchant/bars/:barId/table-board?night=` · `POST merchant/tables/:tableId/occupancy` `{in_use, pax?, note?}` · `GET admin/bars/:barId/table-board?night=` (Backoffice ดูอย่างเดียว — controller ใหม่ `booking.admin.controller.ts` · `AdminGuard`)
- ไฟล์: `booking.merchant.controller.ts`, `booking.admin.controller.ts`, `booking.dto.ts` (`TableBoardQueryDto` · `TableOccupancyDto`), `booking.module.ts`, `test/app.test.ts` (401)

## 2026-10-13 — ชั้นชำระเงินกลาง (payment intents + mock)
- migration `20261013001100_payment_intents`: `booking_transition_allowed` อนุญาต AWAITING_DEPOSIT → CONFIRMED (ระบบเท่านั้น · `app_team_set_booking_status` ยังมี whitelist ของตัวเอง ร้านยืนยันการจองที่ยังไม่จ่ายไม่ได้)
- `handle_booking_status_effects` (ตัวจริง = `20261013001100`): ยืนยันจากการชำระออนไลน์ → แจ้งลูกค้า "ชำระ Table Fee สำเร็จ — E-Ticket พร้อมใช้แล้ว" + แจ้งทีมร้าน "ลูกค้าชำระ Table Fee แล้ว — ยืนยันการจองอัตโนมัติ" (ไม่มียอดเงิน — Staff/PR ห้ามเห็นเงิน · ลิงก์ `/merchant/bookings/:id`) · ประวัติสถานะเหตุผล `payment paid`
- trigger ใหม่ `bookings_close_payment_intents`: การจองออกจาก AWAITING_DEPOSIT (หมดเวลา / ยกเลิก / ส่งสลิป) → ปิดรายการชำระที่ค้าง PENDING

## 2026-10-13 — ยืนยันก่อนเช็กอิน · ร้านไม่มีโต๊ะให้ลูกค้า
- endpoint ใหม่ `GET /merchant/bars/:barId/check-in/preview?code=` (`booking.merchant.controller.ts` · rpc `bar_check_in_preview` อ่านในนามผู้เรียก · migration `…20261013000710_booking_check_in_preview`) — ดูการจองก่อนกดเช็กอิน: ชื่อ/จำนวนคน/โซน/โต๊ะ/เวลา/โปร + เช็กอินได้ไหม (`block_reason` NOT_CONFIRMED / ALREADY_CHECKED_IN / TOO_EARLY / TOO_LATE) ตามเวลา server · ทีมร้านทุกบทบาท · ไม่มียอดเงิน/เบอร์ (Staff/PR ใช้)
- endpoint ใหม่ `POST /merchant/bookings/:bookingId/no-table` `{note?}` (rpc `app_team_report_no_table` · migration `…20261013000700_bar_blacklist_strikes`) — ทีมร้านทุกบทบาท: CONFIRMED / CHECKED_IN → คืน Table Fee เต็ม (ผ่าน `app_team_refund_deposit`) + ยกเลิกถ้ายังไม่เช็กอิน + บันทึก `bar_strikes` + แจ้งแอดมิน/ทีมร้าน · CONFIRMED ที่ไม่มี Table Fee ให้คืน = ยกเลิกอย่างเดียว (STAFF ทำไม่ได้) · ซ้ำ → `NO_TABLE_ALREADY_REPORTED` · แอดมินตัดสิน Blacklist ที่ Backoffice
- DTO `CheckInPreviewQueryDto` · `ReportNoTableDto` (`booking.dto.ts`) · เทสต์ 401 ใน `test/app.test.ts`

## 2026-10-13 — กติกาเวลาการจอง: ต่อเวลา 15 นาที · ไปด้วย · ปลดโต๊ะ (Forfeited)
- endpoint ใหม่ `POST /bookings/:id/extend` (`booking.me.controller.ts` · rpc `app_extend_booking`) — ผู้จองขอต่อเวลา 15 นาทีได้ 1 ครั้ง ตั้งแต่ 15 นาทีก่อนเวลาจองจนถึงเวลาปลดโต๊ะ → `auto_cancel_at` + 15 นาที · แจ้งทีมร้าน · `BOOKING_ALREADY_EXTENDED` / `BOOKING_EXTEND_NOT_AVAILABLE`
- endpoint ใหม่ `POST /share-cards/:token/join` (rpc `app_join_share`) — เพื่อนกด "ไปด้วย" จากลิงก์แชร์ (ต้องล็อกอิน · กดซ้ำไม่นับซ้ำ · แจ้งผู้จองเมื่อมีคนเข้าใหม่) · `GET /share-cards/:token` (`booking.public.controller.ts`) อัปเดต `@ApiDoc`: `get_share_card` คืน `is_member` + `checkin_qr` (QR เดียวกับผู้จอง เฉพาะสมาชิก + CONFIRMED) ให้ใครถึงร้านก่อนสแกนเช็กอินทั้งโต๊ะ
- เช็กอินได้ตั้งแต่ 3 ชม. ก่อนเวลาจองจนถึงเวลาปลดโต๊ะ — trigger `bookings_check_in_window` บังคับทุกทาง (QR / รหัส / ทีมร้าน / แอดมิน · `CHECK_IN_TOO_EARLY` / `CHECK_IN_TOO_LATE`) · เวลาเช็กอินเป็นเวลา server
- `run_booking_timeouts` แจ้งเตือน 15 นาทีก่อนเวลาจอง (ผู้จอง + เพื่อนที่กดไปด้วย) + เตือนผู้จอง 5 นาทีก่อนปลดโต๊ะถ้ายังไม่ต่อเวลา · ผลมี `reminded` / `warned` เพิ่ม (`jobs/jobs.controller.ts` `BookingTimeoutsResult` · log ใน `jobs/local-jobs.scheduler.ts`)
- NO_SHOW = ปลดโต๊ะ (Forfeited): `handle_booking_status_effects` แจ้งลูกค้า + ทีมร้าน (โต๊ะว่างรับ walk-in ได้) + แอดมิน · `booking_detail` + `extended_at` · โต๊ะทั่วไปคืน Table Fee เมื่อยกเลิก ≥ 6 ชม. (`refund_before_hours` = 6 ทุกร้าน)
- เทสต์ 401 ของ 2 เส้นใหม่ใน `test/app.test.ts`
- migration `20261013000500_booking_timing_rules`

## 2026-10-13 — บัตรแชร์มี Table Fee ให้หารต่อหัว
- rpc `get_share_card` คืน `deposit_required` เพิ่ม (drop + create เพราะเปลี่ยนชนิดผลลัพธ์) · `GET /share-cards/:token` อัปเดต `@ApiDoc`
- migration `20261013000300_booking_share_card_fee`

