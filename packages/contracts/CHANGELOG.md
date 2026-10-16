# CHANGELOG — @nightout/contracts

## 2026-10-16 — รูปโปรไฟล์
- `MyProfile.avatar_url` · `SetAvatarBody` · `AvatarResult` · `RemoveUserAvatarBody` / `RemoveUserAvatarResult` · `AVATAR_MAX_BYTES` · `AVATAR_MIME_TYPES` · error `AVATAR_INVALID` / `AVATAR_NOT_FOUND` / `AVATAR_REMOVE_REASON_REQUIRED` · `UPLOAD_BUCKETS` + `PUBLIC_BUCKETS` เพิ่ม `avatars` · เทสต์ใน `contracts.test.ts`

## 2026-10-15 — เมนู navbar (site-content)
- `SITE_NAV_KEYS` · `SiteNavKey` · `SITE_NAV_REQUIRED` · `SITE_NAV_LABEL_MAX` · `SiteNavItem` · `SaveSiteNavBody` (ครบทุกเมนู · ลำดับ 0..n-1 · หน้าหลักซ่อนไม่ได้) · `SaveSiteNavResult` · error `INVALID_SITE_NAV` · view `admin_site_nav` ใน `ADMIN_VIEWS` + เทสต์
- ไฟล์: `src/site-content.ts` · `src/backoffice.ts` · `src/contracts.test.ts`
- เอา `SaveHomePageBody` · `UpdateHomeContentBody` · `UpdateHomeCategoryBody` · `UpdateHomePopularBody` · `SaveHomePageResult` · zod `HomeCategorySlot` (เหลือเป็น type) · error `INVALID_HOME_PAGE` / `HOME_CATEGORY_NOT_FOUND` / `INVALID_HOME_POPULAR` / `HOME_POPULAR_BAR_NOT_FOUND` / `INVALID_HOME_CONTENT` · view `admin_home_content` / `admin_home_popular` ออกจาก `ADMIN_VIEWS` + เทสต์ที่เกี่ยว — Backoffice แก้หน้าแรกไม่ได้แล้ว

## 2026-10-15 — สมัครด้วย Google / Facebook
- `account.ts`: `OAuthSignupVerifyBody` / `OAuthSignupVerifyResult` · `OAuthSignupCompleteBody` / `OAuthSignupCompleteResult` · `OAuthSignupCancelResult` · รหัส error `OAUTH_*` ใน `ACCOUNT_ERRORS` + เทสต์

## 2026-10-13 — ทีมร้านกดปลดโต๊ะเอง (คอมเมนต์ #76)
- `src/booking.ts`: `TeamForfeitResult` (`{ id, status: 'NO_SHOW' }`) ของ `POST /merchant/bookings/:id/forfeit` · error ใหม่ `BOOKING_NOT_OVERDUE` ใน `BOOKING_ERRORS` (ยังไม่เลยเวลาเก็บโต๊ะ)
- เทสต์ใน `src/contracts.test.ts`

## 2026-10-13 — ยอดขายเฉลี่ย (Performance Analytics)
- `src/booking.ts`: `SalesStatsQuery` (`days` 1–366 ค่าเริ่มต้น 30) · `SalesStatsPeriod` · `SalesStatsResult` (`current` / `previous`) ของ `GET /merchant/bars/:barId/sales-stats` · error ใหม่ `INVALID_STATS_RANGE` ใน `BOOKING_ERRORS`
- เทสต์ใน `src/contracts.test.ts`

