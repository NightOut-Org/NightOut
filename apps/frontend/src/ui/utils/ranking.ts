import type { RankingRow } from '@nightout/contracts';
import { getBar, type RankedBar } from '@/services/data';

/**
 * แถวอันดับจาก GET /public/ranking → ร้านใน store ของ catalog (การ์ด/แท่นใช้ข้อมูลร้านเต็ม)
 * ร้านที่ไม่อยู่ใน store (เพิ่งถูกซ่อน/ระงับหลังโหลด catalog) ข้ามไป แล้วนับอันดับใหม่ให้ต่อเนื่อง
 * ดาว/Tier ใช้ค่าของรอบอันดับนั้น (ตรงกับคะแนนรวมที่ job คำนวณ)
 */
export function toRankedBars(rows: RankingRow[]): RankedBar[] {
  const out: RankedBar[] = [];
  for (const r of rows) {
    const bar = getBar(r.bar_id);
    if (!bar) continue;
    out.push({ ...bar, stars: r.stars, tier: r.tier, isNew: false, rank: out.length + 1, votes: r.votes });
  }
  return out;
}
