# CHANGELOG — admin/modules/safety

## 2026-10-21 — เลิกใช้ " · " คั่นข้อความที่ผู้ใช้เห็น (ส่วนที่เหลือ)
- กติกาหลายข้อที่เดิมต่อเป็นประโยคยาว แยกเป็นรายการ 1 ข้อ 1 บรรทัดด้วย `RuleList` ใหม่ (`ui/components/RuleList.tsx` · ไอคอน info / check / warn): คำอธิบายหน้า (ยืนยันจากหลักฐาน vs ลงพื้นที่) + ข้อยืนยันใน Drawer ลงพื้นที่ตรวจ
- ข้อความในหน้า (หัวข้อ Drawer คำอธิบาย ป้าย ข้อความสำเร็จ) เปลี่ยนจากต่อด้วย " · " เป็นประโยค วงเล็บ หรือคำเชื่อม (และ / โดย / เมื่อ) · ชื่อ + จำนวนคน = "สมชาย (4 คน)" · ไม่เปลี่ยนพฤติกรรม
- ไฟล์: หน้าและคอมโพเนนต์ในโมดูลนี้ที่เคยมี " · " ในข้อความ

## 2026-10-15 — ปุ่มในคิวรอตรวจอยู่แถวเดียวกัน ตำแหน่งตายตัว
- คอลัมน์ปุ่ม "ยืนยันแล้ว" + "ลงพื้นที่ตรวจ" กว้าง 220 → 244 (พอดี 2 ปุ่ม + ช่องห่าง 8px) และไม่ตัดบรรทัด (เดิม `Space wrap` ทำให้ปุ่มเรียงซ้อนลงมา) · `scroll.x` 1100 → 1124 — `page.tsx`
- ปุ่มแยกชิดซ้าย/ขวา (space-between) · แถวที่ไม่มี "ยืนยันแล้ว" (ทีมงานเพิ่มเอง) เว้นที่ว่างไว้ "ลงพื้นที่ตรวจ" จึงอยู่ตำแหน่งเดียวกันทุกแถว

## 2026-10-13 — ลงพื้นที่ตรวจ Safety (Inspector) + แยกวิธีตรวจ
- หน้า `/safety` เขียนใหม่ (แอดมินทุกคน = Inspector — เจ้าของตัดสิน 2026-10-13): ตัวกรองร้าน (`?bar=`) + ปุ่ม "ลงพื้นที่ตรวจร้านนี้" (`?inspect=<bar_id>`) · แท็บ "รอลงพื้นที่ (N)" / "ประวัติการตรวจ" (`?tab=history`) · คิว = ข้อที่ร้านแจ้ง "มี" แต่ยังไม่มีผลลงพื้นที่ (`awaiting_visit` กรองที่ server) แยก ทั้งหมด / รอตรวจ / ตรวจหลักฐานแล้ว · คอลัมน์สถานะ (วิธีตรวจ + วันที่ + ผู้ยืนยัน) และ "ตรวจล่าสุด" (ผ่าน / ไม่พบ + วันที่)
- **คงปุ่ม "ยืนยันแล้ว"** (ตรวจจากหลักฐานที่ร้านแนบ ไม่ได้ลงพื้นที่ — owner override 2026-10-13) กดได้เฉพาะข้อที่ร้านแจ้งเองและแนบหลักฐานแล้ว · คิวค้าง (409) → โหลดคิวใหม่ · ลูกค้าเห็น "ตรวจหลักฐานแล้ว <วันที่>" ต่างจาก "ทีมงานลงพื้นที่ตรวจ <วันที่>"
- Drawer ลงพื้นที่ตรวจ (`components/inspectDrawer.tsx` · มือถือเต็มจอ): ผู้ตรวจ = บัญชีที่ล็อกอิน · วันเวลาที่ลงพื้นที่ (ย้อนได้ ≤ 30 วัน · ไม่ก่อนการตรวจครั้งล่าสุด) · หมายเหตุรวม · การ์ดต่อข้อ = ค่าที่ร้านแจ้ง + วิธี/ผู้/วันที่ตรวจเดิม + หลักฐานร้าน + "สิ่งที่ต้องดู" + ผล ผ่าน / ไม่พบ / ไม่ได้ตรวจ + หมายเหตุ + รูป ≤ 3 (ถ่าย/แนบ → ย่อแล้วอัปโหลดเข้า `bar-verifications/<bar_id>/inspections/`) · บันทึกได้เมื่อครบทุกข้อและมีผ่าน/ไม่พบ ≥ 1 · ยืนยันก่อนบันทึก (ยืนยันว่าลงพื้นที่จริง · แก้ไม่ได้ ตรวจใหม่ได้) · อัปโหลดพลาด = draft อยู่ครบ รูปที่ขึ้นแล้วไม่อัปโหลดซ้ำ · ปิดตอนยังไม่บันทึก = ถามก่อน
- ประวัติการตรวจ (`components/inspectionHistory.tsx`): วันที่ · ร้าน · ผู้ตรวจ · ผล · Safety Score ก่อน → หลัง · หมายเหตุ · ขยายดูรายข้อ (ค่าที่เปลี่ยน · หมายเหตุ · รูป)
- `api.ts`: `useSafetyBars` · `useSafetyQueue(barId)` · `useBarSafety` · `useSafetyInspections` · `inspectSafetyAction` (`POST /admin/bars/:id/safety-inspections`) · `uploadInspectionPhoto` · `verifySafetyAction` (เดิม) · `utils/useInspectionDraft.ts` (draft ของ Drawer) · `utils/labels.ts` (`SAFETY_CHECK_TAG` · `SAFETY_VERIFY_TAG` · `SAFETY_VALUE_TEXT` · `SAFETY_INSPECTION_HINTS`)
- ของกลาง: `AdminViewRows` + `admin_bar_safety` / `admin_safety_inspections` (`services/api/backoffice.ts`) · `AUDIT_ACTION` + `safety.inspect` "ลงพื้นที่ตรวจ Safety" · `safety.verify` → "ยืนยัน Safety จากหลักฐาน" (`ui/utils/labels.ts`)
- ไฟล์: `page.tsx`, `api.ts`, `components/inspectDrawer.tsx`, `components/inspectionHistory.tsx`, `utils/useInspectionDraft.ts`, `utils/labels.ts` · migration `20261013000800_bar_safety_inspections`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `useSafetyQueue` · `verifySafetyAction` — ชื่อ view / path / body ของหน้านี้ย้ายมาอยู่ที่เดียว (เดิมเขียนในหน้าผ่าน `useAdminView('admin_x', …)` / `act.mutate({ method, path, body })`) · body มี type จาก `@nightout/contracts`
- หน้า / form / modal ของโมดูลเรียกผ่าน `./api` · พฤติกรรมเดิม (query key, ข้อความแจ้งผล, invalidate `['admin']`)
