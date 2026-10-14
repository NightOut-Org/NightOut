import type { ReactNode } from 'react';
import { Tile } from '@/ui/components/merchantUi';

/** การ์ด KPI ของหน้าสถิติ — หัวข้อ · ตัวเลข · บรรทัดเทียบช่วงก่อนหน้า (subClass = สีของบรรทัดนั้น) */
export function KpiTile({
  title,
  value,
  sub,
  subClass = 'text-muted',
}: {
  title: ReactNode;
  value: ReactNode;
  sub: ReactNode;
  subClass?: string;
}) {
  return (
    <Tile className="flex flex-col gap-1 !rounded-2xl !p-3 lg:!rounded-[20px] lg:!p-[18px]">
      <span className="text-xs text-muted lg:text-[13px]">{title}</span>
      <b className="text-xl font-semibold lg:text-[26px]">{value}</b>
      <span className={`text-[11px] lg:text-xs ${subClass}`}>{sub}</span>
    </Tile>
  );
}
