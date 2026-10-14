# CHANGELOG — @nightout/types

## 2026-10-13 — ยอดขายเฉลี่ย (Performance Analytics)
- `database.generated.ts`: เพิ่ม `bar_sales_stats` / `bar_sales_period` (migration `20261013001400_booking_sales_stats`) แบบแก้มือ — รัน `db:types` หลัง `db:push` ให้ตรงของจริง

## 2026-10-13 — Native Mini-Ads (โฆษณาแบนเนอร์เล็ก)
- `database.ts`: `Db.AdminMiniAd` (view `admin_mini_ads` · migration `20261013001300_mini_ads_banners` — ทุกสถานะ + ผู้ยืนยันไม่ใช่แอลกอฮอล์ + ยอดเห็น/คลิกรวม) · ไฟล์: `src/database.ts`

## 2026-10-13 — ชั้นชำระเงินกลาง (payment intents + mock)
- `enums.ts`: `PaymentIntentStatus` (PENDING/PAID/FAILED/EXPIRED/CANCELLED) · `PaymentRefundStatus` (NONE/REQUIRED/REFUNDED) · `PaymentEventType` — ตามตาราง `payment_intents` / `payment_events` (migration `20261013001100_payment_intents`)
- `database.ts`: `Db.AdminPaymentIntent` (view `admin_payment_intents` + webhook ล่าสุด 20 ตัว) · `Db.AdminPaymentUnmatched` · `PaymentEventRow` · `Db.AdminDeposit` + `payment_intent_id` / `payment_provider` · `BOOKING_TRANSITIONS` เพิ่ม AWAITING_DEPOSIT → CONFIRMED (SYSTEM — webhook จ่ายสำเร็จ)
- `database.generated.ts` สร้างใหม่หลัง migration · ไฟล์: `src/enums.ts`, `src/database.ts`, `src/database.generated.ts`

## 2026-10-13 — type แถว view ของเครื่องมือแอดมิน
- `src/database.ts`: `Db.AdminBarDetails` (view `admin_bar_details` · migration `20261013001010`) · `Db.AdminStyle` (`admin_styles` · `…001020`) · `Db.AdminRanking` (`admin_ranking` · `…001030` · คะแนนแยกส่วน + อันดับในประเภท/ย่าน + โหวตสัปดาห์/เดือน)
- เขียนเอง — `database.generated.ts` ต้องรัน `pnpm --filter @nightout/backend db:types` หลัง `db:push`

## 2026-10-13 — ชุมชน: สิทธิ์ทีมร้าน (ป้ายทีมร้าน · ข่าวจากร้าน · ไม่นับไลก์/ร้านมาแรง)
- `database.ts`: `CommunityTeamBarRef` · `Db.AdminCommunityThread` / `Db.AdminCommunityComment` + `team_bar` / `excluded_like_count` (view `admin_community_*` · migration `…20261013000900`)
- `database.generated.ts` ไม่ได้แก้มือ — เจ้าของรัน `db:push` แล้ว `db:types`

## 2026-10-13 — ลงพื้นที่ตรวจ Safety (Inspector) + วิธีตรวจ
- `enums.ts`: `SafetyCheckResult` (PASS ผ่าน / FAIL ไม่พบ / NA ไม่ได้ตรวจ) · `SafetyVerifyMethod` (EVIDENCE ตรวจหลักฐาน / ON_SITE ลงพื้นที่)
- `database.ts`: `SafetyEntry` + `verify_method` · `SafetyInspectionItem` · `Db.AdminBarSafety` (view `admin_bar_safety`) · `Db.AdminSafetyInspection` (view `admin_safety_inspections`) · `AdminSafetyItem` + `bar_id` / `last_result`
- `database.generated.ts` แก้มือ (migration `…20261013000800`): enum `safety_verify_method` · `bar_safety_features.verify_method` · ตาราง `safety_inspections` / `safety_inspection_items` · view `admin_bar_safety` / `admin_safety_inspections` / `admin_safety_queue` (+ คอลัมน์) · ฟังก์ชัน `admin_inspect_safety` / `bar_safety_inspection_latest` / `safety_inspection_photo_ok` — เจ้าของรัน `db:types` หลัง `db:push` ทับได้

## 2026-10-13 — Blacklist ร้าน
- `src/database.ts`: `Db.AdminBarBlacklist` (view `admin_bar_blacklist` · migration `…20261013000700`: สถานะ Blacklist + เหตุผล + ผู้ทำ + จำนวนครั้งไม่มีโต๊ะทั้งหมด / 90 วัน) + `Db.AdminBarStrike` (ประวัติไม่มีโต๊ะ 1 แถว · `source` TEAM / ADMIN)
- `database.generated.ts` ไม่ได้แก้มือ — เจ้าของรัน `db:push` แล้ว `db:types`

