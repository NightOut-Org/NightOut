# login — ประวัติการแก้ไข

## 2026-10-16 — เอาลืมรหัสผ่านออก (ยังไม่เปิดรีเซ็ต)
- เจ้าของตัดสิน: ยังไม่เปิดรีเซ็ตรหัสผ่าน → เอาลิงก์ "ลืมรหัสผ่าน ?" ออกจากฟอร์มเข้าสู่ระบบ และมุมมอง "ลืมรหัสผ่าน" ออกจาก modal (`openForgotPassword` ไม่มีแล้ว)
- ลบโมดูล `forgotPassword` / `resetPassword` และ `ui/components/authForgotForm.tsx` · `newPasswordForm.tsx` · `/forgot-password` และ `/reset-password` redirect ไปหน้าแรก (ลิงก์เก่า / ลิงก์ในอีเมลเดิม)
- ไฟล์: `ui/components/authModal.tsx` · `ui/components/authLoginForm.tsx` · `router/index.tsx` · `layouts/auth.tsx` (คอมเมนต์) · เอกสาร SITEMAP / STRUCTURE / ARCHITECTURE / PROMPT


## 2026-10-09 — เปลี่ยนหน้าเข้าสู่ระบบเป็น modal บนหน้าหลัก
- ฟอร์มเข้าสู่ระบบย้ายเป็น Basic Modal ของ Ant Design (`ui/components/authModal.tsx`) ตามดีไซน์ใหม่: พื้นมืดโปร่ง · พื้นหลังเบลอ + เงา · Google/Facebook เป็นไอคอนกลม · ลิงก์ลืมรหัสผ่าน/สมัครสมาชิก
- ปุ่ม "เข้าสู่ระบบ" ใน navbar และปุ่มหัวใจ (ยังไม่ล็อกอิน) เปิด modal แทนการเปลี่ยนหน้า · `AuthModalProvider` ครอบใน `layouts/root.tsx`
- `/login` เหลือเป็น redirect ไป `/` แล้วเปิด modal (รองรับ `?next=` จาก `RequireAuth` และลิงก์เก่า) · ไฟล์: `page.tsx`, `router/index.tsx`
