import {
  Armchair,
  ChartBar,
  ClipboardText,
  Crown,
  Gear,
  Images,
  ListBullets,
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
  icon?: ReactNode;
  /** มี = กลุ่มยุบ/ขยายได้ในเมนูซ้าย (ไม่ใช่หน้า · path ใช้เป็น key เท่านั้น) */
  routes?: AdminRoute[];
}

const icon = (Icon: typeof ChartBar) => <Icon size={18} />;

/** เมนู Backoffice ตาม docs/SITEMAP.md ข้อ 4 — จัดเป็นกลุ่มตามงาน ยุบ/ขยายได้ (submenu ของ ProLayout · เปิดกลุ่มของหน้าปัจจุบันให้เอง) */
export const ADMIN_ROUTES: AdminRoute[] = [
  { path: '/', name: 'แดชบอร์ด', icon: icon(ChartBar) },
  {
    path: '/group/bars',
    name: 'ร้านค้า',
    icon: icon(Storefront),
    routes: [
      { path: '/merchants', name: 'ร้านรออนุมัติ', icon: icon(Storefront) },
      { path: '/bars', name: 'จัดการร้าน', icon: icon(Buildings) },
      { path: '/bar-locations', name: 'ตรวจตำแหน่งร้าน', icon: icon(MapPin) },
      { path: '/bar-media', name: 'รูปร้าน', icon: icon(Images) },
      { path: '/safety', name: 'ยืนยัน Safety', icon: icon(ShieldCheck) },
      { path: '/bar-blacklist', name: 'Blacklist ร้าน', icon: icon(Prohibit) },
    ],
  },
  {
    path: '/group/bookings',
    name: 'การจองและการเงิน',
    icon: icon(CalendarCheck),
    routes: [
      { path: '/bookings', name: 'การจอง', icon: icon(CalendarCheck) },
      { path: '/table-board', name: 'ผังโต๊ะร้าน', icon: icon(Armchair) },
      { path: '/deposits', name: 'เงินมัดจำ', icon: icon(Wallet) },
      { path: '/payments', name: 'การชำระเงิน', icon: icon(CreditCard) },
    ],
  },
  {
    path: '/group/content',
    name: 'เนื้อหาและการตลาด',
    icon: icon(Megaphone),
    routes: [
      { path: '/home-content', name: 'เมนูเว็บ (Navbar)', icon: icon(ListBullets) },
      { path: '/styles', name: 'สไตล์ร้าน', icon: icon(Tag) },
      { path: '/ranking', name: 'ดาว / อันดับ', icon: icon(Crown) },
      { path: '/promotions', name: 'โปรโมท', icon: icon(Megaphone) },
      { path: '/mini-ads', name: 'โฆษณา (Mini-Ads)', icon: icon(MegaphoneSimple) },
    ],
  },
  {
    path: '/group/people',
    name: 'ผู้ใช้และชุมชน',
    icon: icon(Users),
    routes: [
      { path: '/users', name: 'ผู้ใช้', icon: icon(Users) },
      { path: '/reviews', name: 'รีวิวที่ถูกรายงาน', icon: icon(ChatCircleText) },
      { path: '/community', name: 'ชุมชน', icon: icon(ChatsCircle) },
    ],
  },
  {
    path: '/group/system',
    name: 'ระบบ',
    icon: icon(Gear),
    routes: [
      { path: '/team', name: 'จัดการทีมงาน', icon: icon(UsersFour) },
      { path: '/audit-logs', name: 'Audit Log', icon: icon(ClipboardText) },
      { path: '/settings', name: 'ตั้งค่าระบบ', icon: icon(Gear) },
    ],
  },
];

export const AvatarIcon = <UserCircle size={24} />;
