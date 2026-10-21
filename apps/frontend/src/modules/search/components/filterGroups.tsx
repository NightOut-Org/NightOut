import { ShieldCheck, Users } from '@phosphor-icons/react';
import { AREA_OPTIONS, STYLES, type BarFilter } from '@/services/data';
import type { CrowdStatus } from '@nightout/types';
import {
  MAX_GROUP_SIZE,
  SEARCH_BUDGET_MAX,
  SEARCH_BUDGET_MIN,
  SEARCH_BUDGET_PRESETS,
} from '@nightout/utils';
import type { ReactNode } from 'react';
import { baht, CROWD } from '@/ui/utils/format';
import { AreaSelect } from './areaSelect';

const CROWDS: CrowdStatus[] = ['AVAILABLE', 'ALMOST_FULL', 'FULL'];
const PEOPLE_QUICK = [2, 4, 6, 8, 10] as const;
const SAFETY_PRESETS = [0, 50, 70, 90] as const;
/** ปุ่มลัด = พื้นที่ที่มีร้านมากสุด · ที่เหลือค้นใน AreaSelect */
const QUICK_AREAS = 8;

const chip = (on: boolean) =>
  `rounded-full border text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
    on
      ? 'border-gold bg-gold/15 text-gold-text'
      : 'border-border bg-surface text-muted hover:text-text'
  }`;
const field =
  'flex h-10 items-center gap-2.5 rounded-xl border border-border bg-background px-3 focus-within:border-gold';
const numberInput =
  'min-w-0 flex-1 border-0 bg-transparent font-mono text-[15px] font-semibold text-text outline-none placeholder:font-sans placeholder:font-normal placeholder:text-muted';

const toggle = <T,>(list: T[] | undefined, v: T) =>
  list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v];
