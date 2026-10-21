import { ClockClockwise, Timer, WarningCircle } from '@phosphor-icons/react';
import { useDroppable } from '@dnd-kit/core';
import type * as C from '@nightout/contracts';
import { TABLE_BOARD_RESERVED_LEAD_MINUTES } from '@nightout/utils';
import { BOOKING_STATUS } from '@/ui/utils/format';
import { TABLE_STATUS_META, bookingWho, hhmm, isUnpaid, minutesUntil } from '../utils/board';
import type { DropData } from '../utils/useBoardMove';
import { BookingChip } from './bookingChip';
import { StatusPill } from './floorLegend';
import { StatusChip } from '@/ui/components/statusChip';

/** สถานะเมื่อกำลังลาก/เลือกการจองเพื่อย้าย: valid = วางได้ · invalid = วางไม่ได้ */
export type DropState = 'valid' | 'invalid' | undefined;

/** บรรทัดเวลาของการจองที่ยังไม่เช็กอิน: อีก n นาที / ถึงเวลานัด / สาย n นาที (n ≥ 1) · ปลดโต๊ะ HH:mm */
export function TimingLine({ booking, now }: { booking: C.TableBoardBooking; now: number }) {
  const until = minutesUntil(booking.booking_datetime, now);
  return (
    <>
      {until > 0 ? (
        <span className="text-xs text-muted">อีก {until} นาที</span>
      ) : until === 0 ? (
        <StatusChip icon={<Timer weight="fill" />} value={hhmm(booking.auto_cancel_at)}>
          ถึงเวลานัด ปลดโต๊ะ
        </StatusChip>
      ) : (
        <StatusChip tone="danger" icon={<WarningCircle weight="fill" />} value={hhmm(booking.auto_cancel_at)}>
          สาย {-until} นาที ปลดโต๊ะ
        </StatusChip>
      )}
      {booking.extended_at && (
        <StatusChip icon={<ClockClockwise weight="bold" />}>ต่อเวลาแล้ว</StatusChip>
      )}
      {isUnpaid(booking.status) && <span className="text-xs text-gold-text">{BOOKING_STATUS[booking.status].label}</span>}
    </>
  );
}

/**
 * การ์ดโต๊ะ 1 ตัว — `div` ที่วางการจองได้ (`table:<id>`) · ปุ่มเต็มการ์ด (เปิดแผงโต๊ะ) อยู่ข้างชิปที่ลากได้ ไม่ซ้อนกัน
 */
export function TableCard({
  table,
  zoneId,
  current,
  now,
  dropState,
  onOpen,
}: {
  table: C.TableBoardTable;
  zoneId: string;
  /** การจองปัจจุบันของโต๊ะ (current_booking_id) */
  current: C.TableBoardBooking | null;
  now: number;
  dropState: DropState;
  onOpen: () => void;
}) {
  const meta = TABLE_STATUS_META[table.status];
  const { setNodeRef, isOver } = useDroppable({
    id: `table:${table.id}`,
    data: { tableId: table.id, zoneId } satisfies DropData,
  });
  const manual = table.status === 'IN_USE' && table.status_source === 'MANUAL';
  const nextSoon =
    manual && table.next_booking_at && minutesUntil(table.next_booking_at, now) <= TABLE_BOARD_RESERVED_LEAD_MINUTES;
  const tint = isOver && dropState === 'valid' ? 26 : 12;

  return (
    <div
      ref={setNodeRef}
      className={`floor-card relative min-h-[104px] rounded-[14px] border border-border ${
        dropState === 'valid' ? 'ring-2 ring-gold' : dropState === 'invalid' ? 'opacity-50' : ''
      }`}
      style={{
        background: `color-mix(in srgb, ${meta.color} ${tint}%, var(--card))`,
        borderLeft: `2px solid ${meta.color}`,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`โต๊ะ ${table.name} ${meta.label} ${table.seats} ที่นั่ง`}
        className="floor-card-button absolute inset-0 rounded-[14px]"
      />
      <div className="pointer-events-none relative flex h-full flex-col gap-2 p-3">
        <div className="flex items-center gap-1.5">
          <b className="min-w-0 truncate text-[17px] font-semibold">{table.name}</b>
          <span className="shrink-0 text-xs text-muted">{table.seats} ที่</span>
          <span className="ml-auto">
            <StatusPill status={table.status} />
          </span>
        </div>

        {current && table.status === 'RESERVED' && (
          <div className="pointer-events-auto">
            <BookingChip booking={current} label={`${current.code} ${bookingWho(current)}`} onTap={onOpen}>
              <span className="truncate font-medium">
                <span className="mr-2 tabular-nums">{hhmm(current.booking_datetime)}</span>
                {bookingWho(current)}
              </span>
              <TimingLine booking={current} now={now} />
            </BookingChip>
          </div>
        )}
        {current && table.status === 'IN_USE' && !manual && (
          <div className="pointer-events-auto">
            <BookingChip booking={current} label={`${current.code} ${bookingWho(current)}`} onTap={onOpen}>
              <span className="truncate font-medium">{bookingWho(current)}</span>
              {current.checked_in_at && <span className="text-xs text-muted">เช็กอิน {hhmm(current.checked_in_at)}</span>}
            </BookingChip>
          </div>
        )}
        {manual && table.occupancy && (
          <span className="text-[13px] text-muted">
            นั่งโดยไม่มีการจอง{table.occupancy.pax ? ` (${table.occupancy.pax} คน)` : ''} ตั้งแต่ {hhmm(table.occupancy.started_at)}
          </span>
        )}
        {table.status === 'FREE' && <span className="text-[13px] text-muted">ว่าง</span>}

        {table.next_booking_at && (
          <span className={`mt-auto text-xs ${nextSoon ? 'font-semibold text-(--crowd-full)' : 'text-muted'}`}>
            {nextSoon ? 'มีจอง' : 'จองถัดไป'} {hhmm(table.next_booking_at)}
          </span>
        )}
      </div>
    </div>
  );
}
