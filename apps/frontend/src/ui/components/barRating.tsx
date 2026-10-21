import type { BarWithTier } from '@/services/data';
import { TierStars } from '@nightout/ui';

/**
 * ระดับร้านเป็นดาว + คะแนนรีวิวเฉลี่ย + จำนวนรีวิว
 * ดาว = ระดับจากคะแนนจัดอันดับ (S=5 A=4 B=3 C=1–2) · ร้านรีวิวไม่ถึง 5 = "ร้านใหม่"
 */
export function BarRating({ bar, compact = false }: { bar: BarWithTier; compact?: boolean }) {
  if (bar.isNew)
    return (
      <span className="inline-flex items-center gap-1.5" title="รีวิวยังไม่ถึง 5 รีวิว จึงยังไม่ให้ดาว">
        <span className="rounded-full bg-purple/15 px-2 text-xs font-medium leading-5 text-link">ร้านใหม่</span>
        {!compact && <span className="text-xs text-muted">รีวิวยังไม่พอให้ดาว</span>}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5">
      <TierStars stars={bar.stars} />
      <span className="font-semibold text-gold-text">{bar.rating.toFixed(1)}</span>
      <span className="text-muted">
        ({bar.reviewCount.toLocaleString('th-TH')}
        {compact ? '' : ' รีวิว'})
      </span>
    </span>
  );
}
