# CHANGELOG — @nightout/utils

## 2026-10-20 — พื้นที่ร้านครบทั้งประเทศ (หาจากหมุด)
- ใหม่ `src/area.ts`: `districtLabel` · `amphoeLabel` · `tambonLabel` · `provinceLabel` (กทม. ใช้ เขต/แขวง · "กรุงเทพฯ") · `areaLine` · `areaMatches` + เทสต์ `area.test.ts`

## 2026-10-20 — เลิกใช้ " · " คั่นข้อความที่ผู้ใช้เห็น
- ข้อความแจ้งผู้ใช้ (error message / ป้าย / สรุปสถานที่) เปลี่ยนจากต่อด้วยจุดกลางเป็นวรรคหรือวงเล็บ ให้อ่านแยกประเภทได้ · แก้เทสต์ที่อ้างข้อความให้ตรง

## 2026-10-20 — promptPayPayload ย้ายมาจาก @nightout/mock
- เพิ่ม `src/promptpay.ts` (`promptPayPayload`) + `promptpay.test.ts` · `@nightout/mock` ถูกลบ

## 2026-10-15 — อายุ 20+ จากวันเกิดของ Google / Facebook
- `age.ts` ใหม่: `googleBirthdate()` (เลือกวันเกิดจากบัญชีก่อนโปรไฟล์ · ต้องครบ วัน/เดือน/ปี) · `facebookBirthdate()` (`MM/DD/YYYY` เท่านั้น) · `isAtLeastAge()` (วันตัดตรง DB) · `OAUTH_BIRTHDAY_SCOPE` · `TERMS_VERSION` / `PRIVACY_VERSION` + เทสต์ `age.test.ts`

