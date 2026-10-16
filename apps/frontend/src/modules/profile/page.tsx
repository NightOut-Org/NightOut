import { ChatCircleDots, SignOut } from '@phosphor-icons/react';
import { App, Button } from 'antd';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ROLE_META, roleTint } from '@/configs/roles';
import { useDemo } from '@/hooks/useDemo';
import { useAuth } from '@/services/auth';
import { MoltenBackground } from '@/ui/components/MoltenBackground';
import { PreferencesCard } from './components/preferencesCard';
import { ProfileHeader } from './components/profileHeader';
import { RoleList } from './components/roleList';

const TABS = [
  { key: 'prefs', label: 'ข้อมูลและความชอบ' },
  { key: 'account', label: 'บัญชีและสิทธิ์' },
  { key: 'notify', label: 'ช่องทางแจ้งเตือน' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export function ProfilePage() {
  useDemo();
  const { user, signOut } = useAuth();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [signingOut, setSigningOut] = useState(false);
  if (!user) return null;

  const tab: TabKey = TABS.find((t) => t.key === search.get('tab'))?.key ?? 'prefs';
  const pickTab = (key: TabKey) =>
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key === 'prefs') next.delete('tab');
        else next.set('tab', key);
        return next;
      },
      { replace: true },
    );
  const meta = ROLE_META[user.role];

  const logout = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch {
      message.error('ออกจากระบบไม่สำเร็จ ลองใหม่อีกครั้ง');
      setSigningOut(false);
    }
  };

  return (
    <>
      {/* -z-10 ใน Layout ที่ isolate (handle `backdrop`) → หลังเนื้อหาและ footer แต่เหนือพื้นของ Layout */}
      <div className="fixed inset-0 -z-10">
        <MoltenBackground />
      </div>
      {/* แสงเรืองสีชั้นบัญชีหลังหัวโปรไฟล์ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px]"
        style={{ background: `radial-gradient(60% 100% at 50% 0%, ${roleTint(meta, 0.28)}, transparent 70%)` }}
      />
      <div className="mx-auto flex max-w-[880px] flex-col gap-5">
        <ProfileHeader user={user} />

        <div role="tablist" aria-label="ส่วนของโปรไฟล์" className="mt-2 flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`profile-tab-${t.key}`}
                aria-selected={active}
                aria-controls={`profile-panel-${t.key}`}
                onClick={() => pickTab(t.key)}
                className={`h-11 shrink-0 cursor-pointer border-b-2 px-4 text-sm whitespace-nowrap transition-colors ${active ? 'border-gold text-text' : 'border-transparent text-muted hover:text-text'}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id={`profile-panel-${tab}`} aria-labelledby={`profile-tab-${tab}`}>
          {tab === 'prefs' && <PreferencesCard user={user} />}
          {tab === 'account' && <RoleList role={user.role} roleLabel={user.roleLabel} />}
          {tab === 'notify' && (
            <section className="rounded-xl border border-border bg-card p-6">
              <p className="mb-3 text-sm text-muted">
                รับแจ้งเตือนการจองทาง LINE (ต้องเพิ่มเพื่อน LINE OA และยินยอมก่อน) — ใช้แจ้งเตือนเท่านั้น
                ไม่ได้ใช้เข้าสู่ระบบ
              </p>
              <Button
                className="w-full sm:w-auto"
                icon={<ChatCircleDots />}
                onClick={() =>
                  message.info('การแจ้งเตือนทาง LINE กำลังจะเปิดให้ใช้ — ตอนนี้ดูแจ้งเตือนได้ที่กระดิ่งด้านบน')
                }
              >
                เชื่อม LINE
              </Button>
            </section>
          )}
        </div>

        {/* มือถือ: ออกจากระบบ (คอมพิวเตอร์อยู่ในเมนูบัญชีบน navbar) */}
        <Button block size="large" icon={<SignOut />} loading={signingOut} onClick={logout} className="mt-2 md:!hidden">
          ออกจากระบบ
        </Button>
      </div>
    </>
  );
}
