import { PencilSimple, PlusCircle } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export type ChipTone = 'gold' | 'success' | 'warn' | 'danger' | 'muted' | 'purple';

const TONE: Record<ChipTone, string> = {
  gold: 'text-gold-text bg-gold/15 border-gold/30',
  success: 'text-(--crowd-available) bg-(--crowd-available)/12 border-(--crowd-available)/30',
  warn: 'text-(--crowd-almost-full) bg-(--crowd-almost-full)/12 border-(--crowd-almost-full)/30',
  danger: 'text-(--crowd-full) bg-(--crowd-full)/12 border-(--crowd-full)/30',
  muted: 'text-muted bg-surface border-border',
  purple: 'text-link bg-purple/12 border-purple/30',
};

/**
 * ชิปสถานะ: ไอคอน + ข้อความสั้น (+ ค่าที่ต้องเห็นชัด เช่นเวลา)
 * ใช้กับสถานะที่ต้องสะดุดตา — ต่อเวลาแล้ว / สาย / พร้อมเช็กอิน / ยังไม่บันทึก
 */
export function StatusChip({
  tone = 'gold',
  icon,
  value,
  className = '',
  children,
}: {
  tone?: ChipTone;
  icon?: ReactNode;
  /** ค่าเด่นท้ายชิป (ตัวหนา) เช่น "23:15" */
  value?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-5 ${TONE[tone]} ${className}`}
    >
      {icon && (
        <span aria-hidden className="inline-flex shrink-0 [&>svg]:size-3.5">
          {icon}
        </span>
      )}
      <span className="truncate">{children}</span>
      {value !== undefined && <b className="shrink-0 font-semibold tabular-nums">{value}</b>}
    </span>
  );
}

/** ชิปสถานะร่างในฟอร์มแก้ทั้งหน้า: เพิ่มใหม่ / แก้แล้ว — ทั้งคู่ยังไม่บันทึก */
export function DraftChip({ state, className = '' }: { state: 'new' | 'changed'; className?: string }) {
  return state === 'new' ? (
    <StatusChip icon={<PlusCircle weight="fill" />} className={className}>
      เพิ่มใหม่ รอบันทึก
    </StatusChip>
  ) : (
    <StatusChip icon={<PencilSimple weight="fill" />} className={className}>
      แก้แล้ว รอบันทึก
    </StatusChip>
  );
}
