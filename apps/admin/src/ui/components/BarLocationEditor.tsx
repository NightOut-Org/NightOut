import { MapPin, MapTrifold } from '@phosphor-icons/react';
import type * as C from '@nightout/contracts';
import type { Db, TransitLine } from '@nightout/types';
import {
  BAR_ADDRESS_MAX,
  BAR_ADDRESS_MIN,
  PARKING_NOTE_MAX,
  TRANSIT_LINES,
  TRANSIT_LINE_LABELS,
  TRANSIT_STATION_MAX,
  TRANSIT_WALK_MAX,
  distanceMeters,
  parseLatLng,
  roundCoord,
} from '@nightout/utils';
import { App, Button, Form, Input, InputNumber, Select, Space, Typography, type FormInstance } from 'antd';
import { useRef, useState } from 'react';
import { PinLegend, PinMap } from '@/ui/components/PinMap';
import { coordText, movedText, realPinOf, type LatLng } from '@/ui/utils/location';

/**
 * ฟอร์มตำแหน่งร้านของ Backoffice — ค้นหาที่อยู่ (กดค้นหาเท่านั้น) · วางพิกัด · ปักหมุดบนแผนที่ · ที่อยู่ · ที่จอดรถ · รถไฟฟ้าใกล้สุด
 * ใช้ใน /bar-locations (ปรับหมุดแล้วอนุมัติ · แก้แทนร้าน) และ /merchants (ปักหมุดร้านใหม่)
 * หน้าที่เรียกเป็นคนครอบ `<Form form={form}>` — ไฟล์นี้วางแค่ Form.Item
 * ค้นหาที่อยู่ผ่าน backend GET /geocode/* (OSM Nominatim · ไทยเท่านั้น) — ห้ามทำ autocomplete / ค้นตอนพิมพ์ (นโยบาย Nominatim)
 */

export interface AdminLocationValues {
  pin: LatLng | null;
  address: string;
  parking_note?: string;
  transit_line?: TransitLine;
  transit_station?: string;
  transit_walk_minutes?: number | null;
  /** ข้อความถึงร้าน (เฉพาะตอนแก้แทนร้าน) */
  note?: string;
}

/** ค่าจาก view → ค่าเริ่มต้นของฟอร์ม · หมุดค่าเริ่มต้นของระบบเดิม = ยังไม่มีหมุด */
export function adminLocationFrom(f: Db.BarLocationFields): AdminLocationValues {
  return {
    pin: realPinOf(f),
    address: f.address ?? '',
    parking_note: f.parking_note ?? undefined,
    transit_line: f.transit_line ?? undefined,
    transit_station: f.transit_station ?? undefined,
    transit_walk_minutes: f.transit_walk_minutes ?? undefined,
  };
}

/** ค่าที่ใช้เทียบว่าแก้แล้วหรือยัง — ไม่ throw เมื่อยังไม่มีหมุด/ช่องยังไม่ mount (Form.useWatch คืนค่าไม่ครบได้) */
export function locationDraftKey(v: Partial<AdminLocationValues> | undefined) {
  return {
    lat: v?.pin ? roundCoord(v.pin.lat) : null,
    lng: v?.pin ? roundCoord(v.pin.lng) : null,
    address: (v?.address ?? '').trim(),
    parking_note: v?.parking_note?.trim() || null,
    transit_line: v?.transit_line ?? null,
    transit_station: v?.transit_station?.trim() || null,
    transit_walk_minutes: v?.transit_walk_minutes ?? null,
  };
}

/** ค่าในฟอร์ม → body ของ API (เรียกหลัง validateFields เท่านั้น — ต้องมีหมุดแล้ว) */
export function toAdminLocationBody(v: AdminLocationValues): C.BarLocationBody {
  const k = locationDraftKey(v);
  if (k.lat === null || k.lng === null) throw new Error('ปักหมุดตำแหน่งร้าน');
  return { ...k, lat: k.lat, lng: k.lng };
}

/**
 * Backoffice ไม่มี useFormDirty — เทียบค่าในฟอร์มกับค่าเริ่มต้น
 * `locationChanged` = หมุด/ที่อยู่/ที่จอดรถ/รถไฟฟ้าเปลี่ยน · `dirty` = รวมข้อความถึงร้านที่พิมพ์ค้างไว้ (ใช้กับ useUnsavedGuard)
 */
export function useLocationDirty(form: FormInstance<AdminLocationValues>, initial: AdminLocationValues) {
  const values = Form.useWatch([], { form, preserve: true }) as Partial<AdminLocationValues> | undefined;
  if (!values) return { dirty: false, locationChanged: false };
  const locationChanged = JSON.stringify(locationDraftKey(values)) !== JSON.stringify(locationDraftKey(initial));
  return { dirty: locationChanged || !!values.note?.trim(), locationChanged };
}

