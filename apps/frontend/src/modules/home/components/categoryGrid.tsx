import { Link } from 'react-router';
import { SectionHeader } from '@/ui/components/sectionHeader';
import type { HomeCategory } from '../type/category';

/**
 * "คืนนี้อยากได้ฟีลไหน" — แถววงกลมแบบ Story: รูปในวงกลม + ชื่อใต้รูป · 8 ช่องเท่ากัน
 * มือถือ/แท็บเล็ต = เลื่อนแนวนอน (ขอบล้นถึงขอบจอ) · เดสก์ท็อป (lg) = 8 คอลัมน์แถวเดียว
 * ร้านยอดนิยม (key `popular`) ขอบทอง · hint ใช้เป็น title ของลิงก์ (ไม่แสดงบนการ์ด) · ไม่แสดง badge
 * เนื้อหา (ชื่อ/คำอธิบาย/ลิงก์/ภาพ) มาจาก useHomeContent (GET /public/home)
 * ยังไม่มา (categories = undefined) → skeleton แถวเดียวกัน
 */
export function CategoryGrid({
  eyebrow,
  title,
  categories,
}: {
  eyebrow?: string;
  title?: string;
  categories?: HomeCategory[];
}) {
  if (!categories || title === undefined) return <CategoryGridSkeleton />;
  return (
    <section aria-labelledby="home-categories" className="mx-auto max-w-7xl px-4 md:px-8">
      <SectionHeader
        id="home-categories"
        eyebrow={eyebrow || undefined}
        title={title}
        to="/search"
        className="mb-6 md:mb-7"
      />
      <ul className={ROW}>
        {categories.map((c) => (
          <li key={c.key} className="snap-start">
            <CategoryCard category={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const ROW =
  '-mx-4 grid grid-flow-col auto-cols-[84px] gap-3 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] snap-x md:-mx-8 md:px-8 lg:mx-0 lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-8 lg:gap-4 lg:overflow-visible lg:px-0';

const SKELETON_COUNT = 8;

function CategoryGridSkeleton() {
  return (
    <section
      role="status"
      aria-label="กำลังโหลดหมวดหมู่"
      className="mx-auto max-w-7xl px-4 motion-safe:animate-pulse md:px-8"
    >
      <div className="mb-6 md:mb-7">
        <span className="mb-2 block h-4 w-24 rounded bg-muted/20" />
        <span className="block h-7 w-56 rounded-md bg-muted/20 md:h-9 md:w-72" />
      </div>
      <ul className={ROW}>
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <li key={i} className="flex flex-col items-center gap-3">
            <span className="block aspect-square w-full max-w-[120px] rounded-full bg-muted/20" />
            <span className="block h-4 w-14 rounded bg-muted/20" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CategoryCard({ category: c }: { category: HomeCategory }) {
  const ring = c.key === 'popular' ? 'border-gold' : 'border-border group-hover:border-purple/60';
  return (
    <Link
      to={c.to}
      title={c.hint || undefined}
      draggable={false}
      className="group flex select-none flex-col items-center gap-3 rounded-2xl text-center !text-text transition-colors hover:!text-gold-highlight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
    >
      {/* รูปวาง absolute ในกล่อง relative + overflow-hidden — กันรูปดัน aspect-ratio จนเป็นวงรี */}
      <span
        className={`relative block aspect-square w-full max-w-[120px] overflow-hidden rounded-full border-2 transition-colors ${ring}`}
      >
        <img
          src={c.image}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-[3px] size-[calc(100%-6px)] rounded-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.04]"
        />
      </span>
      <h3 className="text-[15px] font-semibold leading-tight">{c.title}</h3>
    </Link>
  );
}
