import type { ReactNode } from 'react';

/** ค่าเดียวในแถวข้อมูล — ใส่ไอคอนบอกชนิดของค่า (เวลา คน รหัส โซน …) และ label ให้โปรแกรมอ่านหน้าจอ */
export interface MetaEntry {
  icon?: ReactNode;
  /** ชื่อชนิดของค่า (ไม่แสดง อ่านโดยโปรแกรมอ่านหน้าจอ) เช่น "เวลา" "จำนวนคน" */
  label?: string;
  value: ReactNode;
  /** เน้นค่า (ตัวหนา สีตัวอักษรหลัก) */
  strong?: boolean;
}

type MetaItem = MetaEntry | ReactNode | false | null | undefined;

const isEntry = (x: MetaItem): x is MetaEntry => typeof x === 'object' && x !== null && 'value' in x;

/**
 * แถวข้อมูลสั้นหลายค่า — แต่ละค่ามีไอคอนของตัวเองแทนการต่อด้วยตัวคั่น
 * ค่าที่เป็น false / null / undefined / '' ไม่แสดง และตัดบรรทัดได้ระหว่างค่า
 */
export function MetaList({ items, className = '' }: { items: MetaItem[]; className?: string }) {
  const shown = items.filter((x) => x !== false && x !== null && x !== undefined && x !== '');
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-3.5 gap-y-1 ${className}`}>
      {shown.map((x, i) =>
        isEntry(x) ? (
          <span
            key={i}
            className={`inline-flex min-w-0 items-center gap-1 ${x.strong ? 'font-medium text-text' : ''}`}
          >
            {x.icon && (
              <span aria-hidden className="inline-flex shrink-0 text-gold-text/80 [&>svg]:size-[1.1em]">
                {x.icon}
              </span>
            )}
            {x.label && <span className="sr-only">{x.label}</span>}
            <span className="min-w-0 truncate">{x.value}</span>
          </span>
        ) : (
          <span key={i} className="inline-flex min-w-0 items-center">
            {x}
          </span>
        ),
      )}
    </span>
  );
}
