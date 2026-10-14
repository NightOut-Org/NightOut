# CHANGELOG — frontend/modules/notifications

## 2026-10-14 — กดดูแจ้งเตือนแล้วอ่านเฉพาะอันนั้น
- กดแจ้งเตือนในกล่องกระดิ่ง (navbar) หรือกดชื่อแจ้งเตือนที่มีลิงก์ในหน้า `/notifications` → ส่ง `POST /me/notifications/read` พร้อม `ids` = อันที่กด · เลขบนกระดิ่งลด 1 และจุดแดงของอันนั้นหายทันที (navbar อัปเดตก่อนรอ store) · ส่งไม่สำเร็จ = กลับเป็นยังไม่อ่าน + แจ้ง error
- เปิดกล่องกระดิ่งเฉย ๆ ไม่ถือว่าอ่าน · แจ้งเตือนที่ไม่มีลิงก์ยังใช้ปุ่ม "อ่านทั้งหมดแล้ว"
- เพิ่ม `markRead(ids)` ใน `api.ts` · ไฟล์: `ui/components/navbar.tsx`, `page.tsx`, `api.ts`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `markAllRead` (`POST /me/notifications/read`) — ย้ายมาจาก `services/api/<domain>.ts` / `services/queries/<domain>.ts` (ลบแล้ว) · เรียก `Rest` ตรง
- หน้าในโมดูล import จาก `./api` แทน `@/services/data` · พฤติกรรมเดิม (ชื่อฟังก์ชัน, query key)
