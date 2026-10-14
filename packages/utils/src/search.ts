/** ค้นหาตามงบ (requirement "ค้นหาตามงบ"): Hero หน้าแรก → /search?q=&district=&budget=&people= */
export const SEARCH_BUDGET_MIN = 100;
/** ตั้งแต่ค่านี้ขึ้นไป = ไม่จำกัดงบ */
export const SEARCH_BUDGET_MAX = 2000;
export const SEARCH_BUDGET_STEP = 50;
/** ตัวเลือกงบต่อหัวในเมนูของ Hero (บาท) */
export const SEARCH_BUDGET_PRESETS = [200, 300, 400, 500, 700, 1000, 1500] as const;
/** จำนวนคนสูงสุดที่เลือกได้ในหน้าค้นหาและหน้าจอง (ร้านอาจรับน้อยกว่านี้ · API รับถึง 50) */
export const MAX_GROUP_SIZE = 12;

export interface BudgetSearch {
  q?: string;
  district?: string;
  /** งบต่อหัว (บาท) · ไม่มี = ไม่จำกัด */
  budget?: number;
  /** จำนวนคนในกลุ่ม · ไม่มี = ไม่ระบุ */
  people?: number;
}

const textParam = (raw: string | null | undefined): string | undefined => raw?.trim() || undefined;

/** งบต่อหัว: ไม่ใช่ตัวเลขบวก = ไม่กรอง · ต่ำกว่า MIN → MIN · ตั้งแต่ MAX = ไม่จำกัด · ปัดเป็นบาทเต็ม */
function budgetValue(n: number): number | undefined {
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const v = Math.round(n);
  if (v >= SEARCH_BUDGET_MAX) return undefined;
  return Math.max(v, SEARCH_BUDGET_MIN);
}

/** จำนวนคน: จำนวนเต็มบวกเท่านั้น · เกิน MAX_GROUP_SIZE → MAX_GROUP_SIZE */
function peopleValue(n: number): number | undefined {
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return Math.min(n, MAX_GROUP_SIZE);
}

const numberParam = (raw: string | null | undefined): number => (raw?.trim() ? Number(raw) : Number.NaN);

/**
 * อ่าน query (รับ URLSearchParams ได้ตรงๆ) — ค่าผิด = ไม่กรอง
 * · budget < MIN → MIN · ≥ MAX → undefined (ไม่จำกัด)
 * · people: จำนวนเต็ม ≤0/ผิด → undefined, > MAX_GROUP_SIZE → MAX_GROUP_SIZE
 * · q/district trim แล้วว่าง → undefined
 */
export function parseBudgetSearch(params: { get(key: string): string | null }): BudgetSearch {
  const s: BudgetSearch = {};
  const q = textParam(params.get('q'));
  const district = textParam(params.get('district'));
  const budget = budgetValue(numberParam(params.get('budget')));
  const people = peopleValue(numberParam(params.get('people')));
  if (q !== undefined) s.q = q;
  if (district !== undefined) s.district = district;
  if (budget !== undefined) s.budget = budget;
  if (people !== undefined) s.people = people;
  return s;
}

/**
 * query string (ไม่มี "?") ลำดับ q, district, budget, people · ข้ามค่าว่าง/ค่าที่ไม่กรอง (งบ ≥ MAX = ไม่จำกัด)
 * encodeURIComponent เอง (ไม่พึ่ง URLSearchParams — เว้นวรรคเป็น %20)
 */
export function budgetSearchQuery(s: BudgetSearch): string {
  const budget = s.budget === undefined ? undefined : budgetValue(s.budget);
  const people = s.people === undefined ? undefined : peopleValue(s.people);
  const pairs: [string, string | number | undefined][] = [
    ['q', textParam(s.q)],
    ['district', textParam(s.district)],
    ['budget', budget],
    ['people', people],
  ];
  return pairs
    .filter((p): p is [string, string | number] => p[1] !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
}

/**
 * ร้านรับกลุ่มนี้ได้ไหม: มีอย่างน้อย 1 โซนที่ capacityPax ≥ people
 * · people ไม่ระบุ (หรือไม่ใช่ตัวเลขบวก) = true · ไม่มีโซน + ระบุคน = false
 */
export function fitsGroup(zones: readonly { capacityPax: number }[], people?: number): boolean {
  if (people === undefined || !Number.isFinite(people) || people <= 0) return true;
  return zones.some((z) => z.capacityPax >= people);
}