## 2026-10-13 — Native Mini-Ads (โฆษณาแบนเนอร์เล็ก)
- ใหม่ `src/mini-ads.ts` (โดเมน `mini-ads`): `MiniAdPlacement` (HOME / SEARCH) · `MiniAdBody` (สร้าง · ต้อง `confirm_no_alcohol: true` ข้อความ ม.32) · `UpdateMiniAdBody` (ส่งเฉพาะที่แก้) · `MiniAdsQuery` · `PublicMiniAd` · `TrackMiniAdBody` (IMPRESSION / CLICK) · `SaveMiniAdResult` / `DeleteMiniAdResult` / `TrackMiniAdResult` · `image_url` รับเฉพาะ `site-media/ads/…` หรือ `/images/…` · `link_url` เฉพาะ `https://` หรือ path ในเว็บ (ห้าม `//` และ backslash)
- `MINI_ADS_ERRORS` (`MINI_AD_NOT_FOUND` · `INVALID_MINI_AD` · `MINI_AD_NO_ALCOHOL_CONFIRM_REQUIRED` · `MINI_AD_INVALID_EVENT`) รวมใน `ERROR_MESSAGES` · `backoffice.ts`: `ADMIN_VIEWS` + `admin_mini_ads`
- เทสต์ใน `src/contracts.test.ts` · ไฟล์: `src/mini-ads.ts`, `src/errors.ts`, `src/backoffice.ts`, `src/index.ts`

## 2026-10-13 — ผังโต๊ะ /merchant/floor
- `booking.ts`: `TableBoardQuery` (`night?` YYYY-MM-DD) · type `TableBoard` / `TableBoardZone` / `TableBoardTable` / `TableBoardOccupancy` / `TableBoardBooking` (ไม่มียอดเงิน/เบอร์) · `TableOccupancyBody` / `TableOccupancyResult`
- error ใหม่ใน `BOOKING_ERRORS`: `TABLE_NOT_ON_BOARD` · `TABLE_ALREADY_IN_USE` · `TABLE_NOT_IN_USE` · `TABLE_HAS_GUEST`
- เทสต์ใน `src/contracts.test.ts` · ไฟล์: `src/booking.ts`

## 2026-10-13 — ชั้นชำระเงินกลาง (payment intents + mock)
- ใหม่ `src/payment.ts` (โดเมน `payment`): `PaymentConfig` (`GET /payments/config` · mode SLIP / PROVIDER) · `CheckoutResult` (`POST /bookings/:id/checkout`) · `PaymentIntentView` · `MockCompleteBody` / `PaymentApplyResult` / `PaymentWebhookResult` · `MarkPaymentRefundedBody` / `MarkPaymentRefundedResult` (`POST /admin/payments/:id/refunded`) · `PAYMENT_ERRORS` (ไม่ได้เปิด / ยังไม่พร้อม / ลายเซ็นผิด / หมดเวลาชำระ / ไม่ต้องคืนเงิน …) รวมใน `ERROR_MESSAGES`
- `deposit.ts`: error `SLIP_FLOW_DISABLED` (เปิดชำระออนไลน์แล้ว ส่งสลิปไม่ได้ → 409)
- `backoffice.ts`: `ADMIN_VIEWS` + `admin_payment_intents` · `admin_payment_unmatched`
- เทสต์ใน `src/contracts.test.ts` · ไฟล์: `src/payment.ts`, `src/deposit.ts`, `src/backoffice.ts`, `src/errors.ts`, `src/index.ts`

## 2026-10-13 — เครื่องมือแอดมิน: แบนบัญชี · แก้ข้อมูลร้านแทน · สไตล์ร้าน · อันดับร้าน
- ใหม่ `src/catalog.ts` (โดเมน `catalog`): `RankPeriod` · `RankingQuery` / `RankingRow` (`GET /public/ranking`) · `STYLE_ICONS` / `StyleIconName` · `SaveStylesBody` / `SaveStylesResult` (`PUT /admin/styles` — ชื่อ/ id ห้ามซ้ำ · ไม่มี id = สไตล์ใหม่) · `RecomputeRankingResult` (`POST /admin/ranking/recompute` · `/jobs/tier`) · `CATALOG_ERRORS` (`INVALID_STYLES`, `DUPLICATE_STYLE_NAME`) รวมใน `ERROR_MESSAGES`
- `account.ts`: `BanUserBody` / `BanUserResult` (`POST /admin/users/:id/ban` · เหตุผล 3–300 + `ban_phones`) · `UnbanUserBody.reason` บังคับ 3–300 · `MyProfile.ban_reason` · error `BAN_REASON_REQUIRED` · `CANNOT_BAN_SELF` · `CANNOT_BAN_ADMIN` · `USER_ALREADY_BANNED`
- `bar.ts`: `AdminBarInfoBody` (ข้อมูลร้านที่แอดมินแก้ได้ — ไม่มีที่อยู่) · `AdminMenuItem` · `AdminBarDetailsBody` / `AdminBarDetailsResult` (`PUT /admin/bars/:id/details` · อย่างน้อย 1 ส่วน) · error `INVALID_BAR_DETAILS` · `INVALID_STYLE`
- `backoffice.ts`: `ADMIN_VIEWS` + `admin_bar_details` · `admin_styles` · `admin_ranking` · `ADMIN_MASTER_TABLES` + `districts`
- เทสต์ใน `src/contracts.test.ts` · ไฟล์: `src/catalog.ts`, `src/account.ts`, `src/bar.ts`, `src/backoffice.ts`, `src/errors.ts`, `src/index.ts`

