import { X } from '@phosphor-icons/react';
import type { BarFilter } from '@/services/data';
import type { CrowdStatus } from '@nightout/types';
import { Drawer } from 'antd';
import { FilterGroups } from './filterGroups';

/**
 * ลิ้นชักตัวกรองด้านขวา (ดีไซน์ Search Combined v2 · layout C) กว้าง 420px · จอแคบเต็มจอ
 * ตัวกรองมีผลทันที — ท้ายลิ้นชัก: "ล้างทั้งหมด" + "แสดง N ร้าน" (ปิดลิ้นชัก)
 */
export function FilterDrawer({
  open,
  onClose,
  f,
  set,
  onReset,
  count,
  crowdCounts,
}: {
  open: boolean;
  onClose: () => void;
  f: BarFilter;
  set: (p: Partial<BarFilter>) => void;
  onReset: () => void;
  count: number;
  crowdCounts: Record<CrowdStatus, number>;
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      size="min(420px, 100vw)"
      title="ตัวกรอง"
      closable={{ closeIcon: <X size={18} weight="bold" aria-label="ปิด" />, placement: 'end' }}
      classNames={{ footer: '!px-5 !py-3.5' }}
      footer={
        <div className="flex items-center gap-2.5 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={onReset}
            className="h-12 px-3 text-sm text-muted underline transition-colors hover:text-text"
          >
            ล้างทั้งหมด
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-[14px] bg-gold text-[15px] font-semibold text-on-gold transition-colors hover:bg-gold-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            แสดง {count} ร้าน
          </button>
        </div>
      }
    >
      <FilterGroups f={f} set={set} crowdCounts={crowdCounts} />
    </Drawer>
  );
}
