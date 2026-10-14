import type { BookingStatus } from '@nightout/types';
import { HOLDING_STATUSES } from './booking-status';

/**
 * ผังโต๊ะของร้าน (/merchant/floor · Backoffice ดูอย่างเดียว) — ค่าต้องตรงกับ migration …20261013001200_booking_table_board
 *   (bar_table_board · app_team_set_table_occupancy)
 *   · สถานะคำนวณที่ DB ณ เวลา server: IN_USE (เช็กอินแล้ว / ทีมร้านตั้งเอง) > RESERVED (การจองที่ยังไม่เช็กอิน
 *     เริ่มภายใน 60 นาที หรือเลยเวลานัดแต่ยังไม่หมด reserved_until) > FREE
 *   · หน้าเว็บโพลทุก 10 วิ (เจ้าของตัดสิน 2026-10-13: ไม่ใช้ Realtime/WebSocket)
 *   · "คืน" = 06:00 ถึง 06:00 ของวันถัดไป เวลาไทย (ก่อน 06:00 นับเป็นคืนก่อนหน้า)
 */
export const TABLE_BOARD_POLL_MS = 10_000;
export const TABLE_BOARD_RESERVED_LEAD_MINUTES = 60;
/** ตั้ง "กำลังใช้" เองแล้วลืมตั้งว่าง — เกินกี่ชั่วโมงถือว่าหมดอายุ (ไม่แสดง · ปิดให้ตอนตั้งใหม่) */
export const TABLE_OCCUPANCY_STALE_HOURS = 12;
export const BUSINESS_NIGHT_CUTOFF_HOUR = 6;

export const TABLE_BOARD_STATUSES = ['FREE', 'RESERVED', 'IN_USE'] as const;
export type TableBoardStatus = (typeof TABLE_BOARD_STATUSES)[number];
/** ที่มาของสถานะ: BOOKING = จากการจอง · MANUAL = ทีมร้านตั้ง "กำลังใช้" เอง (ไม่มีการจอง) */
export type TableBoardStatusSource = 'BOOKING' | 'MANUAL';

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
/** เวลาไทย = UTC+7 (ไม่มี DST) */
const BKK_OFFSET_HOURS = 7;

/** วันที่ของ "คืน" ตามเวลาไทย 'YYYY-MM-DD' (ไทยไม่มี DST: UTC+7 · ตัดวันตอน 06:00) */
export function businessNightOf(at: Date = new Date()): string {
  return new Date(at.getTime() + (BKK_OFFSET_HOURS - BUSINESS_NIGHT_CUTOFF_HOUR) * HOUR_MS).toISOString().slice(0, 10);
}

export interface BoardPeriod {
  reserved_from: string;
  reserved_until: string;
}

/** ช่วงเวลาทับกันไหม — ช่วงครึ่งเปิด [from, until) เหมือน tstzrange '[)' && ใน DB (ชนขอบพอดี = ไม่ทับ) */
export function periodsOverlap(a: BoardPeriod, b: BoardPeriod): boolean {
  return Date.parse(a.reserved_from) < Date.parse(b.reserved_until) && Date.parse(b.reserved_from) < Date.parse(a.reserved_until);
}

export interface BoardDropBooking extends BoardPeriod {
  id: string;
  status: BookingStatus;
  table_id: string | null;
}
export interface BoardDropTarget {
  id: string;
  status: TableBoardStatus;
  status_source: TableBoardStatusSource | null;
}
export type BoardDropBlock = 'NOT_MOVABLE' | 'SAME_TABLE' | 'TIME_OVERLAP' | 'TABLE_IN_USE';

const isHolding = (status: BookingStatus) => HOLDING_STATUSES.includes(status);

/**
 * วางการจองลงโต๊ะนี้ได้ไหม (เช็กฝั่งหน้าเว็บก่อนเปิดยืนยัน — DB ตรวจซ้ำ: TABLE_TAKEN / ZONE_FULL)
 * คืน null = วางได้ · ลำดับเช็ก:
 *  1. booking.status ไม่อยู่ใน HOLDING_STATUSES → 'NOT_MOVABLE'
 *  2. target.id === booking.table_id → 'SAME_TABLE'
 *  3. มีการจองอื่น (id ≠ booking.id) ใน targetBookings ที่ status อยู่ใน HOLDING_STATUSES และ periodsOverlap → 'TIME_OVERLAP'
 *  4. target.status === 'IN_USE' && target.status_source === 'MANUAL' และ
 *     (booking.status === 'CHECKED_IN' || reserved_from − TABLE_BOARD_RESERVED_LEAD_MINUTES ≤ now) → 'TABLE_IN_USE'
 */
