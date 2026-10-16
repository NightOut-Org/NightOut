# forgotPassword — ประวัติการแก้ไข

## 2026-10-15 — เปลี่ยนหน้าลืมรหัสผ่านเป็น modal เหมือนเข้าสู่ระบบ/สมัครสมาชิก
- ฟอร์มย้ายไปเป็นมุมมอง `forgot` ใน `AuthModal` (`ui/components/authForgotForm.tsx`) — ลิงก์ "ลืมรหัสผ่าน ?" ในฟอร์มเข้าสู่ระบบสลับมุมมองในกล่องเดิมแทนการเปลี่ยนหน้า · มีปุ่ม "กลับไปเข้าสู่ระบบ"
- ส่งลิงก์แล้วแสดงผลในกล่องเดิม (ไม่บอกว่ามีบัญชีหรือไม่ · กันเดาอีเมล) + ปุ่ม "ส่งลิงก์อีกครั้ง" แทน toast
- `/forgot-password` เหลือเป็น redirect ไป `/` แล้วเปิด modal (ลิงก์เก่า) · ย้าย route ออกจาก `AuthLayout` · `useAuthModal().openForgotPassword()` ใหม่
- ไฟล์: `page.tsx`, `ui/components/authModal.tsx`, `ui/components/authLoginForm.tsx`, `router/index.tsx`
