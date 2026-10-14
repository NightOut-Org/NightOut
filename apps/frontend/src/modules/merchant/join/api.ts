import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';

/** API ของหน้าสมัครลงร้าน · backend: domains/bar */

/** POST /merchant/join — ต้องปักหมุด (ในไทย) + ที่อยู่ · หมุดถูกตรวจพร้อมการอนุมัติร้าน */
export const merchantJoin = (input: C.MerchantJoinBody) => Rest.post<C.MerchantJoinResult>('/merchant/join', input);

/** GET /geocode/search — ค้นหาที่อยู่ในไทย (backend → Nominatim · เรียกเมื่อกดค้นหาเท่านั้น) · ประกาศซ้ำกับ merchant/location ตาม ADR 0007 */
export const searchPlace = async (q: string) =>
  (await Rest.get<C.GeocodeSearchResult>('/geocode/search', { params: { q } satisfies C.GeocodeSearchQuery })).results;

/** GET /geocode/reverse — หมุด → ที่อยู่ (ปุ่ม "ใช้ที่อยู่จากหมุด") */
export const reversePlace = ({ lat, lng }: { lat: number; lng: number }) =>
  Rest.get<C.GeocodeReverseResult>('/geocode/reverse', { params: { lat, lng } satisfies C.GeocodeReverseQuery });
