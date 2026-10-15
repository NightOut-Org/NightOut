import { CalendarCheck, ChatsCircle, Crown, House, Info, MagnifyingGlass, type Icon } from '@phosphor-icons/react';
import type { SiteNavKey } from '@nightout/contracts';

/** ลิงก์ + ไอคอนของแต่ละเมนู — ตรงกับ NAV_LINKS ของเว็บลูกค้า (apps/frontend/src/configs/nav.ts) · แก้ไม่ได้จากหลังบ้าน */
export const NAV_LINKS: Record<SiteNavKey, { to: string; icon: Icon }> = {
  home: { to: '/', icon: House },
  search: { to: '/search', icon: MagnifyingGlass },
  community: { to: '/community', icon: ChatsCircle },
  ranking: { to: '/ranking', icon: Crown },
  bookings: { to: '/bookings', icon: CalendarCheck },
  about: { to: '/about', icon: Info },
};
