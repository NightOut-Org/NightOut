import type * as C from '@nightout/contracts';
import { useAdminView, type AdminActionInput } from '@/services/adminData';

/** API ของหน้า Blacklist ร้าน · backend: domains/backoffice (อ่าน admin_bar_blacklist) · domains/bar (bar.admin.controller.ts) */

/** GET /admin/views/admin_bar_blacklist — ร้านที่ไม่มีโต๊ะให้ลูกค้าบ่อยสุดใน 90 วันขึ้นก่อน */
export const useBarBlacklist = () =>
  useAdminView('admin_bar_blacklist', { order: { column: 'strike_count_90d', ascending: false } });

/** POST /admin/bars/:id/blacklist — ซ่อนร้านและปิดรับจองใหม่จนกว่าจะปลด (ส่งให้ useAdminAction().mutate พร้อม success) */
export const blacklistBarAction = (id: string, body: C.BarBlacklistBody): AdminActionInput => ({
  method: 'POST',
  path: `bars/${id}/blacklist`,
  body,
});

/** POST /admin/bars/:id/blacklist/lift — ร้านกลับมาแสดงและรับจองได้ทันที */
export const liftBlacklistAction = (id: string, body: C.BarBlacklistBody): AdminActionInput => ({
  method: 'POST',
  path: `bars/${id}/blacklist/lift`,
  body,
});

/** POST /admin/bar-strikes — ข้อร้องเรียนลูกค้า: ร้านไม่มีโต๊ะ → คืน Table Fee (Override) + บันทึกประวัติร้าน */
export const reportNoTableAction = (body: C.AdminReportNoTableBody): AdminActionInput => ({
  method: 'POST',
  path: 'bar-strikes',
  body,
});
