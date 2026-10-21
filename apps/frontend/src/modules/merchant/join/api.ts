import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';

/** API ของหน้าสมัครลงร้าน · backend: domains/bar */

/** POST /merchant/join — ต้องปักหมุด (ในไทย) + ที่อยู่ · หมุดถูกตรวจพร้อมการอนุมัติร้าน */
export const merchantJoin = (input: C.MerchantJoinBody) =>
  Rest.post<C.MerchantJoinResult>('/merchant/join', input);

/** GET /geocode/search — ค้นหาที่อยู่ในไทย (backend → Nominatim · เรียกเมื่อกดค้นหาเท่านั้น) · ประกาศซ้ำกับ merchant/location ตาม ADR 0007 */
export const searchPlace = async (q: string) =>
  (
    await Rest.get<C.GeocodeSearchResult>('/geocode/search', {
      params: { q } satisfies C.GeocodeSearchQuery,
    })
  ).results;

/** GET /geocode/reverse — หมุด → ที่อยู่ (ปุ่ม "ใช้ที่อยู่จากหมุด") */
export const reversePlace = ({ lat, lng }: { lat: number; lng: number }) =>
  Rest.get<C.GeocodeReverseResult>('/geocode/reverse', {
    params: { lat, lng } satisfies C.GeocodeReverseQuery,
  });

/** GET /public/area — ตำบล/อำเภอ/จังหวัด + ย่านของหมุด (rpc area_at_point · ค่าจริงของร้าน DB คำนวณเองตอนบันทึกหมุด) · ประกาศซ้ำกับ merchant/store ตาม ADR 0007 */
export const usePinArea = (pin?: { lat: number; lng: number } | null) =>
  useQuery({
    queryKey: [
      'catalog',
      'area',
      pin ? Number(pin.lat.toFixed(5)) : null,
      pin ? Number(pin.lng.toFixed(5)) : null,
    ],
    queryFn: () =>
      Rest.get<C.AreaAtPointResult>('/public/area', {
        params: { lat: pin!.lat, lng: pin!.lng } satisfies C.AreaAtPointQuery,
      }),
    enabled: !!pin,
    staleTime: Infinity,
  });
