import { Plus, Trash, Warning } from '@phosphor-icons/react';
import { estimatePrice } from '@nightout/utils';
import { App, Checkbox, Empty, Form, Input, InputNumber, Modal, Switch, TimePicker } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { barBookings, type BarPromotion } from '@/services/data';
import { useMerchantBar } from '@/hooks/useMerchantBar';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { Tile } from '@/ui/components/merchantUi';
import { baht } from '@/ui/utils/format';
import { savePromotionsPage, toPromotionItems } from './api';
import { usePromotionsDraft } from './utils/usePromotionsDraft';

const DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const DAY_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const DAY_MS = 24 * 60 * 60 * 1000;

interface PromoForm {
  title: string;
  description: string;
  cutoff?: dayjs.Dayjs | null;
  days?: number[];
}

/** [5, 6] → "ศ – ส" · [1, 3] → "จ, พ" · ว่าง = ทุกวัน */
function daysLabel(days?: number[]) {
  if (!days?.length || days.length === 7) return 'ทุกวัน';
  const s = [...days].sort((a, b) => a - b);
  const run = s.every((d, i) => i === 0 || d === s[i - 1]! + 1);
  return run && s.length > 1 ? `${DAY_SHORT[s[0]!]} – ${DAY_SHORT[s.at(-1)!]}` : s.map((d) => DAY_SHORT[d]).join(', ');
}

/**
 * /merchant/promotions — โปรที่ลูกค้าเลือกได้ตอนจองโต๊ะ (การ์ดละโปร) + ค่าธรรมเนียมที่ใช้ประเมินราคา + ข้อกำหนด
 * เช่น "โปรเบียร์ก่อน 2 ทุ่ม" = ต้องเช็กอินก่อน 20:00 · เลือกวันได้ · เปิด/ปิดได้
 * สร้าง/ลบ/เปิด-ปิดโปร และค่าธรรมเนียม แก้ในหน้าก่อน แล้วกดบันทึกครั้งเดียว (PUT /merchant/bars/:barId/promotions)
 */
