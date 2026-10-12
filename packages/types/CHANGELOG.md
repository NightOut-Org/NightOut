# CHANGELOG — @nightout/types

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
