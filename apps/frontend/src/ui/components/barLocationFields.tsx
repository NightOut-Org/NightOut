import type * as C from '@nightout/contracts';
import { MapPinLine } from '@phosphor-icons/react';
import {
  BAR_ADDRESS_MAX,
  BAR_ADDRESS_MIN,
  PARKING_NOTE_MAX,
  TRANSIT_LINES,
  TRANSIT_LINE_LABELS,
  TRANSIT_STATION_MAX,
  TRANSIT_WALK_MAX,
} from '@nightout/utils';
import { App, Button, Form, Input, InputNumber, Select } from 'antd';
import { useState } from 'react';
import type { LocationFormValues } from '@/ui/utils/barLocation';

const TRANSIT_OPTIONS = TRANSIT_LINES.map((line) => ({
  value: line,
  label: TRANSIT_LINE_LABELS[line],
}));
const ADDRESS_MSG = `กรอกที่อยู่ร้าน (อย่างน้อย ${BAR_ADDRESS_MIN} ตัวอักษร)`;
// ข้อความเดียวกับ C.BarLocationBody (contracts)
const TRANSIT_PAIR_MSG = 'เลือกสายรถไฟฟ้าและกรอกชื่อสถานีให้ครบ (หรือเว้นว่างทั้งคู่)';
const TRANSIT_WALK_MSG = 'ใส่เวลาเดินได้เมื่อระบุสถานีแล้ว';

/**
 * ช่องตำแหน่งร้าน (ที่อยู่ · ที่จอดรถ · รถไฟฟ้าใกล้สุด) ตามชื่อใน `LocationFormValues` — วางใน antd Form
 * ช่อง `pin` (LocationPicker) แต่ละหน้าวางเอง · `reverse` = GET /geocode/reverse ของโมดูลนั้น (ADR 0007)
 */
export function BarLocationFields({
  reverse,
  disabled = false,
}: {
  reverse: (p: { lat: number; lng: number }) => Promise<C.GeocodeReverseResult>;
  disabled?: boolean;
}) {
  const { message } = App.useApp();
  const form = Form.useFormInstance<LocationFormValues>();
  const pin = Form.useWatch('pin', form) as LocationFormValues['pin'] | undefined;
  const [reversing, setReversing] = useState(false);

  const fillFromPin = async () => {
    if (!pin) return;
    setReversing(true);
    try {
      const { label } = await reverse(pin);
      if (label) {
        form.setFieldValue('address', label.slice(0, BAR_ADDRESS_MAX));
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

  return (
    <>
      <Form.Item
        name="address"
        label="ที่อยู่"
        rules={[
          {
            validator: (_, v?: string) =>
              (v ?? '').trim().length >= BAR_ADDRESS_MIN
                ? Promise.resolve()
                : Promise.reject(new Error(ADDRESS_MSG)),
          },
        ]}
        extra={
          <Button
            type="link"
            icon={<MapPinLine aria-hidden="true" />}
            disabled={disabled || !pin}
            loading={reversing}
            onClick={() => void fillFromPin()}
            className="!h-11 !px-0 lg:!h-8"
          >
            ใช้ที่อยู่จากหมุด
          </Button>
        }
      >
        <Input.TextArea
          rows={2}
          maxLength={BAR_ADDRESS_MAX}
          showCount
          disabled={disabled}
          autoComplete="street-address"
          placeholder="เลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ"
        />
      </Form.Item>

      <Form.Item name="parking_note" label="ที่จอดรถ" extra="เว้นว่าง = ไม่แสดง">
        <Input.TextArea
          rows={2}
          maxLength={PARKING_NOTE_MAX}
          showCount
          disabled={disabled}
          placeholder="เช่น จอดในซอยได้ประมาณ 10 คัน ฟรี · หรือที่จอดห้าง XX ชั่วโมงละ 20 บาท"
        />
      </Form.Item>

      {/* 3 ช่องแบบ noStyle — ข้อความผิดของแต่ละช่องไปแสดงใต้หัวข้อ "รถไฟฟ้าใกล้สุด" */}
      <Form.Item label="รถไฟฟ้าใกล้สุด" extra="เว้นว่าง = ไม่แสดง" className="!mb-0">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
          <Form.Item name="transit_line" noStyle>
            <Select
              allowClear
              disabled={disabled}
              placeholder="สาย"
              options={TRANSIT_OPTIONS}
              popupMatchSelectWidth={false}
              aria-label="สายรถไฟฟ้า"
            />
          </Form.Item>
          <Form.Item
            name="transit_station"
            noStyle
            dependencies={['transit_line']}
            rules={[
              ({ getFieldValue }) => ({
                validator: (_, station?: string) =>
                  !!getFieldValue('transit_line') === !!station?.trim()
                    ? Promise.resolve()
                    : Promise.reject(new Error(TRANSIT_PAIR_MSG)),
              }),
            ]}
          >
            <Input
              maxLength={TRANSIT_STATION_MAX}
              disabled={disabled}
              placeholder="ชื่อสถานี เช่น อารีย์"
              aria-label="ชื่อสถานี"
            />
          </Form.Item>
          <Form.Item
            name="transit_walk_minutes"
            noStyle
            dependencies={['transit_station']}
            rules={[
              ({ getFieldValue }) => ({
                validator: (_, walk?: number | null) =>
                  walk == null || !!(getFieldValue('transit_station') as string | undefined)?.trim()
                    ? Promise.resolve()
                    : Promise.reject(new Error(TRANSIT_WALK_MSG)),
              }),
            ]}
          >
            <InputNumber
              min={1}
              max={TRANSIT_WALK_MAX}
              precision={0}
              disabled={disabled}
              placeholder="เช่น 5"
              suffix="นาที เดิน"
              inputMode="numeric"
              aria-label="เดินจากสถานีกี่นาที"
              className="!w-full"
            />
          </Form.Item>
        </div>
      </Form.Item>
    </>
  );
}
