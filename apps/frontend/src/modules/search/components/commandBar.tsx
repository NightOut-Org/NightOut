import { SlidersHorizontal, Sparkle, X } from '@phosphor-icons/react';
import { CATEGORY_LABELS, type BarFilter } from '@/services/data';
import type { BarCategory, CrowdStatus } from '@nightout/types';
import { useState } from 'react';
import { baht, CROWD } from '@/ui/utils/format';
import { FilterDrawer } from './filterDrawer';

const CATEGORIES = ['ALL', 'PUB_BAR', 'CHILL', 'RESTAURANT'] as const;

const chip = (on: boolean) =>
  `rounded-lg border px-2.5 py-1 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-gold ${
    on
      ? 'border-gold bg-gold/15 text-gold-text'
      : 'border-transparent bg-surface text-muted hover:text-text'
  }`;

export interface ActiveFilter {
  key: string;
  label: string;
  remove: () => void;
}

/** ป้ายตัวกรองที่ใช้อยู่ (กด × ทีละอัน) — ลำดับเดียวกับดีไซน์ */
export function activeFilters(f: BarFilter, set: (p: Partial<BarFilter>) => void): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  if (f.q) out.push({ key: 'q', label: `“${f.q}”`, remove: () => set({ q: '' }) });
  if (f.category && f.category !== 'ALL')
    out.push({
      key: 'category',
      label: CATEGORY_LABELS[f.category],
      remove: () => set({ category: 'ALL' }),
    });
  if (f.district)
    out.push({ key: 'district', label: f.district, remove: () => set({ district: undefined }) });
  if (f.maxBudget)
    out.push({
      key: 'budget',
      label: `≤ ${baht(f.maxBudget)}/คน`,
      remove: () => set({ maxBudget: undefined }),
    });
  if (f.people)
    out.push({ key: 'people', label: `${f.people} คน`, remove: () => set({ people: undefined }) });
  for (const s of f.styles ?? [])
    out.push({
      key: `style-${s}`,
      label: s,
      remove: () => set({ styles: f.styles?.filter((x) => x !== s) }),
    });
  for (const c of f.crowd ?? [])
    out.push({
      key: `crowd-${c}`,
      label: CROWD[c].label,
      remove: () => set({ crowd: f.crowd?.filter((x) => x !== c) }),
    });
  if (f.hasPR) out.push({ key: 'pr', label: 'มี PR', remove: () => set({ hasPR: false }) });
  if (f.minSafety)
    out.push({
      key: 'safety',
      label: `Safety ≥ ${f.minSafety}`,
      remove: () => set({ minSafety: undefined }),
    });
  return out;
}

/**
 * แถบค้นหา (ดีไซน์ Search Combined v2 · ตัวกรองแบบ C "ลิ้นชัก")
 * แถวบน: ช่องพิมพ์แบบที่พูด → แปลงเป็นตัวกรอง · ปุ่ม "ตัวกรอง" (+ จำนวนที่ใช้อยู่) เปิดลิ้นชักขวา
 * แถวล่าง: ประเภทร้าน (พร้อมจำนวน) · ป้ายตัวกรองที่ใช้อยู่ (กด × ทีละอัน) · ล้างทั้งหมด
 */
export function CommandBar({
  f,
  set,
  smart,
  onSmart,
  onReset,
  count,
  categoryCounts,
  crowdCounts,
}: {
  f: BarFilter;
  set: (p: Partial<BarFilter>) => void;
  smart: string;
  onSmart: (text: string) => void;
  onReset: () => void;
  /** จำนวนร้านตามตัวกรองตอนนี้ (ปุ่ม "แสดง N ร้าน" ในลิ้นชัก) */
  count: number;
  categoryCounts: Record<(typeof CATEGORIES)[number], number>;
  crowdCounts: Record<CrowdStatus, number>;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const active = activeFilters(f, set);

  return (
    <div className="rounded-[20px] border border-gold/35 bg-card shadow-[0_0_0_1px_rgb(232_182_76/0.08),0_16px_48px_rgb(167_56_245/0.18)]">
      {/* ช่องค้นหาแบบพิมพ์ตามที่พูด */}
      <div className="flex min-h-[60px] items-center gap-3 border-b border-border px-4 py-2">
        <Sparkle size={20} className="shrink-0 text-gold" aria-hidden />
        <input
          type="search"
          value={smart}
          onChange={(e) => onSmart(e.target.value)}
          aria-label="ค้นหาร้าน (พิมพ์ย่าน จำนวนคน งบ หรือสไตล์ได้เลย)"
          placeholder="พิมพ์แบบที่พูด เช่น ทองหล่อ 4 คน 800 live music"
          className="min-w-0 flex-1 border-0 bg-transparent text-base font-light text-text outline-none placeholder:text-muted sm:text-lg"
        />
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen(true)}
          className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-gold px-3.5 text-sm text-gold-text transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
            panelOpen ? 'bg-gold/15' : 'hover:bg-gold/10'
          }`}
        >
          <SlidersHorizontal size={16} aria-hidden />
          ตัวกรอง
          {active.length > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold px-[5px] text-[11px] font-bold text-on-gold">
              {active.length}
            </span>
          )}
        </button>
      </div>

      {/* ประเภทร้าน + ตัวกรองที่ใช้อยู่ */}
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 px-4 py-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={(f.category ?? 'ALL') === c}
            onClick={() => set({ category: c as BarCategory | 'ALL' })}
            className={chip((f.category ?? 'ALL') === c)}
          >
            {c === 'ALL' ? 'ทั้งหมด' : CATEGORY_LABELS[c]}{' '}
            <span className="opacity-70">{categoryCounts[c]}</span>
          </button>
        ))}
        {active.length > 0 && (
          <>
            <span aria-hidden className="mx-1 h-5 w-px bg-border" />
            {active.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={a.remove}
                aria-label={`เอาตัวกรอง ${a.label} ออก`}
                className="flex items-center gap-1.5 rounded-lg border border-purple/45 bg-purple/12 px-2.5 py-1 text-[13px] text-text transition-colors hover:border-purple focus-visible:outline-2 focus-visible:outline-gold"
              >
                {a.label}
                <X size={11} weight="bold" aria-hidden />
              </button>
            ))}
            <button
              type="button"
              onClick={onReset}
              className="px-1 text-xs text-muted underline hover:text-text"
            >
              ล้างทั้งหมด
            </button>
          </>
        )}
      </div>

      <FilterDrawer
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        f={f}
        set={set}
        onReset={onReset}
        count={count}
        crowdCounts={crowdCounts}
      />
    </div>
  );
}
