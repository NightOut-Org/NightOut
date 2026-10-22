import { Info } from '@phosphor-icons/react';
import { Popover, type PopoverProps } from 'antd';
import type { ReactNode } from 'react';

/**
 * ข้อมูลที่ต้องแจ้งให้ทราบ (กติกา / เงื่อนไข / หมายเหตุ) — ปุ่มเล็ก เอาเมาส์ชี้ (hover) แล้วเห็นข้อมูลทันที
 * มือถือ/จอสัมผัสแตะเพื่อเปิด-ปิด · คีย์บอร์ด focus แล้วเปิดได้ (trigger hover + focus + click)
 * ใช้แทน `Alert` ชนิด info/warning และ `RuleList` ที่วางโชว์ยาวในหน้า
 * ไม่ใช้กับ error ของ API หรือสถานะที่ผู้ใช้ต้องแก้ทันที (ปล่อยเป็น Alert เดิม)
 * หน้าตาเป็นสีเดียว ไอคอนเดียว ไม่แยกตามระดับความสำคัญ · `title` ใส่เฉพาะเมื่อหัวข้อต่างจาก `label`
 * `iconOnly` = แสดงเฉพาะไอคอน (ใส่ `label` ไว้เป็น aria-label)
 */
export function InfoButton({
  label,
  title,
  children,
  iconOnly = false,
  placement = 'bottomLeft',
  className = '',
}: {
  label: string;
  title?: ReactNode;
  children: ReactNode;
  /** ไม่ใช้แล้ว — เก็บไว้ให้โค้ดเดิมคอมไพล์ได้ */
  tone?: 'info' | 'warn';
  iconOnly?: boolean;
  /** ตำแหน่งกล่องข้อมูล (จอแคบ antd พลิกให้เองถ้าล้นจอ) */
  placement?: PopoverProps['placement'];
  className?: string;
}) {
  return (
    <Popover
      trigger={['hover', 'focus', 'click']}
      mouseEnterDelay={0.08}
      mouseLeaveDelay={0.15}
      placement={placement}
      destroyOnHidden
      title={title}
      content={<div className="max-w-[min(22rem,calc(100vw-3rem))] text-sm leading-relaxed text-text">{children}</div>}
    >
      <button
        type="button"
        aria-label={iconOnly ? label : undefined}
        className={`inline-flex min-h-9 cursor-help items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[13px] font-medium text-muted transition-colors hover:border-link hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 ${iconOnly ? 'size-9 justify-center !px-0' : ''} ${className}`}
      >
        <Info size={16} aria-hidden />
        {!iconOnly && <span>{label}</span>}
      </button>
    </Popover>
  );
}