export function MerchantPromotionsPage() {
  const bar = useMerchantBar();
  const { message, modal } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<PromoForm>();
  const [feeForm] = Form.useForm<typeof bar.fees>();
  const fees = (Form.useWatch([], feeForm) as typeof bar.fees | undefined) ?? bar.fees;
  const promos = usePromotionsDraft(bar.promotions);
  const [feesDirty, setFeesDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [since] = useState(() => Date.now() - 30 * DAY_MS);
  const count = promos.count + (feesDirty ? 1 : 0);
  const { confirmDiscard } = useUnsavedGuard(count > 0);

  const reset = () => {
    promos.reset();
    feeForm.resetFields();
    setFeesDirty(false);
  };

  const save = async () => {
    let feeValues: typeof bar.fees | undefined;
    if (feesDirty) {
      try {
        feeValues = await feeForm.validateFields();
      } catch {
        return; // ฟอร์มแสดงช่องที่ผิดให้แล้ว
      }
    }
    setSaving(true);
    try {
      const r = await savePromotionsPage(bar.id, {
        ...(promos.count ? { items: toPromotionItems(promos.list) } : {}),
        ...(feeValues
          ? { fees: { service_charge: feeValues.serviceChargeRate ?? 0, vat: feeValues.vatRate ?? 0, other: feeValues.otherFees ?? 0 } }
          : {}),
      });
      promos.reset();
      setFeesDirty(false);
      void message.success(r.pending ? 'บันทึกแล้ว — โปรที่เพิ่ม/แก้ข้อความ รอทีม NightOut ตรวจถ้อยคำก่อนแสดง' : 'บันทึกแล้ว');
    } catch (e) {
      void message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (cls: string, label: string) => (
    <button
      type="button"
      disabled={saving || !count}
      onClick={() => void save()}
      className={`merchant-pill disabled:opacity-60 ${cls}`}
    >
      {saving ? 'กำลังบันทึก…' : label}
    </button>
  );

  // ใช้แล้วกี่ครั้งใน 30 วัน (นับการจองที่เลือกโปรนี้ ไม่รวมที่ถูกปฏิเสธ/ยกเลิก)
  const used = new Map<string, number>();
  for (const b of barBookings(bar.id))
    if (b.promotionId && new Date(b.createdAt).getTime() >= since && !['REJECTED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_MERCHANT', 'EXPIRED'].includes(b.status))
      used.set(b.promotionId, (used.get(b.promotionId) ?? 0) + 1);

  const example = estimatePrice({
    items: [{ name: 'เมนู', unitPrice: 1000, quantity: 1 }],
    fees: { serviceChargeRate: Number(fees.serviceChargeRate) || 0, vatRate: Number(fees.vatRate) || 0, otherFees: 0 },
    pax: 1,
  });

  const moderation = (p: BarPromotion) =>
    p.moderationStatus === 'PENDING' ? (
      <span className="rounded-full border border-gold/40 px-2 text-[11px] text-gold-text">รอตรวจถ้อยคำ</span>
    ) : p.moderationStatus === 'REJECTED' ? (
      <span className="rounded-full border border-(--crowd-full)/40 px-2 text-[11px] text-(--crowd-full)">ไม่ผ่านการตรวจ</span>
    ) : null;

  const promoCard = (p: BarPromotion) => {
    const state = promos.stateOf(p);
    return (
    <div
      key={p.id}
      className={`flex min-w-0 flex-col gap-2.5 rounded-[20px] border p-[18px] lg:p-5 ${
        p.active
          ? 'border-gold/35 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--gold)_14%,var(--card)),var(--card))]'
          : 'border-border bg-card'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs ${p.active ? 'border-gold/40 text-gold-text' : 'border-border text-muted'}`}>
            {p.active ? 'เปิดอยู่' : 'ปิดอยู่'}
          </span>
          {moderation(p)}
          {state && (
            <span className="rounded-full bg-gold/15 px-2 text-[11px] text-gold-text">
              {state === 'new' ? 'ใหม่ · ยังไม่บันทึก' : 'ยังไม่บันทึก'}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`ลบ ${p.title}`}
            disabled={saving}
            onClick={() =>
              modal.confirm({
                title: `ลบ "${p.title}"?`,
                okText: 'ลบ',
                okButtonProps: { danger: true },
                cancelText: 'ยกเลิก',
                onOk: () => promos.remove(p.id),
              })
            }
            className="grid size-8 place-items-center rounded-lg text-muted hover:text-(--crowd-full) disabled:opacity-50"
          >
            <Trash />
          </button>
          <Switch
            checked={p.active}
            disabled={saving}
            aria-label={`เปิดใช้ ${p.title}`}
            onChange={(v) => promos.setActive(p.id, v)}
          />
        </span>
      </span>
      <b className="text-base font-semibold lg:text-xl">{p.title}</b>
      {p.description && <span className="hidden text-[13px] text-muted lg:block">{p.description}</span>}
      <span className="text-[13px] text-muted lg:hidden">
        {p.cutoffTime ? `ก่อน ${p.cutoffTime}` : 'ทั้งคืน'} · {daysLabel(p.days)}
      </span>
      <div className="mt-auto hidden grid-cols-2 gap-2 lg:grid">
        <span className="flex flex-col gap-0.5 rounded-xl bg-surface p-2.5">
          <span className="text-[11px] text-muted">Cutoff</span>
          <b className="text-sm">{p.cutoffTime ? `ก่อน ${p.cutoffTime}` : 'ทั้งคืน'}</b>
        </span>
        <span className="flex flex-col gap-0.5 rounded-xl bg-surface p-2.5">
          <span className="text-[11px] text-muted">วัน</span>
          <b className="text-sm">{daysLabel(p.days)}</b>
        </span>
      </div>
      <span className="hidden text-xs text-muted lg:block">ใช้แล้ว {used.get(p.id) ?? 0} ครั้งใน 30 วัน</span>
    </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[17px] font-bold lg:font-display lg:text-[30px]">โปรโมชัน</h1>
          <p className="mt-1 hidden text-sm text-muted lg:block">
            ลูกค้าเลือกได้ 1 โปรตอนจองโต๊ะ · ระบบเช็กเวลา/วันให้อัตโนมัติ · ใช้กับอาหาร ค่าเข้า หรือบริการเท่านั้น
          </p>
        </div>
        <div className="flex items-center gap-1 lg:gap-3">
          {count > 0 && !saving && (
            <>
              <span className="hidden text-sm text-gold-text lg:inline" role="status">
                ยังไม่บันทึก {count} รายการ
              </span>
              <button
                type="button"
                onClick={() => confirmDiscard(reset)}
                className="merchant-pill px-2 py-1 text-sm text-muted lg:h-10 lg:rounded-xl lg:border lg:border-border lg:px-[18px]"
              >
                คืนค่า
              </button>
            </>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => setOpen(true)}
            className="merchant-pill hidden h-10 items-center gap-2 rounded-xl bg-gold px-[18px] text-sm font-semibold text-on-gold disabled:opacity-60 lg:inline-flex"
          >
            <Plus /> สร้างโปร
          </button>
          {saveButton('hidden h-10 items-center rounded-xl bg-gold px-[18px] text-sm font-semibold text-on-gold lg:inline-flex', 'บันทึกการเปลี่ยนแปลง')}
          <button
            type="button"
            aria-label="สร้างโปร"
            disabled={saving}
            onClick={() => setOpen(true)}
            className="grid size-10 place-items-center text-xl text-gold disabled:opacity-60 lg:hidden"
          >
            <Plus />
          </button>
          {saveButton('px-2 py-1 text-sm font-semibold text-gold-text lg:hidden', 'บันทึก')}
        </div>
      </div>

      {promos.list.length === 0 ? (
        <Tile>
          <Empty description="ยังไม่มีโปรโมชัน — สร้างโปรแรกให้ลูกค้าเลือกตอนจองได้เลย" />
        </Tile>
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-3 lg:gap-4">{promos.list.map(promoCard)}</div>
      )}

      <div className="grid gap-2.5 lg:grid-cols-3 lg:gap-4">
        <Tile className="flex flex-col gap-3.5 lg:col-span-2">
          <span className="flex items-center justify-between gap-3">
            <b className="text-[15px] font-semibold">ค่าธรรมเนียมที่ใช้ประเมินราคา</b>
            {feesDirty && <span className="text-xs text-gold-text">ยังไม่บันทึก</span>}
          </span>
          <Form form={feeForm} initialValues={bar.fees} disabled={saving} onValuesChange={() => setFeesDirty(true)}>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ['serviceChargeRate', 'Service Charge', 'คิดจากยอดเมนู', 30, '%'],
                  ['vatRate', 'VAT', 'คิดหลัง SC', 10, '%'],
                  ['otherFees', 'ค่าเปิดขวด / ค่าเข้า', 'ต่อการจอง', 100000, '฿'],
                ] as const
              ).map(([name, label, sub, max, suffix]) => (
                <div key={name} className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-surface p-3.5">
                  <span className="flex min-w-0 flex-col">
                    <b className="font-medium">{label}</b>
                    <span className="text-xs text-muted">{sub}</span>
                  </span>
                  <Form.Item name={name} noStyle>
                    <InputNumber min={0} max={max} suffix={suffix} className="!w-24" aria-label={label} inputMode="decimal" />
                  </Form.Item>
                </div>
              ))}
            </div>
          </Form>
          <span className="text-[13px] text-muted">
            ตัวอย่าง: เมนู {baht(1000)} → SC {baht(example.serviceCharge)} → VAT {baht(example.vat)} →{' '}
            <b className="text-gold-text">รวม {baht(example.estimatedTotal)}</b>
          </span>
        </Tile>

        <div className="flex flex-col gap-2 rounded-[20px] border border-(--crowd-full)/40 bg-(--crowd-full)/10 p-[18px] lg:p-5">
          <span className="flex items-center gap-2 text-sm font-semibold text-(--crowd-full)">
            <Warning /> ข้อกำหนด
          </span>
          <span className="text-[13px] leading-relaxed text-pretty">
            ไม่ทำโปรลด แจก หรือแถมเครื่องดื่มแอลกอฮอล์ และไม่ใช้คำเลี่ยง · โปรใหม่หรือที่แก้ข้อความ ทีม NightOut
            ตรวจถ้อยคำก่อนแสดง และปิดโปรที่ไม่ผ่าน
          </span>
        </div>
      </div>

      <Modal
        open={open}
        title="สร้างโปรโมชัน"
        okText="สร้าง"
        cancelText="ยกเลิก"
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form<PromoForm>
          form={form}
          layout="vertical"
          initialValues={{ days: [] }}
          onFinish={(v) => {
            const p: BarPromotion = {
              id: `new-${Date.now().toString(36)}`,
              title: v.title.trim(),
              description: v.description?.trim() ?? '',
              cutoffTime: v.cutoff ? v.cutoff.format('HH:mm') : undefined,
              days: v.days?.length ? v.days : undefined,
              active: true,
            };
            // เพิ่มเข้า draft — บันทึกพร้อมการแก้อื่นด้วยปุ่มบันทึกของหน้า
            promos.add(p);
            form.resetFields();
            setOpen(false);
          }}
        >
          <Form.Item name="title" label="ชื่อโปร" rules={[{ required: true, max: 60 }]}>
            <Input placeholder="เช่น ส่วนลดอาหาร 15%" />
          </Form.Item>
          <Form.Item name="description" label="รายละเอียด" rules={[{ max: 160 }]}>
            <Input.TextArea rows={2} placeholder="เช่น เฉพาะเมนูอาหาร เมื่อเช็กอินก่อน 20:00 น." />
          </Form.Item>
          <Form.Item name="cutoff" label="ต้องเช็กอินก่อนเวลา (เว้นว่าง = ทั้งคืน)">
            <TimePicker format="HH:mm" minuteStep={30} className="w-full" placeholder="เช่น 20:00" />
          </Form.Item>
          <Form.Item name="days" label="วันที่ใช้ได้ (ไม่เลือก = ทุกวัน)">
            <Checkbox.Group options={DAYS.map((d, i) => ({ label: d, value: i }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
