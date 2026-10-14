import type * as C from '@nightout/contracts';
import type { BarCategory } from '@nightout/types';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';

/** API ของหน้าจัดอันดับ · backend: domains/catalog */

/** จำนวนร้านที่หน้า /ranking แสดง (แท่น 3 + อันดับ 4–10) */
const RANKING_LIMIT = 10;

/**
 * GET /public/ranking — อันดับรอบล่าสุด (job คำนวณทุกคืน) เรียงตามโหวตในรอบ แล้วตามคะแนนรวม
 * ไม่ส่ง category = ทุกประเภท · ไม่รวมร้านรีวิวน้อยกว่า 5
 */
export function useRanking(period: C.RankPeriod, category?: BarCategory) {
  return useQuery({
    queryKey: ['catalog', 'ranking', period, category ?? 'ALL', RANKING_LIMIT],
    queryFn: () =>
      Rest.get<C.RankingRow[]>('/public/ranking', {
        params: { period, limit: RANKING_LIMIT, ...(category ? { category } : {}) } satisfies C.RankingQuery,
      }),
    staleTime: 5 * 60_000,
  });
}
