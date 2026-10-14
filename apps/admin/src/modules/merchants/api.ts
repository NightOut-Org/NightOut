import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useAdminView, type AdminActionInput } from '@/services/adminData';

/** API ของหน้าร้านรออนุมัติ · backend: domains/backoffice (อ่าน) · domains/bar (bar.admin.controller.ts · bar.me.controller.ts = geocode) */

/** ร้านที่รอตรวจ / ร่าง เก่าสุดก่อน */
export const usePendingBars = () =>
  useAdminView('admin_bars', { filters: [['status', ['PENDING_REVIEW', 'DRAFT']]], order: { column: 'created_at', ascending: true } });

/** PATCH /admin/bars/:id/status — อนุมัติ / ไม่อนุมัติ */
export const barStatusAction = (barId: string, body: C.SetBarStatusBody): AdminActionInput => ({ method: 'PATCH', path: `bars/${barId}/status`, body });

/** หมุดของร้านที่รอตรวจ / ร่าง (admin_bar_locations) — จับคู่กับแถวด้วย id · อนุมัติร้าน = ตรวจหมุดไปพร้อมกัน */
export const usePendingBarLocations = () =>
  useAdminView('admin_bar_locations', { filters: [['status', ['PENDING_REVIEW', 'DRAFT']]] });

/** PUT /admin/bars/:id/location — ปักหมุด/แก้ตำแหน่งแทนร้าน (มีผลทันที · แจ้งทีมร้าน) */
export const barLocationAction = (barId: string, body: C.AdminSetBarLocationBody): AdminActionInput => ({
  method: 'PUT',
  path: `bars/${barId}/location`,
  body,
});

/** GET /geocode/search — ค้นหาสถานที่ในไทย (เรียกเมื่อกดค้นหาเท่านั้น) */
export const searchPlace = async (q: string) =>
  (await Rest.get<C.GeocodeSearchResult>('/geocode/search', { params: { q } satisfies C.GeocodeSearchQuery }))
    .results;

/** GET /geocode/reverse — พิกัดหมุด → ที่อยู่ */
export const reversePlace = ({ lat, lng }: { lat: number; lng: number }) =>
  Rest.get<C.GeocodeReverseResult>('/geocode/reverse', { params: { lat, lng } satisfies C.GeocodeReverseQuery });
