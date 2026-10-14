import { ArrowRight } from '@phosphor-icons/react';
import { safetyScore, type BarWithTier } from '@/services/data';
import { Link } from 'react-router';
import { baht } from '@/ui/utils/format';
import { barImage } from '@/ui/utils/barImage';
import { BarRating } from './barRating';
import { CrowdBadge } from './crowdBadge';
import { DealBadge } from './dealBadge';
import { FavoriteButton } from './favoriteButton';
import { PRBadge } from './prBadge';

/** ภาพปกร้าน — รูปจริง (coverUrl) หรือรูปแทน · ไล่เงาดำด้านล่างให้อ่านชื่อร้านออก */
export function BarCover({
  bar,
  className = 'aspect-video',
}: {
  bar: BarWithTier;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-card ${className}`}>
      <img
        src={barImage(bar)}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
      <span className="absolute bottom-3 left-4 font-display text-2xl font-bold text-white/90 drop-shadow">
        {bar.name}
      </span>
    </div>
  );
}

/**
 * การ์ดร้าน (Figma: Material → Card ร้าน)
 * รูปมีขอบใน · สถานะคน · ชื่อ · ดาว (ระดับร้าน) + ย่าน · ปุ่มขอบทอง "ดูรายละเอียด"
 * ทั้งการ์ดเป็นลิงก์เดียว — ปุ่มหัวใจหยุด event เอง
 */
export function BarCard({ bar }: { bar: BarWithTier }) {
  return (
    <Link
      to={`/bars/${bar.slug}`}
      className="group flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-3 !text-text transition-colors hover:border-purple/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      <div className="relative">
        <BarCover bar={bar} className="aspect-[16/10] rounded-xl" />
        <FavoriteButton
          barId={bar.id}
          className="!absolute right-2.5 top-2.5 !border-0 !bg-black/40 !text-white backdrop-blur"
        />
        {bar.promoted && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2.5 py-0.5 text-xs text-gold-highlight backdrop-blur">
            แนะนำ · โฆษณา
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-4">
        <div className="mb-1.5 flex items-center gap-2">
          <CrowdBadge crowd={bar.crowd} updatedAt={bar.crowdUpdatedAt} />
          <PRBadge pr={bar.pr} compact />
        </div>
        <h3 className="text-lg font-semibold">{bar.name}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
          <BarRating bar={bar} compact />
          <span aria-hidden>•</span>
          <span>{bar.district}</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          ประมาณ {baht(bar.avgPerPerson)} ต่อคน · ความปลอดภัย {safetyScore(bar)}/100
        </p>
        <DealBadge bar={bar} className="mt-2" />
        <div className="mt-auto pt-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold px-4 py-1.5 text-sm font-medium text-gold-text transition-colors group-hover:bg-gold group-hover:text-on-gold">
            ดูรายละเอียด <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}
