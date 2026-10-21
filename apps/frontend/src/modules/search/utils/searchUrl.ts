import type { BarFilter } from '@/services/data';
import type { CrowdStatus } from '@nightout/types';
import { budgetSearchQuery, parseBudgetSearch } from '@nightout/utils';

type Category = NonNullable<BarFilter['category']>;
type Sort = NonNullable<BarFilter['sort']>;

const CATEGORIES: readonly Category[] = ['PUB_BAR', 'CHILL', 'RESTAURANT'];
const CROWDS: readonly CrowdStatus[] = ['AVAILABLE', 'ALMOST_FULL', 'FULL'];
const SORTS: readonly Sort[] = ['rating', 'price', 'safety', 'distance'];

const oneOf = <T extends string>(list: readonly T[], v: string | null): T | undefined =>
  list.find((x) => x === v);

/**
 * URL → ตัวกรองหน้า /search
 * · ?q=&district=&budget=&people= จาก Hero หน้าแรก (parseBudgetSearch · ค่าผิด = ไม่กรอง)
 * · ?tambon=<รหัสตำบล TH######> จากตัวกรองพื้นที่ (ใช้แทน district)
 * · ?category= / ?style= (ซ้ำได้) จากการ์ดหมวดหมู่ · ?crowd= (ซ้ำได้) · ?safety= · ?pr=1 · ?sort=
 */
export function filterFromParams(params: URLSearchParams): BarFilter {
  const s = parseBudgetSearch(params);
  const safety = Number(params.get('safety'));
  return {
    q: s.q ?? '',
    category: oneOf(CATEGORIES, params.get('category')) ?? 'ALL',
    styles: params.getAll('style'),
    district: s.district,
    tambon: /^TH[0-9]{6}$/.test(params.get('tambon') ?? '') ? params.get('tambon')! : undefined,
    maxBudget: s.budget,
    people: s.people,
    crowd: params.getAll('crowd').filter((c): c is CrowdStatus => oneOf(CROWDS, c) !== undefined),
    // สวิตช์ "เฉพาะร้านที่มี PR": เปิด (?pr=1) = เฉพาะร้านมี PR · ปิด = ทุกร้าน (ตกลงกับผู้ใช้ 2026-10-21)
    hasPR: params.get('pr') === '1',
    minSafety: Number.isInteger(safety) && safety > 0 && safety <= 100 ? safety : undefined,
    sort: oneOf(SORTS, params.get('sort')) ?? 'relevance',
  };
}

/** ตัวกรอง → query string (ไม่มี "?") · ข้ามค่าที่ไม่กรอง · อ่านกลับด้วย filterFromParams ได้ค่าเดิม */
export function filterToQuery(f: BarFilter): string {
  const extra: [string, string][] = [
    ...(f.tambon ? [['tambon', f.tambon] as [string, string]] : []),
    ...(f.category && f.category !== 'ALL' ? [['category', f.category] as [string, string]] : []),
    ...(f.styles ?? []).map((v): [string, string] => ['style', v]),
    ...(f.crowd ?? []).map((v): [string, string] => ['crowd', v]),
    ...(f.minSafety ? [['safety', String(f.minSafety)] as [string, string]] : []),
    ...(f.hasPR ? [['pr', '1'] as [string, string]] : []),
    ...(f.sort && f.sort !== 'relevance' ? [['sort', f.sort] as [string, string]] : []),
  ];
  return [
    budgetSearchQuery({ q: f.q, district: f.district, budget: f.maxBudget, people: f.people }),
    ...extra.map(([k, v]) => `${k}=${encodeURIComponent(v)}`),
  ]
    .filter(Boolean)
    .join('&');
}
