import { Chair, Plus, SquaresFour, Timer, UsersThree } from '@phosphor-icons/react';
import { BOOKING_EXTENSION_MINUTES } from '@nightout/utils';
import { App, Empty, Form, Input, InputNumber, Modal, Popconfirm } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router';
import { HEADER_ADD_CLASS, HEADER_SAVE_CLASS } from '@/ui/utils/buttonClasses';
import { useMerchantBar } from '@/hooks/useMerchantBar';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { Tile } from '@/ui/components/merchantUi';
import { baht } from '@/ui/utils/format';
import { setZones } from './api';
import { isNewId, useZonesDraft, type Zone } from './utils/useZonesDraft';
import { MetaList } from '@/ui/components/metaList';
import { DraftChip } from '@/ui/components/statusChip';
import { RuleList } from '@/ui/components/ruleList';

interface NewZone {
  name: string;
  tables: number;
  seats: number;
  duration: number;
}

const hoursLabel = (min: number) =>
  `${(min / 60).toLocaleString('th-TH', { maximumFractionDigits: 1 })} ชม.`;

/**
 * /merchant/tables — การ์ดโซนละใบ: ความจุ · ระยะเวลาจอง · มัดจำ · โต๊ะ (DB กันจองซ้อนเวลาต่อโต๊ะ + นับความจุโซน)
 * เพิ่มโซน / เพิ่ม-ปิดใช้โต๊ะ / แก้ความจุ-เวลาจอง ในหน้าก่อน แล้วกดบันทึกครั้งเดียว (PUT /merchant/bars/:barId/zones)
 */
