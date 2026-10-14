import { Armchair, ArrowLeft, ArrowRight, CheckCircle, ForkKnife, MusicNotes, X } from '@phosphor-icons/react';
import type { BarCategory } from '@nightout/types';
import { formatTransit } from '@nightout/utils';
import { App, Form, Input, Select } from 'antd';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { CATEGORY_LABELS, MASTER } from '@/services/data';
import { useAuth } from '@/services/auth';
import { BarLocationFields } from '@/ui/components/barLocationFields';
import { LocationPicker } from '@/ui/components/locationPicker';
import { fillEmptyAddress, toLocationBody, type LocationFormValues } from '@/ui/utils/barLocation';
import { merchantJoin, reversePlace, searchPlace } from './api';

/** ข้อมูลร้าน + เอกสาร + ตำแหน่งร้าน (หมุด · ที่อยู่ · ที่จอดรถ · รถไฟฟ้า — ชื่อช่องจาก LocationFormValues) */
interface JoinValues extends LocationFormValues {
  name: string;
  category: BarCategory;
  district?: string;
  license: string;
}

const CATEGORY_ICON: Record<BarCategory, ReactNode> = {
  PUB_BAR: <MusicNotes size={20} />,
  CHILL: <Armchair size={20} />,
  RESTAURANT: <ForkKnife size={20} />,
};

/** 4 ขั้น: ฟิลด์ที่ต้องผ่านก่อนไปขั้นถัดไป */
const STEPS: { title: string; fields: (keyof JoinValues)[]; next: string; nextHint: string }[] = [
  {
    title: 'ข้อมูลร้าน',
    fields: ['name', 'category', 'district'],
    next: 'ตำแหน่งร้าน',
    nextHint: 'ปักหมุดร้านบนแผนที่ + ที่อยู่ ที่จอดรถ และรถไฟฟ้าใกล้สุด',
  },
  {
    title: 'ตำแหน่งร้าน',
    fields: ['pin', 'address', 'parking_note', 'transit_line', 'transit_station', 'transit_walk_minutes'],
    next: 'เอกสาร',
    nextHint: 'เลขใบอนุญาตสถานบริการ หรือทะเบียนพาณิชย์ของร้าน',
  },
  {
    title: 'เอกสาร',
    fields: ['license'],
    next: 'ส่งตรวจ',
    nextHint: 'ตรวจข้อมูลอีกครั้ง แล้วส่งให้ทีม NightOut ตรวจภายใน 1–2 วันทำการ',
  },
  { title: 'ส่งตรวจ', fields: [], next: '', nextHint: 'หลังส่งตรวจ เตรียมเมนู โต๊ะ และตั้งค่าการจองได้เลยระหว่างรอ' },
];

/** ปุ่มเลือกประเภทร้านแบบการ์ด — ใช้เป็น control ของ Form.Item */
function CategoryPicker({ value, onChange }: { value?: BarCategory; onChange?: (v: BarCategory) => void }) {
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
            onClick={() => onChange?.(c)}
            className={`merchant-pill flex h-[52px] items-center gap-2.5 rounded-xl px-3.5 text-left text-[15px] text-text lg:h-auto lg:rounded-[14px] lg:p-3.5 lg:text-sm ${
              on ? 'border-2 border-gold bg-gold/10' : 'border border-border'
            }`}
          >
            <span className={on ? 'text-gold' : 'text-muted'}>{CATEGORY_ICON[c]}</span>
            {CATEGORY_LABELS[c]}
            {on && <CheckCircle weight="fill" className="ml-auto text-gold lg:hidden" />}
          </button>
        );
      })}
    </div>
  );
}

