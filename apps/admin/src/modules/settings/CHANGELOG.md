# CHANGELOG — admin/modules/settings

## 2026-10-13 — ลิงก์ไปหน้าสไตล์ร้าน
- การ์ดสไตล์ร้านมีลิงก์ "จัดการสไตล์ร้าน" → `/styles` · คำอธิบายหน้าบอกว่าสไตล์ร้านจัดการที่หน้าสไตล์ร้าน (ค่าอื่นยังแก้ผ่าน migration / seed)
- ไฟล์: `page.tsx`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useMasterTable` — ชื่อ view / path / body ของหน้านี้ย้ายมาอยู่ที่เดียว (เดิมเขียนในหน้าผ่าน `useAdminView('admin_x', …)` / `act.mutate({ method, path, body })`) · body มี type จาก `@nightout/contracts`
- หน้า / form / modal ของโมดูลเรียกผ่าน `./api` · พฤติกรรมเดิม (query key, ข้อความแจ้งผล, invalidate `['admin']`)
