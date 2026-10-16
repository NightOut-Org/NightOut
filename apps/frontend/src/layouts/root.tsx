import { Outlet, ScrollRestoration } from 'react-router';
import { useOAuthSignupRedirect } from '@/hooks/useOAuthSignupRedirect';
import { AuthModalProvider } from '@/ui/components/authModal';

/**
 * ครอบทุก route — คืนตำแหน่ง scroll ให้ถูก
 * - ไปหน้าใหม่ (กดลิงก์) → เริ่มที่บนสุดเสมอ
 * - กดย้อนกลับ/ไปข้างหน้า → กลับไปตำแหน่งเดิมของหน้านั้น
 * และพาผู้ที่ล็อกอิน Google/Facebook ครั้งแรกไปยืนยันอายุ + ยอมรับเงื่อนไข (/signup/social)
 */
export function RootLayout() {
  useOAuthSignupRedirect();
  return (
    <AuthModalProvider>
      <Outlet />
      <ScrollRestoration />
    </AuthModalProvider>
  );
}
