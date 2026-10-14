# CHANGELOG — admin/modules/dashboard

## 2026-10-13 — การ์ด "ปลดโต๊ะวันนี้ (Forfeited)"
- การ์ดใหม่ `forfeited_today` (rpc `admin_dashboard` · migration `20261013000500_booking_timing_rules`) กดแล้วไป `/bookings?status=NO_SHOW`
- ไฟล์: `page.tsx`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useAdminDashboard` — ชื่อ view / path / body ของหน้านี้ย้ายมาอยู่ที่เดียว (เดิมเขียนในหน้าผ่าน `useAdminView('admin_x', …)` / `act.mutate({ method, path, body })`) · body มี type จาก `@nightout/contracts`
- หน้า / form / modal ของโมดูลเรียกผ่าน `./api` · พฤติกรรมเดิม (query key, ข้อความแจ้งผล, invalidate `['admin']`)
