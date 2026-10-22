import {
  Bell,
  CalendarCheck,
  CaretDown,
  CaretRight,
  ChartLine,
  ChatCircleText,
  DotsThreeOutline,
  ForkKnife,
  Gauge,
  Gear,
  House,
  MapPin,
  Megaphone,
  QrCode,
  ShieldCheck,
  SquaresFour,
  Storefront,
  Table as TableIcon,
  Tag,
  UsersThree,
  Wallet,
} from '@phosphor-icons/react';
import { getBar } from '@/services/data';
import { Alert, Drawer, Dropdown } from 'antd';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/services/auth';
import { useDemo } from '@/hooks/useDemo';
import { barImage } from '@/ui/utils/barImage';
import { CrowdBadge } from '@/ui/components/crowdBadge';
import { EmbersBackdrop } from '@/ui/components/embersBackdrop';
import { InfoButton } from '@/ui/components/infoButton';
import './merchant.css';

interface NavItem {
  key: string;
  icon: ReactNode;
  label: string;
  staff?: boolean;
}

/** ปุ่มตรงบนแถบเมนู (ใช้บ่อย) */
const PRIMARY: NavItem[] = [
  { key: '/merchant', icon: <Gauge />, label: 'แดชบอร์ด', staff: true },
  { key: '/merchant/tonight', icon: <QrCode />, label: 'คืนนี้', staff: true },
  { key: '/merchant/floor', icon: <SquaresFour />, label: 'ผังโต๊ะ', staff: true },
  { key: '/merchant/bookings', icon: <CalendarCheck />, label: 'การจอง', staff: true },
  { key: '/merchant/deposits', icon: <Wallet />, label: 'Table Fee' },
];

/** ตำแหน่งร้าน — ทีมร้านทุกบทบาทดูได้ (Staff ดูอย่างเดียว · เห็นเป็นปุ่มบนแถบ Desktop) */
const LOCATION_ITEM: NavItem = { key: '/merchant/location', icon: <MapPin />, label: 'ตำแหน่งร้าน', staff: true };

/** กลุ่ม dropdown — ร้าน / การตลาด / ธุรกิจ */
const GROUPS: { key: string; icon: ReactNode; label: string; items: NavItem[] }[] = [
  {
    key: 'store',
    icon: <Storefront />,
    label: 'ร้าน',
    items: [
      { key: '/merchant/store', icon: <Storefront />, label: 'ข้อมูลร้าน' },
      LOCATION_ITEM,
      { key: '/merchant/menu', icon: <ForkKnife />, label: 'เมนู' },
      { key: '/merchant/tables', icon: <TableIcon />, label: 'โซน / โต๊ะ' },
      { key: '/merchant/safety', icon: <ShieldCheck />, label: 'ความปลอดภัย' },
      { key: '/merchant/promotions', icon: <Tag />, label: 'โปรโมชัน' },
      { key: '/merchant/settings', icon: <Gear />, label: 'ตั้งค่าการจอง' },
    ],
  },
  {
    key: 'marketing',
    icon: <Megaphone />,
    label: 'การตลาด',
    items: [
      { key: '/merchant/promote', icon: <Megaphone />, label: 'โปรโมทร้าน' },
      { key: '/merchant/reviews', icon: <ChatCircleText />, label: 'รีวิว' },
    ],
  },
  {
    key: 'business',
    icon: <ChartLine />,
    label: 'ธุรกิจ',
    items: [
      { key: '/merchant/analytics', icon: <ChartLine />, label: 'สถิติ' },
      { key: '/merchant/staff', icon: <UsersThree />, label: 'พนักงาน' },
    ],
  },
];

/** หน้าที่อยู่ใต้ "เพิ่มเติม" บนมือถือ (ที่เหลือจากแท็บ) + ทางกลับเว็บหลัก */
const MORE_ITEMS: NavItem[] = [
  { key: '/merchant/floor', icon: <SquaresFour />, label: 'ผังโต๊ะ' },
  PRIMARY.find((i) => i.key === '/merchant/deposits')!,
  ...GROUPS[1]!.items,
  ...GROUPS[2]!.items,
  { key: '/', icon: <House />, label: 'กลับหน้าหลัก NightOut' },
];

const isActive = (path: string, key: string) =>
  key === '/merchant' ? path === key : path === key || path.startsWith(`${key}/`);

/** หน้าที่มีแถบปุ่มล่างของตัวเอง → ซ่อนแท็บล่าง */
const OWN_BOTTOM_BAR = /^\/merchant\/bookings\/[^/]+$/;

/**
 * บัญชีชั้นร้านที่ยังไม่มีร้านในทีม (เช่น แอดมินตั้งชั้นบัญชีก่อนผูกร้าน) — บอกทางไปต่อ 2 ทาง: เปิดร้านใหม่ / ตอบรับคำเชิญ
 */
