# CHANGELOG — backend/domains/review

## 2026-10-11 — รีวิวได้เมื่อมัดจำผ่าน (ไม่ต้องเช็กอิน)
- migration `20261011000200_review_allow_confirmed`: `app_add_review` + trigger `check_review_booking` รับการจองที่มัดจำผ่านแล้ว (CONFIRMED/CHECKED_IN/COMPLETED/NO_SHOW) · error ใหม่ `REVIEW_REQUIRES_BOOKING` (แทน `REVIEW_REQUIRES_CHECKIN`) · endpoint เดิม `POST bookings/:id/review` (แก้คำอธิบาย `@ApiDoc`) ไม่เปลี่ยน
