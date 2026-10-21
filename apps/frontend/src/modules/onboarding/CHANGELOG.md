# CHANGELOG — frontend/modules/onboarding

## 2026-10-20 — พื้นที่ร้านครบทั้งประเทศ (หาจากหมุด)
- ย่านที่ชอบ: เลือกได้จากย่านทั้งประเทศ (850) ค้นหาได้ ชื่อต่อท้ายด้วยจังหวัด (`districtSelectOptions`)
- ไฟล์: `page.tsx`

## 2026-10-13 — กลับไปหน้าเดิมหลัง onboarding (`?next=`)
- เสร็จ/ข้าม → ไป `?next=` (รับเฉพาะ path ในเว็บเรา — `safeNext` กันพาไปเว็บอื่น) ไม่มีค่อยไปหน้าแรก · ใช้กับคนที่กด "ไปด้วย" ในลิงก์แชร์แล้วสมัครใหม่ (`AuthRegisterForm` ส่ง `next` ต่อ)
- ไฟล์: `page.tsx`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `updateProfile` (`PATCH /me/profile`) — ย้ายมาจาก `services/api/<domain>.ts` / `services/queries/<domain>.ts` (ลบแล้ว) · เรียก `Rest` ตรง
- หน้าในโมดูล import จาก `./api` แทน `@/services/data` · พฤติกรรมเดิม (ชื่อฟังก์ชัน, query key)