## 2026-10-13 — ทีมร้านกดปลดโต๊ะเอง (คอมเมนต์ #76)
- `src/booking-status.ts`: `CONFIRMED → NO_SHOW` ทำได้โดย `SYSTEM` + `MERCHANT` + `STAFF` (ทีมร้านทุกบทบาทกด "ปลดโต๊ะ (Forfeited)" เองได้เมื่อเลยเวลาเก็บโต๊ะ) · ลูกค้า/แอดมินยังทำไม่ได้
- `src/booking-time.ts`: ใหม่ `canTeamForfeit({ status, autoCancelAt }, now)` — CONFIRMED และเลย `auto_cancel_at` แล้ว (ตรงกับ `app_team_forfeit_booking`)
- คำเตือนแอลกอฮอล์ (คอมเมนต์ #87) ใช้ `alcoholWordsIn` / `ALCOHOL_WORDS` / `ALCOHOL_WARNING_TEXT` ใน `src/alcohol.ts` ที่มีอยู่แล้ว (ครบตามสเปค ไม่ต้องเพิ่ม)
- เทสต์ใน `src/utils.test.ts` · ไฟล์: `src/booking-status.ts`, `src/booking-time.ts`

## 2026-10-13 — ดีลวันนี้ (deal.ts)
- ใหม่ `src/deal.ts`: `bangkokClock` (วันที่/วันในสัปดาห์/นาทีตามเวลากรุงเทพ ไม่ขึ้นกับ timezone ของเครื่อง) · `hhmmToMinutes` · `isPublicDeal` (active + ยังไม่ถูกตรวจหรือ APPROVED) · `dealTodayStatus` (LIVE / ENDED เลย cutoff / NOT_TODAY) · `groupDealsToday` (แยกโปรเป็น ใช้ได้วันนี้ / หมดเวลาวันนี้ / วันอื่น · ร้านปิดวันนี้ = ทุกโปรไปวันอื่น)
- กติกาวันตรงกับที่ DB ตรวจโปรตอนจอง (`app_create_booking_core`: `valid_from ≤ วันที่ ≤ valid_to` · วันในสัปดาห์ · เลย cutoff = ใช้ไม่ได้) · ตัดโปรที่ปิดอยู่ / ยังไม่ผ่านการตรวจ / หมดอายุแล้ว (`validTo` < วันนี้ — ตรงกับ `bar_detail`) ทิ้ง เพื่อไม่ให้ทีมร้านเห็นต่างจากลูกค้า
- เทสต์ใน `src/utils.test.ts` · ไฟล์: `src/deal.ts`, `src/index.ts`

## 2026-10-13 — Native Mini-Ads (โฆษณาแบนเนอร์เล็ก)
- ใหม่ `src/mini-ads.ts`: `MINI_AD_LABEL` (ป้าย "โฆษณา") · `MINI_AD_NO_ALCOHOL_TEXT` (ข้อความติ๊กยืนยันไม่ใช่แบรนด์/สินค้าเครื่องดื่มแอลกอฮอล์รวมแบรนด์ร่วม ไม่มีถ้อยคำชวนดื่ม — ม.32) · `miniAdState()` (กำลังแสดง/รอเริ่ม/หมดเวลา/ปิดอยู่ — ตรงกับ `mini_ad_is_live` ใน DB) · `miniAdCtr()`
- ใหม่ `src/alcohol.ts` (คอมเมนต์ #87 — เตือน ไม่บล็อก): `ALCOHOL_WORDS` · `alcoholWordsIn(text)` คืนคำแอลกอฮอล์/ชวนดื่มที่พบ (ไทย + อังกฤษแบบทั้งคำ ไม่สนตัวพิมพ์) · `ALCOHOL_WARNING_TEXT` — ใช้เตือนในฟอร์มโฆษณาของ Backoffice
- เทสต์ใน `src/utils.test.ts` · `src/alcohol.test.ts` · ไฟล์: `src/mini-ads.ts`, `src/alcohol.ts`, `src/index.ts`

## 2026-10-13 — ผังโต๊ะ /merchant/floor
- ใหม่ `src/table-board.ts`: ค่าคงที่ (`TABLE_BOARD_POLL_MS` 10 วิ · `TABLE_BOARD_RESERVED_LEAD_MINUTES` 60 · `TABLE_OCCUPANCY_STALE_HOURS` 12 · ตัดคืน 06:00) · `businessNightOf` · `periodsOverlap` · `boardDropBlock` (เหตุผลที่วางการจองไม่ได้) · `packLanes` · `timelineRange` (ข้ามเที่ยงคืน)
- เทสต์ใน `src/utils.test.ts` · ไฟล์: `src/table-board.ts`, `src/index.ts`

## 2026-10-13 — ชั้นชำระเงินกลาง (payment intents + mock)
- ใหม่ `src/payment.ts`: `PAYMENT_STATUS_LABEL` · `PAYMENT_REFUND_LABEL` · `paymentProviderLabel()` (mock = "ระบบชำระเงินจำลอง (ทดสอบ)") · `PAYMENT_POLL_MS` / `PAYMENT_POLL_MAX_MS` (รอผลหลังกลับจากหน้าผู้ให้บริการ) · `isInAppCheckoutUrl()` (ลิงก์ checkout ในแอปของ mock vs https ของผู้ให้บริการจริง)
- `booking-status.ts`: `BOOKING_TRANSITIONS` AWAITING_DEPOSIT → CONFIRMED โดย SYSTEM (ชำระผ่านผู้ให้บริการสำเร็จ → ยืนยัน + ออก E-Ticket อัตโนมัติ) ให้ตรงกับ `booking_transition_allowed` ใน DB
- เทสต์ใน `src/utils.test.ts` · ไฟล์: `src/payment.ts`, `src/booking-status.ts`, `src/index.ts`

## 2026-10-13 — คะแนนรวมดาว/อันดับ (`rankingScore`)
- `src/ranking.ts` เพิ่มสูตรคะแนนรวม 100 (เจ้าของตัดสิน 2026-10-13): `RANKING_WEIGHTS` รีวิว 50 · เช็กอิน 30 · Safety 20 (ไม่มีคะแนนความครบของราคา · โฆษณาไม่มีผล) · `RANKING_PRIOR_RATING` 3.5 · `RANKING_CHECKIN_WINDOW_DAYS` 90 · `RANKING_CHECKIN_TARGET` 30 · `rankingReviewPoints()` (Bayesian) / `rankingCheckinPoints()` (log scale) / `rankingSafetyPoints()` / `rankingScore()` → `{review, checkin, safety, total, rescaled, isNew, stars, tier}`
- owner override: ร้านที่ยังไม่มีเช็กอินในช่วง → total = (รีวิว + Safety) × 100 / 70 (`rescaled = true`) · มีเช็กอิน ≥ 1 → 50/30/20 ตามปกติ
- สูตรต้องตรงกับ SQL `run_tier_scores()` ใน migration `20261013001030_catalog_ranking_scores` (ปัด 2 ตำแหน่งทุกส่วนเหมือนกัน) · ของเดิม (`scoreToStars`, `starsToTier`, `isNewBar`, `MIN_REVIEWS_FOR_STARS`) ไม่เปลี่ยน
- เทสต์ใน `src/utils.test.ts` · ไฟล์: `src/ranking.ts`

## 2026-10-13 — Safety: ลงพื้นที่ตรวจ + วิธีตรวจ
- ใหม่ `src/safety.ts`: `SAFETY_CHECK_RESULTS` / `SAFETY_CHECK_LABELS` (ผ่าน / ไม่พบ / ไม่ได้ตรวจ) · ขีดจำกัด `SAFETY_INSPECTION_MAX_PHOTOS` (3) / `SAFETY_INSPECTION_MAX_AGE_DAYS` (30) / `SAFETY_INSPECTION_NOTE_MAX` (1000) / `SAFETY_CHECK_NOTE_MAX` (500) — DB ตรวจซ้ำ · `safetyCheckValue()` · `countSafetyChecks()` · `safetyInspectionPhotoPath()` (`<bar_id>/inspections/<uuid>.<ext>`) · `SAFETY_VERIFY_METHODS` / `SAFETY_VERIFY_METHOD_LABELS` ("ตรวจหลักฐานแล้ว" / "ทีมงานลงพื้นที่ตรวจ") · `safetyVerifyLabel()` (ไม่รู้วิธี = ตรวจหลักฐาน — ไม่อ้างว่าลงพื้นที่)
- เทสต์ใน `src/utils.test.ts` (รวมเช็กว่าไม่มีคำ "Safety Verified" / "ยืนยันโดย NightOut") · ไฟล์: `src/safety.ts`, `src/index.ts`

## 2026-10-13 — ค้นหาตามงบ + อ่าน QR เช็กอิน
- ใหม่ `src/search.ts`: `SEARCH_BUDGET_MIN` / `SEARCH_BUDGET_MAX` (ตั้งแต่ค่านี้ = ไม่จำกัด) / `SEARCH_BUDGET_STEP` · `SEARCH_BUDGET_PRESETS` (ตัวเลือกงบใน Hero) · `MAX_GROUP_SIZE` = 12 (หน้าค้นหา + หน้าจอง) · `parseBudgetSearch()` อ่าน `?q=&district=&budget=&people=` (ค่าผิด = ไม่กรอง · งบต่ำกว่าขั้นต่ำปัดขึ้น · คนเกิน 12 ปัดลง) · `budgetSearchQuery()` สร้าง query จาก Hero (เข้ารหัสภาษาไทยเอง · ข้ามค่าว่าง) · `fitsGroup()` ร้านมีโซนจุได้ทั้งกลุ่มไหม
- ใหม่ `src/check-in.ts`: `CHECK_IN_QR_PREFIX` · `checkInQrValue()` · `parseCheckInScan()` แปลงข้อความที่สแกน/พิมพ์ → `NIGHTOUT:<uuid ตัวเล็ก>` หรือ `NL-XXXXXX` (รับ `nl3f8k2a` ได้) · ไม่ใช่ E-Ticket (URL / ข้อความอื่น) → `null`
- เทสต์ใหม่ `src/search.test.ts`, `src/check-in.test.ts` (แยกไฟล์ ไม่แตะ `utils.test.ts`)
- ไฟล์: `src/search.ts`, `src/check-in.ts`, `src/index.ts`

## 2026-10-13 — ตำแหน่งร้าน (หมุด) + แอดมินตรวจหมุด
- ใหม่ `src/location.ts` (export จาก `index.ts`) ใช้ร่วมหน้าเว็บ / Backoffice / backend / contracts: `THAILAND_BOUNDS` + `isInThailand` (กรอบเดียวกับที่ DB ตรวจใน `bar_location_from_json`) · `LEGACY_DEFAULT_PIN` + `isLegacyDefaultPin` (หมุด 13.7563, 100.5018 ที่ระบบเดิมใส่ให้ทุกร้าน — อนุมัติร้านไม่ได้) · `MAP_DEFAULT_CENTER` · `roundCoord` (6 ตำแหน่ง = numeric(9,6)) · ขีดจำกัดช่อง (`BAR_ADDRESS_MIN/MAX` · `PARKING_NOTE_MAX` · `TRANSIT_STATION_MAX` · `TRANSIT_WALK_MAX`)
- รถไฟฟ้า: `TRANSIT_LINES` + `TRANSIT_LINE_LABELS` · `formatTransit()` → "BTS อารีย์ · เดิน 5 นาที" · ระยะทาง `distanceMeters()` (haversine) + `formatDistance()` ("35 ม." / "1.2 กม.") · `parseLatLng()` อ่านพิกัดที่วาง ("13.7563, 100.5018" หรือลิงก์ Google Maps · นอกไทย = null) · ป้าย `LOCATION_REQUEST_STATUS_LABELS` / `LOCATION_REQUEST_SOURCE_LABELS`
- เทสต์ใหม่ `src/location.test.ts` (กรอบไทย · หมุดค่าเริ่มต้น · ข้อความรถไฟฟ้า · ระยะทาง · อ่านพิกัด 5 รูปแบบ)
- ไฟล์: `src/location.ts`, `src/location.test.ts`, `src/index.ts`

## 2026-10-13 — กติกาเวลาการจอง (`booking-time.ts`)
- ใหม่ `src/booking-time.ts` (export จาก `index.ts`): `BOOKING_REMINDER_MINUTES` (15) · `BOOKING_EXTENSION_MINUTES` (15) · `BOOKING_RELEASE_WARNING_MINUTES` (5) · `CHECK_IN_EARLY_HOURS` (3) · `DEFAULT_REFUND_BEFORE_HOURS` (6) · `canExtendBooking(b, now)` (CONFIRMED · ยังไม่เคยต่อ · ตั้งแต่ 15 นาทีก่อนเวลาจองถึงเวลาปลดโต๊ะ) · `checkInWindow(b)` (3 ชม. ก่อนเวลาจอง → `auto_cancel_at`) — ตรงกับ DB migration `20261013000500_booking_timing_rules`
- `depositTermsLines()` บอก "ขอต่อเวลาได้อีก 15 นาที 1 ครั้ง" และ "ระบบจะปลดโต๊ะ (Forfeited)" · ขึ้น `DEPOSIT_TERMS_VERSION` เป็น `deposit-v3`
- เทสต์: ต่อเวลา 1 ครั้ง/ช่วงที่กดได้ · ช่วงเช็กอิน · คืน Table Fee ≥ 6 ชม.
- ไฟล์: `src/booking-time.ts`, `src/deposit.ts`, `src/index.ts`, `src/utils.test.ts`

## 2026-10-13 — เรียกเงินที่จ่ายผ่านแอปว่า Table Fee
- เพิ่ม `TABLE_FEE_LABEL` ("ค่าธรรมเนียมจองโต๊ะ (Table Fee)") + `TABLE_FEE_SHORT` ("Table Fee") — ข้อกฎหมาย: เงินที่ลูกค้าจ่ายผ่านแอปต้องเรียก Table Fee เท่านั้น
- `depositTermsText()` / `depositTermsLines()` ใช้คำใหม่แทน "มัดจำ" · ขึ้น `DEPOSIT_TERMS_VERSION` เป็น `deposit-v2` (หลักฐานเก่าใน `booking_deposit_consents` ยังอ้าง v1)
- ไฟล์: `src/deposit.ts`, `src/utils.test.ts`

## 2026-10-11 — รีวิวได้เมื่อมัดจำผ่าน (ไม่ต้องเช็กอิน)
- เพิ่ม `REVIEWABLE_BOOKING_STATUSES` + `isReviewableStatus()` (CONFIRMED/CHECKED_IN/COMPLETED/NO_SHOW) ใช้ร่วมหน้าเว็บ + mock ให้ตรงกับ DB + เทสต์
- ไฟล์: `src/booking-status.ts`, `src/utils.test.ts`

## 2026-10-09 — storage public URL
- `storage.ts` (ใหม่): `storagePublicUrl(supabaseUrl, bucket, path)` ใช้ร่วม backend + หน้าเว็บ · `barMediaPath(barId, folder, ext)` path รูปร้าน `<bar_id>/gallery|menu/<uuid>.<ext>` + type `BarMediaFolder` · `galleryCoverPath` (หา path ปกจาก `cover_image_url`) · `coverFirst` (เรียงปกขึ้นก่อน) — ใช้ร่วมหน้าข้อมูลร้าน + Backoffice
- เทสต์ใน `utils.test.ts`

## 2026-10-09 — Rest: แกะ ApiResponse ให้
- backend ตอบ `{ status, status_code, data, code, err_msg }` ทุกเส้น → `Rest.get/post/…` คืน `data` ให้เลย (หน้าเว็บไม่ต้องเช็ก `status`) · `status: 'no'` (แม้ HTTP 2xx) หรือ HTTP error → `ApiError(status_code, code)` ข้อความ = `err_msg` · ไม่มี err_msg = ใช้ `errorMessages` เหมือนเดิม · `unauthorizedCode` ยังชนะบน 401
- `ApiError` รับข้อความตัวที่ 3 ได้ · คำตอบแบบเก่า (ไม่ห่อ) ยังใช้ได้
- ไฟล์: `src/rest.ts` · เทสต์ `src/rest.test.ts`

## 2026-10-08 — Rest: afterWrite
- `RestConfig.afterWrite` — เรียกหลัง POST/PUT/PATCH/DELETE ที่สำเร็จ และรอให้เสร็จก่อนคืนผล (frontend ใช้โหลด store ใหม่ คนเรียกไม่ต้อง `refresh()` เอง) · error ใน afterWrite แค่ log ไม่ทำให้การเขียนล้ม · ไม่ตั้ง = เหมือนเดิม (admin)
- ไฟล์: `src/rest.ts` · เทสต์ `src/rest.test.ts`

## 2026-10-08 — ลองซ้ำนานขึ้นเมื่อต่อ API ไม่ติด (backend รีสตาร์ตตอน dev)
- `Rest` ลองซ้ำสูงสุด 3 ครั้ง หน่วง 0.5 / 1 / 2 วิ (`RETRY_DELAYS_MS` · รวม ~3.5 วิ) เมื่อ `ERR_NETWORK` — เดิม 1 ครั้ง 300ms ไม่พอให้ NestJS ที่ `node --watch` รีสตาร์ตบูตเสร็จ (เกิดบ่อยตอน contracts/utils build ใหม่)
- ลองซ้ำอัตโนมัติ: GET / HEAD / **PUT / DELETE** (idempotent — เดิมแค่ GET/HEAD) + request ที่ตั้ง `retryable` · POST / PATCH ยังไม่ลองซ้ำ กันบันทึกซ้ำ
- log บอกรอบ (`ลองใหม่ครั้งที่ n/3`) และเวลารวมทุกรอบ (คง `t0` เดิมไว้)
- เทสต์: ลองซ้ำจนผ่าน · ครบรอบแล้วยอมแพ้ · POST/PATCH ไม่ลองซ้ำ ยกเว้น `retryable`
- ไฟล์: `src/rest.ts`, `src/rest.test.ts`

## 2026-10-07 — กัน "ติดต่อ API ไม่ได้" หลังทิ้งแท็บไว้นานแล้วกลับมา
- `Rest` ลองส่งซ้ำ 1 ครั้ง (หน่วง 300ms) เมื่อต่อไม่ติด (`ERR_NETWORK`) เฉพาะ GET/HEAD และ request ที่ส่ง `{ retryable: true }` — POST ที่เขียนข้อมูลไม่ลองซ้ำ กันบันทึกซ้ำ
- เพิ่ม type `RestRequestConfig` (= `AxiosRequestConfig` + `retryable`) ให้ `Rest.get/post/put/patch/delete`
- log ตอนต่อไม่ติดใส่ `err.code` (ERR_NETWORK / ECONNABORTED / ERR_CANCELED) และเวลาที่ใช้ ไล่สาเหตุได้
- ที่ใช้คู่กัน: `apps/admin` และ `apps/frontend` `services/api/storage.ts` ติด `retryable` ให้ `/storage/upload-url` และ `/storage/signed-urls` (ขอ URL อย่างเดียว ส่งซ้ำได้) · `apps/backend/src/main.ts` ขยาย `keepAliveTimeout` เป็น 65 วิ (เดิม 5 วิ) ไม่ให้เบราว์เซอร์หยิบ connection ที่ server ปิดไปแล้วมาใช้
- ไฟล์: `src/rest.ts`
