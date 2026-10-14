import { CATEGORY_LABELS, safetyScore, type BarWithTier } from '@/services/data';
import { Link } from 'react-router';
import { BarRating } from '@/ui/components/barRating';
import { CrowdBadge } from '@/ui/components/crowdBadge';
import { DealBadge } from '@/ui/components/dealBadge';
import { FavoriteButton } from '@/ui/components/favoriteButton';
import { PRBadge } from '@/ui/components/prBadge';
import { barImage } from '@/ui/utils/barImage';
import { baht } from '@/ui/utils/format';

/** ความจุโซนที่ใหญ่ที่สุด = กลุ่มใหญ่สุดที่ร้านรับได้ในโต๊ะเดียว */
const maxGroup = (bar: BarWithTier) => Math.max(0, ...bar.zones.map((z) => z.capacityPax));

/** บรรทัดใต้แถบราคา: ระบุคนแล้ว = ยอดกลุ่ม · ตั้งงบแล้ว = งบที่เหลือต่อคน · ไม่ระบุ = ชวนให้ระบุคน */
function budgetNote(avg: number, people?: number, maxBudget?: number) {
  if (avg <= 0) return 'ร้านยังไม่ระบุราคา';
  if (people) return `กลุ่ม ≈ ${baht(avg * people)}`;
  if (maxBudget) return `เหลือ ${baht(maxBudget - avg)}/คน`;
  return 'ระบุคนเพื่อดูยอดกลุ่ม';
}

/**
 * แถวร้านแบบ "Budget Planner" (ดีไซน์ Search Combined · รายการจาก 05)
 * รูป + หัวใจ · ป้ายโฆษณา · ชื่อ · ดาว/ย่าน/ประเภท · ความแน่น/Safety/PR/ความจุ · ดีลวันนี้
 * ขวา: ราคาต่อคนตัวใหญ่ + แถบเทียบราคา (เทียบร้านแพงสุด) + ยอดกลุ่ม/งบคงเหลือ
 * ทั้งแถวเป็นลิงก์ไปหน้าร้าน · ชี้/โฟกัสแถว = ไฮไลต์หมุดบนแผนที่ (onActivate)
 */
export function BudgetRow({
  bar,
  active,
  priceMax,
  people,
  maxBudget,
  onActivate,
}: {
  bar: BarWithTier;
  active: boolean;
  /** ราคาต่อหัวสูงสุดของทุกร้าน — ใช้คิดความยาวแถบราคา */
  priceMax: number;
  people?: number;
  maxBudget?: number;
  onActivate: () => void;
}) {
  const avg = bar.avgPerPerson;
  const pct = avg > 0 && priceMax > 0 ? Math.round((avg / priceMax) * 100) : 0;
  const group = maxGroup(bar);

  return (
    <Link
      to={`/bars/${bar.slug}`}
      id={`search-row-${bar.id}`}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      className={`grid w-full min-w-0 scroll-mt-28 grid-cols-[84px_minmax(0,1fr)_92px] items-center gap-2.5 rounded-[18px] border p-2.5 !text-text transition-colors hover:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:grid-cols-[104px_minmax(0,1fr)_128px] sm:gap-3.5 ${
        active ? 'border-gold bg-gold/[0.08]' : 'border-border bg-card'
      }`}
    >
      <div className="relative">
        <img
          src={barImage(bar)}
          alt=""
          loading="lazy"
          decoding="async"
          className="block h-[76px] w-[84px] rounded-xl object-cover sm:h-[88px] sm:w-[104px]"
        />
        <FavoriteButton
          barId={bar.id}
          className="!absolute right-1 top-1 !size-7 !min-w-0 !border-0 !bg-black/50 !text-white backdrop-blur"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-0.5 leading-snug">
        {bar.promoted && (
          <span className="self-start whitespace-nowrap rounded-md border border-gold/40 px-1.5 text-[10px] text-gold-text">
            แนะนำ · โฆษณา
          </span>
        )}
        <b className="truncate text-base">{bar.name}</b>
        <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted">
          <BarRating bar={bar} compact />
          <span aria-hidden>·</span>
          <span className="truncate">
            {bar.district} · {CATEGORY_LABELS[bar.category]}
          </span>
        </p>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted [&_.text-sm]:text-xs">
          <CrowdBadge crowd={bar.crowd} updatedAt={bar.crowdUpdatedAt} />
          <span>Safety {safetyScore(bar)}/100</span>
          <PRBadge pr={bar.pr} compact />
          {group > 0 && <span className="hidden sm:inline">รับได้ถึง {group} คน</span>}
        </p>
        <DealBadge bar={bar} className="mt-0.5" />
      </div>

      <div className="text-right">
        <p className="text-[11px] text-muted">ต่อคนประมาณ</p>
        <p className="text-lg font-bold leading-tight text-gold-text sm:text-[22px] dark:text-gold-highlight">
          {avg > 0 ? baht(avg) : '—'}
        </p>
        <div className="my-1.5 h-[5px] overflow-hidden rounded-full bg-border">
          <div className="h-full bg-linear-to-r from-gold to-gold-highlight" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-muted">{budgetNote(avg, people, maxBudget)}</p>
      </div>
    </Link>
  );
}
