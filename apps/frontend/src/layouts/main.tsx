import { User } from '@phosphor-icons/react';
import { Layout } from 'antd';
import { Outlet, useLocation, useMatches } from 'react-router';
import { useSiteNav } from '@/hooks/useSiteNav';
import { useDemo } from '@/hooks/useDemo';
import { useAuth } from '@/services/auth';
import { AccountBannedBanner } from '@/ui/components/accountBannedBanner';
import { AgeGate } from '@/ui/components/ageGate';
import { SiteFooter } from '@/ui/components/siteFooter';
import { BottomIsland, Navbar, type NavItem } from '@/ui/components/navbar';

/**
 * Layout หลักฝั่งลูกค้า
 * - Navbar แคปซูลลอย: หน้าแรกลอยทับ Hero (วิดีโอ) · หน้าอื่นเว้นที่ด้านบน
 * - หน้าแรกจัด container เอง (Hero เต็มจอ) · หน้าอื่นอยู่ใน max-w-7xl
 */
export function MainLayout() {
  useDemo();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  // handle ใน router:
  // - fullBleed: หน้าวาดเต็มจอเอง (ไม่มี container / ไม่เว้นที่ด้านบน)
  // - darkTop: ส่วนบนของหน้ามืดเสมอทุกธีม (ภาพ/วิดีโอกลางคืน) → navbar ใสตัวหนังสือขาวได้
  //   ไม่ใส่ = navbar ใช้สีตามธีม (เช่น /ranking ธีมสว่างพื้นขาว ถ้าใช้ตัวขาวจะมองไม่เห็น)
  const handles = useMatches().map(
    (m) =>
      (m.handle ?? {}) as {
        fullBleed?: boolean;
        hideFooter?: boolean;
        darkTop?: boolean;
        merchantShell?: boolean;
        hideBottomNav?: boolean;
        backdrop?: boolean;
      },
  );
  // backdrop: หน้าวาดพื้นหลัง fixed -z-10 เอง (เช่น /profile) → Layout ต้อง isolate เหมือนหน้าแรก
  const isolate = isHome || handles.some((h) => h.backdrop);
  const fullBleed = handles.some((h) => h.fullBleed);
  const hideFooter = handles.some((h) => h.hideFooter);
  // หน้าร้าน (/merchant/*): มือถือ/แท็บเล็ตใช้แถบบน + แท็บล่างของ MerchantLayout แทน navbar ของเว็บ
  const merchantShell = handles.some((h) => h.merchantShell);
  // หน้าที่มีแถบล่างของตัวเอง (ช่องตอบกระทู้ / ปุ่มโพสต์) — มือถือไม่แสดงเมนูล่าง
  const hideBottomNav = handles.some((h) => h.hideBottomNav);
  const bleed = isHome || fullBleed;
  const darkTop = isHome || handles.some((h) => h.darkTop);
  const isShop = user?.role === 'MERCHANT' || user?.role === 'STAFF';
  // ชื่อ / ลำดับ / ซ่อน-แสดง แอดมินจัดที่ Backoffice /home-content (desktop กับมือถือแยกกัน)
  const nav = useSiteNav();
  // ฝั่งร้านไม่มีหน้าการจองของลูกค้า — ซ่อน "การจอง" (ร้านดูการจองที่ /merchant/bookings)
  const withoutBookings = (list: NavItem[]) => (isShop ? list.filter((n) => n.to !== '/bookings') : list);
  const items: NavItem[] = [
    ...withoutBookings(nav.desktop),
    ...(isShop ? [{ to: '/merchant', label: 'ร้านของฉัน' }] : []),
  ];

  return (
    // isolate ให้พื้นหลัง fixed -z-10 ของหน้า (<EmbersBackdrop> หน้าแรก · <MoltenBackground> /profile) อยู่เหนือพื้นของ Layout แต่หลังเนื้อหาทั้งหมด
    <Layout className={`min-h-dvh !bg-background ${isolate ? 'isolate' : ''}`}>
      <AgeGate />
      <header className={`sticky top-0 z-40 h-0 ${merchantShell ? 'hidden lg:block' : ''}`}>
        <div className="flex justify-center px-3 pt-3 md:pt-4">
          <Navbar items={items} overVideo={darkTop} />
        </div>
      </header>

      {bleed ? (
        <main className="flex-1">
          <Outlet />
        </main>
      ) : (
        <main
          className={`mx-auto w-full max-w-7xl flex-1 ${
            merchantShell ? 'px-0 pb-0 pt-0 lg:px-4 lg:pb-10 lg:pt-24' : 'px-4 pb-24 pt-24 md:pb-10'
          }`}
        >
          <AccountBannedBanner />
          <Outlet />
        </main>
      )}

      {!hideFooter && <SiteFooter />}

      {!merchantShell && !hideBottomNav && (
        <BottomIsland items={[...withoutBookings(nav.mobile), { to: '/profile', label: 'โปรไฟล์', icon: User }]} />
      )}
    </Layout>
  );
}
