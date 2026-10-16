import { IdentificationCard, MapPin, Sparkle, UsersThree, Wallet, type Icon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { MASTER, myPrefs } from '@/services/data';
import { baht } from '@/ui/utils/format';

function Label({ icon: I, children }: { icon: Icon; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <I size={14} />
      {children}
    </span>
  );
}

/** ยังไม่ได้กรอก — ลิงก์ "เพิ่ม" พาเข้าโหมดแก้ */
function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <span className="text-sm text-muted">
      ยังไม่ได้ระบุ{' '}
      <button type="button" onClick={onAdd} className="cursor-pointer text-link underline-offset-2 hover:underline">
        เพิ่ม
      </button>
    </span>
  );
}

/** โหมดดูของ "ข้อมูลและความชอบ" — ชื่อ · งบ · จำนวนคน · ย่าน · สไตล์ */
export function PreferencesView({ displayName, onEdit }: { displayName: string; onEdit: () => void }) {
  const districts = MASTER.districts.filter((d) => myPrefs.districtIds.includes(d.id));
  const styles = MASTER.styles.filter((s) => myPrefs.styleIds.includes(s.id));
  const cell = 'flex flex-col gap-1.5 px-6 py-5';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3">
      <div className="flex items-center gap-4 border-b border-border px-6 py-5 sm:col-span-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-border bg-surface text-muted">
          <IdentificationCard size={20} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-muted">ชื่อที่แสดง</span>
          <span className="truncate text-lg font-semibold">{displayName}</span>
        </div>
      </div>
      <div className={`${cell} border-b border-border sm:border-r sm:border-b-0`}>
        <Label icon={Wallet}>งบต่อหัว</Label>
        {myPrefs.budget != null ? (
          <span className="text-2xl font-semibold text-gold-text">{baht(myPrefs.budget)}</span>
        ) : (
          <Empty onAdd={onEdit} />
        )}
      </div>
      <div className={`${cell} border-b border-border sm:border-r sm:border-b-0`}>
        <Label icon={UsersThree}>ไปกันปกติ</Label>
        {myPrefs.pax != null ? (
          <span className="text-2xl font-semibold">
            {myPrefs.pax} <span className="text-sm font-normal text-muted">คน</span>
          </span>
        ) : (
          <Empty onAdd={onEdit} />
        )}
      </div>
      <div className={`${cell} gap-2`}>
        <Label icon={MapPin}>ย่านที่ชอบ</Label>
        {districts.length ? (
          <div className="flex flex-wrap gap-1.5">
            {districts.map((d) => (
              <span key={d.id} className="flex h-7 items-center rounded-full border border-border bg-surface px-3 text-[13px] whitespace-nowrap">
                {d.name}
              </span>
            ))}
          </div>
        ) : (
          <Empty onAdd={onEdit} />
        )}
      </div>
      <div className={`${cell} gap-2.5 border-t border-border sm:col-span-3`}>
        <Label icon={Sparkle}>สไตล์ร้านที่ชอบ</Label>
        {styles.length ? (
          <div className="flex flex-wrap gap-2">
            {styles.map((s) => (
              <span
                key={s.id}
                className="flex h-8 items-center rounded-full border border-[rgba(184,107,250,0.4)] bg-[rgba(167,56,245,0.14)] px-3.5 text-sm whitespace-nowrap text-link"
              >
                {s.label}
              </span>
            ))}
          </div>
        ) : (
          <Empty onAdd={onEdit} />
        )}
      </div>
    </div>
  );
}