const TRANSIT_OPTIONS = TRANSIT_LINES.map((l) => ({ value: l, label: TRANSIT_LINE_LABELS[l] }));
const PAIR_MESSAGE = 'เลือกสายรถไฟฟ้าและกรอกชื่อสถานีให้ครบ (หรือเว้นว่างทั้งคู่)';
const WALK_MESSAGE = 'ใส่เวลาเดินได้เมื่อระบุสถานีแล้ว';
const ADDRESS_MESSAGE = `กรอกที่อยู่ร้าน (อย่างน้อย ${BAR_ADDRESS_MIN} ตัวอักษร)`;
const PASTE_ERROR = 'อ่านพิกัดไม่ออก — วางแบบ 13.7563, 100.5018 หรือลิงก์ Google Maps';

export function BarLocationEditor({
  form,
  current,
  search,
  reverse,
  disabled = false,
}: {
  form: FormInstance<AdminLocationValues>;
  /** หมุดที่ลูกค้าเห็นตอนนี้ (วงกลมเทาบนแผนที่) · null = ยังไม่มี */
  current: LatLng | null;
  search: (q: string) => Promise<C.GeocodePlace[]>;
  reverse: (p: LatLng) => Promise<C.GeocodeReverseResult>;
  disabled?: boolean;
}) {
  const { message } = App.useApp();
  const pin = Form.useWatch('pin', form) as LatLng | null | undefined;
  const [reversing, setReversing] = useState(false);

  /** หมุดจากการค้นหา / วางพิกัด — ช่องที่อยู่ว่างอยู่ = ใส่ชื่อสถานที่ให้ */
  const placePin = (p: LatLng, label?: string) => {
    form.setFieldValue('pin', p);
    void form.validateFields(['pin']).catch(() => undefined);
    if (label && !String(form.getFieldValue('address') ?? '').trim()) {
      form.setFieldValue('address', label.slice(0, BAR_ADDRESS_MAX));
    }
  };

  const fillAddress = async () => {
    if (!pin) return;
    setReversing(true);
    try {
      const r = await reverse(pin);
      if (r.label) {
        form.setFieldValue('address', r.label.slice(0, BAR_ADDRESS_MAX));
        void form.validateFields(['address']).catch(() => undefined);
        void message.info('ใส่ที่อยู่จากหมุดแล้ว — ตรวจเลขที่/ซอยอีกครั้ง');
      } else {
        void message.warning('หาที่อยู่จากหมุดไม่เจอ — พิมพ์เองได้');
      }
    } catch (e) {
      void message.error((e as Error).message);
    } finally {
      setReversing(false);
    }
  };

  /** ย้ายจากหมุดเดิมเกิน 2 ม. = บอกระยะ (ใกล้กว่านั้นถือว่าที่เดิม) */
  const moved = pin && current && distanceMeters(current, pin) >= 2 ? movedText(current, pin) : null;

  return (
    <>
      <PlaceSearch search={search} disabled={disabled} onPick={(p) => placePin({ lat: p.lat, lng: p.lng }, p.label)} />

      <Form.Item
        name="pin"
        label="หมุดร้าน"
        rules={[{ required: true, message: 'ปักหมุดตำแหน่งร้าน' }]}
        extra={
          <span className="flex flex-col gap-1 pt-1">
            <span className="tabular-nums">
              {pin
                ? `พิกัด ${coordText(pin)}${moved ? ` (ห่างจากหมุดเดิม ${moved})` : ''}`
                : 'แตะแผนที่ ลากหมุด หรือค้นหาที่อยู่ เพื่อปักหมุดร้าน'}
            </span>
            {moved && <PinLegend />}
          </span>
        }
      >
        <PinMap editable={!disabled} current={current} />
      </Form.Item>

      <PastePin disabled={disabled} onPin={(p) => placePin(p)} />

      <Form.Item
        name="address"
        label={
          <span className="inline-flex flex-wrap items-center gap-x-2">
            ที่อยู่
            <Button
              type="link"
              size="small"
              className="!px-0"
              icon={<MapTrifold size={14} aria-hidden />}
              disabled={!pin || disabled}
              loading={reversing}
              onClick={() => void fillAddress()}
            >
              ใช้ที่อยู่จากหมุด
            </Button>
          </span>
        }
        rules={[
          {
            // นับความยาวหลังตัดช่องว่างหัวท้าย — ตรงกับ contract (z.string().trim().min) และหน้าบ้าน
            required: true,
            validator: (_, v?: string) =>
              (v ?? '').trim().length >= BAR_ADDRESS_MIN
                ? Promise.resolve()
                : Promise.reject(new Error(ADDRESS_MESSAGE)),
          },
        ]}
      >
        <Input.TextArea rows={2} maxLength={BAR_ADDRESS_MAX} showCount placeholder="เลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ" />
      </Form.Item>

      <Form.Item name="parking_note" label="ที่จอดรถ" extra="เว้นว่าง = ไม่แสดง">
        <Input.TextArea
          rows={2}
          maxLength={PARKING_NOTE_MAX}
          showCount
          placeholder="เช่น จอดในซอยได้ประมาณ 10 คัน ฟรี หรือที่จอดห้าง XX ชั่วโมงละ 20 บาท"
        />
      </Form.Item>

      <Form.Item label="รถไฟฟ้าใกล้สุด" className="!mb-2">
        <div className="grid grid-cols-1 gap-x-2 sm:grid-cols-[9rem_minmax(0,1fr)_9.5rem]">
          <Form.Item name="transit_line" className="!mb-4 sm:!mb-0">
            <Select allowClear placeholder="สาย" options={TRANSIT_OPTIONS} aria-label="สายรถไฟฟ้า" />
          </Form.Item>
          <Form.Item
            name="transit_station"
            dependencies={['transit_line']}
            className="!mb-4 sm:!mb-0"
            rules={[
              ({ getFieldValue }) => ({
                validator: (_, v: string | undefined) =>
                  !!getFieldValue('transit_line') === !!v?.trim()
                    ? Promise.resolve()
                    : Promise.reject(new Error(PAIR_MESSAGE)),
              }),
            ]}
          >
            <Input maxLength={TRANSIT_STATION_MAX} placeholder="ชื่อสถานี เช่น อารีย์" aria-label="ชื่อสถานี" />
          </Form.Item>
          <Form.Item
            name="transit_walk_minutes"
            dependencies={['transit_station']}
            className="!mb-0"
            rules={[
              ({ getFieldValue }) => ({
                validator: (_, v: number | null | undefined) =>
                  v == null || String(getFieldValue('transit_station') ?? '').trim()
                    ? Promise.resolve()
                    : Promise.reject(new Error(WALK_MESSAGE)),
              }),
            ]}
          >
            <InputNumber
              min={1}
              max={TRANSIT_WALK_MAX}
              precision={0}
              suffix="นาที เดิน"
              className="!w-full"
              aria-label="เดินจากสถานีกี่นาที"
            />
          </Form.Item>
        </div>
      </Form.Item>
    </>
  );
}

