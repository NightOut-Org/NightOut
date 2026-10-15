import { X } from '@phosphor-icons/react';
import { ConfigProvider, Modal, theme } from 'antd';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { BrandLogo } from './brandLogo';
import { AuthForgotForm } from './authForgotForm';
import { AuthLoginForm } from './authLoginForm';
import { AuthRegisterForm } from './authRegisterForm';

type AuthView = 'login' | 'register' | 'forgot';

interface AuthModalApi {
  /** เปิด modal เข้าสู่ระบบ · next = path ที่จะไปต่อหลังล็อกอินสำเร็จ (ไม่ใส่ = อยู่หน้าเดิม) · สลับไปสมัครก็ส่งต่อ (หลัง onboarding) */
  openLogin: (next?: string) => void;
  /** เปิด modal สมัครสมาชิก */
  openRegister: () => void;
  /** เปิด modal ลืมรหัสผ่าน (ขอลิงก์ตั้งรหัสใหม่ทางอีเมล) */
  openForgotPassword: () => void;
}

const AuthModalContext = createContext<AuthModalApi | null>(null);

export function useAuthModal(): AuthModalApi {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal ต้องอยู่ใน <AuthModalProvider>');
  return ctx;
}

/** กรอบของ modal — การ์ดมืดขอบม่วง เห็นหน้าเว็บเบลอด้านหลัง ตามดีไซน์ (เหมือนกันทั้งธีมมืด/สว่าง) */
/** ลุคการ์ดอยู่ที่ `.auth-glass` ใน styles/index.css */
const MODAL_STYLES = {
  mask: { background: 'rgba(5, 3, 12, 0.55)' },
  container: { padding: '28px 36px 26px' },
} as const;

const HEADINGS: Record<AuthView, { title: string; subtitle: string }> = {
  login: {
    title: 'ยินดีต้อนรับกลับ',
    subtitle: 'เข้าสู่ระบบเพื่อจองโต๊ะและดูรีวิวจากคนที่ไปจริง',
  },
  register: {
    title: 'สร้างบัญชี',
    subtitle: 'ใช้เวลาไม่ถึงนาที · สำหรับผู้ที่อายุ 20 ปีขึ้นไป',
  },
  forgot: {
    title: 'ลืมรหัสผ่าน',
    subtitle: 'กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสใหม่ให้',
  },
};

/** Provider เดียวทั้งแอป: ปุ่ม "เข้าสู่ระบบ" / route guard เรียก `useAuthModal().openLogin()` */
export function AuthModalProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [isOpen, setOpen] = useState(false);
  const [view, setView] = useState<AuthView>('login');
  const [next, setNext] = useState<string | undefined>();

  const openLogin = useCallback((to?: string) => {
    setNext(to);
    setView('login');
    setOpen(true);
  }, []);
  const openRegister = useCallback(() => {
    setNext(undefined);
    setView('register');
    setOpen(true);
  }, []);
  const openForgotPassword = useCallback(() => {
    setNext(undefined);
    setView('forgot');
    setOpen(true);
  }, []);
  const api = useMemo(
    () => ({ openLogin, openRegister, openForgotPassword }),
    [openLogin, openRegister, openForgotPassword],
  );
  const close = () => setOpen(false);

  return (
    <AuthModalContext.Provider value={api}>
      {children}
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
        <Modal
          open={isOpen}
          onCancel={close}
          footer={null}
          centered
          destroyOnHidden
          width={view === 'register' ? 520 : 480}
          rootClassName="auth-modal"
          mask={{ blur: true }}
          styles={MODAL_STYLES}
          classNames={{ container: 'auth-glass' }}
          closeIcon={
            <span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-white/90 transition-colors hover:bg-white/20">
              <X size={16} weight="bold" />
            </span>
          }
        >
          <header className="mb-6 flex flex-col items-center text-center">
            <BrandLogo surface="dark" className="h-7" />
            <h2 className="mt-5 text-2xl font-bold text-white">{HEADINGS[view].title}</h2>
            <p className="mt-1.5 text-xs text-white/60">{HEADINGS[view].subtitle}</p>
          </header>
          {view === 'login' && (
            <AuthLoginForm
              next={next}
              onDone={() => {
                close();
                if (next) navigate(next, { replace: true });
              }}
              onForgot={() => setView('forgot')}
              onSwitch={() => setView('register')}
            />
          )}
          {view === 'register' && (
            <AuthRegisterForm next={next} onNavigate={close} onSwitch={() => setView('login')} />
          )}
          {view === 'forgot' && <AuthForgotForm onBack={() => setView('login')} />}
        </Modal>
      </ConfigProvider>
    </AuthModalContext.Provider>
  );
}
