import { CaretDown, SignOut, User, type Icon } from '@phosphor-icons/react';
import { Dropdown, Spin } from 'antd';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ROLE_META, roleScope, roleTint } from '@/configs/roles';
import { getBar } from '@/services/data';
import type { AppUser } from '@/services/auth';
import { UserAvatar } from './userAvatar';

const ITEM = 'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-white/5';

function MenuItem({ icon: I, children, active, className = '' }: { icon: Icon; children: ReactNode; active?: boolean; className?: string }) {
  return (
    <span className={`${ITEM} ${active ? 'bg-white/[0.06]' : ''} ${className}`}>
      <I size={18} />
      {children}
    </span>
  );
}

/**
 * ปุ่มบัญชีบน navbar — รูป + ชื่อ + ชั้นบัญชี (สีตามชั้น) · กดแล้วเห็นชั้นบัญชี + ดูโปรไฟล์ / ปุ่มลัดของชั้น / ออกจากระบบ
 * มือถือ (< md) เหลือรูป + จุดไอคอนชั้นบัญชี
 */
export function AccountMenu({
  user,
  open,
  onOpenChange,
  glass,
  scrolled,
  compact,
  signingOut,
  onLogout,
}: {
  user: AppUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** อยู่บนวิดีโอหน้าแรก (พื้นกระจกใส) */
  glass: boolean;
  scrolled: boolean;
  /** navbar ไม่พอ (เลื่อนแล้วหด / จอกว้างปานกลาง / ชื่อเมนูยาว) → เหลือรูป + จุดไอคอนชั้นบัญชีแบบมือถือ */
  compact: boolean;
  signingOut: boolean;
  onLogout: () => void;
}) {
  const { pathname } = useLocation();
  const meta = ROLE_META[user.role];
  const label = user.roleLabel || meta.label;
  const scope = roleScope(user.role, user.barId ? getBar(user.barId)?.name : undefined);
  const RoleIcon = meta.icon;
  const avatarSize = scrolled ? 30 : 34;
  const close = () => onOpenChange(false);

  return (
    <Dropdown
      placement="bottomRight"
      trigger={['click']}
      open={open}
      onOpenChange={onOpenChange}
      popupRender={() => (
        <section
          role="menu"
          aria-label="บัญชีของฉัน"
          className="w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-surface text-text shadow-[0_24px_48px_rgba(0,0,0,0.5)]"
        >
          <div className="flex flex-col gap-3 border-b border-border p-4">
            <p className="text-xs text-muted">เข้าสู่ระบบในฐานะ</p>
            <div
              className="flex items-center gap-3 rounded-xl border p-3"
              style={{ borderColor: roleTint(meta, 0.45), background: roleTint(meta, 0.12) }}
            >
              <span
                className="grid size-10 shrink-0 place-items-center rounded-[10px] text-[#07070D]"
                style={{ background: `rgb(${meta.rgb})` }}
              >
                <RoleIcon size={22} weight="fill" />
              </span>
              <span className="flex min-w-0 flex-col">
                <b className="text-[15px]" style={{ color: meta.color }}>
                  {label}
                </b>
                <span className="truncate text-xs text-muted">{scope}</span>
              </span>
            </div>
          </div>
          <div className="p-1.5">
            <Link to="/profile" role="menuitem" onClick={close} className="block !text-text">
              <MenuItem icon={User} active={pathname === '/profile'}>
                ดูโปรไฟล์
              </MenuItem>
            </Link>
            {meta.cta &&
              (meta.cta.external ? (
                <a href={meta.cta.to} role="menuitem" onClick={close} className="block !text-text">
                  <MenuItem icon={meta.cta.icon}>{meta.cta.label}</MenuItem>
                </a>
              ) : (
                <Link to={meta.cta.to} role="menuitem" onClick={close} className="block !text-text">
                  <MenuItem icon={meta.cta.icon}>{meta.cta.label}</MenuItem>
                </Link>
              ))}
            <button
              type="button"
              role="menuitem"
              disabled={signingOut}
              onClick={() => {
                close();
                onLogout();
              }}
              className="block w-full cursor-pointer text-left text-[var(--crowd-full)] disabled:cursor-wait disabled:opacity-60"
            >
              <MenuItem icon={SignOut}>ออกจากระบบ</MenuItem>
            </button>
          </div>
        </section>
      )}
    >
      <button
        type="button"
        aria-label={`บัญชี ${user.displayName} · ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`relative ml-3 flex shrink-0 cursor-pointer items-center gap-2.5 rounded-full border text-left transition-[height,border-color] duration-300 ${compact ? '' : `md:pr-3 md:pl-1.5 ${scrolled ? 'md:h-10' : 'md:h-[46px]'}`} ${glass ? 'border-white/15 bg-white/10 text-white' : 'border-border bg-card text-text'} p-0.5`}
      >
        <Spin spinning={signingOut} size="small">
          <UserAvatar name={user.displayName} src={user.avatarUrl} size={avatarSize} className="!text-xs" />
        </Spin>
        {/* มือถือ / แบบย่อ: จุดไอคอนชั้นบัญชีมุมรูป */}
        <span
          aria-hidden
          className={`absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full border border-surface text-[#07070D] ${compact ? '' : 'md:hidden'}`}
          style={{ background: `rgb(${meta.rgb})` }}
        >
          <RoleIcon size={10} weight="fill" />
        </span>
        <span className={`${compact ? 'hidden' : 'hidden md:flex'} flex-col leading-tight`}>
          <span className="max-w-32 truncate text-[13px] font-semibold whitespace-nowrap">{user.displayName}</span>
          <span className="flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: meta.color }}>
            <RoleIcon weight="fill" />
            {label}
          </span>
        </span>
        <CaretDown size={12} className={`${compact ? 'hidden' : 'hidden md:block'} ${glass ? 'text-white/70' : 'text-muted'}`} />
      </button>
    </Dropdown>
  );
}
