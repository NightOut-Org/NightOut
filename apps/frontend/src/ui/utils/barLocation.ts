import type * as C from '@nightout/contracts';
import type { TransitLine } from '@nightout/types';
import { BAR_ADDRESS_MAX, isLegacyDefaultPin, roundCoord } from '@nightout/utils';
import type { FormInstance } from 'antd';
import type { Bar } from '@/services/data';

/**
 * ฟอร์มตำแหน่งร้าน (หมุด + ที่อยู่ + ที่จอดรถ + รถไฟฟ้าใกล้สุด) — ใช้ร่วม /merchant/location และ /merchant/join
 * ชื่อช่องตรงกับ `C.BarLocationBody` (ยกเว้น `pin` = lat/lng ของ LocationPicker)
 */
export interface LocationFormValues {
  pin: { lat: number; lng: number } | null;
  address: string;
  parking_note?: string;
  transit_line?: TransitLine | null;
  transit_station?: string;
  transit_walk_minutes?: number | null;
}

type BarLocationRequest = NonNullable<Bar['locationRequest']>;

const blankToNull = (s: string | null | undefined) => s?.trim() || null;

/** ค่าในฟอร์ม → body ของ PUT …/location / POST /merchant/join · เรียกหลัง `validateFields` เท่านั้น (ต้องมีหมุดแล้ว) */
export function toLocationBody(v: LocationFormValues): C.BarLocationBody {
  if (!v.pin) throw new Error('ปักหมุดตำแหน่งร้านบนแผนที่');
  return {
    lat: roundCoord(v.pin.lat),
    lng: roundCoord(v.pin.lng),
    address: v.address.trim(),
    parking_note: blankToNull(v.parking_note),
    transit_line: v.transit_line ?? null,
    transit_station: blankToNull(v.transit_station),
    transit_walk_minutes: v.transit_walk_minutes ?? null,
  };
}

/**
 * key สำหรับ `useFormDirty` — ไม่ throw เมื่อยังไม่มีหมุด/ช่องยังไม่ mount
 * (`Form.useWatch([], { preserve: true })` คืนค่าไม่ครบก่อนทุกช่อง mount)
 */
export function locationDraftKey(v: Partial<LocationFormValues>) {
  return {
    lat: v.pin ? roundCoord(v.pin.lat) : null,
    lng: v.pin ? roundCoord(v.pin.lng) : null,
    address: (v.address ?? '').trim(),
    parking_note: v.parking_note?.trim() || null,
    transit_line: v.transit_line ?? null,
    transit_station: v.transit_station?.trim() || null,
    transit_walk_minutes: v.transit_walk_minutes ?? null,
  };
}

/** ค่าที่ลูกค้าเห็นอยู่ → ค่าตั้งต้นของฟอร์ม · หมุดค่าเริ่มต้นเดิม (ร้านไม่ได้ปักเอง) = ยังไม่มีหมุด */
export function locationFormFromBar(bar: Bar): LocationFormValues {
  return {
    pin: isLegacyDefaultPin(bar.lat, bar.lng) ? null : { lat: bar.lat, lng: bar.lng },
    address: bar.address,
    parking_note: bar.parkingNote ?? '',
    transit_line: bar.transit?.line, // undefined (ไม่ใช่ null) — Select แสดง placeholder
    transit_station: bar.transit?.station ?? '',
    transit_walk_minutes: bar.transit?.walkMinutes ?? null,
  };
}

/** คำขอที่ส่งไว้ (รอตรวจ) → ค่าตั้งต้นของฟอร์ม */
export function locationFormFromRequest(r: BarLocationRequest): LocationFormValues {
  return {
    pin: { lat: r.lat, lng: r.lng },
    address: r.address,
    parking_note: r.parkingNote ?? '',
    transit_line: r.transit?.line,
    transit_station: r.transit?.station ?? '',
    transit_walk_minutes: r.transit?.walkMinutes ?? null,
  };
}

/** เลือกผลค้นหาที่อยู่ → เติมช่องที่อยู่ให้ ถ้ายังว่าง (ไม่ทับที่ร้านพิมพ์ไว้) */
export function fillEmptyAddress(form: FormInstance, place: { label: string }) {
  if ((form.getFieldValue('address') as string | undefined)?.trim()) return;
  form.setFieldValue('address', place.label.slice(0, BAR_ADDRESS_MAX));
}
