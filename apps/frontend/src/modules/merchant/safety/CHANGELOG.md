## 2026-10-12 — แก้หลายข้อ แล้วกดบันทึกครั้งเดียว
- ปุ่ม มี/ไม่มี/ไม่ระบุ และ "หลักฐาน" ไม่บันทึกทันทีแล้ว — แก้ในหน้า (Safety Score / จำนวนยืนยันคิดจากค่าที่แก้ · ข้อที่แก้มีบรรทัด "ยังไม่บันทึก · หลักฐาน <ชื่อไฟล์>") แล้วกด "บันทึกการเปลี่ยนแปลง" ที่หัวหน้า · มี "คืนค่า"
- กดบันทึก = อัปโหลดหลักฐาน (แสดง "กำลังอัปโหลด n/N") แล้วบันทึกทุกข้อในคำขอเดียว · แจ้งทีม NightOut 1 ครั้ง · ระหว่างบันทึกปุ่มทั้งหน้า disabled · พลาด = การแก้ยังอยู่ (หลักฐานที่อัปโหลดแล้วไม่อัปโหลดซ้ำ) · ออกจากหน้าตอนยังไม่บันทึก = ถามก่อน
- endpoint ใหม่ `PUT /merchant/bars/:barId/safety` (`app_save_safety` · migration `20261012000400_bar_save_safety`) แทน `PUT …/safety/:key` + `…/evidence`
- ไฟล์: `page.tsx` · `utils/useSafetyDraft.ts` (ใหม่) · `api.ts` (`saveSafety` แทน `setSafety` · `uploadSafetyProof` คืน path อย่างเดียว)

## 2026-10-10 — Bento ตาม Merchant 1i Store/Growth
- ซ้าย = Safety Score (วงแหวน x/9 + จำนวนข้อที่ NightOut ยืนยัน) + สรุป มี/ไม่มี/ไม่ระบุ · ขวา = checklist ไอคอนต่อข้อ ปุ่ม มี/ไม่มี/ไม่ระบุ (สีเขียว/แดง) + "หลักฐาน"
- บรรทัดใต้ชื่อบอกสถานะ: ยืนยันแล้ว · ร้านแจ้ง รอหลักฐาน · ยังไม่มีข้อมูล
- ไฟล์หลัก: `page.tsx` · `Ring` ใน `ui/components/merchantUi.tsx` รับ children แล้ว

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `setSafety` · `uploadSafetyProof` (`PUT /merchant/bars/:barId/safety/:key`) — ย้ายมาจาก `services/api/<domain>.ts` / `services/queries/<domain>.ts` (ลบแล้ว) · เรียก `Rest` ตรง
- หน้าในโมดูล import จาก `./api` แทน `@/services/data` · พฤติกรรมเดิม (ชื่อฟังก์ชัน, query key)

## 2026-10-08 — Responsive Merchant

- หัวข้อความปลอดภัยขึ้นบรรทัดใหม่เมื่อพื้นที่แคบ
