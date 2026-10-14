# CHANGELOG — admin/modules/deposits

## 2026-10-13 — ชั้นชำระเงินกลาง (payment intents + mock)
- คอลัมน์ "ช่องทาง" (สลิป / ออนไลน์ · ผู้ให้บริการ) จาก `admin_deposits.payment_provider` · โหมดชำระออนไลน์มี Alert "เปิดชำระออนไลน์แล้ว — ลูกค้าส่งสลิปใหม่ไม่ได้" เหนือแท็บ · แท็บ "รอคืนลูกค้า" ของรายการออนไลน์เตือนให้คืนที่ระบบผู้ให้บริการก่อนกดบันทึก (ยังไม่คืนอัตโนมัติ) · subtitle รวมการชำระออนไลน์
- `api.ts` + config การชำระเงิน (ประกาศซ้ำตาม ADR 0007) · ไฟล์: `page.tsx`, `api.ts`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useDeposits` · `reviewDepositAction` · `settleDepositAction` — ชื่อ view / path / body ของหน้านี้ย้ายมาอยู่ที่เดียว (เดิมเขียนในหน้าผ่าน `useAdminView('admin_x', …)` / `act.mutate({ method, path, body })`) · body มี type จาก `@nightout/contracts`
- หน้า / form / modal ของโมดูลเรียกผ่าน `./api` · พฤติกรรมเดิม (query key, ข้อความแจ้งผล, invalidate `['admin']`)
