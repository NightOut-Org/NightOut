# CHANGELOG — admin · community

## 2026-10-11 — ชุมชน: แนบรูป/วิดีโอในกระทู้และความเห็น
- คอลัมน์ "ไฟล์แนบ" ในทุกตาราง (ภาพย่อกดดูเต็มจอ · วิดีโอเปิดแท็บใหม่) — ขอ signed URL ทุกไฟล์ครั้งเดียว (`useMediaUrls` → `POST /storage/signed-urls`)
- ไฟล์: `page.tsx` · `api.ts` · `components/mediaCell.tsx`

## 2026-10-10 — ชุมชน: ปักหมุดส่วนตัว + ฉบับร่างเก็บที่ backend

- หน้าใหม่ `/community` (เมนู "ชุมชน"): กระทู้ถูกรายงาน / ความเห็นถูกรายงาน / กระทู้ทั้งหมด / ซ่อน-ลบแล้ว · เก็บไว้ (ปิดรายงาน) / ซ่อน / ลบ / แสดงอีกครั้ง → `POST /admin/community/{threads,comments}/:id/moderate` (audit + แจ้งเจ้าของ) · ไม่มีปักหมุด (หมุดเป็นของผู้ใช้แต่ละคน)
- view ใหม่ `admin_community_threads` / `admin_community_comments` · ป้าย `COMMUNITY_STATUS` / `COMMUNITY_REPORT_REASON` / audit action `community.*` ใน `ui/utils/labels.ts`
- ไฟล์: `page.tsx` · `api.ts` · `configs/menu.tsx` · `router/index.tsx` · `services/api/backoffice.ts`
