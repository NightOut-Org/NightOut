import type { Session } from '@supabase/supabase-js';
import type * as C from '@nightout/contracts';
import type { UserRole } from '@nightout/types';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useDemo } from '@/hooks/useDemo';
import { log } from '@/services/log';
import { supabase } from '@/services/supabase';
import { isOAuthProvider } from '@nightout/utils';
import { ApiError, Rest } from '@nightout/utils/rest';
import { clearUser, currentProfile, startUser } from '@/services/sync';

/** GET /me/profile ด้วย token ที่ระบุ (ตอนโหลด session ก่อน Rest รู้จัก token) · backend: domains/account */
const fetchMyProfile = (accessToken: string) =>
  Rest.get<C.MyProfile>('/me/profile', { headers: { Authorization: `Bearer ${accessToken}` } });

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  /** ชื่อไทยของชั้นบัญชี (ตาราง roles) */
  roleLabel: string;
  barId?: string;
  /** เบอร์ล่าสุดที่ใช้จอง (E.164) */
  phoneE164?: string | null;
  /** ถูกระงับ (จองไม่ได้ + ชุมชนอ่านอย่างเดียว) */
  bannedAt?: string | null;
  /** เหตุผลที่ถูกระงับ (แอดมินกรอก / สลิปปลอมซ้ำ) */
  banReason?: string | null;
  /** URL รูปโปรไฟล์ (null = ใช้ตัวย่อชื่อ) */
  avatarUrl?: string | null;
}

interface AuthContextValue {
  /** เดิมใช้แยกโหมดเดโม — ตอนนี้ต่อ Supabase เสมอ (false ตลอด) */
  isDemo: false;
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  /** ล็อกอิน Google/Facebook ครั้งแรกแล้วยังไม่มีบัญชี (ต้องยืนยันอายุ + ยอมรับเงื่อนไขที่ /signup/social) */
  needsOAuthSignup: boolean;
  signOut: () => Promise<void>;
  /** โหลดโปรไฟล์ + ข้อมูลผู้ใช้ใหม่ (เช่นหลังสมัครเป็นร้าน → role เปลี่ยน) */
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** ล็อกอินด้วย Google/Facebook แล้วยังไม่มี public.users (trigger ไม่สร้างให้ — รอยืนยันอายุ + ยอมรับเงื่อนไข) */
const isPendingOAuthSignup = (session: Session, e: unknown) =>
  e instanceof ApiError && e.code === 'USER_NOT_FOUND' && isOAuthProvider(session.user.app_metadata?.provider);

/** โปรไฟล์จาก public.users ผ่าน API (GET /me/profile) — role อ่านจาก DB ไม่ใช่ user_metadata · 'oauth-signup' = ยังไม่มีบัญชี */
async function fetchProfile(session: Session): Promise<AppUser | 'oauth-signup' | null> {
  let u: C.MyProfile;
  try {
    u = await fetchMyProfile(session.access_token);
  } catch (e) {
    if (isPendingOAuthSignup(session, e)) return 'oauth-signup';
    log.error('โหลดโปรไฟล์ไม่สำเร็จ', (e as Error).message);
    return null;
  }
  return {
    id: u.id,
    email: session.user.email ?? '',
    displayName: u.display_name,
    role: u.role,
    roleLabel: u.role_label,
    phoneE164: u.phone_e164 ?? null,
    bannedAt: u.banned_at ?? null,
    banReason: u.ban_reason ?? null,
    avatarUrl: u.avatar_url ?? null,
  };
}

/**
 * โปรไฟล์ล่าสุดในเครื่อง — รีเฟรชแล้ว navbar แสดงบัญชีได้ทันทีไม่ต้องรอ API (ใช้เฉพาะเมื่อ id ตรงกับ session)
 * ไม่เก็บเบอร์โทร · โปรไฟล์จริงยังโหลดใหม่ทุกครั้ง และหน้าที่ต้องล็อกอินยังรอ `loading` เหมือนเดิม
 */
const PROFILE_CACHE_KEY = 'nightout-profile-v1';

function readCachedProfile(): AppUser | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(p: AppUser | null) {
  try {
    if (p) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ ...p, phoneE164: null }));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // โหมดส่วนตัว / ปิด storage — ไม่มี cache ก็แค่รอ API
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  useDemo();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(supabase !== null);
  const [profile, setProfile] = useState<AppUser | 'oauth-signup' | null>(readCachedProfile);
  /** โหลดโปรไฟล์ของ user id ไหนเสร็จแล้ว (สำเร็จหรือไม่ก็ตาม) */
  const [profileLoadedFor, setProfileLoadedFor] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const userId = session?.user.id;

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId || !session) {
      if (currentProfile()) clearUser();
      // รู้แน่แล้วว่าไม่มี session (ไม่ใช่แค่ยังอ่านอยู่) → ทิ้งโปรไฟล์ใน cache
      if (!sessionLoading) writeCachedProfile(null);
      return;
    }
    let cancelled = false;
    const done = () => !cancelled && setProfileLoadedFor(`${userId}:${version}`);
    void (async () => {
      const p = await fetchProfile(session);
      if (cancelled) return;
      // ตั้งโปรไฟล์ก่อน → navbar แสดงบัญชีทันที ไม่ต้องรอข้อมูลผู้ใช้ทั้งหมด
      setProfile(p);
      writeCachedProfile(p === 'oauth-signup' ? null : p);
      if (!p || p === 'oauth-signup') return;
      // ข้อมูลของผู้ใช้ (การจอง แจ้งเตือน ร้านของฉัน …) โหลดให้เสร็จก่อนเปิดหน้าที่ต้องล็อกอิน (loading ยัง true)
      const { barId } = await startUser(p).catch((e: Error) => {
        log.error('โหลดข้อมูลผู้ใช้ไม่สำเร็จ', e.message);
        return { barId: undefined };
      });
      if (cancelled) return;
      const full = { ...p, barId };
      setProfile(full);
      writeCachedProfile(full);
    })().finally(done);
    return () => {
      cancelled = true;
    };
    // session object เปลี่ยนทุกครั้งที่ต่ออายุ token — โหลดใหม่เฉพาะเมื่อเปลี่ยนผู้ใช้ / สั่ง reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, version, sessionLoading]);

  // มี session แล้วแต่โปรไฟล์ยังไม่มา = ยังโหลดอยู่ (กัน RequireAuth เด้งไป /login ระหว่างรอ)
  const loading = sessionLoading || (!!userId && profileLoadedFor !== `${userId}:${version}`);

  const value = useMemo<AuthContextValue>(
    () => ({
      isDemo: false,
      user: session && profile && profile !== 'oauth-signup' && profile.id === session.user.id ? profile : null,
      session,
      loading,
      needsOAuthSignup: !!session && !loading && profile === 'oauth-signup',
      signOut: async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        clearUser();
        writeCachedProfile(null);
      },
      reload: async () => {
        setVersion((v) => v + 1);
      },
    }),
    [session, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
