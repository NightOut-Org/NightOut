import type { BarFilter } from '@/services/data';
import { MAX_GROUP_SIZE, SEARCH_BUDGET_MAX, SEARCH_BUDGET_MIN } from '@nightout/utils';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/**
 * ช่องค้นหาแบบพิมพ์ตามที่พูด เช่น "ทองหล่อ 4 คน 800 live music" → ตัวกรอง
 * - "<n> คน" → จำนวนคน (≤ MAX_GROUP_SIZE)
 * - ตัวเลข 3–4 หลัก (มี ฿ ได้) → งบต่อหัว (< MIN → MIN · ≥ MAX = ไม่จำกัด)
 * - ชื่อย่าน / ชื่อสไตล์ (ไม่สนตัวพิมพ์) → ย่าน / สไตล์ · คำว่า "ว่าง" → ความแน่น = ว่าง
 * - ที่เหลือ = คำค้น (q)
 * คืนเฉพาะค่าที่เจอ (q คืนเสมอ) — ตัวกรองที่ตั้งจากแผงละเอียดไว้แล้วไม่ถูกล้าง
 */
export function parseSmartQuery(
  text: string,
  { districts, styles }: { districts: readonly string[]; styles: readonly string[] },
): Partial<BarFilter> {
  const patch: Partial<BarFilter> = {};
  let rest = text;

  const people = rest.match(/(\d+)\s*คน/);
  if (people) {
    const n = Number(people[1]);
    if (n > 0) patch.people = Math.min(n, MAX_GROUP_SIZE);
    rest = rest.replace(people[0], ' ');
  }

  const money = rest.match(/฿?\s*(\d{3,4})/);
  if (money) {
    const v = Number(money[1]);
    patch.maxBudget = v >= SEARCH_BUDGET_MAX ? undefined : Math.max(v, SEARCH_BUDGET_MIN);
    rest = rest.replace(money[0], ' ');
  }

  // ชื่อยาวก่อน — "สุขุมวิท" ไม่ไปชนกับย่านที่ชื่อสั้นกว่าที่เป็นส่วนหนึ่งของมัน
  const district = [...districts].sort((a, b) => b.length - a.length).find((d) => rest.includes(d));
  if (district) {
    patch.district = district;
    rest = rest.replace(district, ' ');
  }

  const lower = rest.toLowerCase();
  const found = styles.filter((s) => lower.includes(s.toLowerCase()));
  if (found.length) {
    patch.styles = found;
    for (const s of found) rest = rest.replace(new RegExp(escapeRegExp(s), 'i'), ' ');
  }

  if (rest.includes('ว่าง')) {
    patch.crowd = ['AVAILABLE'];
    rest = rest.replace('ว่าง', ' ');
  }

  patch.q = rest.replace(/\s+/g, ' ').trim();
  return patch;
}
