import type { UserRole } from '@nightout/types';
import { Button, Result, Spin } from 'antd';
import { useEffect, useRef } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router';
import { useAuth } from '@/services/auth';
import { getBar, type Bar } from '@/services/data';
import { useAuthModal } from '@/ui/components/authModal';

/**
 * Layout route: ต้องล็อกอินก่อน
 * - กดลิงก์มาจากหน้าอื่นในแอป → ย้อนกลับไปหน้าเดิมแล้วเปิด modal เข้าสู่ระบบ (ไม่หลุดไปหน้าแรก) · ล็อกอินแล้วไปหน้าที่ขอ
 * - เปิดลิงก์หน้าจองตรง (/bars/:slug/book) → หน้าร้านนั้น + modal (ไม่เสีย context ร้าน) · ล็อกอินแล้วกลับมาหน้าจอง
 * - เปิด URL ตรงหน้าอื่น (ไม่มีหน้าก่อนหน้าในแอป) → /login?next=... (หน้าแรก + modal)
 */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { openLogin } = useAuthModal();
  const next = location.pathname + location.search;
  // react-router เก็บลำดับใน history.state.idx · > 0 = มีหน้าก่อนหน้าในแอปนี้
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  const barSlug = /^\/bars\/([^/]+)\/book\/?$/.exec(location.pathname)?.[1];
  const bounceBack = !loading && !user && (canGoBack || !!barSlug);
  // ย้อนกลับครั้งเดียวต่อการเข้า route นี้ (StrictMode เรียก effect ซ้ำ → navigate(-1) สองครั้ง = ย้อนเลยหน้าเดิม)
  const bounced = useRef(false);

  useEffect(() => {
    if (!bounceBack || bounced.current) return;
    bounced.current = true;
    openLogin(next);
    if (canGoBack) navigate(-1);
    else navigate(`/bars/${barSlug}`, { replace: true });
  }, [bounceBack, canGoBack, barSlug, next, openLogin, navigate]);

  if (loading) return <Spin fullscreen />;
  if (!user)
    return bounceBack ? null : <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
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
  // ส่ง context ของ <MerchantLayout> (ร้านปัจจุบัน) ต่อให้หน้าข้างใน — ไม่งั้น useMerchantBar() ได้ undefined
  const bar = useOutletContext<Bar>();
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
  return <Outlet context={bar} />;
}
