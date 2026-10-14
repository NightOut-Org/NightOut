import type * as C from '@nightout/contracts';
import { CheckCircle, Clock, UsersThree, type Icon } from '@phosphor-icons/react';
import type { TableBoardStatus } from '@nightout/utils';

/** สีตาม token Midnight Gold (packages/ui theme.css) — ต้องตรงกับ /merchant/floor ของหน้าบ้าน */
export const STATUS_META: Record<TableBoardStatus, { label: string; color: string; icon: Icon }> = {
  FREE: { label: 'ว่าง', color: 'var(--crowd-available)', icon: CheckCircle },
  RESERVED: { label: 'จองแล้ว', color: 'var(--gold)', icon: Clock },
  IN_USE: { label: 'กำลังใช้', color: 'var(--crowd-full)', icon: UsersThree },
};

/** การจองที่ยังไม่ได้ชำระ/ยืนยัน — วาดเส้นประ */
export const UNPAID_STATUSES = new Set<C.TableBoardBooking['status']>([
  'PENDING',
  'AWAITING_DEPOSIT',
  'DEPOSIT_SUBMITTED',
]);

export const PR_LABEL: Record<NonNullable<C.TableBoardBooking['request_pr']>, string> = {
  MALE: 'PR ชาย',
  FEMALE: 'PR หญิง',
  LGBTQ: 'PR LGBTQ+',
};

const BKK = 'Asia/Bangkok';

/** 'HH:mm' เวลาไทย */
export const hhmm = (iso: string | number) =>
  new Date(iso).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: BKK,
  });

/** 'HH:mm:ss' เวลาไทย (เวลาอัปเดตล่าสุด) */
export const hhmmss = (ms: number) =>
  new Date(ms).toLocaleTimeString('th-TH', { hour12: false, timeZone: BKK });

/** 'คืนวันศุกร์ 16 ต.ค.' จาก night 'YYYY-MM-DD' */
export const nightLabel = (night: string) =>
  `คืน${new Date(`${night}T12:00:00+07:00`).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: BKK,
  })}`;

export const byThaiName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'th', { numeric: true });

export interface ZoneGroup {
  zone: C.TableBoardZone;
  tables: C.TableBoardTable[];
  /** การจองของโซนนี้ที่ยังไม่ระบุโต๊ะ (หรือโต๊ะที่ปิดใช้แล้ว) */
  unassigned: C.TableBoardBooking[];
}

export interface BoardGroups {
  zones: ZoneGroup[];
  /** การจองของโซนที่ปิดใช้แล้ว */
  inactive: C.TableBoardBooking[];
  /** การจองตามโต๊ะ (เรียงตามเวลา — ลำดับเดียวกับที่ DB ส่งมา) */
  byTable: Map<string, C.TableBoardBooking[]>;
  counts: Record<TableBoardStatus | 'ALL', number>;
}

/** จัดกลุ่มข้อมูลผังโต๊ะ: โซน → โต๊ะ (เรียงชื่อแบบตัวเลข) + การจองที่ยังไม่ระบุโต๊ะ + โซนที่ปิดใช้ */
export function groupBoard(board: C.TableBoard): BoardGroups {
  const counts = { ALL: 0, FREE: 0, RESERVED: 0, IN_USE: 0 };
  const byTable = new Map<string, C.TableBoardBooking[]>();
  const activeZone = new Map(board.zones.map((z) => [z.id, new Set(z.tables.map((t) => t.id))]));
  const unassigned = new Map<string, C.TableBoardBooking[]>();
  const inactive: C.TableBoardBooking[] = [];

  for (const b of board.bookings) {
    const tables = activeZone.get(b.zone_id);
    if (!tables) inactive.push(b);
    else if (b.table_id && tables.has(b.table_id))
      byTable.set(b.table_id, [...(byTable.get(b.table_id) ?? []), b]);
    else unassigned.set(b.zone_id, [...(unassigned.get(b.zone_id) ?? []), b]);
  }

  const zones = board.zones.map((zone) => {
    for (const t of zone.tables) {
      counts.ALL += 1;
      counts[t.status] += 1;
    }
    return {
      zone,
      tables: [...zone.tables].sort(byThaiName),
      unassigned: unassigned.get(zone.id) ?? [],
    };
  });
  return { zones, inactive, byTable, counts };
}
