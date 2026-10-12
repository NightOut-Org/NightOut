# CHANGELOG — backend · community

## 2026-10-12 — ชุมชน: แก้ไขความเห็น + ประวัติการแก้ไข
- migration `20261012000800_community_edit_history.sql`: ตาราง `community_revisions` (เวอร์ชันที่ถูกแก้ทับ · แก้/ลบไม่ได้) · `community_comments.edited_at` · `app_community_update_comment` · `community_history` · `app_community_update_thread` เก็บเวอร์ชันเดิมเฉพาะเมื่อเนื้อหาเปลี่ยนจริง · ร่าง `EDIT_COMMENT` · ไฟล์ของเวอร์ชันเดิมเก็บไว้ (ลบเมื่อเจ้าของลบกระทู้/ความเห็น) และทุกคนที่เห็นกระทู้อ่านได้ · view admin + `revisions`
- endpoint ใหม่: `PATCH /community/comments/:id` (me) · `GET /public/community/threads/:id/history` · `GET /public/community/comments/:id/history` (เติม signed URL ของไฟล์ทุกเวอร์ชันใน `CommunityService.history`)
- ไฟล์: `community.me.controller.ts` · `community.public.controller.ts` · `community.service.ts` · `community.dto.ts`

## 2026-10-11 — ชุมชน: แนบรูป/วิดีโอในกระทู้และความเห็น
- migration `20261011000100_community_media.sql`: bucket `community-media` (private) + storage policy · ตาราง `community_media` · ลายเซ็นใหม่ของ `app_community_create_thread` / `update_thread` / `add_comment` (`p_media`) · ร่างเก็บ `payload.media` · ทุกฟังก์ชันเขียนคืน `removed_paths` · `community_thread` + `media` · view แอดมิน + `media` — ทดสอบด้วย PGlite (stub auth/storage) ผ่าน 55 กรณี
- `community.service.ts` ใหม่: `write()` = rpc แล้วลบไฟล์ใน `removed_paths` ออกจาก Storage (service_role) · `thread()` = เติม signed URL ของไฟล์แนบในนามผู้เรียก (6 ชม.)
- endpoint เดิมรับ `media` เพิ่ม: `POST /community/threads` · `PATCH /community/threads/:id` (แทนที่ทั้งชุด) · `POST /community/threads/:id/comments` · `PUT /me/community/drafts` · `GET /public/community/threads/:id` คืน `media` (+ `url` / `thumb_url`)

## 2026-10-10 — ชุมชน: ปักหมุดส่วนตัว + ฉบับร่างเก็บที่ backend
- โดเมนใหม่ (นอก MVP — อนุมัติ 2026-10-10): กระทู้ · ความเห็น/ตอบกลับ · ถูกใจ · บันทึก · **ปักหมุดส่วนตัว** (ขึ้นบนสุดในฟีดของคนที่ปัก · สูงสุด 3) · **ฉบับร่างเก็บที่ backend** (NEW 1 ร่าง/บัญชี · REPLY/EDIT 1 ร่าง/กระทู้ · 7 วัน) · รายงาน · แอดมินซ่อน/ลบ
- migration `20261010000100_community_threads.sql` (ตาราง `community_*` 9 ตาราง · ฟังก์ชันอ่าน security definer · `app_community_*` · `admin_community_moderate` · view `admin_community_threads` / `admin_community_comments`) — ทดสอบด้วย PGlite (stub auth/users/bars) ผ่าน 38 กรณี แต่ยังไม่ได้รันกับ Supabase จริง
- endpoint ใหม่: `GET /public/community/categories` · `GET /public/community/threads` · `GET /public/community/threads/:id` · `POST /public/community/threads/:id/view` · `GET /public/community/trending-bars` · `GET /me/community/threads` · `GET|PUT /me/community/drafts` · `DELETE /me/community/drafts/:kind` · `POST /community/threads` · `PATCH|DELETE /community/threads/:id` · `PUT /community/threads/:id/{like,save,pin}` · `POST /community/threads/:id/comments` · `DELETE /community/comments/:id` · `PUT /community/comments/:id/like` · `POST /community/reports` · `POST /admin/community/{threads,comments}/:id/moderate`
- ไฟล์: `community.module.ts` · `community.{public,me,admin}.controller.ts` · `community.dto.ts` · `app.module.ts`
