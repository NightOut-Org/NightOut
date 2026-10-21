# oauthSignup — ประวัติการแก้ไข

## 2026-10-20 — เลิกใช้ " · " คั่นข้อมูลในข้อความ UI
- ข้อมูลหลายค่าบรรทัดเดียวใช้ `MetaList` (`ui/components/metaList.tsx`) เว้นระยะแยกค่า · ข้อความยาวใช้วรรค/วงเล็บแทนจุดกลาง ไม่เปลี่ยนพฤติกรรม
- ไฟล์: หน้าและคอมโพเนนต์ในโมดูลนี้ที่เคยมี " · " ในข้อความ

## 2026-10-15 — หน้าใหม่ /signup/social
- ล็อกอิน Google/Facebook ครั้งแรก → `RootLayout` (`hooks/useOAuthSignupRedirect.ts`) พามาหน้านี้ · ส่ง `provider_token` ให้ backend ยืนยันอายุ → ชื่อที่แสดง + ติ๊กยอมรับเงื่อนไข/นโยบายความเป็นส่วนตัว (PDPA) → สร้างบัญชีแล้วกลับหน้าเดิม (`?next=`)
- ไม่ยอมรับ = ลบบัญชี Auth + ออกจากระบบ · ยืนยันอายุไม่ผ่าน = แจ้งเหตุ ไม่สร้างบัญชี + ปุ่ม "สมัครด้วยอีเมล"
- ปุ่ม Google/Facebook ขอ scope วันเกิด (`OAUTH_BIRTHDAY_SCOPE`) + ข้อความใต้ปุ่ม · `services/auth.tsx` เพิ่ม `needsOAuthSignup`
- ไฟล์: `page.tsx`, `api.ts`, `router/index.tsx`, `layouts/root.tsx`, `ui/components/authLoginForm.tsx`, `ui/components/authRegisterForm.tsx` (ใช้ `TERMS_VERSION` / `PRIVACY_VERSION`)