## 2026-10-13 — ตำแหน่งร้าน (หมุด) + แอดมินตรวจหมุด
- enum ใหม่ใน `enums.ts`: `TransitLine` (BTS / MRT / ARL / SRT) · `LocationRequestStatus` (PENDING / APPROVED / REJECTED / CANCELLED) · `LocationRequestSource` (MERCHANT / ADMIN = ทีม NightOut ตั้งแทน)
- `database.ts`: `BarLocationFields` (7 ช่องของตำแหน่งร้าน) · `MyBarLocationRequest` · `AdminBarLocation` (view `admin_bar_locations`) · `AdminBarLocationRequest` (view `admin_bar_location_requests`) · override `BarDetail` + `parking_note` / `transit_*` · `MyBarDetail` + `parking_note` / `transit_*` / `location_reviewed_at` / `location_request`
- `database.generated.ts` ยังไม่ได้สร้างใหม่ — รัน `db:types` หลัง `db:push` migration `20261013000600_bar_location_pins`
- ไฟล์: `src/enums.ts`, `src/database.ts`

## 2026-10-13 — แดชบอร์ดแอดมิน: ปลดโต๊ะวันนี้
- `database.generated.ts`: `admin_dashboard.Returns` + `forfeited_today: number` → `Db.AdminDashboard` มี field ใหม่ (แก้มือ — รัน `db:types` ใหม่หลัง `db:push` migration `20261013000500_booking_timing_rules` · `bookings.extended_at` / `booking_detail.extended_at` จะเข้ามาตอนนั้น)

## 2026-10-12 — ชุมชน: แก้ไขความเห็น + ประวัติการแก้ไข
- `Db.CommunityRevisionRow` · `AdminCommunityThread.revisions` · `AdminCommunityComment.edited_at` + `revisions` (view admin_community_* · migration `20261012000800`)
- `database.generated.ts` ยังไม่ได้สร้างใหม่ — รัน `db:types` หลัง `db:push`

## 2026-10-11 — ชุมชน: แนบรูป/วิดีโอในกระทู้และความเห็น
- `database.ts`: `CommunityMediaRow` + `media` ใน `AdminCommunityThread` / `AdminCommunityComment` (migration `20261011000100_community_media`)

## 2026-10-10 — ชุมชน: ปักหมุดส่วนตัว + ฉบับร่างเก็บที่ backend
- `database.ts`: `CommunityStatus` · `CommunityReportRow` · `AdminCommunityThread` · `AdminCommunityComment` (view ใหม่ใน migration `20261010000100_community_threads` — ยังไม่ได้รัน `db:types` เพราะยังไม่ได้ `db:push`)

## 2026-10-09 — รูปร้าน
- `database.ts`: `MyBarDetail.media` · `AdminBarMedia` (view `admin_bar_media` · migration `20261009000100`)
- `database.generated.ts`: รัน `db:types` หลัง push migration `20261009000100` (ฟังก์ชัน/view รูปร้านใหม่)

## 2026-10-08 — ตัด is_editor_pick
- ลบ `is_editor_pick` จาก `BarCardNonNull` / `AdminBar` · แก้ `database.generated.ts` ด้วยมือให้ตรง migration `20261008000400_bar_drop_editor_pick` (ไม่มีตาราง `editor_picks` / คอลัมน์ `is_editor_pick` / rpc `admin_set_editor_pick` · `admin_bars.promoted_until`) — รัน `db:types` หลัง `db:push`
- ไฟล์: `src/database.ts`, `src/database.generated.ts`

## 2026-10-08 — ร้านยอดนิยมหน้าแรก
- เพิ่ม `Db.AdminHomePopular` · แก้ `database.generated.ts` ด้วยมือให้ตรง migration `20261008000300_site_content_home_popular` (`home_popular_bars`, `popular_*` ใน `home_content`, view `public_home_popular` / `admin_home_popular`, rpc `admin_save_home_popular`) — รัน `db:types` หลัง `db:push` เพื่อ generate ทับ
- ไฟล์: `src/database.ts`, `src/database.generated.ts`

## 2026-10-08 — site-team: ฟังก์ชัน team_member_is_own
- `database.generated.ts`: รัน `db:types` หลัง `db:push` migration `20261008000200_site_team_super_admin_rules` → เพิ่ม `team_member_is_own` ใน Functions

## 2026-10-08 — ลบ home_categories.icon
- `database.generated.ts`: ตัด `icon` ออกจาก `home_categories`, `admin_home_categories`, `public_home_categories` ให้ตรงกับ migration `20261008000100_site_content_drop_category_icon` (แก้มือ — รัน `db:types` ซ้ำหลัง `db:push` ได้ผลเท่ากัน)
