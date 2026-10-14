import type { UserRole } from '@nightout/types';
import { Button, Result, Spin } from 'antd';
import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/services/auth';
import { getBar, type Bar } from '@/services/data';

/** Layout route: ต้องล็อกอินก่อน ไม่งั้นส่งไป /login?next=... */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spin fullscreen />;
  if (!user)
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <Outlet />;
}

/** Layout route: จำกัด role */
export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <Result
        status="403"
        title="ไม่มีสิทธิ์เข้าหน้านี้"
        subTitle="หน้านี้สำหรับเจ้าของร้านและพนักงานเท่านั้น"
        extra={
          <Link to="/merchant/join">
            <Button type="primary">สมัครเป็นร้านค้า</Button>
          </Link>
        }
      />
    );
  }
  return <Outlet />;
}

/**
 * Layout route ใต้ /merchant: จำกัดบทบาทในทีมร้าน (bar_staff.role)
 * Staff/PR เห็นเฉพาะคิว (แดชบอร์ด Lite · คืนนี้ · ผังโต๊ะ · การจอง) — ห้ามเห็นเงินของร้าน · DB กันซ้ำด้วย is_bar_manager()
 */
export function RequireBarRole({ roles }: { roles: NonNullable<Bar['staffRole']>[] }) {
  const { user } = useAuth();
  const role = user?.barId ? getBar(user.barId)?.staffRole : undefined;
  if (!role || !roles.includes(role)) {
    return (
      <Result
        status="403"
        title="หน้านี้สำหรับเจ้าของร้านและผู้จัดการ"
        subTitle="พนักงานใช้ได้เฉพาะหน้า คืนนี้ ผังโต๊ะ และ การจอง"
        extra={
          <Link to="/merchant/tonight">
            <Button type="primary">ไปหน้าคืนนี้</Button>
          </Link>
        }
      />
    );
  }
  return <Outlet />;
}
