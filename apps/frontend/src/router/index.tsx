import { createBrowserRouter, type RouteObject } from 'react-router';
import { AuthLayout } from '@/layouts/auth';
import { MainLayout } from '@/layouts/main';
import { MerchantLayout } from '@/layouts/merchant';
import { MerchantOnboardingLayout } from '@/layouts/merchantOnboarding';
import { RootLayout } from '@/layouts/root';
import { HomePage } from '@/modules/home/page';
import { RequireAuth, RequireBarRole, RequireRole } from './middleware';

// หมดเวลา / ปลดโต๊ะ (Forfeited) / แจ้งเตือน 15 นาทีก่อนเวลาจอง: ฐานข้อมูลจัดการเอง (pg_cron → run_booking_timeouts() ทุก 1 นาที)

/**
 * route ทั้งหมดตาม docs/SITEMAP.md
 * ทุกหน้ายกเว้น Home โหลดแบบ lazy (แยก chunk ต่อหน้า) — bundle แรกเล็กลง หน้าแรกขึ้นไว
 */
const routes: RouteObject[] = [
  // แผนที่เต็มจอ (ไม่มี navbar — มีปุ่มลอยของตัวเอง) ซ่อนไว้ก่อนตอนนี้ไม่ใช้
  { path: 'map', lazy: () => import('@/modules/map/page').then((m) => ({ Component: m.MapPage })) },
  // /login, /register, /forgot-password = redirect ไปหน้าหลักแล้วเปิด modal (ลิงก์เก่า + RequireAuth)
  {
    path: 'login',
    lazy: () => import('@/modules/login/page').then((m) => ({ Component: m.LoginPage })),
  },
  {
    path: 'register',
    lazy: () => import('@/modules/register/page').then((m) => ({ Component: m.RegisterPage })),
  },
  {
    path: 'forgot-password',
    lazy: () =>
      import('@/modules/forgotPassword/page').then((m) => ({ Component: m.ForgotPasswordPage })),
  },
  {
    element: <AuthLayout />,
    children: [
      {
        path: 'verify-email',
        lazy: () =>
          import('@/modules/verifyEmail/page').then((m) => ({ Component: m.VerifyEmailPage })),
      },
      {
        path: 'reset-password',
        lazy: () =>
          import('@/modules/resetPassword/page').then((m) => ({ Component: m.ResetPasswordPage })),
      },
      {
        // ล็อกอิน Google/Facebook ครั้งแรก: ยืนยันอายุจากวันเกิดของบัญชี + ยอมรับ ToS/PDPA ก่อนสร้างบัญชี
        path: 'signup/social',
        lazy: () =>
          import('@/modules/oauthSignup/page').then((m) => ({ Component: m.OAuthSignupPage })),
      },
      {
        path: 'accept-invite',
        lazy: () =>
          import('@/modules/acceptInvite/page').then((m) => ({ Component: m.AcceptInvitePage })),
      },
    ],
  },
  {
    element: <MainLayout />,
    children: [
      // ---- สาธารณะ ----
      { index: true, element: <HomePage /> },
      {
        path: 'ranking',
        handle: { fullBleed: true, hideFooter: true },
        lazy: () => import('@/modules/ranking/page').then((m) => ({ Component: m.RankingPage })),
      },
      {
        path: 'search',
        handle: { hideFooter: true },
        lazy: () => import('@/modules/search/page').then((m) => ({ Component: m.SearchPage })),
      },
      {
        path: 'bars/:slug',
        lazy: () =>
          import('@/modules/barDetail/page').then((m) => ({ Component: m.BarDetailPage })),
      },
      {
        path: 'bars/:slug/reviews',
        lazy: () =>
          import('@/modules/barReviews/page').then((m) => ({ Component: m.BarReviewsPage })),
      },
      // ชุมชน — อ่านได้ทุกคน (hideBottomNav: ช่องตอบติดขอบล่างแทนเมนูล่างบนมือถือ)
      {
        path: 'community',
        handle: { hideFooter: true },
        lazy: () =>
          import('@/modules/community/page').then((m) => ({ Component: m.CommunityPage })),
      },
      {
        path: 'community/c/:category',
        handle: { hideFooter: true },
        lazy: () =>
          import('@/modules/community/page').then((m) => ({ Component: m.CommunityPage })),
      },
      {
        path: 'community/t/:id',
        handle: { hideFooter: true, hideBottomNav: true },
        lazy: () =>
          import('@/modules/communityThread/page').then((m) => ({
            Component: m.CommunityThreadPage,
          })),
      },
      {
        path: 'share/:token',
        lazy: () => import('@/modules/share/page').then((m) => ({ Component: m.SharePage })),
      },
      {
        path: 'about',
        handle: { fullBleed: true, hideFooter: true, darkTop: true },
        lazy: () => import('@/modules/about/page').then((m) => ({ Component: m.AboutPage })),
      },
      {
        path: 'contact',
        handle: { fullBleed: true, hideFooter: true, darkTop: true },
        lazy: () => import('@/modules/about/page').then((m) => ({ Component: m.AboutPage })),
      },
      {
        path: 'terms',
        lazy: () =>
          import('@/modules/static/page').then((m) => ({
            Component: () => <m.StaticPage page="terms" />,
          })),
      },
      {
        path: 'privacy',
        lazy: () =>
          import('@/modules/static/page').then((m) => ({
            Component: () => <m.StaticPage page="privacy" />,
          })),
      },
      {
        path: 'cookies',
        lazy: () =>
          import('@/modules/static/page').then((m) => ({
            Component: () => <m.StaticPage page="cookies" />,
          })),
      },

      // ---- ลูกค้า (ต้องล็อกอิน) ----
      {
        element: <RequireAuth />,
        children: [
          {
            path: 'onboarding',
            lazy: () =>
              import('@/modules/onboarding/page').then((m) => ({ Component: m.OnboardingPage })),
          },
          {
            path: 'bars/:slug/book',
            lazy: () => import('@/modules/book/page').then((m) => ({ Component: m.BookPage })),
          },
          {
            path: 'bookings',
            handle: { hideFooter: true },
            lazy: () =>
              import('@/modules/bookings/page').then((m) => ({ Component: m.BookingsPage })),
          },
          {
            path: 'bookings/:id',
            lazy: () =>
              import('@/modules/bookingDetail/page').then((m) => ({
                Component: m.BookingDetailPage,
              })),
          },
          {
            path: 'bookings/:id/deposit',
            lazy: () =>
              import('@/modules/deposit/page').then((m) => ({ Component: m.DepositPage })),
          },
          {
            // หน้าชำระเงินจำลอง (PAYMENT_PROVIDER=mock) — ผู้ให้บริการจริงพาออกไปหน้าของเขาแทน
            path: 'pay/mock/:intentId',
            lazy: () =>
              import('@/modules/payMock/page').then((m) => ({ Component: m.PayMockPage })),
          },
          {
            path: 'reviews/new',
            lazy: () =>
              import('@/modules/reviewNew/page').then((m) => ({ Component: m.ReviewNewPage })),
          },
          {
            path: 'reviews',
            lazy: () =>
              import('@/modules/myReviews/page').then((m) => ({ Component: m.MyReviewsPage })),
          },
          {
            path: 'community/new',
            handle: { hideFooter: true, hideBottomNav: true },
            lazy: () =>
              import('@/modules/communityCompose/page').then((m) => ({
                Component: m.CommunityComposePage,
              })),
          },
          {
            path: 'community/t/:id/edit',
            handle: { hideFooter: true, hideBottomNav: true },
            lazy: () =>
              import('@/modules/communityCompose/page').then((m) => ({
                Component: m.CommunityComposePage,
              })),
          },
          {
            path: 'community/me',
            lazy: () =>
              import('@/modules/communityMe/page').then((m) => ({ Component: m.CommunityMePage })),
          },
          {
            path: 'favorites',
            lazy: () =>
              import('@/modules/favorites/page').then((m) => ({ Component: m.FavoritesPage })),
          },
          {
            path: 'notifications',
            lazy: () =>
              import('@/modules/notifications/page').then((m) => ({
                Component: m.NotificationsPage,
              })),
          },
          {
            path: 'profile',
            handle: { backdrop: true },
            lazy: () =>
              import('@/modules/profile/page').then((m) => ({ Component: m.ProfilePage })),
          },
          {
            path: 'settings',
            lazy: () =>
              import('@/modules/settings/page').then((m) => ({ Component: m.SettingsPage })),
          },
          // สมัครร้าน / สถานะการสมัคร — พื้นหลังเดียวกับหน้าร้าน
          {
            element: <MerchantOnboardingLayout />,
            children: [
              {
                path: 'merchant/join',
                handle: { merchantShell: true, hideFooter: true },
                lazy: () =>
                  import('@/modules/merchant/join/page').then((m) => ({
                    Component: m.MerchantJoinPage,
                  })),
              },
              {
                path: 'merchant/status',
                lazy: () =>
                  import('@/modules/merchant/status/page').then((m) => ({
                    Component: m.MerchantStatusPage,
                  })),
              },
            ],
          },

          // ---- ร้าน /merchant ----
          {
            element: <RequireRole roles={['MERCHANT', 'STAFF']} />,
            children: [
              {
                path: 'merchant',
                element: <MerchantLayout />,
                // merchantShell: มือถือใช้แถบบน/แท็บล่างของร้านแทน navbar ของเว็บ
                handle: { merchantShell: true },
                children: [
                  {
                    index: true,
                    handle: { hideFooter: true },
                    lazy: () =>
                      import('@/modules/merchant/dashboard/page').then((m) => ({
                        Component: m.MerchantDashboardPage,
                      })),
                  },
                  {
                    path: 'tonight',
                    handle: { hideFooter: true },
                    lazy: () =>
                      import('@/modules/merchant/tonight/page').then((m) => ({
                        Component: m.TonightPage,
                      })),
                  },
                  // ผังโต๊ะ: ทีมร้านทุกบทบาท (ไม่มียอดเงิน) · โพลทุก 10 วิ
                  {
                    path: 'floor',
                    handle: { hideFooter: true },
                    lazy: () =>
                      import('@/modules/merchant/floor/page').then((m) => ({
                        Component: m.MerchantFloorPage,
                      })),
                  },
                  {
                    path: 'bookings',
                    handle: { hideFooter: true },
                    lazy: () =>
                      import('@/modules/merchant/bookings/page').then((m) => ({
                        Component: m.MerchantBookingsPage,
                      })),
                  },
                  {
                    path: 'bookings/:id',
                    handle: { hideFooter: true },
                    lazy: () =>
                      import('@/modules/merchant/bookingDetail/page').then((m) => ({
                        Component: m.MerchantBookingDetailPage,
                      })),
                  },
                  // ตำแหน่งร้าน: ทีมร้านทุกบทบาทดูได้ (Staff/PR ดูอย่างเดียว) · แก้ได้เฉพาะเจ้าของ/ผู้จัดการ
                  {
                    path: 'location',
                    handle: { hideFooter: true },
                    lazy: () =>
                      import('@/modules/merchant/location/page').then((m) => ({
                        Component: m.MerchantLocationPage,
                      })),
                  },
                  // ร้าน: เจ้าของ / ผู้จัดการ เท่านั้น — Staff/PR เห็นเฉพาะคิว (แดชบอร์ด Lite · คืนนี้ · ผังโต๊ะ · การจอง) ห้ามเห็นเงินของร้าน
                  // ค่าคอม /merchant/billing ปิดไว้จนถึง Phase 2 (โมดูลยังอยู่ — เปิดคืนด้วยการเพิ่ม route)
                  {
                    element: <RequireBarRole roles={['OWNER', 'MANAGER']} />,
                    children: [
                      {
                        path: 'deposits',
                        handle: { hideFooter: true },
                        lazy: () =>
                          import('@/modules/merchant/deposits/page').then((m) => ({
                            Component: m.MerchantDepositsPage,
                          })),
                      },
                      {
                        path: 'store',
                        handle: { hideFooter: true },
                        lazy: () =>
                          import('@/modules/merchant/store/page').then((m) => ({
                            Component: m.MerchantStorePage,
                          })),
                      },
                      {
                        path: 'menu',
                        handle: { hideFooter: true },
                        lazy: () =>
                          import('@/modules/merchant/menu/page').then((m) => ({
                            Component: m.MerchantMenuPage,
                          })),
                      },
                      {
                        path: 'promotions',
                        handle: { hideFooter: true },
                        lazy: () =>
                          import('@/modules/merchant/promotions/page').then((m) => ({
                            Component: m.MerchantPromotionsPage,
                          })),
                      },
                      {
                        path: 'tables',
                        handle: { hideFooter: true },
                        lazy: () =>
                          import('@/modules/merchant/tables/page').then((m) => ({
                            Component: m.MerchantTablesPage,
                          })),
                      },
                      {
                        path: 'safety',
                        handle: { hideFooter: true },
                        lazy: () =>
                          import('@/modules/merchant/safety/page').then((m) => ({
                            Component: m.MerchantSafetyPage,
                          })),
                      },
                      {
                        path: 'settings',
                        handle: { hideFooter: true },
                        lazy: () =>
                          import('@/modules/merchant/settings/page').then((m) => ({
                            Component: m.MerchantSettingsPage,
                          })),
                      },
                      {
                        path: 'promote',
                        handle: { hideFooter: true },
                        lazy: () =>
                          import('@/modules/merchant/promote/page').then((m) => ({
                            Component: m.MerchantPromotePage,
                          })),
                      },
                      {
                        path: 'reviews',
                        handle: { hideFooter: true },
                        lazy: () =>
                          import('@/modules/merchant/reviews/page').then((m) => ({
                            Component: m.MerchantReviewsPage,
                          })),
                      },
                      {
                        path: 'analytics',
                        handle: { hideFooter: true },
                        lazy: () =>
                          import('@/modules/merchant/analytics/page').then((m) => ({
                            Component: m.MerchantAnalyticsPage,
                          })),
                      },
                      {
                        path: 'staff',
                        handle: { hideFooter: true },
                        lazy: () =>
                          import('@/modules/merchant/staff/page').then((m) => ({
                            Component: m.MerchantStaffPage,
                          })),
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        path: '*',
        handle: { fullBleed: true, hideFooter: true, darkTop: true },
        lazy: () => import('@/modules/notFound/page').then((m) => ({ Component: m.NotFoundPage })),
      },
    ],
  },
];

export const router = createBrowserRouter([{ element: <RootLayout />, children: routes }]);
