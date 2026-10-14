# CHANGELOG — admin/modules/bookings

## 2026-10-13 — กรองสถานะจาก URL `?status=` · ป้ายปลดโต๊ะ (Forfeited)
- ตัวกรองคอลัมน์สถานะผูกกับ `?status=` (controlled `filteredValue` · ใส่ซ้ำได้หลายสถานะ · รับเฉพาะค่าที่มีใน `BOOKING_STATUS`) — เปิดจากการ์ด "ปลดโต๊ะวันนี้" บนแดชบอร์ดก็กรองให้ทันที รีเฟรช/แชร์ลิงก์แล้วตัวกรองยังอยู่
- สถานะ NO_SHOW แสดงเป็น "ปลดโต๊ะ (Forfeited)" (`ui/utils/labels.ts` ใช้ทั้ง Backoffice)
- ไฟล์: `page.tsx`, `ui/utils/labels.ts`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useBookings` — ชื่อ view / path / body ของหน้านี้ย้ายมาอยู่ที่เดียว (เดิมเขียนในหน้าผ่าน `useAdminView('admin_x', …)` / `act.mutate({ method, path, body })`) · body มี type จาก `@nightout/contracts`
- หน้า / form / modal ของโมดูลเรียกผ่าน `./api` · พฤติกรรมเดิม (query key, ข้อความแจ้งผล, invalidate `['admin']`)
