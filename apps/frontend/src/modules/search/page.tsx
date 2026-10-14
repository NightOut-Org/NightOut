import { ListBullets, MapTrifold, MoonStars } from '@phosphor-icons/react';
import { DISTRICTS, listBars, STYLES, type BarFilter } from '@/services/data';
import type { CrowdStatus } from '@nightout/types';
import { parseBudgetSearch } from '@nightout/utils';
import { Segmented, Select } from 'antd';
import { Fragment, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { useDemo } from '@/hooks/useDemo';
import { EmbersBackdrop } from '@/ui/components/embersBackdrop';
import { MINI_AD_SEARCH_AFTER, MiniAdSlot } from '@/ui/components/miniAdSlot';
import { baht } from '@/ui/utils/format';
import { BudgetRow } from './components/budgetRow';
import { CommandBar } from './components/commandBar';
import { SearchMap } from './components/searchMap';
import { parseSmartQuery } from './utils/smartQuery';

/** จอกว้างตั้งแต่นี้: รายการกับแผนที่วางคู่กัน · แคบกว่า: แผนที่อยู่บน รายการอยู่ล่าง */
const WIDE_QUERY = '(min-width: 1100px)';

const CLEARED: BarFilter = {
  q: '',
  category: 'ALL',
  styles: [],
  district: undefined,
  maxBudget: undefined,
  people: undefined,
  crowd: [],
  hasPR: undefined,
  minSafety: undefined,
};

/**
 * /search — เปลี่ยน query string (เช่นคลิกลิงก์ /search?style=… จากโฆษณาในหน้านี้) = เริ่มตัวกรองใหม่
 * ตัวกรองอ่านจาก URL ครั้งเดียวตอน mount จึงต้อง remount ด้วย key
 */
export function SearchPage() {
  const { search } = useLocation();
  return <SearchView key={search} />;
}

/**
 * ดีไซน์ Search Combined: ตัวกรองแบบ Command (10) + รายการแบบ Budget Planner (05) + แผนที่หมุดทอง (01)
 * อ่าน ?q=&district=&budget=&people= จาก Hero หน้าแรก (requirement "ค้นหาตามงบ") + ?category= / ?style=
 * พื้นหลัง Golden Embers + การ์ดกระจกแบบเดียวกับหน้าร้าน (/merchant) — ธีมมืดเท่านั้น
 */
function SearchView() {
  useDemo();
  const [params] = useSearchParams();
  const [f, setF] = useState<BarFilter>(() => {
    // ลิงก์จากช่องค้นหาหน้าแรก: คำค้น · ย่าน · งบต่อหัว · จำนวนคน (ค่าผิด = ไม่กรอง)
    const s = parseBudgetSearch(params);
    return {
      ...CLEARED,
      q: s.q ?? '',
      // ลิงก์จากการ์ดหมวดหมู่หน้าแรก: ?category=PUB_BAR หรือ ?style=Rooftop
      category: (params.get('category') as BarFilter['category']) ?? 'ALL',
      styles: params.getAll('style'),
      district: s.district,
      maxBudget: s.budget,
      people: s.people,
      sort: 'relevance',
    };
  });
  const [smart, setSmart] = useState(f.q ?? '');
  const [view, setView] = useState<'map' | 'list'>('map');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);

  const set = (patch: Partial<BarFilter>) => setF((prev) => ({ ...prev, ...patch }));
  const smartPatch = (text: string) => parseSmartQuery(text, { districts: DISTRICTS, styles: STYLES });

  const bars = listBars(f);
  // จำนวนข้างปุ่มประเภท/ความแน่น = ผลถ้าเลือกค่านั้น (ตัวกรองอื่นคงเดิม)
  const anyCategory = listBars({ ...f, category: 'ALL' });
  const categoryCounts = {
    ALL: anyCategory.length,
    PUB_BAR: anyCategory.filter((b) => b.category === 'PUB_BAR').length,
    CHILL: anyCategory.filter((b) => b.category === 'CHILL').length,
    RESTAURANT: anyCategory.filter((b) => b.category === 'RESTAURANT').length,
  };
  const anyCrowd = listBars({ ...f, crowd: [] });
  const crowdCounts = Object.fromEntries(
    (['AVAILABLE', 'ALMOST_FULL', 'FULL'] as const).map((c) => [c, anyCrowd.filter((b) => b.crowd === c).length]),
  ) as Record<CrowdStatus, number>;
  const priceMax = Math.max(0, ...listBars().map((b) => b.avgPerPerson));

  const adAfter = Math.min(MINI_AD_SEARCH_AFTER, bars.length) - 1;
  const groupBudget = f.people && f.maxBudget ? ` · ${f.people} คน · งบรวมไม่เกิน ${baht(f.people * f.maxBudget)}` : '';
  const isMap = view === 'map';

  const resetAll = () => {
    setSmart('');
    setF((prev) => ({ ...CLEARED, sort: prev.sort }));
  };

  /** กดหมุด → ไฮไลต์แถว + การ์ดบนแผนที่ · จอกว้างเลื่อนรายการไปหาแถวนั้น (แผนที่ sticky อยู่ข้าง ๆ) */
  const selectFromMap = (id: string) => {
    setActiveId(id);
    setCardOpen(true);
    if (window.matchMedia(WIDE_QUERY).matches) {
      document.getElementById(`search-row-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  return (
    <div className="embers-glass relative isolate min-w-0 has-[[data-map-fullscreen]]:isolation-auto">
      {/* พื้นหลัง Golden Embers (เหมือน /merchant) — การ์ด bg-card ในหน้านี้เป็นกระจกผ่าน embers-glass */}
      <EmbersBackdrop />

      <CommandBar
        f={f}
        set={(p) => {
          // เอาป้ายคำค้นออก = ล้างช่องพิมพ์ด้วย
          if (p.q === '') setSmart('');
          set(p);
        }}
        smart={smart}
        onSmart={(text) => {
          setSmart(text);
          set(smartPatch(text));
        }}
        onExample={(text) => {
          setSmart(text);
          setF((prev) => ({ ...CLEARED, sort: prev.sort, ...smartPatch(text) }));
        }}
        onReset={resetAll}
        categoryCounts={categoryCounts}
        crowdCounts={crowdCounts}
      />

      <div className="mt-3 flex flex-col gap-3.5 min-[1100px]:flex-row min-[1100px]:items-start">
        <section
          aria-label="รายชื่อร้าน"
          className={`flex min-w-0 flex-col ${isMap ? 'min-[1100px]:w-[600px] min-[1100px]:shrink-0' : 'flex-1'}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-0.5 pb-2.5">
            <div className="min-w-0">
              <h1 className="font-display text-[22px] leading-snug">ค้นหาร้าน</h1>
              <p className="text-xs text-muted">
                พบ {bars.length} ร้าน{groupBudget}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Select
                aria-label="เรียงตาม"
                value={f.sort}
                onChange={(v) => set({ sort: v })}
                className="w-36"
                options={[
                  { label: 'แนะนำ', value: 'relevance' },
                  { label: 'คะแนนสูงสุด', value: 'rating' },
                  { label: 'ราคาต่ำสุด', value: 'price' },
                  { label: 'ปลอดภัยที่สุด', value: 'safety' },
                ]}
              />
              <Segmented
                shape="round"
                value={view}
                onChange={(v) => setView(v as 'map' | 'list')}
                options={[
                  { value: 'map', icon: <MapTrifold />, label: 'แผนที่' },
                  { value: 'list', icon: <ListBullets />, label: 'รายการ' },
                ]}
              />
            </div>
          </div>

          {bars.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-border px-4 py-14 text-center text-muted">
              <MoonStars size={40} className="mx-auto text-gold" aria-hidden />
              <p className="mb-3.5 mt-2.5">
                {f.people
                  ? `ไม่พบร้านที่รับกลุ่ม ${f.people} คนตามตัวกรอง ลองลดจำนวนคนหรือเพิ่มงบ`
                  : 'ไม่พบร้านตามตัวกรอง ลองลดเงื่อนไขดู'}
              </p>
              <button
                type="button"
                onClick={resetAll}
                className="rounded-full border border-gold px-4 py-1.5 text-gold-text transition-colors hover:bg-gold hover:text-on-gold"
              >
                ล้างตัวกรอง
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {bars.map((b, i) => (
                <Fragment key={b.id}>
                  <BudgetRow
                    bar={b}
                    active={isMap && b.id === activeId}
                    priceMax={priceMax}
                    people={f.people}
                    maxBudget={f.maxBudget}
                    onActivate={() => setActiveId(b.id)}
                  />
                  {/* โฆษณาเล็กหลังร้านลำดับที่ 6 (หรือร้านสุดท้าย) — ไม่นับรวมใน bars / ไม่เปลี่ยนลำดับผลค้นหา */}
                  {i === adAfter && <MiniAdSlot placement="SEARCH" />}
                </Fragment>
              ))}
            </div>
          )}
        </section>

        {isMap && bars.length > 0 && (
          <SearchMap
            bars={bars}
            activeId={activeId}
            cardOpen={cardOpen}
            onSelect={selectFromMap}
            onCloseCard={() => setCardOpen(false)}
            className="order-first h-[300px] w-full min-[1100px]:sticky min-[1100px]:top-24 min-[1100px]:order-none min-[1100px]:h-[calc(100dvh-7.5rem)] min-[1100px]:min-w-0 min-[1100px]:flex-1"
          />
        )}
      </div>
    </div>
  );
}
