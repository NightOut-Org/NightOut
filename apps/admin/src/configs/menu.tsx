import {
  Armchair,
  ChartBar,
  ClipboardText,
  Crown,
  Gear,
  House,
  Images,
  MapPin,
  Megaphone,
  MegaphoneSimple,
  ShieldCheck,
  Storefront,
  UserCircle,
  Users,
  UsersFour,
  ChatCircleText,
  ChatsCircle,
  CalendarCheck,
  Buildings,
  Wallet,
  CreditCard,
  Prohibit,
  Tag,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export interface AdminRoute {
  path: string;
  name: string;
  icon: ReactNode;
}

/** เมนู Backoffice ตาม docs/SITEMAP.md ข้อ 4 */
export const ADMIN_ROUTES: AdminRoute[] = [
  { path: '/', name: 'แดชบอร์ด', icon: <ChartBar size={18} /> },
  { path: '/merchants', name: 'ร้านรออนุมัติ', icon: <Storefront size={18} /> },
  { path: '/bars', name: 'จัดการร้าน', icon: <Buildings size={18} /> },
  { path: '/bar-blacklist', name: 'Blacklist ร้าน', icon: <Prohibit size={18} /> },
  { path: '/bar-media', name: 'รูปร้าน', icon: <Images size={18} /> },
  { path: '/bar-locations', name: 'ตรวจตำแหน่งร้าน', icon: <MapPin size={18} /> },
  { path: '/safety', name: 'ยืนยัน Safety', icon: <ShieldCheck size={18} /> },
  { path: '/ranking', name: 'ดาว / อันดับ', icon: <Crown size={18} /> },
  { path: '/styles', name: 'สไตล์ร้าน', icon: <Tag size={18} /> },
  { path: '/promotions', name: 'โปรโมท', icon: <Megaphone size={18} /> },
  { path: '/users', name: 'ผู้ใช้', icon: <Users size={18} /> },
  { path: '/team', name: 'จัดการทีมงาน', icon: <UsersFour size={18} /> },
  { path: '/home-content', name: 'หน้าแรก', icon: <House size={18} /> },
  { path: '/mini-ads', name: 'โฆษณา (Mini-Ads)', icon: <MegaphoneSimple size={18} /> },
  { path: '/bookings', name: 'การจอง', icon: <CalendarCheck size={18} /> },
  { path: '/table-board', name: 'ผังโต๊ะร้าน', icon: <Armchair size={18} /> },
  { path: '/deposits', name: 'เงินมัดจำ', icon: <Wallet size={18} /> },
  { path: '/payments', name: 'การชำระเงิน', icon: <CreditCard size={18} /> },
  { path: '/reviews', name: 'รีวิวที่ถูกรายงาน', icon: <ChatCircleText size={18} /> },
  { path: '/community', name: 'ชุมชน', icon: <ChatsCircle size={18} /> },
  { path: '/audit-logs', name: 'Audit Log', icon: <ClipboardText size={18} /> },
  { path: '/settings', name: 'ตั้งค่าระบบ', icon: <Gear size={18} /> },
];

export const AvatarIcon = <UserCircle size={24} />;
