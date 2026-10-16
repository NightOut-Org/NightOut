import type * as C from '@nightout/contracts';
import { OAUTH_PROVIDER_LABEL } from '@nightout/utils';
import { ApiError } from '@nightout/utils/rest';
import { UserCircle } from '@phosphor-icons/react';
import { App, Button, Checkbox, Input, Result, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@/services/auth';
import { supabase } from '@/services/supabase';
import { useAuthModal } from '@/ui/components/authModal';
import { AuthCard } from '@/ui/components/authCard';
import { cancelOAuthSignup, completeOAuthSignup, verifyOAuthSignup } from './api';

type Step =
  | { kind: 'checking' }
  | { kind: 'consent'; info: C.OAuthSignupVerifyResult }
  | { kind: 'failed'; message: string };

/** ปลายทางหลังสร้างบัญชี — รับเฉพาะ path ภายในเว็บ */
const safeNext = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') ? v : '/');

/**
 * /signup/social — ล็อกอิน Google/Facebook ครั้งแรก (REQUIREMENTS ข้อ 3)
 * backend ดึงวันเกิดจากบัญชีเอง → อายุผ่าน = ติ๊กยอมรับ ToS + PDPA แล้วสร้างบัญชี · ไม่ผ่าน = ไม่สร้างบัญชี แนะนำสมัครด้วยอีเมล
 */
export function OAuthSignupPage() {
  const { session, needsOAuthSignup, loading, reload, signOut } = useAuth();
  const { openRegister } = useAuthModal();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [step, setStep] = useState<Step>({ kind: 'checking' });
  const [displayName, setDisplayName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const started = useRef(false);

  /** ยืนยันไม่ผ่าน / ไม่ยอมรับ → ลบบัญชี Auth ที่ยังไม่มีโปรไฟล์ (backend ลบให้แล้วกรณีอายุไม่ผ่าน) แล้วออกจากระบบ */
  const leave = async (alreadyDeleted = false) => {
    if (!alreadyDeleted) await cancelOAuthSignup().catch(() => undefined);
    await signOut().catch(() => supabase?.auth.signOut({ scope: 'local' }));
  };

  useEffect(() => {
    if (!needsOAuthSignup || !session || started.current) return;
    started.current = true;
    verifyOAuthSignup(session.provider_token)
      .then(async (info) => {
        if (info.status === 'REGISTERED') {
          await reload();
          navigate(next, { replace: true });
          return;
        }
        setDisplayName(info.display_name);
        setStep({ kind: 'consent', info });
      })
      .catch(async (e: Error) => {
        // ตั้งหน้าผลก่อนออกจากระบบ — ไม่งั้นพอ session หายหน้าจะเด้งกลับหน้าแรกก่อนผู้ใช้เห็นเหตุผล
        setStep({ kind: 'failed', message: e.message });
        await leave(e instanceof ApiError && e.status === 403);
      });
    // ทำครั้งเดียวต่อการเปิดหน้า (กันยิงซ้ำตอน session ต่ออายุ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOAuthSignup, session]);

  const accept = async () => {
    setSaving(true);
    try {
      await completeOAuthSignup(displayName);
      await reload();
      message.success('สร้างบัญชีเรียบร้อย');
      navigate(next, { replace: true });
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const decline = async () => {
    setSaving(true);
    await leave();
    navigate('/', { replace: true });
  };

  // เข้าหน้านี้ตรงๆ โดยไม่ได้อยู่ระหว่างสมัคร → กลับหน้าแรก
  if (!loading && !needsOAuthSignup && step.kind === 'checking') return <Navigate to={next} replace />;

  if (step.kind === 'failed') {
    return (
      <AuthCard title="ใช้งานบัญชีนี้ไม่ได้">
        <Result status="warning" className="!px-0 !pt-0" subTitle={<span className="text-white/80">{step.message}</span>} />
        <p className="mb-5 text-center text-sm text-white/75">
          ระบบไม่ได้สร้างบัญชีให้ · สมัครด้วยอีเมลแล้วกรอกวันเกิดเองได้
        </p>
        <Button
          type="primary"
          block
          size="large"
          className="btn-gold"
          onClick={() => {
            navigate('/', { replace: true });
            openRegister();
          }}
        >
          สมัครด้วยอีเมล
        </Button>
        <Link to="/" replace className="mt-4 block text-center text-xs !text-white/70 hover:!text-white">
          กลับหน้าแรก
        </Link>
      </AuthCard>
    );
  }

  if (step.kind === 'checking') {
    return (
      <AuthCard title="กำลังยืนยันอายุ" subtitle="ตรวจวันเกิดจากบัญชีที่คุณใช้เข้าสู่ระบบ">
        <div className="flex justify-center py-6">
          <Spin size="large" />
        </div>
      </AuthCard>
    );
  }

  const { info } = step;
  const providerLabel = info.provider ? OAUTH_PROVIDER_LABEL[info.provider] : 'บัญชีของคุณ';
  return (
    <AuthCard
      title="อีกขั้นเดียวก่อนเริ่มใช้งาน"
      subtitle={`ยืนยันอายุ 20 ปีขึ้นไปจากวันเกิดใน ${providerLabel} แล้ว`}
    >
      <p className="mb-4 truncate text-center text-xs text-white/60">{info.email}</p>
      <label htmlFor="oauth-display-name" className="mb-1.5 block text-sm text-white/90">
        ชื่อที่แสดง
      </label>
      <Input
        id="oauth-display-name"
        size="large"
        maxLength={60}
        prefix={<UserCircle size={18} />}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="ชื่อเล่นของคุณ"
        autoComplete="nickname"
        className="!mb-5"
      />
      <Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="!mb-5">
        <span className="text-xs">
          ยอมรับ{' '}
          <Link to="/terms" target="_blank" className="!text-[#c79bff]">
            เงื่อนไขการใช้งาน
          </Link>{' '}
          และ{' '}
          <Link to="/privacy" target="_blank" className="!text-[#c79bff]">
            นโยบายความเป็นส่วนตัว
          </Link>{' '}
          (ยินยอมให้เก็บและใช้ข้อมูลตาม PDPA)
        </span>
      </Checkbox>
      <Button
        type="primary"
        block
        size="large"
        className="btn-gold"
        disabled={!accepted || !displayName.trim()}
        loading={saving}
        onClick={accept}
      >
        ยอมรับและสร้างบัญชี
      </Button>
      <Button type="text" block className="!mt-3 !text-white/70" disabled={saving} onClick={decline}>
        ไม่ยอมรับ · ออกจากระบบ
      </Button>
    </AuthCard>
  );
}
