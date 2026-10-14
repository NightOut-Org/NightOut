import type * as C from '@nightout/contracts';
import { useAdminView, type AdminActionInput } from '@/services/adminData';

/** API ของหน้าโฆษณาแบนเนอร์ · backend: domains/backoffice (อ่าน) · domains/mini-ads (mini-ads.admin.controller.ts) */

export const useMiniAds = () =>
  useAdminView('admin_mini_ads', { order: { column: 'starts_at', ascending: false } });

/** POST /admin/mini-ads */
export const createMiniAdAction = (body: C.MiniAdBody): AdminActionInput => ({
  method: 'POST',
  path: 'mini-ads',
  body,
});

/** PATCH /admin/mini-ads/:id — ส่งเฉพาะ field ที่แก้ */
export const updateMiniAdAction = (id: string, body: C.UpdateMiniAdBody): AdminActionInput => ({
  method: 'PATCH',
  path: `mini-ads/${id}`,
  body,
});

/** DELETE /admin/mini-ads/:id */
export const deleteMiniAdAction = (id: string): AdminActionInput => ({
  method: 'DELETE',
  path: `mini-ads/${id}`,
});