## 2026-10-13 — ชุมชน: สิทธิ์ทีมร้าน (ป้ายทีมร้าน · ข่าวจากร้าน · ไม่นับไลก์/ร้านมาแรง)
- `community.ts`: `COMMUNITY_SHOP_NEWS_CATEGORY` (`shop-news`) · `COMMUNITY_SHOP_NEWS_WEEKLY_MAX` (3) · `COMMUNITY_SHOP_NEWS_WINDOW_DAYS` (7) · `COMMUNITY_STAFF_BADGE` ("ทีม NightOut") · `communityTeamBadge()` · `CommunityTeamBadge` · `CommunityTeamBar` (`GET /me/community/team`) · `CommunityAuthor.team` · `CommunityCategory.team_only` · `CommunityLikeResult.counted`
- `CommunityThreadBody`: ข่าวจากร้านต้องมี `bar_id` · `ModerateCommunityBody`: HIDE / REMOVE ต้องมี `reason` (KEEP / RESTORE ไม่ต้อง)
- `COMMUNITY_ERRORS` + `COMMUNITY_CATEGORY_TEAM_ONLY` / `COMMUNITY_SHOP_NEWS_OWN_BAR` / `COMMUNITY_SHOP_NEWS_LIMIT` / `COMMUNITY_TEAM_CATEGORY` / `COMMUNITY_SHOP_NEWS_LOCKED` / `COMMUNITY_TEAM_OWN_TAG` (migration `…20261013000900`)
- เทสต์ใน `contracts.test.ts`

## 2026-10-13 — ลงพื้นที่ตรวจ Safety (Inspector) + วิธีตรวจ
- `bar.ts`: `SafetyInspectionBody` (items 1–50 · key ไม่ซ้ำ · ผล PASS / FAIL / NA · ต้องมี PASS หรือ FAIL ≥ 1 · หมายเหตุต่อข้อ ≤ 500 · รูป ≤ 3 ไม่ซ้ำ · หมายเหตุรวม ≤ 1000 · `inspected_at` ISO ไม่บังคับ) + `SafetyInspectionResult` · `SafetyInspectionSummary` / `SafetyInspectionItemView` (ผลล่าสุดที่ร้านเห็น · ไม่มีชื่อผู้ตรวจ) · `VerifySafetyResult` (`verify_method: 'EVIDENCE'`) · `BAR_ERRORS` + `INVALID_INSPECTION` / `INVALID_INSPECTION_PHOTO` / `INVALID_INSPECTION_TIME` / `INSPECTOR_IS_BAR_MEMBER` / `SAFETY_ALREADY_VERIFIED` / `SAFETY_EVIDENCE_REQUIRED`
- `backoffice.ts`: `ADMIN_VIEWS` + `admin_bar_safety` · `admin_safety_inspections`
- endpoint ที่ใช้: `POST /admin/bars/:id/safety-inspections` · `GET /merchant/bars/:barId/safety/inspection` · `POST /admin/safety/:id/verify` (migration `…20261013000800`)
- เทสต์ใน `contracts.test.ts`

