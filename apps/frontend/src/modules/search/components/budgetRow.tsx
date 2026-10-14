import { NavigationArrow, ShieldCheck, Users } from '@phosphor-icons/react';
import { CATEGORY_LABELS, safetyScore, type BarWithTier } from '@/services/data';
import type { MouseEvent, ReactNode } from 'react';
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

/** มุมขวาล่าง: ระบุคนแล้ว = ยอดกลุ่ม · ตั้งงบแล้ว = งบที่เหลือต่อคน · ไม่ระบุ = ชวนให้ระบุคน */
function budgetNote(avg: number, people?: number, maxBudget?: number) {
  if (avg <= 0) return 'ร้านยังไม่ระบุราคา';
  if (people) return `กลุ่ม ≈ ${baht(avg * people)}`;
  if (maxBudget) return `เหลือ ${baht(maxBudget - avg)}/คน`;
  return 'ระบุคนเพื่อดูยอดกลุ่ม';
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-surface px-[9px] [&_.text-sm]:text-xs">
      {children}
    </span>
  );
}

/**
 * แถวร้าน (ดีไซน์ Search Combined v2) — รูปใหญ่ซ้าย + หัวใจ/ป้ายโฆษณา
 * ขวา: ชื่อ · ดาว/ย่าน/ประเภท | ราคาต่อคนตัวใหญ่ → ชิป ความแน่น · ระยะทาง (เมื่อรู้ตำแหน่ง) · Safety · PR · รับได้ถึง N คน
 * แถวล่าง: ดีลวันนี้ | ยอดกลุ่ม/งบคงเหลือ
 * ทั้งแถวเป็นลิงก์ไปหน้าร้าน (onClick ให้หน้าเปลี่ยนเป็นเลือกร้านบนแผนที่ได้) · ชี้/โฟกัส = ไฮไลต์หมุด (onActivate)
 */
export function BudgetRow({
  bar,
  active,
  people,
  maxBudget,
  distanceKm,
  onActivate,
  onClick,
}: {
  bar: BarWithTier;
  active: boolean;
  people?: number;
  maxBudget?: number;
  /** ระยะจากตำแหน่งผู้ใช้ (รู้เมื่อกด "ตำแหน่งของฉัน" บนแผนที่) */
  distanceKm?: number;
  onActivate: () => void;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const avg = bar.avgPerPerson;
  const group = maxGroup(bar);

  return (
    <Link
      to={`/bars/${bar.slug}`}
      id={`search-row-${bar.id}`}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={onClick}
      className={`grid w-full min-w-0 scroll-mt-28 grid-cols-[96px_minmax(0,1fr)] items-stretch gap-3 rounded-[18px] border p-2.5 !text-text transition-colors hover:border-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:grid-cols-[136px_minmax(0,1fr)] sm:gap-4 ${
        active ? 'border-gold bg-gold/[0.08]' : 'border-border bg-card'
      }`}
    >
      <div className="relative min-h-[104px] sm:min-h-28">
        <img
          src={barImage(bar)}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 block size-full rounded-xl object-cover"
        />
        <FavoriteButton
          barId={bar.id}
          className="!absolute right-1.5 top-1.5 !size-[30px] !min-w-0 !border-0 !bg-black/55 !text-white backdrop-blur"
        />
        {bar.promoted && (
          <span className="absolute bottom-1.5 left-1.5 rounded-md bg-gold px-1.5 text-[10px] font-semibold text-on-gold">
            แนะนำ · โฆษณา
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2 py-0.5 pr-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[17px] leading-snug">{bar.name}</b>
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-xs text-muted">
              <BarRating bar={bar} compact />
              <span aria-hidden>·</span>
              <span className="truncate">
                {bar.district} · {CATEGORY_LABELS[bar.category]}
              </span>
            </p>
          </div>
          <div className="shrink-0 text-right leading-tight">
            <b className="text-lg text-gold-text sm:text-xl dark:text-gold-highlight">
              {avg > 0 ? baht(avg) : '—'}
            </b>
            <p className="mt-0.5 text-[11px] text-muted">ต่อคน</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          <Chip>
            <CrowdBadge crowd={bar.crowd} updatedAt={bar.crowdUpdatedAt} />
          </Chip>
          {distanceKm !== undefined && (
            <Chip>
              <NavigationArrow size={12} aria-hidden />
              {distanceKm.toFixed(1)} กม.
            </Chip>
          )}
          <Chip>
            <ShieldCheck size={12} aria-hidden />
            Safety {safetyScore(bar)}/100
          </Chip>
          {/* PR ประจำร้าน (กฎธุรกิจ: แสดงบนการ์ด) — ไม่มี PR = ไม่แสดง */}
          <PRBadge pr={bar.pr} compact />
          {group > 0 && (
            <Chip>
              <Users size={12} aria-hidden />
              ถึง {group} คน
            </Chip>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-border pt-2 text-xs">
          <DealBadge bar={bar} className="flex-1" />
          <span className="ml-auto shrink-0 text-muted">{budgetNote(avg, people, maxBudget)}</span>
        </div>
      </div>
    </Link>
  );
}
