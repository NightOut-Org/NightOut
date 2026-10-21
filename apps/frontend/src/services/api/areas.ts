import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';

/**
 * พื้นที่ (ADR 0011) ที่หลายหน้าใช้ร่วมกัน — ตัวเลือก "พื้นที่ที่ชอบ" ของ onboarding และ /profile
 * (ช่องค้นหาของ /search ประกาศของตัวเองใน modules/search/api.ts ตาม ADR 0007)
 */

/** GET /public/tambons?q= — ค้นตำบล/แขวงทั้งประเทศตอนพิมพ์ (≥ 2 ตัวอักษร) */
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

/** GET /public/tambons?codes= — ชื่อของตำบล/แขวงที่เลือกไว้แล้ว (ขอทีเดียวทั้งชุด · ≤ 20 รหัส) */
export const useTambonsByCodes = (codes: string[]) => {
  const key = [...new Set(codes)].sort().join(',');
  return useQuery({
    queryKey: ['catalog', 'tambons-by-codes', key],
    queryFn: () =>
      Rest.get<C.TambonOption[]>('/public/tambons', {
        params: { codes: key } satisfies C.TambonSearchQuery,
      }),
    enabled: key.length > 0,
    staleTime: Infinity,
  });
};
