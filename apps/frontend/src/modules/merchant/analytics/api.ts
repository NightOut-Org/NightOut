import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

/** API ของหน้าสถิติร้าน · backend: domains/booking */

/** GET /merchant/bars/:barId/sales-stats — ยอดขายเฉลี่ย (ประมาณการ) · เจ้าของ/ผู้จัดการเท่านั้น */
export const useSalesStats = (barId: string, days: number) =>
  useQuery({
    queryKey: ['booking', 'sales_stats', barId, days],
    queryFn: () =>
      Rest.get<C.SalesStatsResult>(`/merchant/bars/${barId}/sales-stats`, {
        params: { days } satisfies C.SalesStatsQuery,
      }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
