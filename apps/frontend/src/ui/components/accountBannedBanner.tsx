import { Alert } from 'antd';
import { useLocation } from 'react-router';
import { useAuth } from '@/services/auth';

/** หน้าที่บัญชีที่ถูกแบนต้องรู้ตัว — ชุมชน (อ่านได้อย่างเดียว) · โปรไฟล์ · การจองของฉัน */
const BANNER_PATHS = /^\/(community|profile|bookings)(\/|$)/;

/**
 * แถบแจ้ง "บัญชีของคุณถูกระงับ" พร้อมเหตุผล — วางใน MainLayout เหนือเนื้อหาหน้า
 * ข้อมูลมาจาก GET /me/profile ตอนเข้าสู่ระบบ/เปิดเว็บ (แบนกลางคันเห็นหลังโหลดใหม่ · DB บล็อกการเขียนเองอยู่แล้ว)
 */
export function AccountBannedBanner() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user?.bannedAt || !BANNER_PATHS.test(pathname)) return null;
  const reason = user.banReason?.trim();
  return (
    <Alert
      type="error"
      showIcon
      // relative z-10: หน้าที่มีพื้นหลัง EmbersBackdrop (container `relative isolate` มาทีหลังใน DOM เช่น /community) จะวาดทับแถบนี้ถ้าอยู่ระดับ z-auto เท่ากัน
      className="!mb-4 relative z-10"
      title="บัญชีของคุณถูกระงับ"
      description={`จองโต๊ะไม่ได้ และชุมชนอ่านได้อย่างเดียว${reason ? ` · เหตุผล: ${reason}` : ''} — ติดต่อ NightOut หากคิดว่าเป็นความผิดพลาด`}
    />
  );
}
