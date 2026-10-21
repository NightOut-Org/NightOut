import {
  ArrowRight,
  Check,
  CheckCircle,
  Circle,
  CircleHalf,
  ImageSquare,
  WarningCircle,
} from '@phosphor-icons/react';
import { isLegacyDefaultPin } from '@nightout/utils';
import { Button, Empty, Result } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { CATEGORY_LABELS, getBar, type BarWithTier } from '@/services/data';
import { useAuth } from '@/services/auth';
import { useDemo } from '@/hooks/useDemo';
import { PageHeader } from '@/ui/components/pageHeader';
import { usePinArea } from './api';

type Progress = 'done' | 'partial' | 'todo';

interface Task {
  to: string;
  title: string;
  /** สิ่งที่ขาดอยู่ (ภาษาคน) · ครบแล้ว = สรุปสิ่งที่มี */
  detail: string;
  progress: Progress;
  /** ชื่อปุ่ม = สิ่งที่จะได้ทำเมื่อกด */
  action: string;
}

/** แนะนำให้มีเมนูอย่างน้อยเท่านี้ ลูกค้าถึงประเมินงบได้ */
const MENU_SUGGESTED = 20;

const listThai = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(' ')} และ${items.at(-1)}`;

/** "ทองหล่อ, วัฒนา" — ย่าน + อำเภอ/เขตจากหมุด (ไม่มีย่าน = อำเภอ + จังหวัด) · amphoe/province = จาก GET /public/area เมื่อร้านยังไม่แสดง */
const placeOf = (bar: BarWithTier, pin?: { amphoe?: string; province?: string }) => {
  const amphoe = bar.area?.amphoe ?? pin?.amphoe;
  const province = bar.area?.province ?? pin?.province;
  return [bar.district || amphoe, bar.district ? amphoe : province]
    .filter((x, i, arr) => !!x && arr.indexOf(x) === i)
    .join(', ');
};

/**
 * งานเตรียมร้าน (คำนวณจากข้อมูลที่ร้านกรอกแล้ว)
 * · ต้องมีก่อนลูกค้าจองได้: หมุดจริง (ทีมอนุมัติร้านไม่ได้ถ้ายังไม่ปัก · BAR_LOCATION_NOT_SET) · โซนอย่างน้อย 1 โซน
 * · ระหว่างรอ: ข้อมูลร้าน · เมนูและราคา · ความปลอดภัย (มีผลต่อดาว)
 */
function tasks(bar: BarWithTier, place: string): { required: Task[]; helpful: Task[] } {
  const legacyPin = isLegacyDefaultPin(bar.lat, bar.lng);
  const zones = bar.zones.length;
  const infoParts: [boolean, string][] = [
    [!!bar.coverUrl || !!bar.gallery?.length, 'รูปร้าน'],
    [bar.hours.some((h) => !h.closed), 'เวลาเปิด-ปิด'],
    [!!bar.description, 'คำอธิบายร้าน'],
    [bar.styles.length > 0, 'สไตล์ร้าน'],
  ];
  const infoMissing = infoParts.filter(([ok]) => !ok).map(([, label]) => label);
  const menu = bar.menu.length;
  const safetyYes = bar.safety.filter((s) => s.value === 'YES').length;
  const safetyTotal = Math.max(bar.safety.length, 9);
  const of = (done: boolean, started: boolean): Progress =>
    done ? 'done' : started ? 'partial' : 'todo';
  return {
    required: [
      {
        to: '/merchant/location',
        title: 'ตำแหน่งร้าน',
        detail: legacyPin
          ? 'ยังไม่ได้ปักหมุด ทีมอนุมัติร้านไม่ได้จนกว่าจะปัก'
          : `ปักหมุดแล้ว ${place}`.trim(),
        progress: legacyPin ? 'todo' : 'done',
        action: legacyPin ? 'ปักหมุด' : 'ดู',
      },
      {
        to: '/merchant/tables',
        title: 'โซนและโต๊ะ',
        detail: zones ? `มี ${zones} โซน` : 'ยังไม่มีโซน ต้องเพิ่มอย่างน้อย 1 โซน',
        progress: zones ? 'done' : 'todo',
        action: zones ? 'ดู' : 'เพิ่มโซน',
      },
    ],
    helpful: [
      {
        to: '/merchant/store',
        title: 'ข้อมูลร้าน',
        detail: infoMissing.length
          ? `ยังขาด${listThai(infoMissing)}`
          : 'มีรูป เวลาเปิด-ปิด คำอธิบาย และสไตล์ครบ',
        progress: of(!infoMissing.length, infoMissing.length < infoParts.length),
        action: infoMissing.length ? 'เติม' : 'แก้',
      },
      {
        to: '/merchant/menu',
        title: 'เมนูและราคา',
        detail: menu
          ? menu >= MENU_SUGGESTED
            ? `${menu} รายการ`
            : `${menu} รายการ แนะนำอย่างน้อย ${MENU_SUGGESTED}`
          : 'ยังไม่มีเมนู ลูกค้าดูราคาก่อนไปไม่ได้',
        progress: of(menu >= MENU_SUGGESTED, menu > 0),
        action: 'เพิ่มเมนู',
      },
      {
        to: '/merchant/safety',
        title: 'ความปลอดภัย',
        detail:
          safetyYes >= safetyTotal
            ? `ครบ ${safetyTotal} ข้อ`
            : `มี ${safetyYes} จาก ${safetyTotal} ข้อ มีผลต่อดาวของร้าน`,
        progress: of(safetyYes >= safetyTotal, safetyYes > 0),
        action: 'กรอก',
      },
    ],
  };
}

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold';

/** สถานะของงานแต่ละแถว · required = งานที่ต้องมี (ยังไม่ทำ = เตือนสีทอง) */
function TaskMark({ progress, required }: { progress: Progress; required?: boolean }) {
  if (progress === 'done')
    return (
      <CheckCircle
        weight="fill"
        className="text-(--crowd-available)"
        role="img"
        aria-label="ครบแล้ว"
      />
    );
  if (progress === 'partial')
    return <CircleHalf weight="fill" className="text-gold" role="img" aria-label="ทำไปบางส่วน" />;
  return required ? (
    <WarningCircle weight="fill" className="text-gold" role="img" aria-label="ยังไม่ได้ทำ" />
  ) : (
    <Circle className="text-muted" role="img" aria-label="ยังไม่ได้ทำ" />
  );
}

function TaskRow({ t, required }: { t: Task; required?: boolean }) {
  const open = t.progress !== 'done';
  const action = required ? (
    open ? (
      <Link
        to={t.to}
        className={`rounded-xl bg-gold px-4 py-2.5 text-[13px] font-semibold text-on-gold transition-colors hover:bg-gold/90 ${focusRing}`}
      >
        {t.action}
      </Link>
    ) : (
      <Link
        to={t.to}
        className={`rounded-md px-1 text-[13px] text-link hover:underline ${focusRing}`}
      >
        {t.action}
      </Link>
    )
  ) : (
    <Link
      to={t.to}
      className={`inline-flex items-center gap-1 rounded-md px-1 text-[13px] font-semibold text-gold-text hover:underline ${focusRing}`}
    >
      {t.action}
      <ArrowRight aria-hidden />
    </Link>
  );
  return (
    <li className="flex items-center gap-3.5 border-t border-border px-4 py-3.5 first:border-t-0">
      <span className="shrink-0 text-xl leading-none">
        <TaskMark progress={t.progress} required={required} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-sm font-semibold">{t.title}</b>
        <span
          className={`text-[13px] leading-relaxed text-pretty ${required && open ? 'text-gold-text' : 'text-muted'}`}
        >
          {t.detail}
        </span>
      </span>
      <span className="shrink-0">{action}</span>
    </li>
  );
}

type StepState = 'done' | 'now' | 'next';

/** จุดบนเส้นเวลา: เสร็จ = ทอง+เครื่องหมายถูก · ขั้นปัจจุบัน = วงทองมีแสง · ถัดไป = ตัวเลข */
function StepDot({ state, n }: { state: StepState; n: number }) {
  if (state === 'done')
    return (
      <span className="grid size-8 place-items-center rounded-full bg-gold text-on-gold">
        <Check weight="bold" />
      </span>
    );
  if (state === 'now')
    return (
      <span className="grid size-8 place-items-center rounded-full border-2 border-gold bg-background shadow-[0_0_0_6px_color-mix(in_srgb,var(--gold)_16%,transparent)]">
        <span className="size-2.5 rounded-full bg-gold" />
      </span>
    );
  return (
    <span className="grid size-8 place-items-center rounded-full border border-border bg-background text-[13px] text-muted">
      {n}
    </span>
  );
}

/** ขั้นตอน 1 ขั้น: จุด + เส้นต่อลงไป (เส้นทองถ้าขั้นนี้ผ่านแล้ว) · เนื้อหาย่อยอยู่ใต้หัวข้อ */
function Step({
  n,
  state,
  title,
  sub,
  last,
  children,
}: {
  n: number;
  state: StepState;
  title: string;
  sub: string;
  last?: boolean;
  children?: ReactNode;
}) {
  return (
    <li
      className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-4"
      aria-current={state === 'now' ? 'step' : undefined}
    >
      <span className="flex flex-col items-center">
        <StepDot state={state} n={n} />
        {!last && (
          <span
            className={`my-1.5 w-0.5 flex-1 rounded-full ${state === 'done' ? 'bg-gold' : 'bg-border'}`}
          />
        )}
      </span>
      <div className={`flex min-w-0 flex-col ${last ? '' : 'pb-8'}`}>
        <h2
          className={`m-0 pt-1 text-[17px] font-semibold ${state === 'next' ? 'text-muted' : ''}`}
        >
          {title}
        </h2>
        <p className="m-0 mt-1 text-[13px] text-muted">{sub}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </li>
  );
}

/** การ์ดที่ลูกค้าจะเห็น — ข้อมูลจริงของร้าน · ยังไม่มีรูปปก = บอกตรงๆ พร้อมลิงก์เพิ่ม (ไม่ใช้ภาพแทน) */
function CustomerPreview({ bar, live, place }: { bar: BarWithTier; live: boolean; place: string }) {
  const cover = bar.coverUrl ?? bar.gallery?.[0]?.url;
  return (
    <figure className="m-0 flex flex-col gap-3">
      <figcaption className="text-xs text-muted">
        {live ? 'การ์ดที่ลูกค้าเห็นในหน้าค้นหา' : 'การ์ดที่ลูกค้าจะเห็นหลังอนุมัติ'}
      </figcaption>
      <div className="overflow-hidden rounded-2xl bg-card shadow-[0_18px_40px_-24px_rgba(0,0,0,.65)]">
        {cover ? (
          <img
            src={cover}
            alt={`รูปปกร้าน ${bar.name}`}
            className="aspect-[16/10] w-full object-cover"
          />
        ) : (
          <Link
            to="/merchant/store"
            className="grid aspect-[16/10] place-items-center bg-surface text-center text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold"
          >
            <span className="flex flex-col items-center gap-2">
              <ImageSquare size={30} aria-hidden />
              <span className="text-[13px]">ยังไม่มีรูปปก</span>
              <span className="text-[13px] font-semibold text-gold-text">เพิ่มรูปร้าน</span>
            </span>
          </Link>
        )}
        <div className="flex flex-col gap-1 px-4 py-3.5">
          <b className="font-display text-xl font-bold leading-tight">{bar.name}</b>
          <span className="text-[13px] text-muted">
            {CATEGORY_LABELS[bar.category]}
            {place && ` ${place}`}
          </span>
        </div>
      </div>
    </figure>
  );
}

/** /merchant/status — สถานะการตรวจร้านเป็นเส้นเวลา 3 ขั้น + งานที่ทำได้ระหว่างรอ (จาก my_bar_detail) */
export function MerchantStatusPage() {
  useDemo();
  const { user } = useAuth();
  const bar = user?.barId ? getBar(user.barId) : null;
  const pinArea = usePinArea(bar && !bar.area ? { lat: bar.lat, lng: bar.lng } : null);
  if (!bar)
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="สถานะการตรวจสอบ" />
        <Empty description="ยังไม่มีร้านที่สมัคร">
          <Link to="/merchant/join">
            <Button type="primary">สมัครเป็นร้านค้า</Button>
          </Link>
        </Empty>
      </div>
    );
  if (bar.status === 'REJECTED' || bar.status === 'SUSPENDED')
    return (
      <Result
        status="warning"
        title={
          bar.status === 'REJECTED'
            ? `${bar.name} ยังไม่ผ่านการตรวจ`
            : `${bar.name} ถูกระงับชั่วคราว`
        }
        subTitle={bar.statusReason ?? 'ติดต่อทีม NightOut เพื่อขอรายละเอียด'}
        extra={
          <Link to="/merchant">
            <Button type="primary">ไปหน้าร้านของฉัน</Button>
          </Link>
        }
      />
    );

  const approved = bar.status === 'APPROVED';
  // ขั้นปัจจุบัน 0–2 · อนุมัติแล้ว = ผ่านครบทุกขั้น (3)
  const current = bar.status === 'DRAFT' ? 0 : approved ? 3 : 1;
  const state = (i: number): StepState => (i < current ? 'done' : i === current ? 'now' : 'next');
  const place = placeOf(bar, {
    amphoe: pinArea.data?.amphoe?.name_th,
    province: pinArea.data?.province?.name_th,
  });
  const { required, helpful } = tasks(bar, place);
  const requiredLeft = required.filter((t) => t.progress !== 'done').length;

  const title = approved ? `${bar.name} เปิดรับจองแล้ว` : `${bar.name} อยู่ระหว่างตรวจ`;
  const subtitle = approved
    ? requiredLeft
      ? `ผ่านการตรวจแล้ว เหลืออีก ${requiredLeft} อย่างก่อนลูกค้าจองได้`
      : 'ผ่านการตรวจแล้ว ลูกค้าเห็นร้านและจองโต๊ะได้'
    : `3 ขั้นก่อนลูกค้าจองได้ คุณอยู่ขั้นที่ ${current + 1}`;

  const helpfulPanel = (
    <section aria-label="งานที่ทำได้ระหว่างรอ" className="rounded-2xl border border-border bg-card">
      <p className="m-0 border-b border-border px-4 py-3 text-xs text-muted">
        {approved ? 'ช่วยให้ลูกค้าเลือกร้านคุณ' : 'ระหว่างรอ ช่วยให้ลูกค้าเลือกร้านคุณ'}
      </p>
      <ul className="m-0 list-none p-0">
        {helpful.map((t) => (
          <TaskRow key={t.to} t={t} />
        ))}
      </ul>
    </section>
  );
  const requiredPanel = (
    <section
      aria-label="ต้องมีก่อนลูกค้าจองได้"
      className="rounded-2xl border border-dashed border-gold/40"
    >
      <ul className="m-0 list-none p-0">
        {required.map((t) => (
          <TaskRow key={t.to} t={t} required />
        ))}
      </ul>
    </section>
  );

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-14">
      <div className="flex min-w-0 flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="m-0 font-display text-[28px] font-bold leading-[1.15] tracking-[-0.02em] text-balance lg:text-[38px]">
            {title}
          </h1>
          <p className="m-0 text-sm text-muted">{subtitle}</p>
        </header>

        <ol className="m-0 list-none p-0" aria-label="ขั้นตอนก่อนลูกค้าจองได้">
          <Step
            n={1}
            state={state(0)}
            title={current === 0 ? 'ส่งข้อมูลร้าน' : 'ส่งข้อมูลแล้ว'}
            sub={
              current === 0
                ? 'ส่งใบสมัครร้านให้ทีม NightOut ตรวจ'
                : 'ทีม NightOut ได้รับใบสมัครร้านของคุณแล้ว'
            }
          />
          <Step
            n={2}
            state={state(1)}
            title={approved ? 'ผ่านการตรวจแล้ว' : 'ทีมกำลังตรวจ'}
            sub={
              approved
                ? 'ทีม NightOut อนุมัติร้านของคุณแล้ว'
                : 'ใช้เวลา 1–2 วันทำการ แจ้งผลทางการแจ้งเตือน'
            }
          >
            {!approved && helpfulPanel}
          </Step>
          <Step
            n={3}
            state={approved ? (requiredLeft ? 'now' : 'done') : 'next'}
            title="ลูกค้าเห็นร้านและจองได้"
            sub={
              requiredLeft
                ? `ต้องมี ${required.length} อย่างนี้ครบ ไม่งั้นจองไม่ได้แม้ผ่านการตรวจ`
                : 'ครบทั้ง 2 อย่างแล้ว'
            }
            last
          >
            {requiredPanel}
            {approved && <div className="mt-4">{helpfulPanel}</div>}
          </Step>
        </ol>

        {/* มือถือ: ตัวอย่างการ์ดอยู่หลังเส้นเวลา (งานสำคัญกว่า) · จอกว้างอยู่คอลัมน์ขวา */}
        <div className="lg:hidden">
          <CustomerPreview bar={bar} live={approved} place={place} />
        </div>
      </div>

      <aside className="hidden lg:sticky lg:top-24 lg:block">
        <CustomerPreview bar={bar} live={approved} place={place} />
      </aside>
    </div>
  );
}
