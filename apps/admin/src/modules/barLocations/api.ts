import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useAdminView, type AdminActionInput } from '@/services/adminData';

/**
 * API ของหน้าตรวจตำแหน่งร้าน (/bar-locations)
 * backend: domains/backoffice (อ่าน admin_bar_locations · admin_bar_location_requests) · domains/bar (bar.admin.controller.ts · bar.me.controller.ts = geocode)
 */

/** ทุกร้าน (ทุกสถานะ) + คำขอที่รอตรวจของแต่ละร้าน — เรียงตามชื่อ */
export const useBarLocations = () =>
  useAdminView('admin_bar_locations', { order: { column: 'name', ascending: true } });

/** ประวัติคำขอ/การตั้งแทนที่จบแล้ว ใหม่สุดก่อน */
export const useLocationHistory = () =>
  useAdminView('admin_bar_location_requests', {
    filters: [['status', ['APPROVED', 'REJECTED', 'CANCELLED']]],
    order: { column: 'created_at', ascending: false },
    limit: 500,
  });

/** POST /admin/bar-location-requests/:id/review — อนุมัติ (ปรับก่อนได้) / ตีกลับพร้อมเหตุผล */
export const reviewLocationAction = (requestId: string, body: C.ReviewBarLocationBody): AdminActionInput => ({
  method: 'POST',
  path: `bar-location-requests/${requestId}/review`,
  body,
});

/** PUT /admin/bars/:id/location — ตั้งตำแหน่งแทนร้าน (มีผลทันที · ยกเลิกคำขอที่ค้าง · ส่งค่าเดิม = ยืนยันหมุดเดิม) */
export const setBarLocationAction = (barId: string, body: C.AdminSetBarLocationBody): AdminActionInput => ({
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
