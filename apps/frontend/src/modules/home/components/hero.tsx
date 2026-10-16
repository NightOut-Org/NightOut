import { CaretDown, MagnifyingGlass, MapPin, UsersThree, Wallet } from '@phosphor-icons/react';
import { budgetSearchQuery, MAX_GROUP_SIZE, SEARCH_BUDGET_PRESETS } from '@nightout/utils';
import { DISTRICTS, type BarWithTier } from '@/services/data';
import { baht } from '@/ui/utils/format';
import { type SiteHomeContent } from '../api';
import type { HomeCategory } from '../type/category';
import { Dropdown } from 'antd';
import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { HeroSuggest } from './heroSuggest';
import { SkyBackdrop } from './skyBackdrop';

const HERE = 'ตำแหน่งปัจจุบัน';
/** key ของตัวเลือก "ไม่กรอง" ในเมนูงบ / จำนวนคน */
const ANY = 'any';

const BUDGET_ITEMS = [
  { key: ANY, label: 'ไม่จำกัดงบ' },
  ...SEARCH_BUDGET_PRESETS.map((v) => ({ key: String(v), label: `ไม่เกิน ${baht(v)} / คน` })),
];
const PEOPLE_ITEMS = [
  { key: ANY, label: 'ไม่ระบุ' },
  ...Array.from({ length: MAX_GROUP_SIZE }, (_, i) => ({ key: String(i + 1), label: `${i + 1} คน` })),
];
const fromKey = (key: string) => (key === ANY ? undefined : Number(key));

/**
 * Hero (Figma: Main → Hero) — ภาพท้องฟ้ายามค่ำ + motion เบา ๆ เต็มจอ (<SkyBackdrop>)
 * หัวข้อ 3 ท่อน เช่น "คืนนี้ไป | ร้านไหน | ดี" (ตัวกลางใหญ่สีทอง) + ช่องค้นหากระจก มีเลือกย่าน · งบต่อหัว · จำนวนคน
 * (requirement "ค้นหาตามงบ" เช่น 8 คน ไม่เกินคนละ 400 → /search?budget=400&people=8 · สร้าง query ด้วย budgetSearchQuery)
 * ข้อความ/ภาพมาจาก content (แอดมินแก้ได้ · ดู useHomeContent) · ยังไม่มา = skeleton แทนหัวข้อ (ช่องค้นหาใช้ได้เลย)
 * ช่องพิมพ์ = <HeroSuggest> (แผงแนะนำประเภทร้าน / สไตล์ / ร้านยอดนิยม ใต้ช่องค้นหา)
 */
