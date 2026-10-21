import type { Icon } from '@phosphor-icons/react';
import { CheckCircle, Clock, UsersThree } from '@phosphor-icons/react';
import type * as C from '@nightout/contracts';
import type { BookingStatus } from '@nightout/types';
import { HOLDING_STATUSES, type BoardDropBlock, type TableBoardStatus } from '@nightout/utils';

/** ป้าย/สี/ไอคอนของสถานะโต๊ะ — ห้ามใช้สีอย่างเดียว: แสดงไอคอน + ข้อความเสมอ */
export const TABLE_STATUS_META: Record<TableBoardStatus, { label: string; color: string; Icon: Icon }> = {
  FREE: { label: 'ว่าง', color: 'var(--crowd-available)', Icon: CheckCircle },
  RESERVED: { label: 'จองแล้ว', color: 'var(--gold)', Icon: Clock },
  IN_USE: { label: 'กำลังใช้', color: 'var(--crowd-full)', Icon: UsersThree },
};

/** เหตุผลที่วางการจองลงโต๊ะนี้ไม่ได้ (boardDropBlock ใน @nightout/utils) */
export const DROP_BLOCK_TEXT: Record<BoardDropBlock, string> = {
  SAME_TABLE: 'อยู่โต๊ะนี้อยู่แล้ว',
  TIME_OVERLAP: 'โต๊ะนี้มีการจองอื่นในช่วงเวลาเดียวกัน',
  TABLE_IN_USE: 'โต๊ะนี้มีลูกค้านั่งอยู่ (ตั้งเป็นกำลังใช้) — ตั้งเป็นว่างก่อน',
  NOT_MOVABLE: 'ย้ายได้เฉพาะการจองที่ยังไม่จบ',
};

export const PR_LABEL: Record<NonNullable<C.TableBoardBooking['request_pr']>, string> = {
  MALE: 'ชาย',
  FEMALE: 'หญิง',
  LGBTQ: 'LGBTQ+',
};

/** ยังไม่ชำระ / รอร้านยืนยัน → ขอบเส้นประ */
const UNPAID: readonly BookingStatus[] = ['PENDING', 'AWAITING_DEPOSIT', 'DEPOSIT_SUBMITTED'];
export const isUnpaid = (s: BookingStatus) => UNPAID.includes(s);
export const isHolding = (s: BookingStatus) => HOLDING_STATUSES.includes(s);

// ---- เวลา (ตรงกับ "คืน" 06:00–06:00 เวลาไทยของ server) ----
const TZ = 'Asia/Bangkok';
const HM = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ });
const HMS = new Intl.DateTimeFormat('th-TH', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: TZ,
});
const NIGHT = new Intl.DateTimeFormat('th-TH', { weekday: 'long', day: 'numeric', month: 'short', timeZone: TZ });

type TimeInput = string | number | Date;
export const hhmm = (t: TimeInput) => HM.format(new Date(t));
export const hhmmss = (t: TimeInput) => HMS.format(new Date(t));

/** เที่ยงวันของคืนนั้น (เวลาไทย) — `new Date('YYYY-MM-DD')` เป็นเที่ยงคืน UTC จึงห้ามใช้ตรง ๆ */
const nightNoon = (night: string) => new Date(`${night}T12:00:00+07:00`);

/** "คืนวันศุกร์ 16 ต.ค." */
export function nightLabel(night: string): string {
  const parts = NIGHT.formatToParts(nightNoon(night));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `คืน${get('weekday')} ${get('day')} ${get('month')}`;
}

/** วันในสัปดาห์ของคืนนั้น (0 = อาทิตย์ — ตรงกับ bar.hours[].day) */
export const nightWeekday = (night: string) => nightNoon(night).getUTCDay();

/** นาทีจาก a ถึง b (ปัดขึ้น · ติดลบได้) */
export const minutesUntil = (to: TimeInput, from: number) => Math.ceil((new Date(to).getTime() - from) / 60_000);

// ---- ดัชนีของผัง ----
export interface BoardTableRef {
  table: C.TableBoardTable;
  zone: C.TableBoardZone;
}

export interface BoardIndex {
  tables: Map<string, BoardTableRef>;
  bookings: Map<string, C.TableBoardBooking>;
  /** การจองของคืนนั้นตามโต๊ะ (เรียงตามเวลา) */
  byTable: Map<string, C.TableBoardBooking[]>;
  /** การจองของโซนที่เปิดใช้ แต่ยังไม่ระบุโต๊ะ / โต๊ะถูกปิดใช้ */
  unassigned: Map<string, C.TableBoardBooking[]>;
  /** การจองของโซนที่ปิดใช้แล้ว */
  inactiveZone: C.TableBoardBooking[];
  counts: Record<TableBoardStatus | 'ALL', number>;
}

export function buildBoardIndex(board: C.TableBoard): BoardIndex {
  const tables = new Map<string, BoardTableRef>();
  const counts = { ALL: 0, FREE: 0, RESERVED: 0, IN_USE: 0 };
  for (const zone of board.zones)
    for (const table of zone.tables) {
      tables.set(table.id, { table, zone });
      counts.ALL += 1;
      counts[table.status] += 1;
    }
  const zoneIds = new Set(board.zones.map((z) => z.id));
  const bookings = new Map<string, C.TableBoardBooking>();
  const byTable = new Map<string, C.TableBoardBooking[]>();
  const unassigned = new Map<string, C.TableBoardBooking[]>();
  const inactiveZone: C.TableBoardBooking[] = [];
  const push = (m: Map<string, C.TableBoardBooking[]>, k: string, b: C.TableBoardBooking) =>
    m.set(k, [...(m.get(k) ?? []), b]);
  for (const b of board.bookings) {
    bookings.set(b.id, b);
    const ref = b.table_id ? tables.get(b.table_id) : undefined;
    if (ref && ref.zone.id === b.zone_id) push(byTable, ref.table.id, b);
    else if (zoneIds.has(b.zone_id)) push(unassigned, b.zone_id, b);
    else inactiveZone.push(b);
  }
  return { tables, bookings, byTable, unassigned, inactiveZone, counts };
}

/** เรียงชื่อโต๊ะแบบคน (A2 ก่อน A10) */
export const byTableName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'th', { numeric: true });

/** "{code} · {ชื่อ} · {n} คน" */
export const bookingWho = (b: C.TableBoardBooking) => `${b.customer_name ?? 'ลูกค้า'} (${b.pax} คน)`;
