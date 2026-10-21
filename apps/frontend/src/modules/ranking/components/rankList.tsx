import type { RankedBar } from '@/services/data';
import { useRef } from 'react';
import { Link } from 'react-router';
import { barImage } from '@/ui/utils/barImage';
import { EASE_OUT, MOTION_OK, gsap, useGSAP } from '../utils/gsap';
import { RatingBadge } from './ratingBadge';
import { barPlace } from '@/ui/utils/area';

/**
 * อันดับ 4–10 — แต่ละแถวค่อยๆ โผล่ขึ้นมาตามการเลื่อน (scrub ต่อแถว) ยิ่งเลื่อนลงยิ่งชัด
 * เลื่อนกลับขึ้นจะจางกลับ · แถวถัดไปตามมาเองเพราะอยู่ต่ำกว่า (ไม่ต้อง stagger)
 */
export function RankList({ rows }: { rows: RankedBar[] }) {
  const root = useRef<HTMLOListElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        gsap.utils.toArray<HTMLElement>('[data-rank-row]').forEach((el, i) => {
          gsap.fromTo(
            el,
            { opacity: 0, yPercent: 60, scale: 0.96, xPercent: i % 2 ? 4 : -4 },
            {
              opacity: 1,
              yPercent: 0,
              scale: 1,
              xPercent: 0,
              ease: EASE_OUT,
              scrollTrigger: { trigger: el, start: 'top 98%', end: 'top 72%', scrub: 0.6 },
            },
          );
        });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [rows.map((b) => b.id).join()], revertOnUpdate: true },
  );

  return (
    <ol ref={root} className="mx-auto flex max-w-2xl flex-col gap-3">
      {rows.map((b) => (
        <li key={b.id} data-rank-row>
          <Link
            to={`/bars/${b.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-text! transition-colors duration-150 active:bg-surface [@media(hover:hover)_and_(pointer:fine)]:hover:border-gold/60"
          >
            <span className="w-6 text-center text-base font-bold tabular-nums text-muted">
              {b.rank}
            </span>
            <img
              src={barImage(b)}
              alt=""
              loading="lazy"
              className="size-10 shrink-0 rounded-lg object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{b.name}</span>
              <span className="block text-xs text-muted">{barPlace(b)}</span>
            </span>
            <span className="shrink-0 text-right text-xs text-muted">
              <span className="block text-sm font-semibold tabular-nums text-text">
                {b.votes.toLocaleString('th-TH')}
              </span>
              โหวต
            </span>
            <RatingBadge rating={b.rating} tier={b.tier} />
          </Link>
        </li>
      ))}
    </ol>
  );
}
