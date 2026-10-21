import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';

/** API ของหน้าสถานะการตรวจร้าน · backend: domains/catalog */

/** GET /public/area — เขต/อำเภอของหมุดร้าน (ร้านที่ยังไม่แสดงไม่มีพื้นที่ใน catalog) · ประกาศซ้ำกับ merchant/store ตาม ADR 0007 */
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
