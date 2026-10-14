import { Minus, Plus, SlidersHorizontal, Sparkle, X } from '@phosphor-icons/react';
import { CATEGORY_LABELS, DISTRICTS, STYLES, type BarFilter } from '@/services/data';
import type { BarCategory, CrowdStatus } from '@nightout/types';
import {
  MAX_GROUP_SIZE,
  SEARCH_BUDGET_MAX,
  SEARCH_BUDGET_MIN,
  SEARCH_BUDGET_PRESETS,
  SEARCH_BUDGET_STEP,
} from '@nightout/utils';
import { Checkbox, Select, Slider } from 'antd';
import { useState } from 'react';
import { baht, CROWD } from '@/ui/utils/format';
import { SMART_EXAMPLES } from '../utils/smartQuery';

const CATEGORIES = ['ALL', 'PUB_BAR', 'CHILL', 'RESTAURANT'] as const;
const CROWDS: CrowdStatus[] = ['AVAILABLE', 'ALMOST_FULL', 'FULL'];

const chip = (on: boolean) =>
  `rounded-lg border px-2.5 py-1 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-gold ${
    on ? 'border-gold bg-gold/15 text-gold-text' : 'border-transparent bg-surface text-muted hover:text-text'
  }`;
const pill = (on: boolean) =>
  `rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-gold ${
    on ? 'border-gold bg-gold text-on-gold' : 'border-border text-muted hover:text-text'
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
    out.push({ key: 'category', label: CATEGORY_LABELS[f.category], remove: () => set({ category: 'ALL' }) });
  if (f.district) out.push({ key: 'district', label: f.district, remove: () => set({ district: undefined }) });
  if (f.maxBudget)
    out.push({ key: 'budget', label: `≤ ${baht(f.maxBudget)}/คน`, remove: () => set({ maxBudget: undefined }) });
  if (f.people) out.push({ key: 'people', label: `${f.people} คน`, remove: () => set({ people: undefined }) });
  for (const s of f.styles ?? [])
    out.push({ key: `style-${s}`, label: s, remove: () => set({ styles: f.styles?.filter((x) => x !== s) }) });
  for (const c of f.crowd ?? [])
    out.push({ key: `crowd-${c}`, label: CROWD[c].label, remove: () => set({ crowd: f.crowd?.filter((x) => x !== c) }) });
  if (f.hasPR) out.push({ key: 'pr', label: 'มี PR', remove: () => set({ hasPR: undefined }) });
  if (f.minSafety)
    out.push({ key: 'safety', label: `Safety ≥ ${f.minSafety}`, remove: () => set({ minSafety: undefined }) });
  return out;
}

/**
 * แถบค้นหา + ตัวกรอง (ดีไซน์ Search Combined · ตัวกรองจาก 10 Command)
 * แถวบน: ช่องพิมพ์แบบที่พูด → แปลงเป็นตัวกรอง · งบรวมกลุ่ม · ปุ่ม "ตัวกรองละเอียด" (+ จำนวนตัวกรองที่ใช้)
 * แถวกลาง: ประเภทร้าน (พร้อมจำนวน) · ตัวกรองที่ใช้อยู่ / ตัวอย่างคำค้น
 * แผงละเอียด: ย่าน · จำนวนคน · งบต่อหัว (slider + ปุ่มลัด) · Safety · ความแน่น · PR · สไตล์
 */
export function CommandBar({
  f,
  set,
  smart,
  onSmart,
  onExample,
  onReset,
  categoryCounts,
  crowdCounts,
}: {
  f: BarFilter;
  set: (p: Partial<BarFilter>) => void;
  smart: string;
  onSmart: (text: string) => void;
  onExample: (text: string) => void;
  onReset: () => void;
  categoryCounts: Record<(typeof CATEGORIES)[number], number>;
  crowdCounts: Record<CrowdStatus, number>;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const active = activeFilters(f, set);
  const people = f.people;
  const groupTotal = people && f.maxBudget ? baht(people * f.maxBudget) : '—';
  const toggle = <T,>(list: T[] | undefined, v: T) =>
    list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v];

  return (
    <div className="rounded-[20px] border border-gold/35 bg-card shadow-[0_0_0_1px_rgb(232_182_76/0.08),0_16px_48px_rgb(167_56_245/0.18)]">
      {/* ช่องค้นหาแบบพิมพ์ตามที่พูด */}
      <div className="flex min-h-[60px] flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-2 sm:flex-nowrap">
        <Sparkle size={20} weight="fill" className="shrink-0 text-gold" aria-hidden />
        <input
          type="search"
          value={smart}
          onChange={(e) => onSmart(e.target.value)}
          aria-label="ค้นหาร้าน (พิมพ์ย่าน จำนวนคน งบ หรือสไตล์ได้เลย)"
          placeholder="พิมพ์แบบที่พูด เช่น ทองหล่อ 4 คน 800 live music"
          className="min-w-0 flex-1 basis-[calc(100%-2.5rem)] border-0 bg-transparent text-base font-light text-text outline-none placeholder:text-muted sm:basis-auto sm:text-lg"
        />
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 text-[13px]">
          <span className="text-muted">งบรวมกลุ่ม</span>
          <b className="font-mono text-gold-text">{groupTotal}</b>
        </div>
        <button
          type="button"
          aria-expanded={panelOpen}
          aria-controls="search-filter-panel"
          onClick={() => setPanelOpen((o) => !o)}
          className={`ml-auto flex h-9 items-center gap-1.5 rounded-[10px] border border-gold px-3 text-[13px] text-gold-text transition-colors focus-visible:outline-2 focus-visible:outline-gold sm:ml-0 ${
            panelOpen ? 'bg-gold/15' : 'hover:bg-gold/10'
          }`}
        >
          <SlidersHorizontal size={16} aria-hidden />
          ตัวกรองละเอียด
          <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-on-gold">
            {active.length}
          </span>
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
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        {active.length > 0 ? (
          <>
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
        ) : (
          <>
            <span className="text-xs text-muted">ลอง:</span>
            {SMART_EXAMPLES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onExample(t)}
                className="rounded-lg border border-dashed border-border px-2 py-0.5 font-mono text-xs text-muted transition-colors hover:border-gold hover:text-text"
              >
                {t}
              </button>
            ))}
          </>
        )}
      </div>

      {/* แผงตัวกรองละเอียด */}
      {panelOpen && (
        <div
          id="search-filter-panel"
          className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-[18px] border-t border-border px-4 pb-[18px] pt-4 text-[13px]"
        >
          <div>
            <p className="mb-1.5 text-muted">ย่าน</p>
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
            <p className="mb-1.5 text-muted">จำนวนคน</p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                aria-label="ลดจำนวนคน"
                disabled={!people}
                onClick={() => set({ people: people && people > 1 ? people - 1 : undefined })}
                className="grid size-8 place-items-center rounded-[9px] border border-border bg-background text-text disabled:opacity-40"
              >
                <Minus size={14} weight="bold" />
              </button>
              <span className="min-w-[60px] text-center font-semibold" aria-live="polite">
                {people ? `${people} คน` : 'ไม่ระบุ'}
              </span>
              <button
                type="button"
                aria-label="เพิ่มจำนวนคน"
                disabled={people === MAX_GROUP_SIZE}
                onClick={() => set({ people: Math.min((people ?? 0) + 1, MAX_GROUP_SIZE) })}
                className="grid size-8 place-items-center rounded-[9px] bg-gold text-on-gold disabled:opacity-40"
              >
                <Plus size={14} weight="bold" />
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted">แสดงเฉพาะร้านที่มีโซนรับได้ทั้งกลุ่ม</p>
          </div>

          <div>
            <p className="mb-1.5 text-muted">
              งบต่อหัวไม่เกิน <b className="text-gold-text">{f.maxBudget ? baht(f.maxBudget) : 'ไม่จำกัด'}</b>
            </p>
            <Slider
              className="!mx-1 !my-1.5"
              min={SEARCH_BUDGET_MIN}
              max={SEARCH_BUDGET_MAX}
              step={SEARCH_BUDGET_STEP}
              value={f.maxBudget ?? SEARCH_BUDGET_MAX}
              onChange={(v) => set({ maxBudget: v >= SEARCH_BUDGET_MAX ? undefined : v })}
              tooltip={{ formatter: (v) => (v === undefined || v >= SEARCH_BUDGET_MAX ? 'ไม่จำกัด' : baht(v)) }}
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {SEARCH_BUDGET_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={f.maxBudget === p}
                  onClick={() => set({ maxBudget: f.maxBudget === p ? undefined : p })}
                  className={`rounded-md px-2 py-0.5 text-[11px] ${
                    f.maxBudget === p ? 'bg-gold text-on-gold' : 'bg-surface text-muted hover:text-text'
                  }`}
                >
                  {baht(p)}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={!f.maxBudget}
                onClick={() => set({ maxBudget: undefined })}
                className={`rounded-md px-2 py-0.5 text-[11px] ${
                  !f.maxBudget ? 'bg-gold text-on-gold' : 'bg-surface text-muted hover:text-text'
                }`}
              >
                ไม่จำกัด
              </button>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-muted">
              Safety Score ขั้นต่ำ <b className="text-text">{f.minSafety ?? 0}</b>
            </p>
            <Slider
              className="!mx-1 !my-1.5"
              min={0}
              max={100}
              step={10}
              value={f.minSafety ?? 0}
              onChange={(v) => set({ minSafety: v || undefined })}
            />
          </div>

          <div>
            <p className="mb-1.5 text-muted">ความแน่นตอนนี้</p>
            <div className="flex gap-1">
              {CROWDS.map((c) => {
                const on = !!f.crowd?.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ crowd: toggle(f.crowd, c) })}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-[9px] border py-1.5 text-xs transition-colors ${
                      on ? 'bg-surface text-text' : 'border-border text-muted hover:text-text'
                    }`}
                    style={on ? { borderColor: CROWD[c].dot } : undefined}
                  >
                    <span className="size-[7px] rounded-full" style={{ background: CROWD[c].dot }} />
                    {CROWD[c].label}
                    {!on && <span className="opacity-70">{crowdCounts[c]}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <Checkbox
            className="self-end pb-1.5"
            checked={!!f.hasPR}
            onChange={(e) => set({ hasPR: e.target.checked || undefined })}
          >
            เฉพาะร้านที่มี PR
          </Checkbox>

          <div className="col-span-full">
            <p className="mb-1.5 text-muted">สไตล์</p>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((s) => {
                const on = !!f.styles?.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ styles: toggle(f.styles, s) })}
                    className={pill(on)}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
