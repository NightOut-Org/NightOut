import { useEffect } from 'react';
import { Navigate } from 'react-router';
import { useAuthModal } from '@/ui/components/authModal';

/** /forgot-password — ไม่มีหน้าแยกแล้ว: กลับหน้าหลักแล้วเปิด modal ลืมรหัสผ่าน (ลิงก์เก่า) */
export function ForgotPasswordPage() {
  const { openForgotPassword } = useAuthModal();

  useEffect(() => {
    openForgotPassword();
  }, [openForgotPassword]);

  return <Navigate to="/" replace />;
}
