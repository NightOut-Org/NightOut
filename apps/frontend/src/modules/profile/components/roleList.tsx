import { CaretRight, CheckCircle, Storefront } from '@phosphor-icons/react';
import { Link } from 'react-router';
import type { UserRole } from '@nightout/types';
import { ROLE_META, visibleRoles } from '@/configs/roles';
import { useRoles } from '@/hooks/useRoles';

/** แท็บ "บัญชีและสิทธิ์" — ชั้นของตัวเอง (ไฮไลต์) และชั้นที่ต่ำกว่า · ไม่โชว์ชั้นที่สูงกว่า · ชื่อ/สีของชั้นจาก GET /me/roles */
export function RoleList({ role, roleLabel }: { role: UserRole; roleLabel: string }) {
  const roles = useRoles();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">ชั้นบัญชีของคุณ — เปลี่ยนเองไม่ได้ ติดต่อทีม NightOut หากตั้งผิด</p>
      <ul className="flex flex-col gap-2">
        {visibleRoles(role).map((code) => {
          const m = ROLE_META[code];
          const t = roles.tone(code);
          const I = m.icon;
          const current = code === role;
          return (
            <li
              key={code}
              aria-current={current || undefined}
              className={`grid grid-cols-[44px_minmax(0,1fr)_24px] items-center gap-x-3.5 gap-y-1 rounded-[14px] border px-[18px] py-3.5 sm:grid-cols-[44px_160px_minmax(0,1fr)_24px] ${current ? '' : 'border-border bg-card opacity-60'}`}
              style={current ? { borderColor: t.ink, background: t.tint(0.12), boxShadow: `0 0 0 4px ${t.tint(0.14)}` } : undefined}
            >
              <span
                className="row-span-2 grid size-10 place-items-center rounded-[10px] sm:row-span-1"
                style={current ? { background: t.solid, color: t.on } : { background: t.tint(0.14), color: t.ink }}
              >
                <I size={20} weight="fill" />
              </span>
              <b className="text-[15px]" style={{ color: t.ink }}>
                {current ? roleLabel || roles.label(code) : roles.label(code)}
              </b>
              <span className="col-start-2 row-start-2 text-[13px] text-muted sm:col-start-3 sm:row-start-1">{m.description}</span>
              {current && (
                <CheckCircle
                  size={22}
                  weight="fill"
                  className="col-start-3 row-span-2 row-start-1 justify-self-end sm:col-start-4 sm:row-span-1"
                  style={{ color: t.ink }}
                  aria-label="ชั้นบัญชีปัจจุบัน"
                />
              )}
            </li>
          );
        })}
      </ul>
      {role === 'CUSTOMER' && (
        <Link
          to="/merchant/join"
          className="group flex items-center gap-3.5 rounded-[14px] border border-dashed border-gold/45 px-[18px] py-3.5 !text-text md:hover:border-gold"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-gold/15 text-gold-text">
            <Storefront size={20} weight="fill" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="text-[15px]">เปิดร้านกับ NightOut</b>
            <span className="text-[13px] text-muted">สมัครร้านแล้วทีม NightOut ตรวจภายใน 1–2 วันทำการ</span>
          </span>
          <CaretRight className="shrink-0 text-muted transition-transform md:group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
