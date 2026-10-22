import { MapPin, PencilSimple, Sparkle, Wallet } from '@phosphor-icons/react';
import { motionTokens } from '@nightout/ui';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { AREA_CODE_LABEL, MASTER, myPrefs } from '@/services/data';
import { useTambonsByCodes } from '@/services/api/areas';
import { tambonOptionText } from '@/ui/utils/area';
import { StyleIcon } from '../utils/styleIcon';
import './preferencesView.css';

const tile = 'rounded-2xl border border-border bg-card p-5';

/** ยังไม่ได้กรอก — ลิงก์ "เพิ่ม" พาเข้าโหมดแก้ */
function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <span className="text-sm text-muted">
      ยังไม่ได้ระบุ{' '}
      <button
        type="button"
        onClick={onAdd}
        className="cursor-pointer text-link underline-offset-2 hover:underline"
      >
        เพิ่ม
      </button>
    </span>
  );
}

/**
 * โหมดดูของ "ข้อมูลและความชอบ" — Bento (ดีไซน์ 3c): ชื่อ (การ์ดกระจกม่วง กว้าง 3) · งบ (การ์ดทอง สูง 2 แถว) · สไตล์ (กว้าง 2) · จำนวนคน · พื้นที่ (เต็มแถว)
 * มือถือ 2 คอลัมน์ (grid-flow-dense ให้จำนวนคนขึ้นคู่กับงบ) · ปุ่ม "แก้ไขข้อมูล" เป็นทางเดียวเข้าโหมดแก้
 */
export function PreferencesView({
  displayName,
  onEdit,
}: {
  displayName: string;
  onEdit: () => void;
}) {
  const reduce = useReducedMotion();
  const tambons = useTambonsByCodes(myPrefs.areaCodes.filter((c) => /^TH[0-9]{6}$/.test(c)));
  // ย่าน → อำเภอ/เขต/จังหวัด → ตำบล/แขวง ตามที่เลือก (ตำบลรอชื่อจาก backend ครู่เดียว)
  const places = [
    ...MASTER.districts
      .filter((d) => myPrefs.districtIds.includes(d.id))
      .map((d) => ({ key: d.id, label: `ย่าน${d.name}` })),
    ...myPrefs.areaCodes
      .filter((c) => AREA_CODE_LABEL.has(c))
      .map((c) => ({ key: c, label: AREA_CODE_LABEL.get(c)! })),
    ...(tambons.data ?? [])
      .filter((t) => myPrefs.areaCodes.includes(t.code))
      .map((t) => ({ key: t.code, label: tambonOptionText(t).label })),
  ];
  const styles = MASTER.styles.filter((s) => myPrefs.styleIds.includes(s.id));

  // ไล่ขึ้นทีละกล่อง 40ms (ตอนเปิดแท็บ / กลับจากโหมดแก้) · ลดการเคลื่อนไหว = จางอย่างเดียว
  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, transform: 'translateY(8px)' },
    show: {
      opacity: 1,
      transform: 'translateY(0px)',
      transition: { duration: motionTokens.duration.base, ease: motionTokens.ease.out },
    },
  };
  return (
    <motion.div
      initial="hidden"
      animate="show"
      transition={{ staggerChildren: 0.04 }}
      className="grid grid-flow-row-dense grid-cols-2 gap-3 md:grid-cols-4"
    >
      <motion.div
        variants={item}
        className="profile-glass col-span-2 flex items-center justify-between gap-3 p-5 md:col-span-3"
      >
        <div className="min-w-0">
          <span className="text-xs text-muted">ชื่อที่แสดง</span>
          <p className="mt-0.5 truncate text-[22px] font-semibold whitespace-nowrap">
            {displayName}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex h-[34px] shrink-0 cursor-pointer items-center gap-1.5 profile-glass__btn rounded-xl border px-3.5 text-sm whitespace-nowrap text-text transition-colors hover:text-gold-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <PencilSimple size={16} aria-hidden />
          แก้ไขข้อมูล
        </button>
      </motion.div>

      {/* ไฮไลต์ทอง: --gold-highlight → --gold → ทองเข้ม · ทั้ง 2 ธีม */}
      <motion.div
        variants={item}
        className="col-span-1 flex flex-col justify-between gap-4 rounded-2xl bg-[linear-gradient(160deg,var(--gold-highlight),var(--gold)_55%,#B8862A)] p-5 text-on-gold md:row-span-2"
      >
        <Wallet size={24} weight="fill" aria-hidden />
        <div>
          <span className="text-xs font-semibold">งบต่อหัว</span>
          {myPrefs.budget != null ? (
            <p className="font-display text-[40px] leading-[1.1] font-bold">
              ฿{myPrefs.budget.toLocaleString('th-TH')}
            </p>
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="font-display text-[40px] leading-[1.1] font-bold">—</p>
              <button
                type="button"
                onClick={onEdit}
                className="cursor-pointer text-sm font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-gold"
              >
                ตั้งงบ
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <motion.div variants={item} className={`${tile} col-span-2 flex flex-col gap-3`}>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Sparkle aria-hidden />
          สไตล์ร้านที่ชอบ
        </span>
        {styles.length ? (
          <div className="flex flex-wrap gap-2">
            {styles.map((s) => (
              <span
                key={s.id}
                className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm whitespace-nowrap text-text"
              >
                <StyleIcon name={s.icon} weight="fill" className="text-link" />
                {s.label}
              </span>
            ))}
          </div>
        ) : (
          <Empty onAdd={onEdit} />
        )}
      </motion.div>

      <motion.div
        variants={item}
        className={`${tile} col-span-1 flex flex-col justify-between gap-2`}
      >
        <span className="text-xs text-muted">ไปกันปกติ</span>
        {myPrefs.pax != null ? (
          <span className="text-[32px] leading-none font-semibold">
            {myPrefs.pax}
            <span className="text-sm font-normal text-muted"> คน</span>
          </span>
        ) : (
          <Empty onAdd={onEdit} />
        )}
      </motion.div>

      <motion.div
        variants={item}
        className={`${tile} col-span-2 flex flex-wrap items-center gap-x-4 gap-y-2.5 !py-4 md:col-span-4`}
      >
        <span className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted">
          <MapPin aria-hidden />
          พื้นที่ที่ชอบ
        </span>
        {places.length ? (
          <div className="flex flex-wrap gap-2">
            {places.map((p) => (
              <span
                key={p.key}
                className="flex h-[30px] items-center rounded-full border border-border bg-surface px-3 text-sm whitespace-nowrap"
              >
                {p.label}
              </span>
            ))}
          </div>
        ) : (
          <Empty onAdd={onEdit} />
        )}
      </motion.div>
    </motion.div>
  );
}
