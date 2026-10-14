import type { Db, LocationRequestStatus } from '@nightout/types';
import {
  LOCATION_REQUEST_SOURCE_LABELS,
  LOCATION_REQUEST_STATUS_LABELS,
  distanceMeters,
  formatDistance,
  formatTransit,
  isLegacyDefaultPin,
} from '@nightout/utils';
import type { TagLabel } from './labels';

/** ตำแหน่งร้าน (หมุด) ของ Backoffice — ป้ายสถานะคำขอ · ข้อความรถไฟฟ้า · ระยะที่ย้ายหมุด (migration 20261013000600) */

export interface LatLng {
  lat: number;
  lng: number;
}

/** สถานะคำขอแก้ตำแหน่ง → Tag */
export const LOCATION_REQUEST_STATUS: Record<LocationRequestStatus, TagLabel> = {
  PENDING: { text: LOCATION_REQUEST_STATUS_LABELS.PENDING, color: 'gold' },
  APPROVED: { text: LOCATION_REQUEST_STATUS_LABELS.APPROVED, color: 'green' },
  REJECTED: { text: LOCATION_REQUEST_STATUS_LABELS.REJECTED, color: 'red' },
  CANCELLED: { text: LOCATION_REQUEST_STATUS_LABELS.CANCELLED, color: 'default' },
};

/** ที่มาของแถว: ร้านขอแก้ / ทีม NightOut ตั้งแทน */
export const LOCATION_SOURCE = LOCATION_REQUEST_SOURCE_LABELS;

/** เกินระยะนี้ = ป้าย "ย้ายไกล" (ตรวจให้ดีว่าไม่ได้ปักผิดร้าน) */
export const FAR_MOVE_METERS = 500;

/** พิกัดจาก view (numeric อาจมาเป็น string) → ตัวเลข */
export const pinOf = (f: { lat: number | string; lng: number | string }): LatLng => ({
  lat: Number(f.lat),
  lng: Number(f.lng),
});

/** หมุดที่ลูกค้าเห็นจริง — null ถ้ายังเป็นหมุดค่าเริ่มต้นของระบบเดิม (ร้านไม่ได้ปักเอง) */
export const realPinOf = (f: { lat: number | string; lng: number | string }): LatLng | null => {
  const p = pinOf(f);
  return isLegacyDefaultPin(p.lat, p.lng) ? null : p;
};

/** "BTS อารีย์ · เดิน 5 นาที" · ไม่ระบุ = null */
export const transitText = (
  f: Pick<Db.BarLocationFields, 'transit_line' | 'transit_station' | 'transit_walk_minutes'>,
): string | null =>
  f.transit_line && f.transit_station
    ? formatTransit({ line: f.transit_line, station: f.transit_station, walkMinutes: f.transit_walk_minutes })
    : null;

/** "120 ม." / "1.4 กม." — หมุดย้ายไปไกลแค่ไหน */
export const movedText = (a: LatLng, b: LatLng): string => formatDistance(distanceMeters(a, b));

/** "13.756300, 100.501800" */
export const coordText = (p: LatLng): string => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