## 2026-10-13 — ยืนยันก่อนเช็กอิน · ร้านไม่มีโต๊ะ · Blacklist ร้าน
- `booking.ts`: `CheckInPreviewQuery` (`code` 3–120) + `CheckInPreview` (ชื่อ/จำนวนคน/โซน/โต๊ะ/เวลา/โปร/หมายเหตุ + `can_check_in` / `block_reason` / `server_now` · **ไม่มียอดเงิน/เบอร์**) + `CheckInBlockReason` · `ReportNoTableBody` (`note` ≤ 300 ไม่บังคับ) + `ReportNoTableResult` (`refund_amount` · `strikes_90d`) · `BOOKING_ERRORS` + `NO_TABLE_NOT_ALLOWED` / `NO_TABLE_ALREADY_REPORTED`
- `bar.ts`: `BarBlacklistBody` (เหตุผล 3–500) + `BarBlacklistResult` (`upcoming_bookings`) · `AdminReportNoTableBody` (`booking_code` + `note` 3–300) + `AdminReportNoTableResult` · `BAR_ERRORS` + `BLACKLIST_REASON_REQUIRED` / `BAR_ALREADY_BLACKLISTED` / `BAR_NOT_BLACKLISTED` / `BAR_NOT_BLACKLISTABLE` / `BAR_BLACKLISTED` / `NO_TABLE_NOTE_REQUIRED` / `NO_TABLE_ADMIN_NOT_ALLOWED`
- `backoffice.ts`: `ADMIN_VIEWS` + `admin_bar_blacklist` (แอดมินทุกคน)
- endpoint ที่ใช้: `GET /merchant/bars/:barId/check-in/preview` · `POST /merchant/bookings/:bookingId/no-table` · `POST /admin/bars/:id/blacklist` · `POST /admin/bars/:id/blacklist/lift` · `POST /admin/bar-strikes` (migration `…20261013000700` / `…20261013000710`)
- เทสต์ใน `src/contracts.test.ts`

## 2026-10-13 — ตำแหน่งร้าน (หมุด) + แอดมินตรวจหมุด
- ตำแหน่งร้าน (`bar.ts`): `BarLocationBody` (หมุด `lat`/`lng` · `address` 3–300 · `parking_note` · `transit_line` / `transit_station` / `transit_walk_minutes`) + 3 ข้อตรวจ (หมุดต้องอยู่ในไทย · สายกับสถานีต้องมาคู่กัน · เวลาเดินต้องมีสถานี) · `BarLocationResult` (`PENDING` รอตรวจ / `APPLIED` บันทึกแล้ว) · `CancelBarLocationResult`
- แอดมิน: `ReviewBarLocationBody` (`{approve, location?, reason?}` — object เดียว + refine เพราะ `createZodDto(union)` คอมไพล์ไม่ผ่าน · ตีกลับต้องมีเหตุผล) · `ReviewBarLocationResult` · `AdminSetBarLocationBody` (+ `note` ถึงร้าน) · `AdminSetBarLocationResult`
- ค้นหาที่อยู่: `GeocodeSearchQuery` (`q` 2–120 · `limit` ≤ 8) · `GeocodePlace` · `GeocodeSearchResult` · `GeocodeReverseQuery` (พิกัดในไทย) · `GeocodeReverseResult`
- `MerchantJoinBody` ต้องมีหมุด + ที่อยู่ (+ ที่จอดรถ/รถไฟฟ้า) · `BarInfoBody` ไม่มี `address` แล้ว (แก้ผ่าน `PUT …/location` เท่านั้น · zod ตัด key ทิ้ง)
- `BAR_ERRORS` + `INVALID_BAR_LOCATION` · `LOCATION_OUTSIDE_THAILAND` · `LOCATION_UNCHANGED` · `LOCATION_REQUEST_NOT_FOUND` · `LOCATION_REQUEST_ALREADY_REVIEWED` · `LOCATION_REJECT_REASON_REQUIRED` · `BAR_LOCATION_NOT_SET` · `GEOCODER_UNAVAILABLE` · `GEOCODER_BUSY` (ข้อความไทย) · `INVALID_BAR_INFO` เหลือเรื่องชื่อร้าน
- `ADMIN_VIEWS` + `admin_bar_locations` · `admin_bar_location_requests` (`backoffice.ts`)
- เทสต์ใหม่ `src/bar-location.test.ts` · ไฟล์: `src/bar.ts`, `src/backoffice.ts` · migration `20261013000600_bar_location_pins`

