import type * as C from '@nightout/contracts';
import { InstagramLogo, TiktokLogo } from '@phosphor-icons/react';
import { App, Form, Input, Switch, TimePicker } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link } from 'react-router';
import { MASTER, type Bar } from '@/services/data';
import { useFormDirty } from '@/hooks/useFormDirty';
import { HEADER_SAVE_CLASS } from '@/ui/utils/buttonClasses';
import { useMerchantBar } from '@/hooks/useMerchantBar';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { Tile } from '@/ui/components/merchantUi';
import { PinAreaCard } from '@/ui/components/pinAreaCard';
import { saveStore, usePinArea } from './api';
import { BarPhotos } from './components/barPhotos';
import { useGalleryDraft } from './utils/useGalleryDraft';

const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

/** สไตล์ร้านแบบชิปกดเลือก (ตัวที่เลือก = ทอง) — control ของ Form.Item */
function StyleChips({
  value = [],
  onChange,
}: {
  value?: string[];
  onChange?: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="สไตล์ร้าน">
      {MASTER.styles.map((s) => {
        const on = value.includes(s.key);
        return (
          <button
            key={s.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange?.(on ? value.filter((k) => k !== s.key) : [...value, s.key])}
            className={`merchant-pill rounded-full border px-3 py-2 text-[13px] lg:py-[5px] ${
              on ? 'border-gold/40 bg-gold/10 text-gold-text' : 'border-border text-muted'
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

type StoreForm = {
  name: string;
  description?: string;
  styles?: string[];
  instagram?: string;
  tiktok?: string;
  hours: { closed: boolean; range?: [dayjs.Dayjs, dayjs.Dayjs] | null }[];
};

/**
 * ค่าในฟอร์ม → `info` ของ PUT /merchant/bars/:barId/store (ลิงก์อื่นที่ร้านมีอยู่แล้ว — Facebook / เว็บไซต์ — ไม่หาย)
 * ที่อยู่/หมุดไม่อยู่ในนี้แล้ว — แก้ที่ /merchant/location (PUT …/location · รอทีม NightOut ตรวจ)
 */
const toInfo = (v: StoreForm, links: Bar['links']): C.BarInfoBody => ({
  name: v.name,
  description: v.description || null,
  style_keys: v.styles ?? [],
  links: [
    ...(v.instagram ? [{ type: 'INSTAGRAM' as const, url: v.instagram }] : []),
    ...(v.tiktok ? [{ type: 'TIKTOK' as const, url: v.tiktok }] : []),
    ...links.filter((l) => l.type !== 'INSTAGRAM' && l.type !== 'TIKTOK'),
  ],
  hours: v.hours.map((h, day) => ({
    day_of_week: day,
    is_closed: !!h.closed,
    open_time: h.closed || !h.range ? null : h.range[0].format('HH:mm'),
    close_time: h.closed || !h.range ? null : h.range[1].format('HH:mm'),
  })),
});

/** ค่าจาก server → ค่าตั้งต้นของฟอร์ม */
const toForm = (bar: Bar): StoreForm => ({
  name: bar.name,
  description: bar.description,
  styles: MASTER.styles.filter((st) => bar.styles.includes(st.label)).map((st) => st.key),
  instagram: bar.links.find((l) => l.type === 'INSTAGRAM')?.url,
  tiktok: bar.links.find((l) => l.type === 'TIKTOK')?.url,
  // ครบ 7 วันเสมอ (ร้านใหม่ยังไม่มีเวลาเปิด-ปิด → ค่าเริ่มต้น 18:00–02:00)
  hours: Array.from(
    { length: 7 },
    (_, day) =>
      bar.hours.find((h) => h.day === day) ?? { day, open: '18:00', close: '02:00', closed: false },
  ).map((h) => ({ closed: !!h.closed, range: [dayjs(h.open, 'HH:mm'), dayjs(h.close, 'HH:mm')] })),
});

/**
 * /merchant/store — รูปร้าน (ซ้าย) · ข้อมูลร้าน เวลาเปิด-ปิด สไตล์ ลิงก์ (ขวา)
 * แก้ทั้งหน้าในเครื่องก่อน แล้วกดบันทึกครั้งเดียว: อัปโหลดรูปใหม่ → PUT /merchant/bars/:barId/store (ส่งเฉพาะส่วนที่แก้)
 */
export function MerchantStorePage() {
  const bar = useMerchantBar();
  const { message } = App.useApp();
  const [form] = Form.useForm<StoreForm>();
  const gallery = useGalleryDraft(bar);
  const pinArea = usePinArea({ lat: bar.lat, lng: bar.lng });
  const initial = toForm(bar);
  const formDirty = useFormDirty(form, initial, (v) => toInfo(v, bar.links));
  const [progress, setProgress] = useState<string | null>(null);
  const saving = progress !== null;
  const count = (formDirty ? 1 : 0) + (gallery.changed ? 1 : 0);
  const { confirmDiscard } = useUnsavedGuard(count > 0);

  const reset = () => {
    form.resetFields();
    gallery.reset();
  };

  const save = async () => {
    let values: StoreForm | undefined;
    if (formDirty) {
      try {
        values = await form.validateFields();
      } catch {
        return; // ฟอร์มแสดงช่องที่ผิดให้แล้ว
      }
    }
    setProgress('กำลังบันทึก…');
    try {
      let media: C.BarMediaBody | undefined;
      if (gallery.changed) {
        try {
          media = await gallery.upload((done, total) =>
            setProgress(done < total ? `กำลังอัปโหลด ${done + 1}/${total}` : 'กำลังบันทึก…'),
          );
        } catch (e) {
          // รูปที่อัปโหลดสำเร็จแล้วอยู่ใน draft — กดบันทึกใหม่ไม่อัปโหลดซ้ำ
          void message.error(`อัปโหลดรูปไม่สำเร็จ — ${(e as Error).message}`);
          return;
        }
      }
      await saveStore(bar.id, {
        ...(values ? { info: toInfo(values, bar.links) } : {}),
        ...(media ? { media } : {}),
      });
      gallery.reset();
      void message.success('บันทึกข้อมูลร้านแล้ว');
    } catch (e) {
      void message.error((e as Error).message);
    } finally {
      setProgress(null);
    }
  };

  const saveButton = (cls: string, label: string) => (
    <button
      type="button"
      disabled={saving || !count}
      onClick={() => void save()}
      className={`merchant-pill disabled:opacity-60 ${cls}`}
    >
      {saving ? progress : label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-bold lg:font-display lg:text-[30px]">ข้อมูลร้าน</h1>
          <p className="mt-1 hidden text-sm text-muted lg:block">
            แก้รูปและข้อความได้ทั้งหน้า แล้วกดบันทึกครั้งเดียว และห้ามชักชวนให้ดื่ม (ดูนโยบายถ้อยคำ)
          </p>
        </div>
        <div className="flex items-center gap-1 lg:gap-3">
          {count > 0 && !saving && (
            <>
              <span className="hidden text-sm text-gold-text lg:inline" role="status">
                ยังไม่บันทึก {count} ส่วน
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
          {saveButton(
            HEADER_SAVE_CLASS,
            'บันทึกการเปลี่ยนแปลง',
          )}
          {saveButton('px-2 py-1 text-sm font-semibold text-gold-text lg:hidden', 'บันทึก')}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <BarPhotos bar={bar} gallery={gallery} disabled={saving} />

        <Tile>
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            className="merchant-store-form"
            initialValues={initial}
            disabled={saving}
          >
            <Form.Item
              name="name"
              label="ชื่อร้าน"
              rules={[{ required: true, message: 'กรอกชื่อร้าน' }]}
            >
              <Input />
            </Form.Item>
            {/* ย่าน/เขต/จังหวัด ระบบหาจากหมุดที่ผ่านการตรวจแล้ว · ที่อยู่ดูอย่างเดียว — แก้พร้อมหมุดที่หน้าตำแหน่งร้าน (ต้องรอทีม NightOut ตรวจ) */}
            <div className="mb-6">
              <PinAreaCard area={pinArea.data} loading={pinArea.isFetching} hasPin />
            </div>
            <div>
              <div className="mb-6 flex min-w-0 flex-col gap-1">
                <span className="text-sm">ที่อยู่</span>
                <span className="break-words text-sm text-muted">{bar.address || '-'}</span>
                <Link to="/merchant/location" className="text-[13px] text-link">
                  แก้ที่อยู่/หมุดที่หน้า ตำแหน่งร้าน →
                </Link>
                <span className="text-xs text-muted">ต้องรอทีม NightOut ตรวจก่อนแสดง</span>
              </div>
            </div>

            <Form.Item label="เวลาเปิด-ปิด" extra="รองรับปิดข้ามเที่ยงคืน เช่น 18:00–02:00">
              <Form.List name="hours">
                {(fields) => (
                  <div className="flex flex-col gap-1.5">
                    {fields.map((f, i) => (
                      <div
                        key={f.key}
                        className="flex min-h-10 items-center gap-2.5 rounded-xl border border-border bg-surface px-3"
                      >
                        <span className="w-[72px] shrink-0 text-sm text-muted">{DAYS[i]}</span>
                        <Form.Item noStyle shouldUpdate>
                          {() => {
                            const closed = form.getFieldValue([
                              'hours',
                              f.name,
                              'closed',
                            ]) as boolean;
                            return closed ? (
                              <span className="flex-1 text-sm text-muted">ปิดทั้งวัน</span>
                            ) : (
                              <Form.Item name={[f.name, 'range']} noStyle>
                                <TimePicker.RangePicker
                                  variant="borderless"
                                  className="merchant-hours-range !min-w-0 flex-1 !px-0"
                                  format="HH:mm"
                                  minuteStep={15}
                                  order={false}
                                  aria-label={`เวลาเปิด-ปิด วัน${DAYS[i]}`}
                                />
                              </Form.Item>
                            );
                          }}
                        </Form.Item>
                        {/* สวิตช์ = "เปิดร้าน" (ทอง = เปิด · เทา = ปิด) — ค่าในฟอร์มยังเป็น closed จึงกลับค่าเข้า/ออก */}
                        <Form.Item
                          name={[f.name, 'closed']}
                          noStyle
                          getValueProps={(closed: boolean) => ({ checked: !closed })}
                          normalize={(open: boolean) => !open}
                        >
                          <Switch aria-label={`เปิดร้านวัน${DAYS[i]}`} />
                        </Form.Item>
                      </div>
                    ))}
                  </div>
                )}
              </Form.List>
            </Form.Item>

            <Form.Item name="styles" label="สไตล์ร้าน">
              <StyleChips />
            </Form.Item>
            <Form.Item name="description" label="คำอธิบายร้าน">
              <Input.TextArea rows={3} maxLength={400} showCount />
            </Form.Item>
            <Form.Item label="ลิงก์ (แสดงเป็นลิงก์เท่านั้น)" className="!mb-0">
              <div className="flex flex-col gap-2">
                <Form.Item
                  name="instagram"
                  noStyle
                  rules={[{ type: 'url', message: 'ใส่ลิงก์เต็ม เช่น https://instagram.com/…' }]}
                >
                  <Input
                    prefix={<InstagramLogo className="text-muted" />}
                    placeholder="https://instagram.com/…"
                    aria-label="Instagram"
                  />
                </Form.Item>
                <Form.Item
                  name="tiktok"
                  noStyle
                  rules={[{ type: 'url', message: 'ใส่ลิงก์เต็ม เช่น https://tiktok.com/@…' }]}
                >
                  <Input
                    prefix={<TiktokLogo className="text-muted" />}
                    placeholder="https://tiktok.com/@…"
                    aria-label="TikTok"
                  />
                </Form.Item>
              </div>
            </Form.Item>
          </Form>
        </Tile>
      </div>
    </div>
  );
}
