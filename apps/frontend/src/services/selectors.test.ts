import { describe, expect, it, beforeEach } from 'vitest';
import type { Bar } from './models';
import { mutate } from './cache';
import {
  activeFilterKeys,
  barMisses,
  listBars,
  nearBars,
  withoutKey,
  type BarFilter,
} from './selectors';

/** ร้านทดสอบ — ค่าที่ไม่เกี่ยวกับเงื่อนไขค้นหาใส่ค่าพื้นฐานไว้ */
function makeBar(over: Partial<Bar> & Pick<Bar, 'id' | 'district'>): Bar {
  return {
    slug: over.id,
    name: `ร้าน ${over.id}`,
    category: 'PUB_BAR',
    address: '',
    styles: [],
    zones: [{ id: 'z', name: 'z', capacityPax: 10, tables: [], defaultDurationMinutes: 120 }],
    safety: [],
    pr: { male: 0, female: 0, lgbtq: 0 },
    crowd: 'AVAILABLE',
    score: 50,
    rating: 4,
    reviewCount: 10,
    avgPerPerson: 500,
    status: 'APPROVED',
    promoted: false,
    ...over,
  } as Bar;
}

function seed(bars: Bar[]) {
  mutate((s) => {
    s.bars = bars;
  });
}

// ทองหล่อ = ที่ตรงทุกเงื่อนไข · สีลม = ผิดย่าน · ผิดสไตล์+งบ · ผิดทุกข้อ
const SAMPLE: Bar[] = [
  makeBar({ id: 'match', district: 'ทองหล่อ', styles: ['Live Music'], avgPerPerson: 500 }),
  makeBar({ id: 'wrong-area', district: 'สีลม', styles: ['Live Music'], avgPerPerson: 500 }),
  makeBar({ id: 'wrong-style-budget', district: 'ทองหล่อ', styles: ['DJ'], avgPerPerson: 1500 }),
  makeBar({ id: 'nothing', district: 'สีลม', styles: ['DJ'], avgPerPerson: 2000, zones: [] }),
];

const QUERY: BarFilter = {
  district: 'ทองหล่อ',
  styles: ['Live Music'],
  maxBudget: 800,
  people: 4,
};

describe('activeFilterKeys', () => {
  it('ไม่มีเงื่อนไข = ไม่มีคีย์', () => {
    expect(activeFilterKeys({})).toEqual([]);
  });

  it('ค่าที่เท่ากับ "ไม่ตั้ง" ไม่นับ (ALL, [], hasPR=false, q ว่าง)', () => {
    expect(activeFilterKeys({ category: 'ALL', styles: [], hasPR: false, q: '  ' })).toEqual([]);
  });

  it('คืนเฉพาะเงื่อนไขที่ตั้งค่าไว้', () => {
    expect(activeFilterKeys(QUERY)).toEqual(['area', 'styles', 'budget', 'people']);
  });
});

describe('barMisses', () => {
  beforeEach(() => seed(SAMPLE));

  it('ร้านที่ตรงทุกเงื่อนไขไม่มีรายการขาด', () => {
    expect(barMisses(SAMPLE[0]!, QUERY)).toEqual([]);
  });

  it('ระบุเฉพาะเงื่อนไขที่ร้านไม่ผ่าน', () => {
    expect(barMisses(SAMPLE[1]!, QUERY)).toEqual(['area']);
    expect(barMisses(SAMPLE[2]!, QUERY)).toEqual(['styles', 'budget']);
  });

  it('ร้านที่ไม่มีราคาไม่ผ่านงบ', () => {
    const noPrice = makeBar({
      id: 'np',
      district: 'ทองหล่อ',
      avgPerPerson: 0,
      styles: ['Live Music'],
    });
    expect(barMisses(noPrice, { maxBudget: 800 })).toEqual(['budget']);
  });
});

describe('nearBars', () => {
  beforeEach(() => seed(SAMPLE));

  it('ไม่มีร้านที่ตรงทุกเงื่อนไข จึงคืนร้านที่ตรงบางข้อ เรียงจากขาดน้อยไปมาก', () => {
    // match ตรงครบ = ไม่ใช่ใกล้เคียง · nothing ไม่ตรงสักข้อ = ตัดทิ้ง
    const near = nearBars(QUERY);
    expect(near.map((m) => m.bar.id)).toEqual(['wrong-area', 'wrong-style-budget']);
    expect(near[0]!.misses).toEqual(['area']);
    expect(near[1]!.misses).toEqual(['styles', 'budget']);
  });

  it('จำกัดจำนวนตาม limit', () => {
    expect(nearBars(QUERY, 1)).toHaveLength(1);
  });

  it('ไม่มีเงื่อนไขเลย = ว่าง', () => {
    expect(nearBars({})).toEqual([]);
  });

  it('listBars ยังคืนเฉพาะร้านที่ตรงทุกเงื่อนไข (พฤติกรรมเดิม)', () => {
    expect(listBars(QUERY).map((b) => b.id)).toEqual(['match']);
  });
});

describe('withoutKey', () => {
  it('area เคลียร์ทั้ง district, tambon และ tambonLabel', () => {
    const out = withoutKey(
      { district: 'ทองหล่อ', tambon: 'TH1', tambonLabel: 'คลองตัน', maxBudget: 800 },
      'area',
    );
    expect(out).toEqual({ maxBudget: 800 });
    expect(out.district).toBeUndefined();
    expect(out.tambon).toBeUndefined();
    expect(out.tambonLabel).toBeUndefined();
  });

  it('styles กลับเป็น [] และ q กลับเป็นค่าว่าง', () => {
    expect(withoutKey({ styles: ['Live Music'], q: 'x' }, 'styles').styles).toEqual([]);
    expect(withoutKey({ q: 'x' }, 'q').q).toBe('');
  });

  it('category กลับเป็น ALL, hasPR เป็น false', () => {
    expect(withoutKey({ category: 'CHILL' }, 'category').category).toBe('ALL');
    expect(withoutKey({ hasPR: true }, 'pr').hasPR).toBe(false);
  });
});