## 2026-10-13 — กติกาเวลาการจอง: ต่อเวลา · ไปด้วย · QR ของกลุ่ม
- `ShareCard` + `is_member` (ผู้เรียกเป็นผู้จอง/เพื่อนที่กด "ไปด้วย" · ไม่ล็อกอิน = false) + `checkin_qr` (`NIGHTOUT:<booking id>` เฉพาะสมาชิก + CONFIRMED)
- ใหม่ `JoinShareResult` `{joined, going_count}` (`POST /share-cards/:token/join`) · `ExtendBookingResult` `{id, auto_cancel_at, extended_at}` (`POST /bookings/:id/extend`)
- `BOOKING_ERRORS` + `BOOKING_ALREADY_EXTENDED` · `BOOKING_EXTEND_NOT_AVAILABLE` · `CHECK_IN_TOO_EARLY` · `CHECK_IN_TOO_LATE` · `SHARE_NOT_FOUND` · `SHARE_CLOSED` (ข้อความไทย)
- ไฟล์: `src/booking.ts` · migration `20261013000500_booking_timing_rules`

## 2026-10-13 — Table Fee · ยอดหารต่อหัวในบัตรแชร์ · view ค่าคอมเฉพาะ Super Admin
- ข้อความ error ที่ลูกค้า/ร้านเห็นเปลี่ยน "มัดจำ" → "Table Fee" (`DEPOSIT_ERRORS`, `BOOKING_ERRORS.DEPOSIT_TERMS_REQUIRED`, `REVIEW_ERRORS.REVIEW_REQUIRES_BOOKING`)
- `ShareCard` เพิ่ม `deposit_required` (Table Fee ของการจอง — หน้าแชร์หารต่อหัว)
- ใหม่ `SUPER_ADMIN_VIEWS = ['admin_billing_events']` — `GET /admin/views/:view` ตอบ 403 ให้ ADMIN
- ตัวอย่างใน `.describe()` ไม่ใช้ชื่อเครื่องดื่มแอลกอฮอล์ (`pricing.ts`)
- ไฟล์: `src/booking.ts`, `src/deposit.ts`, `src/review.ts`, `src/backoffice.ts`, `src/pricing.ts`, `src/contracts.test.ts`

## 2026-10-12 — ชุมชน: แก้ไขความเห็น + ประวัติการแก้ไข
- `community.ts`: `UpdateCommunityCommentBody` (PATCH /community/comments/:id — ข้อความหรือไฟล์อย่างน้อย 1 อย่าง) · `UpdateCommunityCommentResult` · `CommunityRevision` (1 เวอร์ชันในประวัติ) · `CommunityComment.edited_at`
- ร่างชนิดใหม่ `EDIT_COMMENT` + `payload.comment_id` (ต้องมีเมื่อเป็นร่างแก้ความเห็น) · ข้อความ `NOT_COMMENT_OWNER` = แก้หรือลบได้เฉพาะของตัวเอง
- เทสต์ใน `contracts.test.ts`

## 2026-10-12 — body บันทึกหน้าแรก + ตั้งค่าร้านครั้งเดียว
- `site-content.ts`: `SaveHomePageBody` (`content?` + `categories?` (การ์ด + `slot` ไม่ซ้ำ) + `popular?` อย่างน้อย 1) + result · error `INVALID_HOME_PAGE` · ลบ `UpdateHomePopularResult`
- `bar.ts`: `SettingsPageBody` (`booking?` + `payout?` อย่างน้อย 1) + result · error `INVALID_SETTINGS_PAGE`
- เทสต์ใน `contracts.test.ts`

