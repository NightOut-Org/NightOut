## 2026-10-13 — ผังโต๊ะ /merchant/floor
- ข้อความใต้รายชื่อทีม: "Staff เห็นเฉพาะ คืนนี้ · ผังโต๊ะ · การจอง"
- ไฟล์: `page.tsx`

## 2026-10-13 — QR พาพนักงานเข้าหน้าคืนนี้
- การ์ดใหม่ `components/staffQrCard.tsx` (คอลัมน์ขวา · มือถืออยู่ต่อจากรายชื่อทีม): QR ลิงก์ `<origin>/merchant/tonight` + คัดลอกลิงก์ + ดาวน์โหลด PNG (`nightout-staff-<slug>.png`) — requirement "QR Code พาพนักงานเข้าหน้า Staff"
- QR เป็นแค่ลิงก์ ไม่มีข้อมูลลับ: ยังไม่ล็อกอิน → login แล้วกลับมาหน้าคืนนี้ (`?next=`) · คนนอกทีมเข้าไม่ได้ · ทีมร้านอื่นเห็นแค่ร้านของตัวเอง
- ไฟล์: `page.tsx`, `components/staffQrCard.tsx`

## 2026-10-10 — Bento ตาม Merchant 1i Store/Growth
- ซ้าย = สมาชิกที่ตอบรับแล้ว (ป้ายบทบาท + วันเข้าทีม + นำออก) · ขวา = การ์ดเชิญพนักงาน (อีเมล + Staff/ผู้จัดการ) + คำเชิญที่ยังไม่ตอบรับ (ยกเลิกได้)
- มือถือ: ปุ่มเชิญบนหัวหน้าเปิดแผ่นล่าง
- ยังเปลี่ยนบทบาทสมาชิกไม่ได้ (ไม่มี API)
- ไฟล์หลัก: `page.tsx`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useBarTeam` · `inviteStaff` · `removeStaff` (`GET /merchant/bars/:barId/team` · `POST /merchant/bars/:barId/staff` · `DELETE /merchant/bars/:barId/staff/:userId`) — ย้ายมาจาก `services/api/<domain>.ts` / `services/queries/<domain>.ts` (ลบแล้ว) · เรียก `Rest` ตรง
- หน้าในโมดูล import จาก `./api` แทน `@/services/data` · พฤติกรรมเดิม (ชื่อฟังก์ชัน, query key)

## 2026-10-08 — Responsive Merchant

- ฟอร์มเชิญและ action สมาชิกจัดวางตามความกว้างจอ