/** ตัวบอกขั้น 1 — 2 — 3 — 4 (Desktop) */
function StepDots({ step }: { step: number }) {
  return (
    <ol className="m-0 flex list-none items-center gap-2.5 p-0 text-sm" aria-label="ขั้นตอนสมัคร">
      {STEPS.map((s, i) => (
        <li key={s.title} className="flex items-center gap-2.5" aria-current={i === step ? 'step' : undefined}>
          <span className={`flex items-center gap-2 ${i <= step ? 'text-gold-text' : 'text-muted'}`}>
            <span
              className={`grid size-[26px] place-items-center rounded-full text-[13px] ${
                i <= step ? 'bg-gold font-bold text-on-gold' : 'border border-border'
              }`}
            >
              {i + 1}
            </span>
            {s.title}
          </span>
          {i < STEPS.length - 1 && <span className="h-px w-10 bg-border" />}
        </li>
      ))}
    </ol>
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
  const district = MASTER.districts.find((d) => d.id === v.district)?.name;
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
        district_id: values.district ?? null,
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
    ? formatTransit({ line: v.transit_line, station: v.transit_station ?? '', walkMinutes: v.transit_walk_minutes })
    : null;
  const summary: [string, string | undefined][] = [
    ['ชื่อร้าน', v.name],
    ['ประเภทร้าน', v.category && CATEGORY_LABELS[v.category]],
    ['ย่าน', district],
    ['ที่อยู่', v.address],
    ['ตำแหน่ง', v.pin ? `${v.pin.lat.toFixed(5)}, ${v.pin.lng.toFixed(5)}` : undefined],
    ['รถไฟฟ้าใกล้สุด', transit ?? undefined],
    ['ที่จอดรถ', v.parking_note],
    ['เลขใบอนุญาต / ทะเบียนพาณิชย์', v.license],
  ];

  const fields = (
    <Form<JoinValues> form={form} layout="vertical" size="large" requiredMark={false} preserve className="merchant-join-form">
      <div className={step === 0 ? 'grid gap-x-5 lg:grid-cols-2' : 'hidden'}>
        <Form.Item name="name" label="ชื่อร้าน" rules={[{ required: true, message: 'กรอกชื่อร้าน' }]} className="lg:col-span-2">
          <Input autoComplete="organization" />
        </Form.Item>
        <Form.Item name="category" label="ประเภทร้าน" rules={[{ required: true, message: 'เลือกประเภทร้าน' }]} className="lg:col-span-2">
          <CategoryPicker />
        </Form.Item>
        <Form.Item name="district" label="ย่าน" rules={[{ required: true, message: 'เลือกย่าน' }]}>
          <Select showSearch={{ optionFilterProp: 'label' }} options={MASTER.districts.map((d) => ({ label: d.name, value: d.id }))} />
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
          <BarLocationFields reverse={reversePlace} disabled={sending} />
        </div>
      )}
      <div className={step === 2 ? '' : 'hidden'}>
        <Form.Item
          name="license"
          label="เลขใบอนุญาตสถานบริการ / ทะเบียนพาณิชย์"
          rules={[{ required: true, message: 'กรอกเลขใบอนุญาตหรือทะเบียนพาณิชย์' }]}
          extra="ทีม NightOut ใช้ตรวจว่าร้านเปิดถูกต้องตามกฎหมาย · ไม่แสดงให้ลูกค้าเห็น"
        >
          <Input autoCapitalize="characters" />
        </Form.Item>
      </div>
      {step === 3 && (
        <>
          <dl className="m-0 grid gap-3.5">
            {summary.map(([k, val]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <dt className="text-[13px] text-muted">{k}</dt>
                <dd className="m-0 break-words text-[15px]">{val || '-'}</dd>
              </div>
            ))}
          </dl>
          {v.pin && <LocationPicker value={v.pin} readOnly className="mt-4 h-40" />}
        </>
      )}
    </Form>
  );

  const preview = (
    <div
      className="flex min-h-[220px] flex-1 flex-col justify-end rounded-[20px] border border-border bg-cover bg-center p-5 text-white"
      style={{
        backgroundImage:
          "linear-gradient(to top, rgba(7,7,13,.92), rgba(7,7,13,.15)), url('/images/bars/placeholder.webp')",
      }}
    >
      <span className="text-xs text-white/75">ตัวอย่างการ์ดร้านที่ลูกค้าเห็น</span>
      <b className="break-words font-display text-[26px] font-bold text-white">{v.name || 'ชื่อร้านของคุณ'}</b>
      <span className="text-[13px] text-white/80">
        {[v.category ? CATEGORY_LABELS[v.category] : 'ประเภทร้าน', district, 'ร้านใหม่'].filter(Boolean).join(' · ')}
      </span>
    </div>
  );

  const backButton = step > 0 && (
    <button
      type="button"
      onClick={() => setStep(step - 1)}
      className="merchant-pill inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm"
    >
      <ArrowLeft />
      ย้อนกลับ
    </button>
  );

  return (
    <div>
      {/* มือถือ — แถบบน: ปิด/ย้อน · ชื่อ · ขั้น + แถบความคืบหน้า */}
      <header className="merchant-appbar sticky top-0 z-40 border-b border-border bg-surface lg:hidden">
        <div className="flex h-14 items-center gap-2.5 px-2">
          {step === 0 ? (
            <Link to="/" aria-label="ปิด" className="grid size-10 place-items-center text-xl text-text">
              <X />
            </Link>
          ) : (
            <button type="button" aria-label="ย้อนกลับ" onClick={() => setStep(step - 1)} className="grid size-10 place-items-center text-xl">
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
        <span className="block h-full bg-gold transition-[width] duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {/* Desktop — หัวข้อ + ตัวบอกขั้น */}
      <div className="mb-4 hidden items-center justify-between gap-6 lg:flex">
        <div>
          <h1 className="font-display text-[30px] font-bold">เปิดร้านบน NightOut</h1>
          <p className="mt-1 text-sm text-muted">ทีม NightOut ตรวจภายใน 1–2 วันทำการ · ระหว่างนี้เตรียมเมนูและโต๊ะได้เลย</p>
        </div>
        <StepDots step={step} />
      </div>

      <div className="grid gap-4 px-4 pb-32 pt-[18px] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:p-0">
        <div className="min-w-0 lg:rounded-[20px] lg:border lg:border-border lg:bg-card lg:p-6">
          <h1 className="mb-3.5 font-display text-[26px] font-bold lg:hidden">{cur.title}</h1>
          {fields}
        </div>
        <div className={`flex-col gap-4 ${step === 3 ? 'flex' : 'hidden lg:flex'}`}>
          {preview}
          <div className="hidden flex-col gap-2 rounded-[20px] border border-border bg-surface p-[18px] text-[13px] text-muted lg:flex">
            <b className="text-sm font-semibold text-text">{last ? 'หลังส่งตรวจ' : `ขั้นถัดไป: ${cur.next}`}</b>
            <span>{cur.nextHint}</span>
          </div>
          <div className="hidden justify-end gap-2 lg:flex">
            {backButton}
            <button
              type="button"
              disabled={sending}
              onClick={() => void next()}
              className="merchant-pill inline-flex h-10 items-center gap-2 rounded-xl bg-gold px-[18px] text-sm font-semibold text-on-gold disabled:opacity-70"
            >
              {last ? nextLabel : 'ถัดไป'}
              {!last && <ArrowRight />}
            </button>
          </div>
        </div>
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
