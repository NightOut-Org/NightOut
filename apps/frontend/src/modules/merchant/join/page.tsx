import {
  Armchair,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  ForkKnife,
  MapPin,
  MusicNotes,
  X,
} from '@phosphor-icons/react';
import type { BarCategory } from '@nightout/types';
import { formatTransit } from '@nightout/utils';
import { App, Form, Input } from 'antd';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { CATEGORY_LABELS } from '@/services/data';
import { useAuth } from '@/services/auth';
import { BarLocationFields } from '@/ui/components/barLocationFields';
import { LocationPicker } from '@/ui/components/locationPicker';
import { MetaList } from '@/ui/components/metaList';
import { PinAreaCard, pinAreaParts } from '@/ui/components/pinAreaCard';
import { InfoButton } from '@/ui/components/infoButton';
import { RuleList } from '@/ui/components/ruleList';
import { fillEmptyAddress, toLocationBody, type LocationFormValues } from '@/ui/utils/barLocation';
import { merchantJoin, reversePlace, searchPlace, usePinArea } from './api';

/** ข้อมูลร้าน + เอกสาร + ตำแหน่งร้าน (หมุด · ที่อยู่ · ที่จอดรถ · รถไฟฟ้า — ชื่อช่องจาก LocationFormValues) */
interface JoinValues extends LocationFormValues {
  name: string;
  category: BarCategory;
  license: string;
}

const CATEGORY_ICON: Record<BarCategory, ReactNode> = {
  PUB_BAR: <MusicNotes size={20} />,
  CHILL: <Armchair size={20} />,
  RESTAURANT: <ForkKnife size={20} />,
};

/** 4 ขั้น: ฟิลด์ที่ต้องผ่านก่อนไปขั้นถัดไป */
const STEPS: { title: string; desc: string; fields: (keyof JoinValues)[]; next: string }[] = [
  {
    title: 'ข้อมูลร้าน',
    desc: 'ชื่อและประเภทของร้าน',
    fields: ['name', 'category'],
    next: 'ตำแหน่งร้าน',
  },
  {
    title: 'ตำแหน่งร้าน',
    desc: 'ปักหมุด (ระบบหาย่านให้) ที่อยู่ ที่จอดรถ และรถไฟฟ้าใกล้สุด',
    fields: [
      'pin',
      'address',
      'parking_note',
      'transit_line',
      'transit_station',
      'transit_walk_minutes',
    ],
    next: 'เอกสาร',
  },
  {
    title: 'เอกสาร',
    desc: 'เลขใบอนุญาตสถานบริการหรือทะเบียนพาณิชย์',
    fields: ['license'],
    next: 'ส่งตรวจ',
  },
  { title: 'ส่งตรวจ', desc: 'ตรวจข้อมูลอีกครั้ง แล้วส่งให้ทีม NightOut', fields: [], next: '' },
];

const CATEGORY_HINT: Record<BarCategory, string> = {
  PUB_BAR: 'ดนตรี เต้น ปาร์ตี้',
  CHILL: 'นั่งคุย บรรยากาศสบาย',
  RESTAURANT: 'อาหารเป็นหลัก มีเครื่องดื่ม',
};

/** ปุ่มเลือกประเภทร้านแบบการ์ด — ใช้เป็น control ของ Form.Item */
function CategoryPicker({
  value,
  onChange,
}: {
  value?: BarCategory;
  onChange?: (v: BarCategory) => void;
}) {
  return (
    <div role="radiogroup" aria-label="ประเภทร้าน" className="grid gap-2.5 lg:grid-cols-3">
      {(Object.keys(CATEGORY_LABELS) as BarCategory[]).map((c) => {
        const on = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${CATEGORY_LABELS[c]} (${CATEGORY_HINT[c]})`}
            onClick={() => onChange?.(c)}
            className={`merchant-pill relative flex items-center gap-3 rounded-[14px] border p-3.5 text-left text-text transition-colors lg:flex-col lg:items-start lg:gap-2 ${
              on
                ? 'border-gold bg-gold/12 shadow-[inset_0_0_0_1px_var(--gold)]'
                : 'border-border md:hover:border-muted/60'
            }`}
          >
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-xl ${on ? 'bg-gold text-on-gold' : 'bg-surface text-muted'}`}
            >
              {CATEGORY_ICON[c]}
            </span>
            <span className="flex min-w-0 flex-col">
              <b className="text-[15px] font-semibold">{CATEGORY_LABELS[c]}</b>
              <span className="text-xs text-muted">{CATEGORY_HINT[c]}</span>
            </span>
            <CheckCircle
              weight="fill"
              aria-hidden
              className={`ml-auto size-5 shrink-0 text-gold transition-opacity lg:absolute lg:right-3 lg:top-3 ${on ? 'opacity-100' : 'opacity-0'}`}
            />
          </button>
        );
      })}
    </div>
  );
}

