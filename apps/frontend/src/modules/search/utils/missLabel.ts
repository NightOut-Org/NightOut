import { AREA_OPTIONS, CATEGORY_LABELS, type BarFilter, type BarFilterKey } from '@/services/data';
import type { BarCategory } from '@nightout/types';
import type { Bar } from '@/services/models';
import { baht } from '@/ui/utils/format';

/** ข้อความว่าทำไมร้านนี้ไม่ตรงเงื่อนไข (ป้ายเหลืองบนการ์ดร้านใกล้เคียง) */
export function missLabel(key: BarFilterKey, bar: Bar, f: BarFilter): string {
  switch (key) {
    case 'area':
      return `ไม่ได้อยู่${areaLabel(f)}`;
    case 'budget': {
      const avg = bar.avgPerPerson;
      return avg <= 0 ? 'ร้านยังไม่ระบุราคา' : `เกินงบ ${baht(avg - (f.maxBudget ?? 0))}/คน`;
    }
    case 'people': {
      const max = Math.max(0, ...bar.zones.map((z) => z.capacityPax));
      return max === 0 ? 'ยังไม่มีโซนรับกลุ่ม' : `รับได้ถึง ${max} คน`;
    }
    case 'styles':
      return `ไม่มี ${(f.styles ?? []).filter((s) => !bar.styles.includes(s)).join(', ')}`;
    case 'category':
      return `ไม่ใช่${CATEGORY_LABELS[f.category as BarCategory]}`;
    case 'crowd':
      return 'ความแน่นไม่ตรง';
    case 'safety':
      return `Safety ต่ำกว่า ${f.minSafety}`;
    case 'pr':
      return 'ไม่มี PR';
    case 'q':
      return `ไม่ตรงคำค้น "${f.q}"`;
  }
}

/** ป้ายพื้นที่เดียวกับชิปพื้นที่ใน CommandBar */
function areaLabel(f: BarFilter): string {
  if (f.district) return AREA_OPTIONS.find((o) => o.value === f.district)?.label ?? f.district;
  return f.tambonLabel ?? 'ตำบลที่เลือก';
}

/** ข้อความปุ่มผ่อนเงื่อนไข (กดแล้วเอาเงื่อนไขนั้นออก) */
export function relaxLabel(key: BarFilterKey, _f: BarFilter): string {
  switch (key) {
    case 'area':
      return 'ค้นทุกพื้นที่';
    case 'budget':
      return 'ไม่จำกัดงบ';
    case 'people':
      return 'ไม่ระบุจำนวนคน';
    case 'styles':
      return 'ทุกสไตล์';
    case 'category':
      return 'ทุกประเภท';
    case 'crowd':
      return 'ทุกความแน่น';
    case 'safety':
      return 'ไม่จำกัด Safety';
    case 'pr':
      return 'รวมร้านที่ไม่มี PR';
    case 'q':
      return 'ไม่ใช้คำค้น';
  }
}