## 2026-10-12 — body บันทึกหน้าโปรโมชันครั้งเดียว
- `bar.ts`: `PromotionsPageBody` (`items?` + `fees?` อย่างน้อย 1) + `PromotionsPageResult` (PUT …/promotions-page) · `BarPromotionsBody` / `FeesBody` เดิมคงไว้ · error `INVALID_PROMOTIONS_PAGE` · เทสต์ใน `contracts.test.ts`

## 2026-10-12 — body บันทึกชั้นบัญชี + Safety ครั้งเดียว
- `account.ts`: `SetUsersRoleBody` (`changes: [{id, role}]` ไม่ซ้ำคน) + result · error `INVALID_ROLE_CHANGES` · ลบ `SetUserRoleBody`
- `bar.ts`: `SaveSafetyBody` (`items` แต่ละข้อมีค่าและ/หรือหลักฐาน · key ไม่ซ้ำ) + result · error `INVALID_SAFETY_ITEMS` · ลบ `SafetyBody` / `EvidenceBody`
- เทสต์ใน `contracts.test.ts`

## 2026-10-12 — body สำหรับบันทึกทั้งหน้าครั้งเดียว
- `bar.ts`: `SetBarsStatusBody` (ระงับต้องมีเหตุผล · ไม่ซ้ำร้าน) · `AdminBarMediaBody` (`gallery?` + `menu_images?` อย่างน้อย 1) · `DiscardBarMediaBody` · `BarStoreBody` (`info?` + `media?` อย่างน้อย 1) + result · error `INVALID_BAR_STORE` / `INVALID_BAR_STATUS_CHANGES` / `BAR_NOT_TOGGLEABLE` · ลบ `MenuItemImageBody`
- `site-team.ts`: `SaveTeamPageBody` (`order?` + `active?`) + result · error `INVALID_TEAM_PAGE` · ลบ `ReorderTeamBody`
- เทสต์ใน `contracts.test.ts`

## 2026-10-11 — รีวิวได้เมื่อมัดจำผ่าน (ไม่ต้องเช็กอิน)
- `REVIEW_ERRORS`: `REVIEW_REQUIRES_CHECKIN` → `REVIEW_REQUIRES_BOOKING` ("รีวิวได้หลังจองและมัดจำผ่านแล้วเท่านั้น")
- ไฟล์: `src/review.ts`

## 2026-10-11 — ชุมชน: แนบรูป/วิดีโอในกระทู้และความเห็น
- `community.ts`: `CommunityMediaItem` + `COMMUNITY_MEDIA_LIMITS` (6 ไฟล์ · รูป 15MB · วิดีโอ 60MB / 60 วิ) · `media` ใน `CommunityThreadBody` / `CommunityCommentBody` (ความเห็นต้องมีข้อความหรือไฟล์) / `CommunityDraftPayload` · response `CommunityMedia` (`url` / `thumb_url`) ใน `CommunityThreadDetail` + `CommunityComment` · error `INVALID_COMMUNITY_MEDIA`
- `storage.ts`: `community-media` อยู่ใน `UPLOAD_BUCKETS` · เทสต์ใน `contracts.test.ts`

## 2026-10-10 — ชุมชน: ปักหมุดส่วนตัว + ฉบับร่างเก็บที่ backend
- `community.ts` ใหม่: body/query ของฟีด (`CommunityFeedQuery` · `MyCommunityFeedQuery` scope mine/saved/pinned), กระทู้ (`CommunityThreadBody`), ความเห็น, ถูกใจ/บันทึก/ปักหมุด (`CommunityToggleBody`), รายงาน, ฉบับร่าง (`SaveCommunityDraftBody` · `CommunityDraftPayload` · `DeleteCommunityDraftQuery`), แอดมิน (`ModerateCommunityBody`) + type ของ response + ค่าคงที่ `COMMUNITY_PIN_MAX` = 3 · `COMMUNITY_DRAFT_TTL_DAYS` = 7
- `COMMUNITY_ERRORS` (รวมใน `ERROR_MESSAGES`) เช่น `COMMUNITY_PIN_LIMIT` · `THREAD_NOT_FOUND` · `INVALID_COMMUNITY_DRAFT` · `ADMIN_VIEWS` + `admin_community_threads` / `admin_community_comments`
- เทสต์ใน `contracts.test.ts`

