import { CheckCircle } from '@phosphor-icons/react';
import type { UserRole } from '@nightout/types';
import { ROLE_META, roleTint, visibleRoles } from '@/configs/roles';

/** แท็บ "บัญชีและสิทธิ์" — ชั้นของตัวเอง (ไฮไลต์) และชั้นที่ต่ำกว่า · ไม่โชว์ชั้นที่สูงกว่า */
export function RoleList({ role, roleLabel }: { role: UserRole; roleLabel: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">ชั้นบัญชีของคุณ — เปลี่ยนเองไม่ได้ ติดต่อทีม NightOut หากตั้งผิด</p>
      <ul className="flex flex-col gap-2">
        {visibleRoles(role).map((code) => {
          const m = ROLE_META[code];
          const I = m.icon;
          const current = code === role;
          return (
            <li
              key={code}
              aria-current={current || undefined}
              className={`grid grid-cols-[44px_minmax(0,1fr)_24px] items-center gap-x-3.5 gap-y-1 rounded-[14px] border px-[18px] py-3.5 sm:grid-cols-[44px_160px_minmax(0,1fr)_24px] ${current ? '' : 'border-border bg-card opacity-60'}`}
              style={
                current
                  ? { borderColor: m.color, background: roleTint(m, 0.12), boxShadow: `0 0 0 4px ${roleTint(m, 0.14)}` }
                  : undefined
              }
            >
              <span
                className="row-span-2 grid size-10 place-items-center rounded-[10px] sm:row-span-1"
                style={current ? { background: `rgb(${m.rgb})`, color: '#07070D' } : { background: roleTint(m, 0.14), color: m.color }}
              >
                <I size={20} weight="fill" />
              </span>
              <b className="text-[15px]" style={{ color: m.color }}>
                {current ? roleLabel || m.label : m.label}
              </b>
              <span className="col-start-2 row-start-2 text-[13px] text-muted sm:col-start-3 sm:row-start-1">{m.description}</span>
              {current && (
                <CheckCircle
                  size={22}
                  weight="fill"
                  className="col-start-3 row-span-2 row-start-1 justify-self-end sm:col-start-4 sm:row-span-1"
                  style={{ color: m.color }}
                  aria-label="ชั้นบัญชีปัจจุบัน"
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
