import { describe, expect, it } from 'vitest';
import type { Bar } from '@/services/models';
import { baht } from '@/ui/utils/format';
import { missLabel, relaxLabel } from './missLabel';

const bar = (over: Partial<Bar>) =>
  ({
    styles: [],
    zones: [{ id: 'z', name: 'z', capacityPax: 10, tables: [], defaultDurationMinutes: 120 }],
    avgPerPerson: 500,
    category: 'PUB_BAR',
    safety: [],
    pr: { male: 0, female: 0, lgbtq: 0 },
    ...over,
  }) as Bar;

describe('missLabel', () => {
  it('ระบุว่าร้านไม่ได้อยู่พื้นที่ที่เลือก', () => {
    expect(missLabel('area', bar({}), { district: 'ทองหล่อ' })).toBe('ไม่ได้อยู่ทองหล่อ');
  });

  it('งบ: ร้านไม่มีราคา / เกินงบเท่าไร', () => {
    expect(missLabel('budget', bar({ avgPerPerson: 0 }), { maxBudget: 800 })).toBe(
      'ร้านยังไม่ระบุราคา',
    );
    expect(missLabel('budget', bar({ avgPerPerson: 1500 }), { maxBudget: 800 })).toBe(
      `เกินงบ ${baht(700)}/คน`,
    );
  });

  it('คน: บอกความจุสูงสุดของร้าน หรือยังไม่มีโซน', () => {
    const cap2 = bar({
      zones: [{ id: 'z', name: 'z', capacityPax: 2, tables: [], defaultDurationMinutes: 120 }],
    });
    expect(missLabel('people', cap2, { people: 4 })).toBe('รับได้ถึง 2 คน');
    expect(missLabel('people', bar({ zones: [] }), { people: 4 })).toBe('ยังไม่มีโซนรับกลุ่ม');
  });

  it('สไตล์: แสดงเฉพาะสไตล์ที่ร้านไม่มี', () => {
    expect(missLabel('styles', bar({ styles: ['DJ'] }), { styles: ['Live Music', 'DJ'] })).toBe(
      'ไม่มี Live Music',
    );
  });

  it('ประเภท / คำค้น', () => {
    expect(missLabel('category', bar({ category: 'PUB_BAR' }), { category: 'CHILL' })).toBe(
      'ไม่ใช่ร้านนั่งชิล',
    );
    expect(missLabel('q', bar({}), { q: 'abc' })).toBe('ไม่ตรงคำค้น "abc"');
  });
});

describe('relaxLabel', () => {
  it('ข้อความปุ่มผ่อนเงื่อนไขแต่ละข้อ', () => {
    expect(relaxLabel('area', {})).toBe('ค้นทุกพื้นที่');
    expect(relaxLabel('budget', {})).toBe('ไม่จำกัดงบ');
    expect(relaxLabel('pr', {})).toBe('รวมร้านที่ไม่มี PR');
  });
});
