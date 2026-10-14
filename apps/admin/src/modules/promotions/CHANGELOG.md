# CHANGELOG — admin/modules/promotions

## 2026-10-13 — ป้าย "อาจเกี่ยวกับแอลกอฮอล์" (คอมเมนต์ #87)
- แท็บตรวจถ้อยคำโปรของร้าน: โปรที่ชื่อ/รายละเอียดมีคำเกี่ยวกับแอลกอฮอล์ติดป้าย "อาจเกี่ยวกับแอลกอฮอล์" + tooltip คำที่พบ (`AlcoholHint` · `alcoholWordsIn`) ช่วยแอดมินตรวจ ไม่ปฏิเสธอัตโนมัติ
- ไฟล์: `page.tsx`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `usePendingBarPromotions` · `usePromotedListings` · `moderateBarPromotionAction` · `reviewPromotionAction` — ชื่อ view / path / body ของหน้านี้ย้ายมาอยู่ที่เดียว (เดิมเขียนในหน้าผ่าน `useAdminView('admin_x', …)` / `act.mutate({ method, path, body })`) · body มี type จาก `@nightout/contracts`
- หน้า / form / modal ของโมดูลเรียกผ่าน `./api` · พฤติกรรมเดิม (query key, ข้อความแจ้งผล, invalidate `['admin']`)
