# @nightout/mock — ประวัติการแก้ไข

## 2026-10-11 — รีวิวได้เมื่อมัดจำผ่าน (ไม่ต้องเช็กอิน)
- `reviewableBooking()` / `addReview()` ใช้ `isReviewableStatus()` (มัดจำผ่านแล้วรีวิวได้ ไม่ต้องเช็กอิน)
- ไฟล์: `src/service.ts`

## 2026-10-09 — รูปร้าน + รูปเมนู
- `models.ts`: `Bar.gallery` (`BarPhoto` = id · path · url) · `MenuItem.imagePath` / `imageUrl` — ค่ามาจาก `media` / `menu[].image_path` ของ `bar_detail` · `my_bar_detail`

## 2026-10-08 — ตัด editorsPick
- ลบ `editorsPick` ออกจาก `Bar` และข้อมูลร้านเดโม (Editor's Pick ถูกตัดทั้งโปรเจกต์)
- ไฟล์: `src/models.ts`, `src/seed.ts`
