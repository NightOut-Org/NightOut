# CHANGELOG — admin/modules/billing

## 2026-10-13 — ป้ายปลดโต๊ะ (Forfeited)
- ค่าคอมที่ยกเว้นเพราะลูกค้าไม่มา แสดงป้าย "ปลดโต๊ะ (Forfeited)" แทน "ไม่มาตามนัด" (หน้ายังปิดไว้จนถึง Phase 2)
- ไฟล์: `page.tsx`

## 2026-10-13 — ปิดหน้าไว้จนถึง Phase 2
- เอา route `/billing` และเมนูออก · view `admin_billing_events` เฉพาะ Super Admin แล้ว (`SUPER_ADMIN_VIEWS` + `is_super_admin()`) · โค้ดโมดูลยังอยู่

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useBillingEvents` — ชื่อ view / path / body ของหน้านี้ย้ายมาอยู่ที่เดียว (เดิมเขียนในหน้าผ่าน `useAdminView('admin_x', …)` / `act.mutate({ method, path, body })`) · body มี type จาก `@nightout/contracts`
- หน้า / form / modal ของโมดูลเรียกผ่าน `./api` · พฤติกรรมเดิม (query key, ข้อความแจ้งผล, invalidate `['admin']`)
