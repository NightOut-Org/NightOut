import { Tag } from '@phosphor-icons/react';
import { useNow } from '@/hooks/useNow';
import type { Bar } from '@/services/data';
import { barDealsToday } from '@/ui/utils/promotion';

/**
 * ป้าย "ดีลวันนี้" บนการ์ดร้าน — เฉพาะโปรที่ใช้ได้วันนี้ (เวลากรุงเทพ) และยังไม่เลย cutoff
 * ไม่มีดีล = ไม่แสดง · ไม่ใช่ปุ่ม (การ์ดทั้งใบเป็นลิงก์) · ส่วนที่มองเห็นซ่อนจาก screen reader แล้วอ่านรายชื่อดีลครั้งเดียวผ่าน sr-only
 */
export function DealBadge({
  bar,
  className = '',
}: {
  bar: Pick<Bar, 'promotions' | 'hours'>;
  className?: string;
}) {
  const now = useNow(60_000);
  const { live } = barDealsToday(bar, now);
  const [first] = live;
  if (!first) return null;
  const label = `ดีลวันนี้: ${live.map((p) => p.title).join(', ')}`;
  return (
    <p className={`min-w-0 text-xs ${className}`} title={label}>
      <span aria-hidden className="flex min-w-0 items-center gap-1.5">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 font-semibold text-gold-text">
          <Tag size={12} weight="fill" />
          ดีลวันนี้
        </span>
        <span className="min-w-0 truncate">{first.title}</span>
        {live.length > 1 && <span className="shrink-0 text-muted">+{live.length - 1}</span>}
      </span>
      <span className="sr-only">{label}</span>
    </p>
  );
}
