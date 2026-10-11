# CHANGELOG — @nightout/contracts

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
