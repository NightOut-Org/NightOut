import { MagnifyingGlass, MapTrifold, SquaresFour } from '@phosphor-icons/react';
import { CATEGORY_LABELS, DISTRICTS, listBars, STYLES, type BarFilter } from '@/services/data';
import type { BarCategory, CrowdStatus } from '@nightout/types';
import { MAX_GROUP_SIZE, parseBudgetSearch, SEARCH_BUDGET_MAX, SEARCH_BUDGET_MIN, SEARCH_BUDGET_STEP } from '@nightout/utils';
import { Checkbox, Empty, Input, InputNumber, Segmented, Select, Slider } from 'antd';
import { Fragment, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { BarCard } from '@/ui/components/barCard';
import { MINI_AD_SEARCH_AFTER, MiniAdSlot } from '@/ui/components/miniAdSlot';
import { PageHeader } from '@/ui/components/pageHeader';
import { BarMap } from '@/ui/components/barMap';
import { useDemo } from '@/hooks/useDemo';
import { baht } from '@/ui/utils/format';

/**
 * /search — เปลี่ยน query string (เช่นคลิกลิงก์ /search?style=… จากโฆษณาในหน้านี้) = เริ่มตัวกรองใหม่
 * ตัวกรองอ่านจาก URL ครั้งเดียวตอน mount จึงต้อง remount ด้วย key
 */
export function SearchPage() {
  const { search } = useLocation();
  return <SearchView key={search} />;
}

/** ค้นหา + ตัวกรอง · อ่าน ?q=&district=&budget=&people= จาก Hero หน้าแรก (requirement "ค้นหาตามงบ") */
function SearchView() {
  useDemo();
  const [params] = useSearchParams();
  const [f, setF] = useState<BarFilter>(() => {
    // ลิงก์จากช่องค้นหาหน้าแรก: คำค้น · ย่าน · งบต่อหัว · จำนวนคน (ค่าผิด = ไม่กรอง)
    const s = parseBudgetSearch(params);
    return {
      q: s.q ?? '',
      // ลิงก์จากการ์ดหมวดหมู่หน้าแรก: ?category=PUB_BAR หรือ ?style=Rooftop
      category: (params.get('category') as BarFilter['category']) ?? 'ALL',
      styles: params.getAll('style'),
      district: s.district,
      maxBudget: s.budget,
      people: s.people,
      crowd: [],
      sort: 'relevance',
    };
  });
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const set = (patch: Partial<BarFilter>) => setF((prev) => ({ ...prev, ...patch }));
  const bars = listBars(f);
  const adAfter = Math.min(MINI_AD_SEARCH_AFTER, bars.length) - 1;
  const groupBudget = f.people && f.maxBudget ? ` · ${f.people} คน · งบรวมไม่เกิน ${baht(f.people * f.maxBudget)}` : '';

  return (
    <div>
      <PageHeader title="ค้นหาร้าน" subtitle={`พบ ${bars.length} ร้าน${groupBudget}`} />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-5 rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-24 lg:self-start">
          <Input
            size="large"
            allowClear
            prefix={<MagnifyingGlass />}
            placeholder="ชื่อร้าน ย่าน หรือสไตล์"
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
          />
          <div>
            <p className="mb-2 text-sm text-muted">ประเภทร้าน</p>
            <Segmented
              block
              orientation="vertical"
              value={f.category}
              onChange={(v) => set({ category: v as BarCategory | 'ALL' })}
              options={[
                { label: 'ทั้งหมด', value: 'ALL' },
                ...(['PUB_BAR', 'CHILL', 'RESTAURANT'] as const).map((c) => ({
                  label: CATEGORY_LABELS[c],
                  value: c,
                })),
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-sm text-muted">ย่าน</p>
            <Select
              allowClear
              className="w-full"
              placeholder="ทุกย่าน"
              value={f.district}
              onChange={(v) => set({ district: v })}
              options={DISTRICTS.map((d) => ({ label: d, value: d }))}
            />
          </div>
          <div>
            <p className="mb-2 text-sm text-muted">
              งบต่อหัวไม่เกิน {f.maxBudget ? baht(f.maxBudget) : 'ไม่จำกัด'}
            </p>
            <Slider
              min={SEARCH_BUDGET_MIN}
              max={SEARCH_BUDGET_MAX}
              step={SEARCH_BUDGET_STEP}
              value={f.maxBudget ?? SEARCH_BUDGET_MAX}
              onChange={(v) => set({ maxBudget: v >= SEARCH_BUDGET_MAX ? undefined : v })}
            />
          </div>
          <div>
            <label htmlFor="search-people" className="mb-2 block text-sm text-muted">
              จำนวนคน
            </label>
            {/* size large = ตัวอักษร 16px — iOS ไม่ซูมหน้าตอนแตะช่อง */}
            <InputNumber
              id="search-people"
              size="large"
              min={1}
              max={MAX_GROUP_SIZE}
              precision={0}
              inputMode="numeric"
              placeholder="ไม่ระบุ"
              suffix="คน"
              className="w-full"
              value={f.people ?? null}
              onChange={(v) => set({ people: v ?? undefined })}
            />
            <p className="mt-1.5 text-xs text-muted">แสดงเฉพาะร้านที่มีโซนรับได้ทั้งกลุ่ม</p>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted">สไตล์</p>
            <Select
              mode="multiple"
              className="w-full"
              placeholder="เลือกได้หลายอย่าง"
              value={f.styles}
              onChange={(v) => set({ styles: v })}
              options={STYLES.map((s) => ({ label: s, value: s }))}
            />
          </div>
          <div>
            <p className="mb-2 text-sm text-muted">ความแน่นตอนนี้</p>
            <Checkbox.Group
              value={f.crowd}
              onChange={(v) => set({ crowd: v as CrowdStatus[] })}
              options={[
                { label: '🟢 ว่าง', value: 'AVAILABLE' },
                { label: '🟡 ใกล้เต็ม', value: 'ALMOST_FULL' },
                { label: '🔴 เต็ม', value: 'FULL' },
              ]}
            />
          </div>
          <div>
            <Checkbox
              checked={!!f.hasPR}
              onChange={(e) => set({ hasPR: e.target.checked || undefined })}
            >
              เฉพาะร้านที่มี PR
            </Checkbox>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted">Safety Score ขั้นต่ำ {f.minSafety ?? 0}</p>
            <Slider
              min={0}
              max={100}
              step={10}
              value={f.minSafety ?? 0}
              onChange={(v) => set({ minSafety: v || undefined })}
            />
          </div>
        </aside>
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <Segmented
              value={view}
              onChange={(v) => setView(v as 'grid' | 'map')}
              options={[
                { value: 'grid', icon: <SquaresFour />, label: 'รายการ' },
                { value: 'map', icon: <MapTrifold />, label: 'แผนที่' },
              ]}
            />
            <Select
              value={f.sort}
              onChange={(v) => set({ sort: v })}
              className="w-44"
              options={[
                { label: 'แนะนำ', value: 'relevance' },
                { label: 'คะแนนสูงสุด', value: 'rating' },
                { label: 'ราคาต่ำสุด', value: 'price' },
                { label: 'ปลอดภัยที่สุด', value: 'safety' },
              ]}
            />
          </div>
          {bars.length === 0 ? (
            <Empty
              description={
                f.people
                  ? `ไม่พบร้านที่รับกลุ่ม ${f.people} คนตามตัวกรอง ลองลดจำนวนคนหรือเพิ่มงบ`
                  : 'ไม่พบร้านตามตัวกรอง ลองลดเงื่อนไขดู'
              }
            />
          ) : view === 'map' ? (
            <BarMap bars={bars} className="h-[70dvh]" expandable />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {bars.map((b, i) => (
                <Fragment key={b.id}>
                  <BarCard bar={b} />
                  {/* โฆษณาเล็กเต็มแถวหลังร้านลำดับที่ 6 (หรือร้านสุดท้าย) — ไม่นับรวมใน bars / ไม่เปลี่ยนลำดับผลค้นหา */}
                  {i === adAfter && <MiniAdSlot placement="SEARCH" className="col-span-full" />}
                </Fragment>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
