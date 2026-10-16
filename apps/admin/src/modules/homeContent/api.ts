import type * as C from '@nightout/contracts';
import { useAdminView, type AdminActionInput } from '@/services/adminData';

/** API ของหน้าเมนู navbar (/home-content) · backend: domains/backoffice (อ่าน) · domains/site-content (site-content.admin.controller.ts) */

/** GET /admin/views/admin_site_nav — ทุกเมนู (รวมที่ซ่อน) */
export const useSiteNav = () => useAdminView('admin_site_nav', { order: { column: 'desktop_order', ascending: true } });

/** PUT /admin/site-nav — บันทึกทุกเมนูครั้งเดียว (ชื่อ · ลำดับ · ซ่อน/แสดง ของ navbar และแถบเมนูมือถือ) */
export const saveSiteNavAction = (body: C.SaveSiteNavBody): AdminActionInput => ({ method: 'PUT', path: 'site-nav', body });