/** ค้นหาสถานที่ — ส่งเมื่อกด Enter / ปุ่มค้นหาเท่านั้น (ไม่ค้นตอนพิมพ์ — นโยบาย Nominatim) */
function PlaceSearch({
  search,
  disabled,
  onPick,
}: {
  search: (q: string) => Promise<C.GeocodePlace[]>;
  disabled: boolean;
  onPick: (p: C.GeocodePlace) => void;
}) {
  const [results, setResults] = useState<C.GeocodePlace[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const run = async (raw: string) => {
    const q = raw.trim();
    setResults(null);
    if (q.length < 2) {
      setError('พิมพ์อย่างน้อย 2 ตัวอักษร');
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const found = await search(q);
      if (mine === seq.current) setResults(found);
    } catch (e) {
      if (mine === seq.current) setError((e as Error).message);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  };

  return (
    <div className="mb-4">
      <Input.Search
        enterButton="ค้นหา"
        loading={loading}
        disabled={disabled}
        allowClear
        maxLength={120}
        placeholder="ค้นหาชื่อสถานที่ ถนน หรือซอย"
        aria-label="ค้นหาที่อยู่เพื่อปักหมุด"
        onSearch={(v, _e, info) => {
          if (info?.source === 'clear') {
            seq.current += 1;
            setResults(null);
            setError(null);
            setLoading(false);
            return;
          }
          void run(v);
        }}
      />
      {error && (
        <Typography.Text type="danger" className="mt-1 block text-xs" role="alert">
          {error}
        </Typography.Text>
      )}
      {results && results.length === 0 && (
        <Typography.Text type="secondary" className="mt-1 block text-xs">
          ไม่พบสถานที่นี้ — ลองชื่อถนน/ซอย หรือลากหมุดเอง
        </Typography.Text>
      )}
      {results && results.length > 0 && (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border" aria-label="ผลการค้นหา">
          {results.map((p) => (
            <li key={`${p.lat},${p.lng},${p.label}`}>
              <button
                type="button"
                className="flex min-h-11 w-full touch-manipulation items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gold/10 focus-visible:bg-gold/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold"
                onClick={() => {
                  onPick(p);
                  setResults(null);
                }}
              >
                <MapPin size={16} className="mt-0.5 shrink-0 text-gold-text" aria-hidden />
                <span className="min-w-0">{p.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** วางพิกัด "13.7563, 100.5018" หรือลิงก์ Google Maps → ย้ายหมุด */
function PastePin({ disabled, onPin }: { disabled: boolean; onPin: (p: LatLng) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const apply = () => {
    const p = parseLatLng(text);
    if (!p) return setError(true);
    setError(false);
    setText('');
    onPin(p);
  };
  return (
    <div className="-mt-2 mb-6">
      <Space.Compact className="w-full">
        <Input
          value={text}
          disabled={disabled}
          status={error ? 'error' : undefined}
          placeholder="วางพิกัด เช่น 13.7563, 100.5018 หรือลิงก์ Google Maps"
          aria-label="วางพิกัด"
          onChange={(e) => {
            setText(e.target.value);
            setError(false);
          }}
          onPressEnter={(e) => {
            e.preventDefault();
            apply();
          }}
        />
        <Button disabled={disabled || !text.trim()} onClick={apply}>
          ใช้พิกัด
        </Button>
      </Space.Compact>
      {error && (
        <Typography.Text type="danger" className="mt-1 block text-xs" role="alert">
          {PASTE_ERROR}
        </Typography.Text>
      )}
    </div>
  );
}
