# CHANGELOG — backend/domains/review

## 2026-10-16 — คะแนนรีวิวของร้านจากรีวิวจริง
- migration `20261016000200_review_rating_stats`: `bar_stats.rating_avg` / `rating_count` คิดจากรีวิว `PUBLISHED` เท่านั้น — เดิม seed ใส่ตัวเลขปลอม (เช่น 978) แล้ว `app_add_review` บวกทีละ 1 → หน้าร้าน "979 รีวิว" แต่แท็บรีวิวมี 1 · ซ่อน/ลบรีวิวแล้วตัวเลขไม่ลด
- `refresh_bar_rating(p_bar)` + trigger `reviews_refresh_bar_rating` (เพิ่ม/แก้คะแนน/เปลี่ยนสถานะ/ลบ) · `app_add_review` เลิกบวกเอง · คำนวณใหม่ทุกร้านท้าย migration
- `seed.sql` + `scripts/seed-from-mock.ts` เลิกใส่ `rating_avg` / `rating_count`
- หลัง `db:push` กด "คำนวณใหม่" ที่ Backoffice `/ranking` (คะแนนรีวิวเป็นส่วนของอันดับ)


## 2026-10-11 — รีวิวได้เมื่อมัดจำผ่าน (ไม่ต้องเช็กอิน)
- migration `20261011000200_review_allow_confirmed`: `app_add_review` + trigger `check_review_booking` รับการจองที่มัดจำผ่านแล้ว (CONFIRMED/CHECKED_IN/COMPLETED/NO_SHOW) · error ใหม่ `REVIEW_REQUIRES_BOOKING` (แทน `REVIEW_REQUIRES_CHECKIN`) · endpoint เดิม `POST bookings/:id/review` (แก้คำอธิบาย `@ApiDoc`) ไม่เปลี่ยน
