import type { LocationRequestSource, LocationRequestStatus, TransitLine } from '@nightout/types';

/**
 * ตำแหน่งร้าน (หมุด) — กรอบประเทศไทย · หมุดค่าเริ่มต้นเดิม · ระยะทาง · อ่านพิกัดที่วาง · ข้อความรถไฟฟ้า
 * ใช้ร่วมหน้าบ้าน / Backoffice / contracts (DB ตรวจค่าเดียวกันใน bar_location_from_json — migration 20261013000600)
 */

/** กรอบประเทศไทย — หมุดร้าน/ผลค้นหาที่อยู่ต้องอยู่ในกรอบนี้ (DB ตรวจค่าเดียวกันใน bar_location_from_json) */
export const THAILAND_BOUNDS = { south: 5.5, north: 20.6, west: 97.3, east: 105.7 } as const;

/** พิกัดอยู่ในกรอบประเทศไทยหรือไม่ (รวมขอบ · NaN/Infinity = ไม่ใช่) */
export function isInThailand(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= THAILAND_BOUNDS.south &&
    lat <= THAILAND_BOUNDS.north &&
    lng >= THAILAND_BOUNDS.west &&
    lng <= THAILAND_BOUNDS.east
  );
}

/** หมุดที่ app_merchant_join เดิมใส่ให้ทุกร้าน — ร้านที่ยังเป็นหมุดนี้อนุมัติไม่ได้ (BAR_LOCATION_NOT_SET) */
export const LEGACY_DEFAULT_PIN = { lat: 13.7563, lng: 100.5018 } as const;

/** ยังเป็นหมุดค่าเริ่มต้นเดิม (ร้านไม่ได้ปักเอง) หรือไม่ */
export function isLegacyDefaultPin(lat: number, lng: number): boolean {
  return Math.abs(lat - LEGACY_DEFAULT_PIN.lat) < 1e-6 && Math.abs(lng - LEGACY_DEFAULT_PIN.lng) < 1e-6;
}

/** จุดกลางแผนที่เมื่อยังไม่มีหมุด (กรุงเทพฯ — เดียวกับหน้า /map) */
export const MAP_DEFAULT_CENTER = { lat: 13.745, lng: 100.56 } as const;

/** ทศนิยม 6 ตำแหน่ง = numeric(9,6) ใน DB */
export const roundCoord = (n: number): number => Math.round(n * 1e6) / 1e6;

/** ความยาวข้อความ (DB ตรวจซ้ำด้วย check constraint) */
export const BAR_ADDRESS_MIN = 3;
export const BAR_ADDRESS_MAX = 300;
export const PARKING_NOTE_MAX = 200;
export const TRANSIT_STATION_MAX = 60;
/** เดินจากสถานีได้สูงสุดกี่นาที */
export const TRANSIT_WALK_MAX = 60;

/** สายรถไฟฟ้าที่เลือกได้ (ตรงกับ check ของ bars.transit_line) */
export const TRANSIT_LINES = ['BTS', 'MRT', 'ARL', 'SRT'] as const satisfies readonly TransitLine[];
export const TRANSIT_LINE_LABELS: Record<TransitLine, string> = {
  BTS: 'BTS',
  MRT: 'MRT',
  ARL: 'Airport Rail Link',
  SRT: 'รถไฟฟ้าสายสีแดง',
};

export interface TransitInfo {
  line: TransitLine;
  station: string;
  walkMinutes?: number | null;
}

/** "BTS อารีย์ · เดิน 5 นาที" (ชื่อสายจาก TRANSIT_LINE_LABELS เช่น "Airport Rail Link มักกะสัน") · ไม่มีข้อมูล = null */
export function formatTransit(t: TransitInfo | null | undefined): string | null {
  const station = t?.station?.trim();
  if (!t || !station) return null;
  const head = `${TRANSIT_LINE_LABELS[t.line] ?? t.line} ${station}`;
  return t.walkMinutes ? `${head} · เดิน ${t.walkMinutes} นาที` : head;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** ระยะทาง (เมตร) แบบ haversine R = 6_371_000 */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "35 ม." (<1000, ปัดเป็นจำนวนเต็ม) · "1.2 กม." (1 ตำแหน่ง) */
export function formatDistance(m: number): string {
  const rounded = Math.round(m);
  return rounded < 1000 ? `${rounded} ม.` : `${(m / 1000).toFixed(1)} กม.`;
}

const COORD = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
/** ลำดับสำคัญ: หมุดของสถานที่ (!3d!4d) → q=/query= → จุดกลางจอ (@) → พิกัดล้วน */
const LAT_LNG_PATTERNS: readonly RegExp[] = [
  new RegExp(String.raw`!3d${COORD}!4d${COORD}`),
  new RegExp(String.raw`[?&](?:q|query)=${COORD}\s*,\s*${COORD}`),
  new RegExp(String.raw`@${COORD},${COORD}`),
  new RegExp(String.raw`^\(?\s*${COORD}\s*(?:,\s*|\s+)${COORD}\s*\)?$`),
];

/** ข้อความที่วาง → พิกัด: "13.7563, 100.5018" · "13.7563 100.5018" · ลิงก์ Google Maps (`@lat,lng` · `?q=lat,lng` / `query=` · `!3dlat!4dlng`) · อ่านไม่ออก/นอกไทย = null · ปัด 6 ตำแหน่ง */
export function parseLatLng(text: string): { lat: number; lng: number } | null {
  let s = (text ?? '').trim();
  if (!s) return null;
  try {
    s = decodeURIComponent(s);
  } catch {
    // ลิงก์ที่ encode ไม่ครบ — อ่านแบบดิบ
  }
  for (const re of LAT_LNG_PATTERNS) {
    const m = re.exec(s);
    if (!m) continue;
    const lat = roundCoord(Number(m[1]));
    const lng = roundCoord(Number(m[2]));
    return isInThailand(lat, lng) ? { lat, lng } : null;
  }
  return null;
}

export const LOCATION_REQUEST_STATUS_LABELS: Record<LocationRequestStatus, string> = {
  PENDING: 'รอตรวจ',
  APPROVED: 'ผ่านแล้ว',
  REJECTED: 'ตีกลับ',
  CANCELLED: 'ยกเลิก',
};

export const LOCATION_REQUEST_SOURCE_LABELS: Record<LocationRequestSource, string> = {
  MERCHANT: 'ร้านขอแก้',
  ADMIN: 'ทีม NightOut ตั้งแทน',
};
