# CHANGELOG — backend · community

## 2026-10-11 — ชุมชน: แนบรูป/วิดีโอในกระทู้และความเห็น
- migration `20261011000100_community_media.sql`: bucket `community-media` (private) + storage policy · ตาราง `community_media` · ลายเซ็นใหม่ของ `app_community_create_thread` / `update_thread` / `add_comment` (`p_media`) · ร่างเก็บ `payload.media` · ทุกฟังก์ชันเขียนคืน `removed_paths` · `community_thread` + `media` · view แอดมิน + `media` — ทดสอบด้วย PGlite (stub auth/storage) ผ่าน 55 กรณี
- `community.service.ts` ใหม่: `write()` = rpc แล้วลบไฟล์ใน `removed_paths` ออกจาก Storage (service_role) · `thread()` = เติม signed URL ของไฟล์แนบในนามผู้เรียก (6 ชม.)
- endpoint เดิมรับ `media` เพิ่ม: `POST /community/threads` · `PATCH /community/threads/:id` (แทนที่ทั้งชุด) · `POST /community/threads/:id/comments` · `PUT /me/community/drafts` · `GET /public/community/threads/:id` คืน `media` (+ `url` / `thumb_url`)

## 2026-10-10 — ชุมชน: ปักหมุดส่วนตัว + ฉบับร่างเก็บที่ backend
- โดเมนใหม่ (นอก MVP — อนุมัติ 2026-10-10): กระทู้ · ความเห็น/ตอบกลับ · ถูกใจ · บันทึก · **ปักหมุดส่วนตัว** (ขึ้นบนสุดในฟีดของคนที่ปัก · สูงสุด 3) · **ฉบับร่างเก็บที่ backend** (NEW 1 ร่าง/บัญชี · REPLY/EDIT 1 ร่าง/กระทู้ · 7 วัน) · รายงาน · แอดมินซ่อน/ลบ
- migration `20261010000100_community_threads.sql` (ตาราง `community_*` 9 ตาราง · ฟังก์ชันอ่าน security definer · `app_community_*` · `admin_community_moderate` · view `admin_community_threads` / `admin_community_comments`) — ทดสอบด้วย PGlite (stub auth/users/bars) ผ่าน 38 กรณี แต่ยังไม่ได้รันกับ Supabase จริง
- endpoint ใหม่: `GET /public/community/categories` · `GET /public/community/threads` · `GET /public/community/threads/:id` · `POST /public/community/threads/:id/view` · `GET /public/community/trending-bars` · `GET /me/community/threads` · `GET|PUT /me/community/drafts` · `DELETE /me/community/drafts/:kind` · `POST /community/threads` · `PATCH|DELETE /community/threads/:id` · `PUT /community/threads/:id/{like,save,pin}` · `POST /community/threads/:id/comments` · `DELETE /community/comments/:id` · `PUT /community/comments/:id/like` · `POST /community/reports` · `POST /admin/community/{threads,comments}/:id/moderate`
- ไฟล์: `community.module.ts` · `community.{public,me,admin}.controller.ts` · `community.dto.ts` · `app.module.ts`
