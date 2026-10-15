import type { SiteNavItem } from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';

/** GET /public/site-nav — เมนู navbar ทุกรายการ (รวมที่ซ่อน) · ใช้ทุกหน้าผ่าน hooks/useSiteNav */
export const fetchSiteNav = () => Rest.get<SiteNavItem[]>('/public/site-nav');