## 2026-10-09 — รูปร้าน + รูปเมนู
- `bar.ts`: `BarMediaBody` (`paths` ไม่ซ้ำ ≤ `BAR_GALLERY_MAX` = 10 · `cover_path` ต้องอยู่ใน paths) + `BarMediaResult` · `MenuItemImageBody` + `MenuItemImageResult` · `MenuBody.items[].image_path` (nullish) · error ใหม่ `INVALID_BAR_MEDIA` · `INVALID_MENU_IMAGE` · `MENU_ITEM_NOT_FOUND` · `INVALID_MENU_ITEM` (DB โยนอยู่แล้วแต่ยังไม่มีข้อความไทย)
- `storage.ts`: `bar-media` อยู่ใน `UPLOAD_BUCKETS` และ `PUBLIC_BUCKETS` · `backoffice.ts`: `ADMIN_VIEWS` + `admin_bar_media`
- เทสต์ใน `contracts.test.ts`

## 2026-10-09 — รูปแบบคำตอบกลาง ApiResponse
- เพิ่ม `ApiResponse<T>` = `{ status: 'ok' | 'no', status_code, data, code, err_msg }` (รูปแบบคำตอบของทุก endpoint) + `errorMessageOf(code)` (รหัส → ข้อความไทย ใช้ใน backend)
- รหัสใหม่ใน `COMMON_ERRORS`: `VALIDATION_FAILED` · `TOO_MANY_REQUESTS` · `INTERNAL_ERROR` · เทสต์ `errorMessageOf`
- ไฟล์: `src/common.ts`, `src/errors.ts`, `src/contracts.test.ts`

## 2026-10-08 — bar: ตัด Editor's Pick
- ลบ `SetEditorPickBody` (endpoint `PATCH /admin/bars/:id/editor-pick` ถูกลบ · migration `20261008000400_bar_drop_editor_pick`)
- ไฟล์: `src/bar.ts`

## 2026-10-08 — site-content: ร้านยอดนิยมหน้าแรก
- เพิ่ม `HOME_POPULAR_MAX` · `UpdateHomePopularBody` / `UpdateHomePopularResult` · `PublicHomeResult.popular_bar_ids` · `HomeContent` + `UpdateHomeContentBody` มี `popular_eyebrow` / `popular_title` · error `INVALID_HOME_POPULAR` / `HOME_POPULAR_BAR_NOT_FOUND` · `ADMIN_VIEWS` + `admin_home_popular` + เทสต์ (คู่กับ migration `20261008000300_site_content_home_popular`)
- ไฟล์: `src/site-content.ts`, `src/backoffice.ts`, `src/contracts.test.ts`

## 2026-10-08 — site-team: สิทธิ์จัดการทีมงาน
- เพิ่มรหัส error `TEAM_MEMBER_NOT_OWN` (แอดมินแก้แถวของคนอื่น) และ `TEAM_MEMBER_EMAIL_LOCKED` (แอดมินเปลี่ยนอีเมลของแถวตัวเอง) ใน `SITE_TEAM_ERRORS` + เทสต์ · คู่กับ migration `20261008000200_site_team_super_admin_rules`
- ไฟล์: `src/site-team.ts`, `src/contracts.test.ts`

## 2026-10-08 — site-content: ลบไอคอนการ์ดหมวด
- ลบ `HOME_CATEGORY_ICON_KEYS` / `HomeCategoryIcon` · ตัด `icon` ออกจาก `UpdateHomeCategoryBody` และ `HomeCategory` (คู่กับ migration `20261008000100_site_content_drop_category_icon`)
- ไฟล์: `src/site-content.ts`, `src/contracts.test.ts`
