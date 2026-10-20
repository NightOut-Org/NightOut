# CHANGELOG — admin/modules/login

## 2026-10-17 — กด Enter ยืนยันรหัส MFA ได้
- เดิมช่องรหัส 6 หลักไม่ได้อยู่ใน `<form>` และปุ่ม "ยืนยันรหัส" เป็นปุ่มธรรมดา → กด Enter ไม่มีอะไรเกิดขึ้น · รวมช่องรหัสกับปุ่มเป็น `otpForm` (ปุ่มยืนยันเป็น `htmlType="submit"`) ใช้ทั้งขั้นยืนยันตัวตนและขั้นผูกแอป Authenticator · รหัสยังไม่ครบ 6 หลัก ปุ่ม disabled จึงไม่ส่ง
- ไฟล์: `page.tsx`

## 2026-10-17 — เข้าจากหน้าบ้านแล้วไปขั้น MFA ทันที
- ใช้ session Supabase ร่วมกับหน้าบ้าน (`services/supabase.ts` เลิกใช้ `storageKey` แยก · dev เปิดผ่าน `localhost:5173/admin/` ที่ vite proxy ไป :5174) → ล็อกอินหน้าบ้านแล้วไม่ต้องกรอกอีเมล/รหัสผ่านซ้ำ
- `page.tsx`: มี session แอดมินที่ยังไม่ผ่าน MFA → แสดง loading จนขึ้นขั้นใส่รหัส 6 หลัก ไม่โชว์ฟอร์มขั้นที่ 1 คั่น (กดเข้าสู่ระบบเอง/เริ่ม MFA ไม่สำเร็จ = ฟอร์มเหมือนเดิม)

## 2026-10-15 — พื้นหลัง Aurora ทุกหน้า Backoffice (dark mode)
- ใหม่ `ui/components/AuroraBackground.tsx`: พื้นหลัง WebGL ม่วง + ทอง (ไม่มี dependency เพิ่ม) ขยับตามเมาส์ · คลิก = คลื่นวง · หยุดเมื่อสลับแท็บ · `prefers-reduced-motion` = ภาพนิ่ง · light mode ไม่แสดง
- `layouts/main.tsx`: วาง Aurora หลัง ProLayout ให้ทุกหน้าใน MainLayout · dark mode ให้ header/sider โปร่ง (token ของ ProLayout) และการ์ด/ตารางโปร่งเล็กน้อย (`colorBgContainer`) — Modal/Drawer/Dropdown ยังทึบ
- `styles/index.css`: glass blur 8px ให้ header + sider เฉพาะ `.dark`
- หน้า login (`page.tsx`) ใส่ Aurora ด้วย · แสงม่วงมุมจอเดิมเหลือเฉพาะ light mode
- แก้: ตารางที่มีคอลัมน์ `fixed: 'right'` (`/safety` `/users` `/community` `/bars`) ข้อความซ้อนกันตอนเลื่อนแนวนอน เพราะพื้นเซลล์ sticky โปร่งตาม `colorBgContainer` → ตาราง (Table token) ใช้พื้นทึบเดิม `#171520` + หัวตาราง/hover ทึบ `#201e29` — การ์ดยังโปร่งเหมือนเดิม

## 2026-10-10 — ดีไซน์ใหม่ "Staff Pass" (บัตรพนักงาน)
- หน้า login เปลี่ยนจาก Card ธรรมดาเป็นบัตร 2 ส่วน: ต้นขั้ว (โลโก้ใหม่ · STAFF ONLY · Admin Pass · ชื่อผู้ถือ) + ฝั่งฟอร์ม มีรอยปรุและรูบัตร · จอ < 900px ต้นขั้วกลายเป็นแถบบน
- ชื่อผู้ถือบนต้นขั้วตามช่องอีเมลแบบสด (`Form.useWatch`) · ขั้นยืนยันแสดงอีเมลที่ล็อกอินพร้อมเครื่องหมายถูก
- ขั้น enroll วาง QR ซ้าย + รหัสลับ (คัดลอกได้) ขวา · ปุ่ม "ใช้บัญชีอื่น" เป็นปุ่มขอบ คู่กับปุ่มยืนยัน
- logic เดิมทั้งหมด (signIn, ตรวจ `can_enter_backoffice`, MFA enroll/verify, ข้อความ error)
- ไฟล์: `page.tsx` · ใหม่ `components/staffPass.tsx` + `staffPass.css` · `public/logo-mark.svg` · เพิ่มฟอนต์ JetBrains Mono ใน `index.html`

## 2026-10-09 — ย้าย API เข้า `api.ts` ของโมดูล (ADR 0007)
- เพิ่ม `api.ts`: `fetchMyProfile` — ชื่อ view / path / body ของหน้านี้ย้ายมาอยู่ที่เดียว (เดิมเขียนในหน้าผ่าน `useAdminView('admin_x', …)` / `act.mutate({ method, path, body })`) · body มี type จาก `@nightout/contracts`
- หน้า / form / modal ของโมดูลเรียกผ่าน `./api` · พฤติกรรมเดิม (query key, ข้อความแจ้งผล, invalidate `['admin']`)
