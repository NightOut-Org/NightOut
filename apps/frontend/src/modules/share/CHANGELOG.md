# CHANGELOG — frontend/modules/share

## 2026-10-13 — "ไปด้วย" + QR เช็กอินของกลุ่ม
- ส่วนกลุ่มที่ไปด้วย (`components/groupCheckIn.tsx` ใหม่): "ไปด้วยแล้ว N คน" + ปุ่ม "ไปด้วย" → `joinShare()` (`POST /share-cards/:token/join`) · ยังไม่ล็อกอิน → modal เข้าสู่ระบบ/สมัคร แล้วกลับมาเข้ากลุ่มให้เองครั้งเดียว (`utils/pendingJoin.ts` จำ token ใน localStorage `nightout-pending-share` 1 วัน · สมัครใหม่ผ่าน `/onboarding?next=` — `ui/components/authModal.tsx` / `authRegisterForm.tsx` ส่ง `next` ต่อ)
- สมาชิก (ผู้จอง/คนที่กดไปด้วย) + การจอง CONFIRMED เห็น QR `checkin_qr` เดียวกับผู้จอง "ใครถึงร้านก่อน ให้พนักงานสแกน QR นี้ — เช็กอินทั้งโต๊ะ" · ยังไม่ยืนยัน = "QR จะแสดงเมื่อการจองยืนยันแล้ว" · สมาชิกได้แจ้งเตือน 15 นาทีก่อนเวลาจอง
- `useShareCard(token, userId)` — query key มี user id เพราะ `is_member` / `checkin_qr` ขึ้นกับคนที่ล็อกอิน · `shareCardKey()` ใช้ invalidate หลังเข้ากลุ่ม
- ไฟล์: `page.tsx`, `api.ts`, `components/groupCheckIn.tsx`, `utils/pendingJoin.ts` · migration `20261013000500_booking_timing_rules`

## 2026-10-13 — ยอดหารต่อหัว
- การ์ด "ยอดหารต่อหัว": Table Fee ÷ จำนวนคน (ปัดขึ้น) + บอกว่าผู้จองจ่ายผ่านแอปคนเดียว เพื่อนโอนส่วนของตัวเองให้ผู้จอง · งบในร้านโดยประมาณต่อคน (`avgPerPerson`)
- ใช้ `deposit_required` ใหม่จาก `GET /share-cards/:token` (migration `20261013000300_booking_share_card_fee`)
- ไฟล์: `page.tsx`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useShareCard` (`GET /share-cards/:token`) — ย้ายมาจาก `services/api/<domain>.ts` / `services/queries/<domain>.ts` (ลบแล้ว) · เรียก `Rest` ตรง
- หน้าในโมดูล import จาก `./api` แทน `@/services/data` · พฤติกรรมเดิม (ชื่อฟังก์ชัน, query key)
