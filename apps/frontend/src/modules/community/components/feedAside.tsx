import type { CommunityCategory } from '@nightout/contracts';
import { ChatsCircle, MagnifyingGlass, MapPin } from '@phosphor-icons/react';
import { Input } from 'antd';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { getBar } from '@/services/data';
import { barImage } from '@/ui/utils/barImage';
import { compactCount } from '@/ui/utils/community';
import { useTrendingBars } from '../api';
import { MetaList } from '@/ui/components/metaList';
import { barPlace } from '@/ui/utils/area';

export const COMMUNITY_RULES = [
  { text: 'เคารพกัน และไม่โฆษณาแฝง', tone: 'check' },
  { text: 'ห้ามแชร์ข้อมูลส่วนตัวของคนอื่น', tone: 'warn' },
  { text: 'ทีมร้านมีป้าย "ทีมร้าน" ห้ามโปรแอลกอฮอล์และห้ามพูดถึงร้านอื่นในทางเสีย', tone: 'info' },
  { text: 'สำหรับผู้อายุ 20 ปีขึ้นไป ดื่มไม่ขับ', tone: 'warn' },
] as const;

/**
 * หมวดที่เลือกอยู่: กระจกใส (glassmorphism) — ฝ้าโปร่งสีกลางจาก --text (ปรับตามธีม) + ขอบบาง + เส้นสะท้อนแสงขอบบน
 * ไม่มีเงา/แสงฟุ้ง · ไม่ทาสีทองบนพื้น
 */
const ACTIVE_GLASS: CSSProperties = {
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--text) 11%, transparent), color-mix(in srgb, var(--text) 4%, transparent))',
  borderColor: 'color-mix(in srgb, var(--text) 18%, transparent)',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--text) 22%, transparent)',
};

/**
 * แถบซ้าย (จอใหญ่): ค้นหา + หมวดหมู่ + ร้านที่ถูกพูดถึงสัปดาห์นี้ (ปุ่มกติกาชุมชนอยู่ใต้หัวหน้า)
 * ฟีดใช้พื้นที่ที่เหลือทั้งหมด (ไม่มีคอลัมน์ขวา)
 */
export function CategoryAside({
  categories,
  active,
  search,
  onSearch,
}: {
  categories: CommunityCategory[];
  active?: string;
  search: string;
  onSearch: (v: string) => void;
}) {
  const total = categories.reduce((n, c) => n + c.thread_count, 0);
  const items = [{ slug: undefined, name: 'ทั้งหมด', thread_count: total }, ...categories];
  const { data: bars = [] } = useTrendingBars();
  return (
    <aside className="sticky top-24 hidden w-60 shrink-0 flex-col gap-5 self-start lg:flex">
      <div className="flex flex-col gap-2">
        <Input
          allowClear
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          prefix={<MagnifyingGlass size={18} className="text-muted" />}
          placeholder="ค้นหากระทู้ ร้าน หรือย่าน"
          aria-label="ค้นหากระทู้"
          enterKeyHint="search"
          className="!h-[46px] !rounded-[14px]"
        />
      </div>

      <nav aria-label="หมวดหมู่">
        <div className="mb-2 px-3 text-[13px] font-semibold text-muted">หมวดหมู่</div>
        {items.map((c) => {
          const on = c.slug === active;
          return (
            <Link
              key={c.slug ?? 'all'}
              to={c.slug ? `/community/c/${c.slug}` : '/community'}
              aria-current={on ? 'page' : undefined}
              style={on ? ACTIVE_GLASS : undefined}
              className={`mb-0.5 flex items-center justify-between rounded-xl border px-3 py-2.5 text-[15px] transition-colors ${
                on ? 'font-semibold !text-text backdrop-blur-md' : 'border-transparent !text-text hover:bg-card'
              }`}
            >
              <span>{c.name}</span>
              <span className={`text-xs ${on ? 'font-semibold text-gold-text' : 'text-muted'}`}>
                {compactCount(c.thread_count)}
              </span>
            </Link>
          );
        })}
      </nav>

      {bars.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-3.5">
          <h2 className="m-0 text-[15px] font-semibold">ร้านที่ถูกพูดถึงสัปดาห์นี้</h2>
          <p className="m-0 mb-3 mt-0.5 text-xs text-muted">ไม่นับกระทู้ที่ทีมร้านโพสต์ถึงร้านตัวเอง</p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {bars.map((b) => {
              const bar = getBar(b.id);
              return (
                <li key={b.id} className="flex items-center gap-2.5">
                  <img
                    src={bar ? barImage(bar) : barImage({})}
                    alt=""
                    className="size-10 shrink-0 rounded-[10px] object-cover"
                    loading="lazy"
                  />
                  <Link to={`/bars/${b.slug}`} className="min-w-0 flex-1 !text-text">
                    <div className="truncate text-sm font-semibold">{b.name}</div>
                    <div className="truncate text-xs text-muted">
                      <MetaList
                        items={[
                          { icon: <ChatsCircle weight="fill" />, label: 'จำนวนกระทู้', value: `${b.thread_count} กระทู้` },
                          bar && { icon: <MapPin weight="fill" />, label: 'พื้นที่', value: barPlace(bar) },
                        ]}
                      />
                    </div>
                  </Link>
                  <Link
                    to={`/bars/${b.slug}/book`}
                    className="shrink-0 rounded-lg bg-gold px-2.5 py-1.5 text-xs font-bold !text-on-gold"
                  >
                    จอง
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </aside>
  );
}
