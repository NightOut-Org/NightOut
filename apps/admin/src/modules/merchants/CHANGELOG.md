# CHANGELOG — admin/modules/merchants

## 2026-10-21 — เลิกใช้ " · " คั่นข้อความที่ผู้ใช้เห็น (ส่วนที่เหลือ)
- กติกาหลายข้อที่เดิมต่อเป็นประโยคยาว แยกเป็นรายการ 1 ข้อ 1 บรรทัดด้วย `RuleList` ใหม่ (`ui/components/RuleList.tsx` · ไอคอน info / check / warn): คำอธิบายหน้า
- ข้อความในหน้า (หัวข้อ Drawer คำอธิบาย ป้าย ข้อความสำเร็จ) เปลี่ยนจากต่อด้วย " · " เป็นประโยค วงเล็บ หรือคำเชื่อม (และ / โดย / เมื่อ) · ชื่อ + จำนวนคน = "สมชาย (4 คน)" · ไม่เปลี่ยนพฤติกรรม
- ไฟล์: หน้าและคอมโพเนนต์ในโมดูลนี้ที่เคยมี " · " ในข้อความ

## 2026-10-13 — ตำแหน่งร้าน (หมุด) + แอดมินตรวจหมุด
- คอลัมน์ "หมุด": ยังไม่ปักหมุด (หมุดค่าเริ่มต้นของระบบเดิม) = ป้ายแดง + ปุ่ม "ปักหมุด" · ปักแล้ว = ที่อยู่ + "ดูหมุด" → Drawer ใหม่ `components/pinDrawer.tsx` (แผนที่ + ที่อยู่ ที่จอดรถ รถไฟฟ้า · "แก้หมุด" แทนร้าน + ข้อความถึงร้าน)
- ปุ่ม "อนุมัติ" กดไม่ได้ + tooltip "ปักหมุดก่อนอนุมัติ" จนกว่าจะปักหมุด (server กันซ้ำด้วย `BAR_LOCATION_NOT_SET`) · อนุมัติร้าน = ตรวจหมุดไปพร้อมกัน
- `api.ts` + `usePendingBarLocations` (`admin_bar_locations` เฉพาะร้านรอตรวจ/ร่าง) · `barLocationAction` (`PUT bars/:id/location`) · `searchPlace` / `reversePlace`
- ไฟล์หลัก: `page.tsx`, `api.ts`, `components/pinDrawer.tsx`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `usePendingBars` · `barStatusAction` — ชื่อ view / path / body ของหน้านี้ย้ายมาอยู่ที่เดียว (เดิมเขียนในหน้าผ่าน `useAdminView('admin_x', …)` / `act.mutate({ method, path, body })`) · body มี type จาก `@nightout/contracts`
- หน้า / form / modal ของโมดูลเรียกผ่าน `./api` · พฤติกรรมเดิม (query key, ข้อความแจ้งผล, invalidate `['admin']`)
