import { CalendarCheck, ChatsCircle, Crown, House, Info, MagnifyingGlass } from '@phosphor-icons/react';
import type { NavItem } from '@/ui/components/navbar';

/** เมนูหลักฝั่งลูกค้า (Figma: navbar) — ใช้ทั้ง MainLayout และ AuthLayout · desktopOnly ไม่ขึ้นใน BottomIsland มือถือ */
export const NAV: NavItem[] = [
  { to: '/', label: 'หน้าหลัก', icon: House, end: true },
  { to: '/search', label: 'ค้นหา', icon: MagnifyingGlass },
  { to: '/community', label: 'ชุมชน', icon: ChatsCircle },
  { to: '/ranking', label: 'จัดอันดับ', icon: Crown },
  { to: '/bookings', label: 'การจอง', icon: CalendarCheck },
  { to: '/about', label: 'เกี่ยวกับเรา', icon: Info, desktopOnly: true },
];
