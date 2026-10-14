import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';

/** API ของหน้าตำแหน่งร้าน (/merchant/location) · backend: domains/bar · เขียนแล้ว Rest โหลด /me/overview ใหม่ให้เอง */

/** PUT /merchant/bars/:barId/location — ร้านที่แสดงอยู่ = ส่งคำขอรอแอดมินตรวจ · ร้านที่ยังไม่เคยแสดง = บันทึกทันที */
export const saveLocation = (barId: string, body: C.BarLocationBody) =>
  Rest.put<C.BarLocationResult>(`/merchant/bars/${barId}/location`, body);

/** DELETE /merchant/bars/:barId/location-request — ยกเลิกคำขอที่รอตรวจ (ลูกค้ายังเห็นหมุดเดิม) */
export const cancelLocationRequest = (barId: string) =>
  Rest.delete<C.CancelBarLocationResult>(`/merchant/bars/${barId}/location-request`);

/** GET /geocode/search — ค้นหาที่อยู่ในไทย (backend → Nominatim · เรียกเมื่อกดค้นหาเท่านั้น) */
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
