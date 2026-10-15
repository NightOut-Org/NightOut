import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/services/auth';

export const OAUTH_SIGNUP_PATH = '/signup/social';

/**
 * ล็อกอินด้วย Google/Facebook ครั้งแรก (ยังไม่มีบัญชี) → พาไป /signup/social ยืนยันอายุ + ยอมรับเงื่อนไขก่อนใช้งาน
 * กลับมาหน้าเดิมหลังสร้างบัญชี (`next`)
 */
export function useOAuthSignupRedirect() {
  const { needsOAuthSignup } = useAuth();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!needsOAuthSignup || pathname === OAUTH_SIGNUP_PATH) return;
    const next = pathname === '/login' ? new URLSearchParams(search).get('next') ?? '/' : `${pathname}${search}`;
    navigate(`${OAUTH_SIGNUP_PATH}?next=${encodeURIComponent(next)}`, { replace: true });
  }, [needsOAuthSignup, pathname, search, navigate]);
}