export function MerchantTablesPage() {
  const bar = useMerchantBar();
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<NewZone>();
  const draft = useZonesDraft(bar.zones);
  const { confirmDiscard } = useUnsavedGuard(draft.count > 0);

  const save = async () => {
    setSaving(true);
    try {
      await setZones(bar.id, draft.zones);
      draft.reset();
      void message.success('บันทึกโซนและโต๊ะแล้ว');
    } catch (e) {
      void message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (cls: string, label: string) => (
    <button
      type="button"
      disabled={saving || !draft.count}
      onClick={() => void save()}
      className={`merchant-pill disabled:opacity-60 ${cls}`}
    >
      {saving ? 'กำลังบันทึก…' : label}
    </button>
  );

  const zoneTag = (z: Zone) => {
    const st = draft.zoneState(z);
    return st ? (
      <DraftChip state={st === 'new' ? 'new' : 'changed'} />
    ) : null;
  };

  const tableCount = draft.zones.reduce((a, z) => a + z.tables.length, 0);
  const pax = draft.zones.reduce((a, z) => a + z.capacityPax, 0);
  const deposit =
    bar.deposit.amount > 0
      ? `${baht(bar.deposit.amount)}/${bar.deposit.unit === 'PER_PERSON' ? 'คน' : 'โต๊ะ'}`
      : 'ไม่มี';

  /** ช่องสถิติแก้ได้ในที่ (เข้า draft) */
  const statInput = (
    label: string,
    value: number,
    suffix: string,
    min: number,
    max: number,
    step: number,
    onChange: (v: number) => void,
  ) => (
    <label className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-surface p-2.5">
      <span className="text-[11px] text-muted">{label}</span>
      <InputNumber
        variant="borderless"

        min={min}
        max={max}
        step={step}
        value={value}
        disabled={saving}
        suffix={<span className="text-xs text-muted">{suffix}</span>}
        className="!w-full !p-0 [&_input]:!p-0 [&_input]:!text-base [&_input]:!font-bold"
        aria-label={label}
        onChange={(v) => typeof v === 'number' && onChange(v)}
      />
    </label>
  );

  const tableButton = (z: Zone, t: Zone['tables'][number], compact: boolean) => (
    <Popconfirm
      key={t.id}
      title={`ปิดใช้โต๊ะ ${t.name}?`}
      description="การจองเดิมยังอยู่ แต่ลูกค้าจองโต๊ะนี้ใหม่ไม่ได้"
      okText="ปิดใช้"
      cancelText="ยกเลิก"
      okButtonProps={{ danger: true }}
      disabled={saving}
      onConfirm={() => draft.removeTable(z, t.id)}
    >
      <button
        type="button"
        disabled={saving}
        aria-label={`โต๊ะ ${t.name} ${t.seats} ที่ — กดเพื่อปิดใช้`}
        className={`merchant-pill flex flex-col items-center justify-center border bg-surface hover:border-(--crowd-full) disabled:opacity-60 ${
          isNewId(t.id) ? 'border-dashed border-gold/60' : 'border-border'
        } ${compact ? 'h-11 rounded-[10px] text-xs' : 'h-14 rounded-[14px]'}`}
      >
        <b className={compact ? '' : 'text-[15px]'}>{t.name}</b>
        <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-muted`}>
          {t.seats}
          {compact ? '' : ' ที่'}
        </span>
      </button>
    </Popconfirm>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[17px] font-bold lg:font-display lg:text-[30px]">โซน / โต๊ะ</h1>
          <p className="mt-1 text-xs text-muted lg:text-sm">
            <MetaList
              items={[
                { icon: <SquaresFour weight="fill" />, label: 'โซน', value: `${draft.zones.length} โซน` },
                { icon: <Chair weight="fill" />, label: 'โต๊ะ', value: `${tableCount} โต๊ะ` },
                { icon: <UsersThree weight="fill" />, label: 'รับได้', value: `รับได้ ${pax} คน` },
              ]}
            />
            <span className="ml-3 hidden lg:inline">ระบบกันจองซ้อนตามระยะเวลาจอง</span>
          </p>
        </div>
        <div className="flex items-center gap-1 lg:gap-3">
          {draft.count > 0 && !saving && (
            <>
              <span className="hidden text-sm text-gold-text lg:inline" role="status">
                ยังไม่บันทึก {draft.count} โซน
              </span>
              <button
                type="button"
                onClick={() => confirmDiscard(draft.reset)}
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
            className={HEADER_ADD_CLASS}
          >
            <Plus /> เพิ่มโซน
          </button>
          {saveButton(
            HEADER_SAVE_CLASS,
            'บันทึกการเปลี่ยนแปลง',
          )}
          <button
            type="button"
            aria-label="เพิ่มโซน"
            disabled={saving}
            onClick={() => setOpen(true)}
            className="grid size-10 place-items-center text-xl text-gold disabled:opacity-60 lg:hidden"
          >
            <Plus />
          </button>
          {saveButton('px-2 py-1 text-sm font-semibold text-gold-text lg:hidden', 'บันทึก')}
        </div>
      </div>

      {draft.zones.length === 0 ? (
        <Tile>
          <Empty description="ยังไม่มีโซน — ต้องมีอย่างน้อย 1 โซนเพื่อรับจอง" />
        </Tile>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden gap-4 lg:grid lg:grid-cols-3">
            {draft.zones.map((z) => (
              <Tile key={z.id} className="flex flex-col gap-3.5">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-lg font-semibold">{z.name}</b>
                  {zoneTag(z)}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {statInput('ความจุรวม', z.capacityPax, 'คน', 1, 2000, 1, (v) =>
                    draft.setCapacity(z, v),
                  )}
                  {statInput('ระยะเวลาจอง', z.defaultDurationMinutes, 'นาที', 60, 480, 30, (v) =>
                    draft.setDuration(z, v),
                  )}
                  <span className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-surface p-2.5">
                    <span className="text-[11px] text-muted">Table Fee</span>
                    <b className="truncate text-base text-gold-text">{deposit}</b>
                  </span>
                </div>
                <span className="text-[13px] text-muted">
                  โต๊ะ ({z.tables.length}) รอบละ {hoursLabel(z.defaultDurationMinutes)}
                </span>
                {z.tables.length === 0 ? (
                  <span className="text-sm text-muted">ยังไม่มีโต๊ะ — ลูกค้าจองเป็นโซน</span>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {z.tables.map((t) => tableButton(z, t, false))}
                  </div>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => draft.addTable(z)}
                  className="merchant-pill mt-auto flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-muted/60 text-sm text-muted hover:border-gold hover:text-text disabled:opacity-50"
                >
                  <Plus /> เพิ่มโต๊ะ
                </button>
              </Tile>
            ))}
          </div>

          {/* มือถือ */}
          <div className="flex flex-col gap-3 lg:hidden">
            {draft.zones.map((z) => (
              <Tile key={z.id} className="flex flex-col gap-2.5 !rounded-[18px] !p-3.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <b className="text-base font-semibold">{z.name}</b>
                    {zoneTag(z)}
                  </span>
                  <span className="text-xs text-muted">
                    <MetaList
                      items={[
                        { icon: <Chair weight="fill" />, label: 'โต๊ะ', value: `${z.tables.length} โต๊ะ` },
                        { icon: <UsersThree weight="fill" />, label: 'รับได้', value: `${z.capacityPax} คน` },
                        { icon: <Timer weight="fill" />, label: 'เวลาต่อรอบ', value: hoursLabel(z.defaultDurationMinutes) },
                      ]}
                    />
                  </span>
                </span>
                <div className="grid grid-cols-6 gap-1.5">
                  {z.tables.map((t) => tableButton(z, t, true))}
                  <button
                    type="button"
                    aria-label={`เพิ่มโต๊ะใน ${z.name}`}
                    disabled={saving}
                    onClick={() => draft.addTable(z)}
                    className="grid h-11 place-items-center rounded-[10px] border border-dashed border-muted/60 text-muted"
                  >
                    <Plus />
                  </button>
                </div>
              </Tile>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-[18px] py-3.5 text-sm text-muted">
        <RuleList
          className="flex-1"
          rules={[
            'ลูกค้าเลือกได้ทั้งโซนหรือโต๊ะ',
            { tone: 'warn', text: `ไม่มาเช็กอินเกิน grace period (${bar.gracePeriodMinutes} นาที) ระบบปลดโต๊ะ (Forfeited) อัตโนมัติ` },
            { tone: 'check', text: `ลูกค้าขอต่อเวลาได้อีก ${BOOKING_EXTENSION_MINUTES} นาที 1 ครั้ง` },
          ]}
        />
        <Link to="/merchant/settings" className="hidden shrink-0 lg:inline">
          ตั้งค่าการจอง →
        </Link>
      </div>

      <Modal
        open={open}
        title="เพิ่มโซน"
        okText="เพิ่ม"
        cancelText="ยกเลิก"
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form<NewZone>
          form={form}
          layout="vertical"
          initialValues={{ tables: 4, seats: 4, duration: 180 }}
          onFinish={(v) => {
            // เพิ่มเข้า draft — บันทึกพร้อมการแก้อื่นด้วยปุ่มบันทึกของหน้า
            draft.addZone({ ...v, name: v.name.trim() });
            form.resetFields();
            setOpen(false);
          }}
        >
          <Form.Item name="name" label="ชื่อโซน" rules={[{ required: true, max: 60 }]}>
            <Input placeholder="เช่น Rooftop, หน้าเวที" />
          </Form.Item>
          <div className="grid gap-4 sm:grid-cols-3">
            <Form.Item name="tables" label="จำนวนโต๊ะ">
              <InputNumber className="!w-full" min={0} max={100} />
            </Form.Item>
            <Form.Item name="seats" label="ที่นั่ง/โต๊ะ">
              <InputNumber className="!w-full" min={1} max={50} />
            </Form.Item>
            <Form.Item name="duration" label="จองนาน (นาที)">
              <InputNumber className="!w-full" min={60} max={480} step={30} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
