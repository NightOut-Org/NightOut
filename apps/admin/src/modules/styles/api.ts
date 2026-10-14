import type * as C from '@nightout/contracts';
import { useAdminView, type AdminActionInput } from '@/services/adminData';

/** API ของหน้าสไตล์ร้าน · backend: domains/backoffice (อ่าน admin_styles · admin_home_categories) · domains/catalog (catalog.admin.controller.ts) */

/** GET /admin/views/admin_styles — สไตล์ทั้งหมด (รวมที่ซ่อน) เรียงตามที่แสดง + จำนวนร้าน/ลูกค้าที่ใช้ */
export const useStyles = () => useAdminView('admin_styles', { order: { column: 'sort_order', ascending: true } });

/** GET /admin/views/admin_home_categories — การ์ดหมวดหน้าแรก (เตือนเมื่อการ์ดลิงก์ /search?style=<ชื่อเดิม>) */
export const useHomeCategories = () => useAdminView('admin_home_categories');

/** PUT /admin/styles — บันทึกทุกสไตล์ตามลำดับครั้งเดียว (เพิ่ม / เปลี่ยนชื่อ / ซ่อน / เรียง) */
export const saveStylesAction = (body: C.SaveStylesBody): AdminActionInput => ({ method: 'PUT', path: 'styles', body });