function NoBarLinked() {
  const choices = [
    {
      to: '/merchant/join',
      icon: <Storefront weight="fill" />,
      title: 'เปิดร้านใหม่',
      desc: 'กรอกข้อมูลร้าน ปักหมุด แล้วส่งให้ทีม NightOut ตรวจ ใช้เวลา 1–2 วันทำการ',
    },
    {
      to: '/accept-invite',
      icon: <UsersThree weight="fill" />,
      title: 'เข้าร่วมทีมร้าน',
      desc: 'ดูคำเชิญจากเจ้าของหรือผู้จัดการร้าน แล้วกดตอบรับ',
    },
  ];
  return (
    <div className="embers-glass relative isolate min-w-0 px-4 py-10 lg:py-16">
      <EmbersBackdrop />
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div className="flex flex-col items-start gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-gold/15 text-2xl text-gold-text">
            <Storefront weight="fill" />
          </span>
          <h1 className="m-0 font-display text-2xl font-bold lg:text-[30px]">บัญชีนี้ยังไม่มีร้าน</h1>
          <p className="m-0 text-sm text-muted">
            เปิดร้านของคุณเองกับ NightOut หรือถ้าร้านเชิญคุณเข้าทีมแล้ว ตอบรับคำเชิญเพื่อเริ่มใช้งาน
          </p>
        </div>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {choices.map((c) => (
            <li key={c.to}>
              <Link
                to={c.to}
                className="group flex items-center gap-4 rounded-[20px] border border-border bg-card p-4 !text-text transition-colors md:hover:border-gold/60"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-xl text-gold-text">
                  {c.icon}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="font-semibold">{c.title}</b>
                  <span className="text-[13px] text-muted">{c.desc}</span>
                </span>
                <CaretRight className="shrink-0 text-muted transition-transform md:group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="m-0 text-xs text-muted">
          ถ้าบัญชีนี้ควรมีร้านอยู่แล้ว <Link to="/about">ติดต่อทีม NightOut</Link>
        </p>
      </div>
    </div>
  );
}

/** Layout ฝั่งร้าน — Desktop แถบแคปซูลใต้ navbar · มือถือแถบบน + แท็บล่าง 5 ช่อง · Staff เห็นแค่ แดชบอร์ด Lite · คืนนี้ · ผังโต๊ะ · การจอง */
export function MerchantLayout() {
  useDemo();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<'store' | 'more' | null>(null);
  const bar = user?.barId ? getBar(user.barId) : null;
  if (!bar) return <NoBarLinked />;
  const isStaff = bar.staffRole === 'STAFF';
  // Staff ไม่มี dropdown "ร้าน" → ตำแหน่งร้านเป็นปุ่มบนแถบ (มือถือ: เข้าจากลิงก์ในแจ้งเตือน)
  const primary = isStaff ? [...PRIMARY.filter((i) => i.staff), LOCATION_ITEM] : PRIMARY;
  const groups = isStaff ? [] : GROUPS;
  const go = (key: string) => {
    setSheet(null);
    navigate(key);
  };

  const pill = (active: boolean) =>
    `merchant-pill inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-[7px] text-[13px] ${
      active ? 'border-gold bg-gold font-semibold text-on-gold' : 'border-border text-muted hover:text-text'
    }`;

  const tabs: { key: string; icon: ReactNode; label: string; center?: boolean }[] = isStaff
    ? [
        { key: '/merchant', icon: <Gauge />, label: 'แดชบอร์ด' },
        { key: '/merchant/bookings', icon: <CalendarCheck />, label: 'การจอง' },
        { key: '/merchant/tonight', icon: <QrCode />, label: 'คืนนี้', center: true },
        { key: '/merchant/floor', icon: <SquaresFour />, label: 'ผังโต๊ะ' },
        { key: '/', icon: <House />, label: 'หน้าหลัก' },
      ]
    : [
        { key: '/merchant', icon: <Gauge />, label: 'แดชบอร์ด' },
        { key: '/merchant/bookings', icon: <CalendarCheck />, label: 'การจอง' },
        { key: '/merchant/tonight', icon: <QrCode />, label: 'คืนนี้', center: true },
        { key: 'store', icon: <Storefront />, label: 'ร้าน' },
        { key: 'more', icon: <DotsThreeOutline />, label: 'เพิ่มเติม' },
      ];
  const sheetItems = sheet === 'store' ? GROUPS[0]!.items : MORE_ITEMS;
  const showTabs = !OWN_BOTTOM_BAR.test(pathname);
  const crowdPill = (
    <span className="merchant-glass-pill inline-flex items-center rounded-full border border-border px-3 py-1">
      <CrowdBadge crowd={bar.crowd} updatedAt={bar.crowdUpdatedAt} showTime />
    </span>
  );

  return (
    <div className="merchant-layout embers-glass relative isolate min-w-0">
      {/* พื้นหลัง Golden Embers ครอบทุกหน้าใต้ /merchant (ธีมมืด) + การ์ด/เมนูเป็นกระจก (embers-glass) */}
      <EmbersBackdrop />
      {/* มือถือ — แถบบนของร้าน */}
      <header className="merchant-appbar sticky top-0 z-40 flex h-14 items-center gap-2.5 border-b border-border bg-surface/95 px-4 backdrop-blur dark:bg-surface/60 dark:backdrop-blur-xl lg:hidden">
        <span
          aria-hidden
          className="size-[30px] shrink-0 rounded-[9px] bg-cover bg-center"
          style={{ backgroundImage: `url(${barImage(bar)})` }}
        />
        <b className="min-w-0 flex-1 truncate text-[15px]">{bar.name}</b>
        <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs">
          <CrowdBadge crowd={bar.crowd} updatedAt={bar.crowdUpdatedAt} />
        </span>
        <Link to="/notifications?view=merchant" aria-label="การแจ้งเตือน" className="grid size-10 place-items-center text-xl text-text">
          <Bell />
        </Link>
      </header>

      {/* Desktop — แถบเมนูร้าน: ปุ่มตรง + dropdown 3 กลุ่ม + สถานะร้านขวาสุด */}
      <nav aria-label="เมนูร้าน" className="mb-4 hidden items-center gap-1.5 lg:flex">
        {primary.map((i) => (
          <NavLink key={i.key} to={i.key} end={i.key === '/merchant'} className={() => pill(isActive(pathname, i.key))}>
            {i.icon}
            {i.label}
          </NavLink>
        ))}
        {groups.map((g) => {
          const current = g.items.find((i) => isActive(pathname, i.key));
          return (
            <Dropdown
              key={g.key}
              trigger={['click']}
              menu={{
                items: g.items.map((i) => ({ key: i.key, icon: i.icon, label: i.label })),
                selectedKeys: current ? [current.key] : [],
                onClick: (e) => navigate(e.key),
              }}
            >
              <button type="button" className={pill(!!current)}>
                {g.icon}
                {current ? (
                  <>
                    <span className="opacity-70">{g.label}</span> {current.label}
                  </>
                ) : (
                  g.label
                )}
                <CaretDown size={11} />
              </button>
            </Dropdown>
          );
        })}
        <span className="ml-auto text-[13px]">{crowdPill}</span>
      </nav>

      <section className={`merchant-content min-w-0 px-4 pt-4 lg:px-0 lg:pt-0 ${showTabs ? 'pb-28' : 'pb-32'} lg:pb-0`}>
        {(bar.status === 'PENDING_REVIEW' || bar.status === 'DRAFT') && (
          <div className="mb-4">
            <InfoButton label="ร้านกำลังรอตรวจ" title="ร้านกำลังรอทีม NightOut ตรวจ">
              <p>
                ลูกค้ายังไม่เห็นร้านของคุณ ระหว่างนี้เตรียมข้อมูลร้าน เมนู โต๊ะ และตั้งค่าการจองไว้ได้
              </p>
              {bar.statusReason && <p className="mt-2">{bar.statusReason}</p>}
            </InfoButton>
          </div>
        )}
        {bar.status !== 'APPROVED' && bar.status !== 'PENDING_REVIEW' && bar.status !== 'DRAFT' && (
          <Alert
            className="!mb-4"
            showIcon
            type="warning"
            title={
              bar.status === 'REJECTED'
                ? 'ร้านยังไม่ผ่านการตรวจ — ลูกค้ายังไม่เห็นร้าน'
                : 'ร้านถูกระงับชั่วคราว — ลูกค้าไม่เห็นร้านและจองไม่ได้'
            }
            description={bar.statusReason}
          />
        )}
        <Outlet context={bar} />
      </section>

      {/* มือถือ — แท็บล่าง 5 ช่อง: "คืนนี้" อยู่กลางและเด่นที่สุด */}
      {showTabs && (
        <nav
          aria-label="เมนูร้านบนมือถือ"
          className="merchant-tabbar fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-surface px-2 lg:hidden"
        >
          {tabs.map((t) => {
            const group = t.key === 'store' ? GROUPS[0]!.items : t.key === 'more' ? MORE_ITEMS : null;
            const active = group ? group.some((i) => isActive(pathname, i.key)) : isActive(pathname, t.key);
            return (
              <button
                key={t.key}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => (group ? setSheet(t.key as 'store' | 'more') : go(t.key))}
                className={`merchant-tab flex w-16 flex-col items-center gap-0.5 text-[11px] ${
                  active ? 'text-gold' : 'text-muted'
                }`}
              >
                <span
                  className={`grid place-items-center rounded-full text-[22px] ${
                    t.center ? '-mt-6 size-[52px] bg-gold text-on-gold shadow-glow' : 'size-7'
                  }`}
                >
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </nav>
      )}

      <Drawer
        placement="bottom"
        size="auto"
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet === 'store' ? 'ร้าน' : 'เพิ่มเติม'}
        className="merchant-sheet"
      >
        <ul className="m-0 grid list-none gap-1 p-0">
          {sheetItems.map((i) => (
            <li key={i.key}>
              <button
                type="button"
                onClick={() => go(i.key)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-base ${
                  isActive(pathname, i.key) ? 'bg-gold/10 text-gold' : 'text-text'
                }`}
              >
                <span className="text-xl">{i.icon}</span>
                {i.label}
              </button>
            </li>
          ))}
        </ul>
      </Drawer>
    </div>
  );
}