export function Hero({
  content: c,
  categories,
  popularBars,
  failed = false,
  onRetry,
}: {
  content?: Omit<SiteHomeContent, 'updated_at'>;
  /** การ์ดหมวดหน้าแรก — แผงแนะนำใช้การ์ดที่ลิงก์ ?category= / ?style= */
  categories?: HomeCategory[];
  /** ร้านยอดนิยม (utils/popularBars) — แผงแนะนำแสดง 4 ร้านแรก */
  popularBars: BarWithTier[];
  /** โหลดเนื้อหาไม่สำเร็จ → แสดงข้อความ + ปุ่มลองใหม่แทน skeleton */
  failed?: boolean;
  onRetry?: () => void;
}) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [area, setArea] = useState(HERE);
  const [budget, setBudget] = useState<number>();
  const [people, setPeople] = useState<number>();
  const district = area !== HERE ? area : undefined;

  return (
    <section className="relative isolate flex min-h-[540px] items-center overflow-hidden bg-[#07070d] pb-24 pt-20 md:min-h-[620px] md:pb-32 md:pt-24">
      {/* ยังไม่รู้ภาพ Hero จาก API → แสดงแค่พื้นสีกลางคืน (ไม่โหลดภาพตั้งต้นทิ้งแล้วสลับกลางคัน) */}
      <SkyBackdrop imageUrl={c?.hero_image_url} pending={!c} />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
      {/* ขอบล่างไล่เข้าสีพื้น — ธีมสว่าง: สีพื้นเรียบ · ธีมมืด: #07070d (Hero ทึบ แสงพื้นหลัง <EmbersBackdrop> ใน page.tsx ห้ามล้นเข้ามา) */}
      <div className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-background to-transparent dark:hidden" />
      <div className="absolute inset-x-0 bottom-0 -z-10 hidden h-40 bg-gradient-to-t from-[#07070d] to-transparent dark:block" />

      <div className="mx-auto flex w-full max-w-7xl flex-col items-center px-4 text-center md:px-8">
        {c ? (
          <>
            <h1 className="flex items-end justify-center gap-x-2 font-bold leading-none text-white md:gap-x-5">
              <span className="shrink-0 pb-[0.35em] text-xl drop-shadow sm:text-3xl md:text-5xl">
                {c.hero_title_lead}
              </span>
              <span className="bg-gradient-to-b from-[#ffe39a] via-gold to-[#b9832a] -mt-[0.3em] bg-clip-text pb-[0.1em] pt-[0.3em] text-[3.9rem] leading-[1.1] text-transparent sm:text-[5.5rem] drop-shadow-[0_4px_24px_rgba(232,182,76,0.35)] md:text-[9rem]">
                {c.hero_title_highlight}
              </span>
              {c.hero_title_tail && (
                <span className="shrink-0 pb-[0.35em] text-xl drop-shadow sm:text-3xl md:text-5xl">
                  {c.hero_title_tail}
                </span>
              )}
            </h1>
            {c.hero_subtitle && (
              <p className="mt-4 max-w-xl text-balance text-base text-white/80 md:text-lg">
                {c.hero_subtitle}
              </p>
            )}
          </>
        ) : failed ? (
          <div role="alert" className="flex flex-col items-center gap-4 text-white">
            <p className="max-w-md text-balance text-base text-white/80 md:text-lg">
              โหลดเนื้อหาหน้าแรกไม่สำเร็จ ตรวจการเชื่อมต่อแล้วลองใหม่
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-white/25 px-5 py-2 text-sm font-semibold text-white transition select-none hover:bg-white/10 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              ลองใหม่
            </button>
          </div>
        ) : (
          <HeroTitleSkeleton />
        )}

        <form
          ref={formRef}
          role="search"
          className="mt-8 flex w-full max-w-4xl flex-wrap items-center text-left gap-2 rounded-lg border sm:flex-nowrap border-white/15 bg-white/10 p-1.5 pl-5 shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get('q')?.toString() ?? '';
            // "ตำแหน่งปัจจุบัน" = ไม่กรองย่าน แต่เรียงร้านใกล้ผู้ใช้ก่อน (/search ขอตำแหน่งเอง · ไม่ใส่พิกัดใน URL)
            const qs = [budgetSearchQuery({ q, district, budget, people }), area === HERE ? 'sort=distance' : '']
              .filter(Boolean)
              .join('&');
            navigate(`/search${qs ? `?${qs}` : ''}`);
          }}
        >
          <MagnifyingGlass size={20} className="shrink-0 text-white/70" aria-hidden />
          <HeroSuggest
            anchorRef={formRef}
            placeholder={c?.hero_search_placeholder}
            categories={categories}
            popularBars={popularBars}
            filterQuery={budgetSearchQuery({ district, budget, people })}
          />
          {/* มือถือ: แถวล่างเต็มกว้าง 3 ช่อง (ย่าน · งบ · คน) · sm+: อยู่ในแถวเดียวกัน คั่นด้วยเส้นตั้ง */}
          <div className="order-last -ml-3.5 grid w-[calc(100%+0.875rem)] grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-1.5 sm:order-none sm:ml-0 sm:flex sm:w-auto sm:shrink-0 sm:items-center sm:divide-x-0 sm:border-t-0 sm:pt-0">
            <span className="hidden h-7 w-px shrink-0 bg-white/20 sm:block" aria-hidden />
            <HeroSelect
              icon={<MapPin size={18} weight="fill" className="shrink-0 text-gold" />}
              label={area}
              ariaLabel={`ย่าน: ${area}`}
              selected={area}
              items={[HERE, ...DISTRICTS].map((d) => ({ key: d, label: d }))}
              onSelect={setArea}
              className="sm:max-w-40"
            />
            <span className="hidden h-7 w-px shrink-0 bg-white/20 sm:block" aria-hidden />
            <HeroSelect
              icon={<Wallet size={18} weight="fill" className="shrink-0 text-gold" />}
              label={budget ? `≤ ${baht(budget)}/คน` : 'งบต่อหัว'}
              ariaLabel={`งบต่อหัว: ${budget ? `ไม่เกิน ${baht(budget)}` : 'ไม่จำกัด'}`}
              selected={budget ? String(budget) : ANY}
              items={BUDGET_ITEMS}
              onSelect={(key) => setBudget(fromKey(key))}
            />
            <span className="hidden h-7 w-px shrink-0 bg-white/20 sm:block" aria-hidden />
            <HeroSelect
              icon={<UsersThree size={18} weight="fill" className="shrink-0 text-gold" />}
              label={people ? `${people} คน` : 'จำนวนคน'}
              ariaLabel={`จำนวนคน: ${people ? `${people} คน` : 'ไม่ระบุ'}`}
              selected={people ? String(people) : ANY}
              items={PEOPLE_ITEMS}
              onSelect={(key) => setPeople(fromKey(key))}
            />
          </div>
          <button
            type="submit"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-on-gold transition select-none hover:bg-gold-highlight active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold md:px-7"
          >
            <MagnifyingGlass size={16} weight="bold" />
            ค้นหา
          </button>
        </form>
        {/* งบรวมของกลุ่ม (ค่าประเมิน — จองล่วงหน้าเฉพาะโต๊ะ) · เว้นที่ไว้ หน้าไม่กระโดดตอนข้อความขึ้น */}
        <p aria-live="polite" className="mt-3 min-h-5 text-sm text-white/75">
          {budget && people ? `${people} คน · ไม่เกินคนละ ${baht(budget)} · รวมประมาณ ${baht(budget * people)}` : ''}
        </p>
      </div>
    </section>
  );
}

