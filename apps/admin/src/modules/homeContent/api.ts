import type * as C from '@nightout/contracts';
import { useAdminView, type AdminActionInput } from '@/services/adminData';

/** API ของหน้าเนื้อหาหน้าแรก · backend: domains/backoffice (อ่าน) · domains/site-content (site-content.admin.controller.ts) */

export const useHomeContent = () => useAdminView('admin_home_content');
export const useHomeCategories = () => useAdminView('admin_home_categories', { order: { column: 'sort_order', ascending: true } });
export const useHomePopular = () => useAdminView('admin_home_popular', { order: { column: 'sort_order', ascending: true } });
/** ร้านทั้งหมดไว้เลือกเป็นร้านยอดนิยม */
export const useBars = () => useAdminView('admin_bars', { order: { column: 'name', ascending: true } });

/** PUT /admin/home-page — บันทึกทั้งหน้าครั้งเดียว: Hero/หัวข้อ · การ์ดที่แก้ · ร้านยอดนิยม (ส่งเฉพาะส่วนที่แก้) */
export const homePageAction = (body: C.SaveHomePageBody): AdminActionInput => ({ method: 'PUT', path: 'home-page', body });
