import { CalendarCheck, ChatsCircle, Crown, House, Info, MagnifyingGlass } from '@phosphor-icons/react';
import type { SiteNavItem, SiteNavKey } from '@nightout/contracts';
import type { NavItem } from '@/ui/components/navbar';

/**
 * เมนูหลักฝั่งลูกค้า (Figma: navbar) — ใช้ทั้ง MainLayout และ AuthLayout
 * ลิงก์ + ไอคอนตายตัวในโค้ด · ชื่อ / ลำดับ / ซ่อน-แสดง (desktop กับมือถือแยกกัน) แอดมินจัดที่ Backoffice /home-content (GET /public/site-nav)
 */
export const NAV_LINKS: Record<SiteNavKey, Omit<NavItem, 'label'>> = {
  home: { to: '/', icon: House, end: true },
  search: { to: '/search', icon: MagnifyingGlass },
  community: { to: '/community', icon: ChatsCircle },
  ranking: { to: '/ranking', icon: Crown },
  bookings: { to: '/bookings', icon: CalendarCheck },
  about: { to: '/about', icon: Info },
};

/** ค่าตั้งต้นก่อนโหลดเมนูจาก API ได้ (ตรงกับ seed ใน migration …20261015000300) */
export const DEFAULT_SITE_NAV: SiteNavItem[] = [
  { key: 'home', label: 'หน้าหลัก', desktop_order: 0, desktop_visible: true, mobile_order: 0, mobile_visible: true },
  { key: 'search', label: 'ค้นหา', desktop_order: 1, desktop_visible: true, mobile_order: 1, mobile_visible: true },
  { key: 'community', label: 'ชุมชน', desktop_order: 2, desktop_visible: true, mobile_order: 2, mobile_visible: true },
  { key: 'ranking', label: 'จัดอันดับ', desktop_order: 3, desktop_visible: true, mobile_order: 3, mobile_visible: true },
  { key: 'bookings', label: 'การจอง', desktop_order: 4, desktop_visible: true, mobile_order: 4, mobile_visible: true },
  { key: 'about', label: 'เกี่ยวกับเรา', desktop_order: 5, desktop_visible: true, mobile_order: 5, mobile_visible: false },
];

/** แถวจาก API → เมนูที่แสดงของชุดนั้น (เรียงตามลำดับ · เมนูที่โค้ดไม่รู้จักถูกข้าม) */
export function toNavItems(rows: SiteNavItem[], mode: 'desktop' | 'mobile'): NavItem[] {
  const order = mode === 'desktop' ? 'desktop_order' : 'mobile_order';
  const visible = mode === 'desktop' ? 'desktop_visible' : 'mobile_visible';
  return rows
    .filter((r) => r[visible] && r.key in NAV_LINKS)
    .sort((a, b) => a[order] - b[order])
    .map((r) => ({ ...NAV_LINKS[r.key], label: r.label }));
}
