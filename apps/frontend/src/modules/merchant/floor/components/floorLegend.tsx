import { TABLE_BOARD_STATUSES } from '@nightout/utils';
import { TABLE_STATUS_META } from '../utils/board';

/** คำอธิบายสี/ไอคอนของสถานะโต๊ะ + ตัวอย่างการจองที่ยังไม่ชำระ (ขอบเส้นประ) */
export function FloorLegend() {
  return (
    <ul aria-label="คำอธิบายสถานะโต๊ะ" className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1.5 p-0 text-xs text-muted">
      {TABLE_BOARD_STATUSES.map((s) => {
        const m = TABLE_STATUS_META[s];
        return (
          <li key={s} className="inline-flex items-center gap-1.5">
            <m.Icon size={16} weight="fill" style={{ color: m.color }} aria-hidden />
            {m.label}
          </li>
        );
      })}
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-3.5 w-6 rounded-[5px] border border-dashed border-gold" />
        รอยืนยัน/รอชำระ
      </li>
    </ul>
  );
}

/** ป้ายสถานะโต๊ะ (ไอคอน + ข้อความ + สี) */
export function StatusPill({ status }: { status: keyof typeof TABLE_STATUS_META }) {
  const m = TABLE_STATUS_META[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ color: m.color, background: `color-mix(in srgb, ${m.color} 16%, transparent)` }}
    >
      <m.Icon size={13} weight="fill" aria-hidden />
      {m.label}
    </span>
  );
}