/** แผงขั้นตอนแนวตั้ง (Desktop) — ขั้นที่ผ่านแล้วกดย้อนไปแก้ได้ · ขั้นถัดไปต้องผ่านการตรวจช่องก่อน */
function StepRail({ step, onGo }: { step: number; onGo: (i: number) => void }) {
  return (
    <nav aria-label="ขั้นตอนสมัคร" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-[13px] text-muted">
          ขั้น {step + 1} จาก {STEPS.length}
        </span>
        <span className="block h-1.5 overflow-hidden rounded-full bg-border/70">
          <span
            className="block h-full rounded-full bg-gold transition-[width] duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </span>
      </div>
      <ol className="m-0 flex list-none flex-col p-0">
        {STEPS.map((s, i) => {
          const done = i < step;
          const current = i === step;
          const body = (
            <>
              <span className="flex flex-col items-center self-stretch">
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${
                    current
                      ? 'bg-gold text-on-gold shadow-[0_0_0_4px_color-mix(in_srgb,var(--gold)_22%,transparent)]'
                      : done
                        ? 'bg-gold/15 text-gold-text'
                        : 'border border-border text-muted'
                  }`}
                >
                  {done ? <Check weight="bold" /> : i + 1}
                </span>
                {i < STEPS.length - 1 && (
                  <span className={`my-1 w-px flex-1 ${done ? 'bg-gold/50' : 'bg-border'}`} />
                )}
              </span>
              <span
                className={`flex min-w-0 flex-col pb-5 pt-1 ${current || done ? '' : 'opacity-70'}`}
              >
                <b className={`text-sm font-semibold ${current ? 'text-gold-text' : 'text-text'}`}>
                  {s.title}
                </b>
                <span className="text-xs text-muted">{s.desc}</span>
              </span>
            </>
          );
          return (
            <li key={s.title} aria-current={current ? 'step' : undefined}>
              {done ? (
                <button
                  type="button"
                  onClick={() => onGo(i)}
                  className="flex w-full gap-3 bg-transparent p-0 text-left md:hover:[&_b]:underline"
                >
                  {body}
                </button>
              ) : (
                <div className="flex gap-3">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
      <InfoButton label="ขั้นตอนหลังส่งตรวจ">
        <RuleList
          rules={[
            'ทีม NightOut ตรวจภายใน 1–2 วันทำการ',
            { tone: 'check', text: 'ระหว่างรอตรวจ เตรียมเมนู โต๊ะ และตั้งค่าการจองได้เลย' },
          ]}
        />
      </InfoButton>
    </nav>
  );
}

/** /merchant/join — สมัครเป็นร้าน 4 ขั้น (ข้อมูลร้าน → ตำแหน่งร้าน → เอกสาร → ส่งตรวจ) · ส่งครั้งเดียวตอนจบ */
export function MerchantJoinPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { reload } = useAuth();
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState(0);
  const [form] = Form.useForm<JoinValues>();
  const v = (Form.useWatch([], { form, preserve: true }) ?? {}) as Partial<JoinValues>;
  const pinArea = usePinArea(v.pin);
  const place = pinAreaParts(pinArea.data);
  const cur = STEPS[step]!;
  const last = step === STEPS.length - 1;

  const submit = async () => {
    const values = form.getFieldsValue(true) as JoinValues;
    if (!values.pin) {
      setStep(1);
      void message.error('ปักหมุดตำแหน่งร้านบนแผนที่');
      return;
    }
    setSending(true);
    try {
      await merchantJoin({
        name: values.name,
        category: values.category,
        license: values.license,
        ...toLocationBody(values),
      });
      await reload(); // role เปลี่ยนเป็นร้านค้า → เมนูร้านค้าเปิดให้เตรียมข้อมูลระหว่างรอตรวจ
      message.success('ส่งข้อมูลแล้ว ทีม NightOut จะตรวจภายใน 1–2 วันทำการ');
      navigate('/merchant/status');
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };
  const next = async () => {
    if (last) return submit();
    try {
      await form.validateFields(cur.fields);
      setStep(step + 1);
    } catch {
      /* antd แสดงข้อความใต้ช่องให้แล้ว */
    }
  };

  const nextLabel = last ? (sending ? 'กำลังส่ง…' : 'ส่งให้ทีมตรวจ') : `ถัดไป: ${cur.next}`;
  const transit = v.transit_line
    ? formatTransit({
        line: v.transit_line,
        station: v.transit_station ?? '',
        walkMinutes: v.transit_walk_minutes,
      })
    : null;
  const summary: [string, string | undefined][] = [
    ['ชื่อร้าน', v.name],
    ['ประเภทร้าน', v.category && CATEGORY_LABELS[v.category]],
    ['พื้นที่', place.found ? `${place.head} ${place.rest}` : undefined],
    ['ที่อยู่', v.address],
    ['ตำแหน่ง', v.pin ? `${v.pin.lat.toFixed(5)}, ${v.pin.lng.toFixed(5)}` : undefined],
    ['รถไฟฟ้าใกล้สุด', transit ?? undefined],
    ['ที่จอดรถ', v.parking_note],
    ['เลขใบอนุญาต / ทะเบียนพาณิชย์', v.license],
  ];

  const fields = (
    <Form<JoinValues>
      form={form}
      layout="vertical"
      requiredMark={false}
      preserve
      className="merchant-join-form"
    >
      <div className={step === 0 ? 'grid gap-x-5 lg:grid-cols-2' : 'hidden'}>
        <Form.Item
          name="name"
          label="ชื่อร้าน"
          rules={[{ required: true, message: 'กรอกชื่อร้าน' }]}
          className="lg:col-span-2"
        >
          <Input autoComplete="organization" placeholder="ชื่อที่ลูกค้าจะเห็นบนการ์ดร้าน" />
        </Form.Item>
        <Form.Item
          name="category"
          label="ประเภทร้าน"
          rules={[{ required: true, message: 'เลือกประเภทร้าน' }]}
          className="lg:col-span-2"
        >
          <CategoryPicker />
        </Form.Item>
      </div>
      {/* แผนที่ mount ตอนถึงขั้นนี้ (ไม่ซ่อนไว้ใน hidden — Leaflet ที่สร้างตอนขนาด 0 จะจัดกลางเพี้ยน) · ค่าในฟอร์มยังอยู่ (preserve) */}
      {step === 1 && (
        <div>
          <Form.Item
            name="pin"
            label="หมุดร้าน"
            rules={[{ required: true, message: 'ปักหมุดตำแหน่งร้านบนแผนที่' }]}
            extra="ทีม NightOut ตรวจหมุดพร้อมการอนุมัติร้าน"
          >
            <LocationPicker search={searchPlace} onPickPlace={(p) => fillEmptyAddress(form, p)} />
          </Form.Item>
          <div className="mb-6">
            <PinAreaCard area={pinArea.data} loading={pinArea.isFetching} hasPin={!!v.pin} />
          </div>
          <BarLocationFields reverse={reversePlace} disabled={sending} />
        </div>
      )}
      <div className={step === 2 ? '' : 'hidden'}>
        <Form.Item
          name="license"
          label="เลขใบอนุญาตสถานบริการ / ทะเบียนพาณิชย์"
          rules={[{ required: true, message: 'กรอกเลขใบอนุญาตหรือทะเบียนพาณิชย์' }]}
          extra="ทีม NightOut ใช้ตรวจว่าร้านเปิดถูกต้องตามกฎหมาย และไม่แสดงให้ลูกค้าเห็น"
        >
          <Input autoCapitalize="characters" />
        </Form.Item>
      </div>
      {step === 3 && (
        <>
          <dl className="m-0 grid overflow-hidden rounded-2xl border border-border sm:grid-cols-2 [&>*:last-child]:border-b-0 sm:[&>*:nth-last-child(-n+2)]:border-b-0">
            {summary.map(([k, val]) => (
              <div
                key={k}
                className="flex flex-col gap-0.5 border-b border-border px-4 py-3 sm:odd:border-r"
              >
                <dt className="text-[13px] text-muted">{k}</dt>
                <dd className={`m-0 break-words text-[15px] ${val ? '' : 'text-muted'}`}>
                  {val || 'ยังไม่กรอก'}
                </dd>
              </div>
            ))}
          </dl>
          {v.pin && <LocationPicker value={v.pin} readOnly className="mt-4 h-40" />}
        </>
      )}
    </Form>
  );

  const preview = (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] text-muted">ตัวอย่างการ์ดร้านที่ลูกค้าเห็น</span>
      <div className="overflow-hidden rounded-[20px] border border-border bg-card">
        <div
          className="aspect-[16/10] bg-cover bg-center"
          style={{ backgroundImage: "url('/images/bars/placeholder.webp')" }}
          role="img"
          aria-label="รูปปกร้าน (เพิ่มได้หลังสมัคร)"
        />
        <div className="flex flex-col gap-1.5 p-4">
          <span className="self-start rounded-full bg-purple/15 px-2 text-xs font-medium leading-5 text-link">
            ร้านใหม่
          </span>
          <b
            className={`break-words font-display text-[22px] font-bold leading-tight ${v.name ? '' : 'text-muted'}`}
          >
            {v.name || 'ชื่อร้านของคุณ'}
          </b>
          <MetaList
            className="text-[13px] text-muted"
            items={[
              {
                icon: v.category ? CATEGORY_ICON[v.category] : <MusicNotes />,
                label: 'ประเภทร้าน',
                value: v.category ? CATEGORY_LABELS[v.category] : 'ประเภทร้าน',
              },
              {
                icon: <MapPin weight="fill" />,
                label: 'พื้นที่',
                value: place.found ? place.head : 'พื้นที่จากหมุด',
              },
            ]}
          />
        </div>
      </div>
      <span className="text-xs text-muted">รูปปก เมนู และโต๊ะ เพิ่มได้หลังสมัคร</span>
    </div>
  );

  const backButton = step > 0 && (
    <button
      type="button"
      onClick={() => setStep(step - 1)}
      className="merchant-pill inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm"
    >
      <ArrowLeft />
      ย้อนกลับ
    </button>
  );

  return (
    <div className="lg:mx-auto lg:max-w-[1240px]">
      {/* มือถือ — แถบบน: ปิด/ย้อน · ชื่อ · ขั้น + แถบความคืบหน้า */}
      <header className="merchant-appbar sticky top-0 z-40 border-b border-border bg-surface lg:hidden">
        <div className="flex h-14 items-center gap-2.5 px-2">
          {step === 0 ? (
            <Link
              to="/"
              aria-label="ปิด"
              className="grid size-10 place-items-center text-xl text-text"
            >
              <X />
            </Link>
          ) : (
            <button
              type="button"
              aria-label="ย้อนกลับ"
              onClick={() => setStep(step - 1)}
              className="grid size-10 place-items-center text-xl"
            >
              <ArrowLeft />
            </button>
          )}
          <b className="flex-1 text-[15px]">สมัครเป็นร้าน</b>
          <span className="pr-2 text-[13px] text-muted">
            {step + 1} / {STEPS.length}
          </span>
        </div>
      </header>
      <div className="h-1 bg-border/60 lg:hidden">
        <span
          className="block h-full bg-gold transition-[width] duration-300"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Desktop — หัวข้อหน้า */}
      <div className="mb-6 hidden lg:block">
        <h1 className="font-display text-[30px] font-bold">เปิดร้านบน NightOut</h1>
        <p className="mt-1 text-sm text-muted">กรอก 4 ขั้น ใช้เวลาประมาณ 5 นาที</p>
      </div>

      <div className="grid gap-6 px-4 pb-32 pt-[18px] lg:grid-cols-[220px_minmax(0,1fr)_300px] lg:items-start lg:p-0 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <StepRail step={step} onGo={setStep} />
        </aside>

        <section className="min-w-0 lg:rounded-[20px] lg:border lg:border-border lg:bg-card">
          <header className="mb-4 lg:mb-0 lg:border-b lg:border-border lg:px-6 lg:py-5">
            <h2 className="m-0 font-display text-[26px] font-bold lg:text-[22px]">{cur.title}</h2>
            <p className="m-0 mt-1 text-sm text-muted">{cur.desc}</p>
          </header>
          <div className="lg:px-6 lg:pt-5">{fields}</div>
          {step === 3 && (
            <div className="mt-4 lg:mx-6">
              <InfoButton label="ขั้นตอนหลังส่งตรวจ">
                <RuleList
                  rules={[
                    'ทีม NightOut ตรวจภายใน 1–2 วันทำการ และแจ้งผลทางการแจ้งเตือน',
                    { tone: 'check', text: 'ระหว่างรอตรวจ เตรียมเมนู โต๊ะ และตั้งค่าการจองได้เลย' },
                  ]}
                />
              </InfoButton>
            </div>
          )}
          <footer className="hidden items-center justify-between gap-3 lg:mt-2 lg:flex lg:border-t lg:border-border lg:px-6 lg:py-4">
            {backButton || <span />}
            <button
              type="button"
              disabled={sending}
              onClick={() => void next()}
              className="merchant-pill inline-flex h-11 items-center gap-2 rounded-xl bg-gold px-5 text-sm font-semibold text-on-gold disabled:opacity-70"
            >
              {nextLabel}
              {!last && <ArrowRight />}
            </button>
          </footer>
        </section>

        <aside
          className={`flex-col gap-4 lg:sticky lg:top-24 ${step === 3 ? 'flex' : 'hidden lg:flex'}`}
        >
          {preview}
        </aside>
      </div>

      {/* มือถือ — ปุ่มล่าง */}
      <div className="merchant-actionbar fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 pt-3.5 lg:hidden">
        <button
          type="button"
          disabled={sending}
          onClick={() => void next()}
          className="merchant-pill flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold font-semibold text-on-gold disabled:opacity-70"
        >
          {nextLabel}
          {!last && <ArrowRight />}
        </button>
      </div>
    </div>
  );
}