const toInt = (s: string) => {
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2.5 p-0 text-[13px] font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

/**
 * ตัวกรองทั้งหมดของหน้าค้นหา (ดีไซน์ Search Combined v2 · "Filter Groups") — ใช้ในลิ้นชักตัวกรอง
 * พื้นที่ (ย่าน · ตำบล/แขวง · อำเภอ/เขต · จังหวัด) · ไปกันกี่คน (พิมพ์ได้ + ปุ่มลัด) · งบต่อคน (พิมพ์ได้ + ปุ่มลัด) · ความแน่น (พร้อมจำนวน) · สไตล์ · Safety ขั้นต่ำ · มี PR
 */
export function FilterGroups({
  f,
  set,
  crowdCounts,
}: {
  f: BarFilter;
  set: (p: Partial<BarFilter>) => void;
  crowdCounts: Record<CrowdStatus, number>;
}) {
  return (
    <div className="flex flex-col gap-6 text-sm">
      {/* ทุกพื้นที่ทั้งประเทศค้นได้ใน Select · ปุ่มลัด = พื้นที่ที่มีร้านมากสุด ตามด้วยย่านที่ทีมคัดเอง */}
      <Group title="พื้นที่">
        <AreaSelect f={f} set={set} />
        <div className="flex flex-wrap gap-1.5">
          {[undefined, ...AREA_OPTIONS.slice(0, QUICK_AREAS)].map((o) => {
            const on = o ? f.district === o.value : !f.district && !f.tambon;
            return (
              <button
                key={o?.value ?? 'all'}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  set({
                    district: o && on ? undefined : o?.value,
                    tambon: undefined,
                    tambonLabel: undefined,
                  })
                }
                className={`h-9 px-3.5 ${chip(on)}`}
              >
                {o?.label ?? 'ทุกพื้นที่'}
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="ไปกันกี่คน">
        <label className={`mb-2.5 ${field}`}>
          <Users size={15} className="shrink-0 text-muted" aria-hidden />
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_GROUP_SIZE}
            aria-label="จำนวนคน"
            placeholder="ไม่ระบุ"
            value={f.people ?? ''}
            onChange={(e) => {
              const n = toInt(e.target.value);
              set({ people: n > 0 ? Math.min(n, MAX_GROUP_SIZE) : undefined });
            }}
            className={numberInput}
          />
          <span className="text-[13px] text-muted">คน</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PEOPLE_QUICK.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={f.people === n}
              onClick={() => set({ people: f.people === n ? undefined : n })}
              className={`h-8 px-3 !text-xs ${chip(f.people === n)}`}
            >
              {n} คน
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted">
          แสดงเฉพาะร้านที่มีโซนรับได้ทั้งกลุ่ม (สูงสุด {MAX_GROUP_SIZE} คน)
        </p>
      </Group>

      <Group title="งบต่อคนไม่เกิน">
        <label className={field}>
          <span className="text-[15px] text-muted">฿</span>
          <input
            type="number"
            inputMode="numeric"
            min={SEARCH_BUDGET_MIN}
            step={100}
            aria-label="งบต่อคน (บาท)"
            placeholder="ไม่จำกัด"
            value={f.maxBudget ?? ''}
            onChange={(e) => {
              const n = toInt(e.target.value);
              // พิมพ์อยู่ยังไม่ปัดขึ้นเป็นขั้นต่ำ (พิมพ์ "8" ก่อน "800" ได้) · ≥ เพดาน = ไม่จำกัด
              set({ maxBudget: n > 0 && n < SEARCH_BUDGET_MAX ? n : undefined });
            }}
            className={numberInput}
          />
          <span className="text-[13px] text-muted">/คน</span>
        </label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {SEARCH_BUDGET_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={f.maxBudget === p}
              onClick={() => set({ maxBudget: f.maxBudget === p ? undefined : p })}
              className={`h-8 px-3 !text-xs ${chip(f.maxBudget === p)}`}
            >
              {baht(p)}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={!f.maxBudget}
            onClick={() => set({ maxBudget: undefined })}
            className={`h-8 px-3 !text-xs ${chip(!f.maxBudget)}`}
          >
            ไม่จำกัด
          </button>
        </div>
      </Group>

      <Group title="ความแน่นตอนนี้">
        <div className="flex flex-wrap gap-1.5">
          {CROWDS.map((c) => {
            const on = !!f.crowd?.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => set({ crowd: toggle(f.crowd, c) })}
                className={`flex h-9 items-center gap-[7px] px-3.5 ${chip(on)}`}
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: CROWD[c].dot }}
                />
                {CROWD[c].label}
                <span className="opacity-60">{crowdCounts[c]}</span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="สไตล์">
        <div className="flex flex-wrap gap-1.5">
          {STYLES.map((s) => {
            const on = !!f.styles?.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => set({ styles: toggle(f.styles, s) })}
                className={`h-[34px] px-[13px] ${chip(on)}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Safety Score ขั้นต่ำ">
        <label className={`mb-2 ${field}`}>
          <ShieldCheck size={15} className="shrink-0 text-muted" aria-hidden />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            aria-label="Safety Score ขั้นต่ำ"
            placeholder="0"
            value={f.minSafety ?? ''}
            onChange={(e) =>
              set({ minSafety: Math.max(0, Math.min(100, toInt(e.target.value))) || undefined })
            }
            className={numberInput}
          />
          <span className="text-[13px] text-muted">/ 100</span>
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {SAFETY_PRESETS.map((v) => {
            const on = (f.minSafety ?? 0) === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={on}
                onClick={() => set({ minSafety: v || undefined })}
                className={`h-[30px] !rounded-lg !text-xs ${chip(on)}`}
              >
                {v ? `${v}+` : 'ทั้งหมด'}
              </button>
            );
          })}
        </div>
      </Group>

      <button
        type="button"
        role="switch"
        aria-checked={!!f.hasPR}
        onClick={() => set({ hasPR: !f.hasPR })}
        className="flex min-h-10 w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 text-left text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        เฉพาะร้านที่มี PR
        <span
          aria-hidden
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${f.hasPR ? 'bg-gold' : 'bg-border'}`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white transition-[left] motion-reduce:transition-none ${
              f.hasPR ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </span>
      </button>
    </div>
  );
}
