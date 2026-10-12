import type { CommunityCategory } from '@nightout/contracts';
import { Info } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { getBar } from '@/services/data';
import { barImage } from '@/ui/utils/barImage';
import { compactCount } from '@/ui/utils/community';
import { useTrendingBars } from '../api';

export const COMMUNITY_RULES =
  'เคารพกัน ไม่โฆษณาแฝง ห้ามแชร์ข้อมูลส่วนตัวของคนอื่น · 20+ · ดื่มไม่ขับ';

/** คอลัมน์ซ้าย (จอใหญ่): หมวดหมู่ + จำนวนกระทู้ */
export function CategoryAside({
  categories,
  active,
}: {
  categories: CommunityCategory[];
  active?: string;
}) {
  const total = categories.reduce((n, c) => n + c.thread_count, 0);
  const items = [{ slug: undefined, name: 'ทั้งหมด', thread_count: total }, ...categories];
  return (
    <nav aria-label="หมวดหมู่" className="sticky top-24 hidden w-52 shrink-0 self-start lg:block">
      <div className="mb-2 px-3 text-[13px] font-semibold text-muted">หมวดหมู่</div>
      {items.map((c) => {
        const on = c.slug === active;
        return (
          <Link
            key={c.slug ?? 'all'}
            to={c.slug ? `/community/c/${c.slug}` : '/community'}
            aria-current={on ? 'page' : undefined}
            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-[15px] transition-colors ${
              on ? 'bg-card font-semibold !text-gold-text' : '!text-text hover:bg-card'
            }`}
          >
            <span>{c.name}</span>
            <span className="text-xs text-muted">{compactCount(c.thread_count)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** คอลัมน์ขวา (จอใหญ่): ร้านที่ถูกพูดถึงสัปดาห์นี้ + กติกาชุมชน */
export function FeedSideRail() {
  const { data: bars = [] } = useTrendingBars();
  return (
    <aside className="sticky top-24 hidden w-72 shrink-0 flex-col gap-4 self-start xl:flex">
      {bars.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="m-0 mb-3 text-[15px] font-semibold">ร้านที่ถูกพูดถึงสัปดาห์นี้</h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {bars.map((b) => {
              const bar = getBar(b.id);
              return (
                <li key={b.id} className="flex items-center gap-3">
                  <img
                    src={bar ? barImage(bar) : barImage({})}
                    alt=""
                    className="size-11 shrink-0 rounded-[10px] object-cover"
                    loading="lazy"
                  />
                  <Link to={`/bars/${b.slug}`} className="min-w-0 flex-1 !text-text">
                    <div className="truncate text-sm font-semibold">{b.name}</div>
                    <div className="truncate text-xs text-muted">
                      {b.thread_count} กระทู้{bar?.district ? ` · ${bar.district}` : ''}
                    </div>
                  </Link>
                  <Link
                    to={`/bars/${b.slug}/book`}
                    className="shrink-0 rounded-lg bg-gold px-3 py-1.5 text-xs font-bold !text-on-gold"
                  >
                    จอง
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section className="rounded-2xl bg-gold/[0.12] p-4 text-[13px] leading-relaxed">
        <h2 className="m-0 mb-1 flex items-center gap-1.5 text-[15px] font-semibold">
          <Info size={17} className="text-gold-text" />
          กติกาชุมชน
        </h2>
        {COMMUNITY_RULES}
      </section>
    </aside>
  );
}
