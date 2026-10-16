import { ListBullets, MapTrifold, MoonStars } from '@phosphor-icons/react';
import { DISTRICTS, listBars, STYLES, type BarFilter } from '@/services/data';
import type { CrowdStatus } from '@nightout/types';
import { distanceMeters } from '@nightout/utils';
import { Segmented, Select } from 'antd';
import { Fragment, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useDemo } from '@/hooks/useDemo';
import { EmbersBackdrop } from '@/ui/components/embersBackdrop';
import { MINI_AD_SEARCH_AFTER, MiniAdSlot } from '@/ui/components/miniAdSlot';
import { baht } from '@/ui/utils/format';
import { BudgetRow } from './components/budgetRow';
import { CommandBar } from './components/commandBar';
import { SearchMap, type LatLng } from './components/searchMap';
import { filterFromParams, filterToQuery } from './utils/searchUrl';
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
 * /search — ดีไซน์ Search Combined v2: ช่องพิมพ์แบบที่พูด + ลิ้นชักตัวกรอง (layout C) + แถวร้านรูปใหญ่ + แผนที่หมุดรูปร้าน
 * ตัวกรองอยู่ใน URL (utils/searchUrl.ts) → รีเฟรช / ย้อนกลับ / แชร์ลิงก์ ได้ตัวกรองเดิม
 * อ่าน ?q=&district=&budget=&people= จาก Hero หน้าแรก (requirement "ค้นหาตามงบ") + ?category= / ?style=
 * พื้นหลัง Golden Embers + การ์ดกระจกแบบเดียวกับหน้าร้าน (/merchant) — ธีมมืดเท่านั้น (ไม่เปลี่ยนตามดีไซน์ v2)
 */
export function SearchPage() {
  useDemo();
  const { search } = useLocation();
  const navigate = useNavigate();
  const [f, setF] = useState<BarFilter>(() => filterFromParams(new URLSearchParams(search)));
  const [smart, setSmart] = useState(f.q ?? '');
  /** query string ที่หน้านี้เขียนเองล่าสุด — URL เปลี่ยนเป็นค่าอื่น (เช่นกดลิงก์ /search?style=… จากโฆษณา) = เริ่มตัวกรองใหม่ */
  const written = useRef(search);

  useEffect(() => {
    if (search === written.current) return;
    written.current = search;
    const next = filterFromParams(new URLSearchParams(search));
    setF(next);
    setSmart(next.q ?? '');
  }, [search]);

  useEffect(() => {
    const qs = filterToQuery(f);
    const next = qs ? `?${qs}` : '';
    if (next === written.current) return;
    written.current = next;
    navigate({ search: next }, { replace: true, preventScrollReset: true });
  }, [f, navigate]);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  /** ตำแหน่งผู้ใช้ — รู้เมื่อกด "ตำแหน่งของฉัน" บนแผนที่ (ไม่ขอสิทธิ์ตอนเปิดหน้า) → แสดงระยะทางในรายการ/การ์ด */
  const [me, setMe] = useState<LatLng | null>(null);

  const set = (patch: Partial<BarFilter>) => setF((prev) => ({ ...prev, ...patch }));
  const smartPatch = (text: string) =>
    parseSmartQuery(text, { districts: DISTRICTS, styles: STYLES });

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
    (['AVAILABLE', 'ALMOST_FULL', 'FULL'] as const).map((c) => [
      c,
      anyCrowd.filter((b) => b.crowd === c).length,
    ]),
  ) as Record<CrowdStatus, number>;
  const distanceKm = useCallback(
    (b: { lat: number; lng: number }) =>
      me ? distanceMeters({ lat: me[0], lng: me[1] }, b) / 1000 : undefined,
    [me],
  );

  const adAfter = Math.min(MINI_AD_SEARCH_AFTER, bars.length) - 1;
  const groupBudget =
    f.people && f.maxBudget
      ? ` · ${f.people} คน · งบรวมไม่เกิน ${baht(f.people * f.maxBudget)}`
      : '';
  const isMap = view === 'map';

  const resetAll = () => {
    setSmart('');
    setF((prev) => ({ ...CLEARED, sort: prev.sort }));
  };

  /** กดหมุด → ไฮไลต์แถว + การ์ดบนแผนที่ · จอกว้างเลื่อนรายการไปหาแถวนั้น (แผนที่ sticky อยู่ข้าง ๆ) */
  const selectFromMap = useCallback((id: string) => {
    setActiveId(id);
    setCardOpen(true);
    if (window.matchMedia(WIDE_QUERY).matches) {
      document
        .getElementById(`search-row-${id}`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);
  const closeCard = useCallback(() => setCardOpen(false), []);

  /**
   * โหมดแผนที่บนจอกว้าง (แผนที่อยู่ข้างรายการ): กดแถว = เลือกร้านบนแผนที่ + เปิดการ์ด (ไปหน้าร้านจากการ์ด)
   * จอแคบ / โหมดรายการ / กดพร้อม Ctrl·⌘·Shift / ปุ่มกลาง = ไปหน้าร้านตามปกติ
   */
  const rowClick = (id: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isMap || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (!window.matchMedia(WIDE_QUERY).matches) return;
    e.preventDefault();
    setActiveId(id);
    setCardOpen(true);
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
        onReset={resetAll}
        count={bars.length}
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
                    people={f.people}
                    maxBudget={f.maxBudget}
                    distanceKm={distanceKm(b)}
                    onActivate={() => setActiveId(b.id)}
                    onClick={rowClick(b.id)}
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
            me={me}
            distanceKm={distanceKm}
            onSelect={selectFromMap}
            onCloseCard={closeCard}
            onLocate={setMe}
            className="order-first h-[400px] w-full min-[1100px]:sticky min-[1100px]:top-24 min-[1100px]:order-none min-[1100px]:h-[calc(100dvh-7.5rem)] min-[1100px]:min-w-0 min-[1100px]:flex-1"
          />
        )}
      </div>
    </div>
  );
}
