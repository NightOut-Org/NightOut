import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';

/** API ของหน้าค้นหา (/search) · backend: domains/catalog */

/** GET /public/tambons?q= — ค้นตำบล/แขวงทั้งประเทศตอนพิมพ์ในตัวกรองพื้นที่ (≥ 2 ตัวอักษร · backend ของเราเอง ไม่ใช่ Nominatim) */
export const useTambonSearch = (q: string) => {
  const term = q.trim();
  return useQuery({
    queryKey: ['catalog', 'tambons', term],
    queryFn: () =>
      Rest.get<C.TambonOption[]>('/public/tambons', {
        params: { q: term } satisfies C.TambonSearchQuery,
      }),
    enabled: term.length >= 2,
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  });
};

/** GET /public/tambons?code= — ชื่อของตำบลที่เลือกไว้ (เปิดลิงก์ ?tambon= ตรงๆ) */
export const useTambonByCode = (code?: string) =>
  useQuery({
    queryKey: ['catalog', 'tambon', code],
    queryFn: async () =>
      (
        await Rest.get<C.TambonOption[]>('/public/tambons', {
          params: { code } satisfies C.TambonSearchQuery,
        })
      )[0] ?? null,
    enabled: !!code,
    staleTime: Infinity,
  });