export function boardDropBlock(
  booking: BoardDropBooking,
  target: BoardDropTarget,
  targetBookings: readonly BoardDropBooking[],
  now: Date = new Date(),
): BoardDropBlock | null {
  if (!isHolding(booking.status)) return 'NOT_MOVABLE';
  if (target.id === booking.table_id) return 'SAME_TABLE';
  if (targetBookings.some((b) => b.id !== booking.id && isHolding(b.status) && periodsOverlap(b, booking))) return 'TIME_OVERLAP';
  if (target.status === 'IN_USE' && target.status_source === 'MANUAL') {
    const startsSoon = Date.parse(booking.reserved_from) - TABLE_BOARD_RESERVED_LEAD_MINUTES * MINUTE_MS <= now.getTime();
    if (booking.status === 'CHECKED_IN' || startsSoon) return 'TABLE_IN_USE';
  }
  return null;
}

// ---- ไทม์ไลน์ (อยู่ที่นี่เพราะหน้าเว็บไม่มี test runner — logic ข้ามเที่ยงคืนต้องมีเทสต์) ----

/** epoch ms · ครึ่งเปิด [start, end) */
export interface LaneSpan {
  start: number;
  end: number;
}

/** จัดแถบที่ทับกันเป็นแถวย่อยแบบ greedy: เรียงตาม start (เท่ากันเรียง end) → ใส่แถวแรกที่ end สุดท้าย ≤ start · คืนแถว (เรียงตาม start ในแถว) */
export function packLanes<T extends LaneSpan>(items: readonly T[]): T[][] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const lanes: T[][] = [];
  for (const item of sorted) {
    const lane = lanes.find((l) => l[l.length - 1]!.end <= item.start);
    if (lane) lane.push(item);
    else lanes.push([item]);
  }
  return lanes;
}

/** 'HH:mm' (รูปเดียวกับ bar.hours) */
export interface NightHours {
  open: string;
  close: string;
  closed?: boolean;
}

/** ไม่มีเวลาเปิด-ปิด (หรือปิดวันนั้น) และไม่มีการจอง → แสดง 18:00–02:00 */
const FALLBACK_OPEN = '18:00';
const FALLBACK_CLOSE = '02:00';

/** epoch ms ของ 'HH:mm' เวลาไทยในคืน night (ก่อนเวลาตัดวัน 06:00 = วันถัดไป) */
function nightClock(night: string, hhmm: string): number {
  const [y, m, d] = night.split('-').map(Number) as [number, number, number];
  const [hh = 0, mm = 0] = hhmm.split(':').map(Number);
  const nextDay = hh < BUSINESS_NIGHT_CUTOFF_HOUR ? 1 : 0;
  return Date.UTC(y, m - 1, d + nextDay, hh - BKK_OFFSET_HOURS, mm);
}

/** ช่วงเปิด-ปิดของคืนนั้น (ปิด ≤ เปิด = วันถัดไป) */
function openingSpan(night: string, open: string, close: string): LaneSpan {
  const start = nightClock(night, open);
  let end = nightClock(night, close);
  while (end <= start) end += 24 * HOUR_MS;
  return { start, end };
}

/**
 * ช่วงเวลาที่ไทม์ไลน์แสดง (epoch ms) — ปัดลง/ขึ้นเป็นชั่วโมงเต็ม แล้วบีบให้อยู่ใน [nightStart, nightEnd]
 *   start = min(เวลาเปิดของคืนนั้น, reserved_from ที่เร็วสุด, now ถ้าอยู่ในคืน)
 *   end   = max(เวลาปิด (ปิด ≤ เปิด = วันถัดไป), reserved_until ที่ช้าสุด, now ถ้าอยู่ในคืน)
 *   hours = null/closed และไม่มีการจอง → 18:00–02:00 ของคืนนั้น · เวลาไทย (UTC+7)
 */
export function timelineRange(input: {
  /** 'YYYY-MM-DD' */
  night: string;
  nightStart: string;
  nightEnd: string;
  /** ของวันในสัปดาห์ของ night (0 = อาทิตย์ — หน้าเว็บเลือกจาก bar.hours เอง) */
  hours: NightHours | null;
  periods: readonly BoardPeriod[];
  now?: Date;
}): { start: number; end: number } {
  const { night, hours, periods } = input;
  const nightStart = Date.parse(input.nightStart);
  const nightEnd = Date.parse(input.nightEnd);
  const now = (input.now ?? new Date()).getTime();

  const points: number[] = [];
  const isOpen = hours != null && !hours.closed;
  if (isOpen) {
    const span = openingSpan(night, hours.open, hours.close);
    points.push(span.start, span.end);
  } else if (periods.length === 0) {
    const span = openingSpan(night, FALLBACK_OPEN, FALLBACK_CLOSE);
    points.push(span.start, span.end);
  }
  for (const p of periods) points.push(Date.parse(p.reserved_from), Date.parse(p.reserved_until));
  if (now >= nightStart && now < nightEnd) points.push(now);

  const start = Math.max(nightStart, Math.floor(Math.min(...points) / HOUR_MS) * HOUR_MS);
  const end = Math.min(nightEnd, Math.ceil(Math.max(...points) / HOUR_MS) * HOUR_MS);
  return { start, end: end > start ? end : Math.min(nightEnd, start + HOUR_MS) };
}
