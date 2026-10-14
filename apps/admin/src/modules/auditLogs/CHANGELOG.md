# CHANGELOG — admin/modules/auditLogs

## 2026-10-13 — ป้ายการกระทำ "ร้านปลดโต๊ะ"
- `AUDIT_ACTION` ใน `ui/utils/labels.ts`: `booking.forfeit` = "ร้านปลดโต๊ะ (Forfeited)" (จาก `app_team_forfeit_booking`)
- ไฟล์: `ui/utils/labels.ts`

## 2026-10-13 — Native Mini-Ads (โฆษณาแบนเนอร์เล็ก)
- ป้ายการกระทำใหม่ใน `ui/utils/labels.ts` (`AUDIT_ACTION`): `mini_ad.create` = "เพิ่มโฆษณา (Mini-Ads)" · `mini_ad.update` = "แก้โฆษณา (Mini-Ads)" · `mini_ad.delete` = "ลบโฆษณา (Mini-Ads)"
- ไฟล์: `ui/utils/labels.ts`

## 2026-10-13 — ผังโต๊ะ /merchant/floor
- ป้ายการกระทำใหม่ใน `ui/utils/labels.ts` (`AUDIT_ACTION`): `booking.move` = "ร้านย้ายโต๊ะ" (เดิมไม่มีป้าย) · `table.occupy` = "ร้านตั้งโต๊ะเป็นกำลังใช้" · `table.release` = "ร้านตั้งโต๊ะเป็นว่าง"
- ไฟล์: `ui/utils/labels.ts`

## 2026-10-13 — แอดมินไม่เห็นงานของ Super Admin
- DB กรองให้ (`admin_audit_logs` · migration `20261013000200_backoffice_super_admin_reads`) · หน้าแสดง subtitle "ไม่แสดงรายการที่ซูเปอร์แอดมินเป็นคนทำ" ให้แอดมินทั่วไป · ไฟล์: `page.tsx`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useAuditLogs` — ชื่อ view / path / body ของหน้านี้ย้ายมาอยู่ที่เดียว (เดิมเขียนในหน้าผ่าน `useAdminView('admin_x', …)` / `act.mutate({ method, path, body })`) · body มี type จาก `@nightout/contracts`
- หน้า / form / modal ของโมดูลเรียกผ่าน `./api` · พฤติกรรมเดิม (query key, ข้อความแจ้งผล, invalidate `['admin']`)