/** ปุ่มเลือกในช่องค้นหา (ย่าน / งบ / จำนวนคน) — เมนู antd Dropdown · สูง ≥44px ให้แตะง่ายบนมือถือ */
function HeroSelect({
  icon,
  label,
  ariaLabel,
  selected,
  items,
  onSelect,
  className = '',
}: {
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  selected: string;
  items: { key: string; label: string }[];
  onSelect: (key: string) => void;
  className?: string;
}) {
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        selectable: true,
        selectedKeys: [selected],
        onClick: ({ key }) => onSelect(key),
        items,
        // เมนูย่าน / จำนวนคนยาว — เลื่อนในเมนูเอง ไม่ล้นจอ
        className: 'max-h-[min(22rem,60vh)] overflow-y-auto overscroll-contain',
      }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        className={`flex min-h-11 min-w-0 touch-manipulation items-center justify-center gap-1.5 px-2 text-[13px] text-white/85 transition-colors select-none hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-gold sm:justify-start sm:rounded-full sm:px-3 sm:text-sm ${className}`}
      >
        {icon}
        <span className="truncate">{label}</span>
        <CaretDown size={14} className="hidden shrink-0 sm:block" aria-hidden />
      </button>
    </Dropdown>
  );
}

/** แทนหัวข้อ + คำโปรยระหว่างรอ API — สูงใกล้ของจริง หน้าไม่กระโดดตอนข้อมูลมา */
function HeroTitleSkeleton() {
  return (
    <div role="status" aria-label="กำลังโหลด" className="flex w-full flex-col items-center motion-safe:animate-pulse">
      <div className="flex items-end gap-x-2 md:gap-x-5">
        <span className="mb-[0.6em] h-6 w-16 rounded-md bg-white/10 sm:h-8 sm:w-24 md:h-12 md:w-40" />
        <span className="h-[3.6rem] w-36 rounded-xl bg-gold/15 sm:h-[5rem] sm:w-52 md:h-[8.5rem] md:w-96" />
        <span className="mb-[0.6em] h-6 w-8 rounded-md bg-white/10 sm:h-8 sm:w-10 md:h-12 md:w-16" />
      </div>
      <span className="mt-5 h-4 w-72 max-w-full rounded bg-white/10 md:h-5 md:w-[28rem]" />
      <span className="mt-2 h-4 w-48 rounded bg-white/10 md:h-5 md:w-72" />
    </div>
  );
}
