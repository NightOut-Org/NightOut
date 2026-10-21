import { useDraggable, useDroppable } from '@dnd-kit/core';
import type * as C from '@nightout/contracts';
import { packLanes, timelineRange, type BoardDropBlock, type NightHours } from '@nightout/utils';
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { BOOKING_STATUS } from '@/ui/utils/format';
import { TABLE_STATUS_META, byTableName, hhmm, isHolding, isUnpaid, type BoardIndex } from '../utils/board';
import {
  HOUR_PX,
  LANE_PX,
  NAME_COL_PX,
  canvasWidth,
  clampSpan,
  hourTicks,
  rowHeight,
  widthOf,
  xOf,
} from '../utils/timeline';
import type { DragData, DropData } from '../utils/useBoardMove';
import { DRAGGABLE_ROLE } from './bookingChip';
import { FilterEmpty, hasVisibleRows, type StatusFilter } from './floorGrid';

type Range = { start: number; end: number };
type Item =
  | { kind: 'booking'; booking: C.TableBoardBooking; start: number; end: number }
  | { kind: 'manual'; occupancy: C.TableBoardOccupancy; start: number; end: number };

/** สีของแถบตามสถานะการจอง */
function barStyle(b: C.TableBoardBooking): CSSProperties {
  const solid = (c: string, pct = 28): CSSProperties => ({
    borderColor: c,
    background: `color-mix(in srgb, ${c} ${pct}%, var(--card))`,
  });
  if (b.status === 'CHECKED_IN') return solid('var(--crowd-full)');
  if (isUnpaid(b.status)) return { ...solid('var(--gold)', 12), borderStyle: 'dashed' };
  if (b.status === 'CONFIRMED') return solid('var(--gold)');
  if (b.status === 'NO_SHOW') return { ...solid('var(--crowd-full)', 10), opacity: 0.6 };
  return { ...solid('var(--muted)', 14), opacity: 0.7 };
}

function itemsOf(bookings: readonly C.TableBoardBooking[], occupancy: C.TableBoardOccupancy | null, now: number, range: Range) {
  const items: Item[] = bookings.map((b) => ({
    kind: 'booking',
    booking: b,
    ...clampSpan(Date.parse(b.reserved_from), Date.parse(b.completed_at ?? b.reserved_until), range),
  }));
  if (occupancy) items.push({ kind: 'manual', occupancy, ...clampSpan(Date.parse(occupancy.started_at), now, range) });
  return packLanes(items);
}

/** แถบการจอง 1 รายการ — ลากไปแถวโต๊ะอื่นได้ (เวลาเดิม เปลี่ยนแค่โต๊ะ) */
function BookingBar({
  booking,
  lane,
  span,
  range,
  onTap,
}: {
  booking: C.TableBoardBooking;
  lane: number;
  span: Range;
  range: Range;
  onTap: () => void;
}) {
  const draggable = isHolding(booking.status);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `booking:${booking.id}`,
    data: { bookingId: booking.id } satisfies DragData,
    disabled: !draggable,
  });
  const forfeited = booking.status === 'NO_SHOW';
  const text = `${hhmm(booking.booking_datetime)} ${booking.customer_name ?? 'ลูกค้า'} ${booking.pax}`;
  // ลากไม่ได้ = ปุ่มธรรมดา (ไม่ใส่ aria-disabled / คำอธิบายการลากของ dnd-kit)
  const a11y = draggable ? { ...attributes, 'aria-roledescription': DRAGGABLE_ROLE } : { role: 'button', tabIndex: 0 };
  return (
    <div
      ref={setNodeRef}
      {...a11y}
      aria-label={`${booking.code} ${text} ${BOOKING_STATUS[booking.status].label}${draggable ? ' (ลากเพื่อย้ายโต๊ะ)' : ''}`}
      onClick={onTap}
      onKeyDown={(e) => {
        if (!draggable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onTap();
        }
      }}
      // ลากได้: ตัวฟังของ dnd-kit (คีย์บอร์ด Space/Enter = ยก) ทับ onKeyDown ด้านบน
      {...listeners}
      className={`floor-chip absolute flex items-center overflow-hidden rounded-lg border px-2 text-xs whitespace-nowrap ${
        draggable ? 'cursor-grab' : 'cursor-pointer'
      } ${isDragging ? 'opacity-40' : ''}`}
      style={{
        ...barStyle(booking),
        left: xOf(span.start, range.start),
        width: widthOf(span.start, span.end),
        top: 4 + lane * LANE_PX,
        height: LANE_PX - 6,
      }}
    >
      <span className={`truncate ${forfeited ? 'line-through' : 'font-medium'}`}>
        {forfeited ? `${text} (ปลดโต๊ะ Forfeited)` : text}
      </span>
    </div>
  );
}

function Lanes({
  lanes,
  range,
  onBarTap,
}: {
  lanes: Item[][];
  range: Range;
  onBarTap: (b: C.TableBoardBooking) => void;
}) {
  return lanes.flatMap((lane, i) =>
    lane.map((it) =>
      it.kind === 'booking' ? (
        <BookingBar
          key={it.booking.id}
          booking={it.booking}
          lane={i}
          span={it}
          range={range}
          onTap={() => onBarTap(it.booking)}
        />
      ) : (
        <div
          key={it.occupancy.id}
          className="floor-hatch absolute flex items-center overflow-hidden rounded-lg border border-(--crowd-full) px-2 text-xs whitespace-nowrap"
          style={{
            left: xOf(it.start, range.start),
            width: widthOf(it.start, it.end),
            top: 4 + i * LANE_PX,
            height: LANE_PX - 6,
          }}
        >
          <span className="truncate font-medium">กำลังใช้ (ไม่มีการจอง)</span>
        </div>
      ),
    ),
  );
}

const gridLines: CSSProperties = {
  backgroundImage: `repeating-linear-gradient(to right, color-mix(in srgb, var(--border) 70%, transparent) 0 1px, transparent 1px ${HOUR_PX}px)`,
};

/** แถวการจองที่ไม่มีโต๊ะบนผัง ("ยังไม่ระบุโต๊ะ" / "โซนที่ปิดใช้แล้ว") — แถบยังลากไปโต๊ะว่างได้ */
function LooseRow({
  label,
  bookings,
  range,
  now,
  onBarTap,
}: {
  label: string;
  bookings: readonly C.TableBoardBooking[];
  range: Range;
  now: number;
  onBarTap: (b: C.TableBoardBooking) => void;
}) {
  const lanes = itemsOf(bookings, null, now, range);
  return (
    <div className="flex border-b border-border/60" style={{ height: rowHeight(lanes.length) }}>
      <span
        className="merchant-solid sticky left-0 z-20 flex shrink-0 items-center border-r border-border bg-card px-2.5 text-[11px] leading-tight text-muted"
        style={{ width: NAME_COL_PX }}
      >
        {label}
      </span>
      <div className="relative flex-1" style={gridLines}>
        <Lanes lanes={lanes} range={range} onBarTap={onBarTap} />
      </div>
    </div>
  );
}

/** แถวโต๊ะ 1 แถว — วางการจองได้ (`row:<id>`) */
function TableRow({
  table,
  zoneId,
  bookings,
  range,
  now,
  dropState,
  onOpen,
  onBarTap,
}: {
  table: C.TableBoardTable;
  zoneId: string;
  bookings: C.TableBoardBooking[];
  range: Range;
  now: number;
  dropState: 'valid' | 'invalid' | undefined;
  onOpen: () => void;
  onBarTap: (b: C.TableBoardBooking) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `row:${table.id}`,
    data: { tableId: table.id, zoneId } satisfies DropData,
  });
  const lanes = itemsOf(bookings, table.status_source === 'MANUAL' ? table.occupancy : null, now, range);
  const meta = TABLE_STATUS_META[table.status];
  return (
    <div
      ref={setNodeRef}
      className={`floor-card flex border-b border-border/60 ${dropState === 'invalid' ? 'opacity-50' : ''}`}
      style={{
        height: rowHeight(lanes.length),
        background: dropState === 'valid' ? `color-mix(in srgb, var(--gold) ${isOver ? 18 : 8}%, transparent)` : undefined,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`โต๊ะ ${table.name} ${meta.label} ${table.seats} ที่นั่ง`}
        className="floor-card-button merchant-solid sticky left-0 z-20 flex shrink-0 items-center gap-1.5 border-r border-border bg-card px-2.5 text-left"
        style={{ width: NAME_COL_PX }}
      >
        <meta.Icon size={14} weight="fill" style={{ color: meta.color }} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{table.name}</span>
        <span className="shrink-0 text-[11px] text-muted">{table.seats}</span>
      </button>
      <div className="relative flex-1" style={gridLines}>
        <Lanes lanes={lanes} range={range} onBarTap={onBarTap} />
      </div>
    </div>
  );
}

/**
 * มุมมองไทม์ไลน์คืนนี้ — แถวละโต๊ะ (72px/ชม.) · คอลัมน์ชื่อโต๊ะติดซ้าย · เส้น "ตอนนี้" สีทอง
 * แถบการจองที่ยังไม่จบลากไปแถวโต๊ะอื่นได้ (เวลาเดิม)
 */
export function FloorTimeline({
  board,
  index,
  filter,
  hours,
  now,
  blockFor,
  onOpenTable,
  onBarTap,
  onResetFilter,
}: {
  board: C.TableBoard;
  index: BoardIndex;
  filter: StatusFilter;
  hours: NightHours | null;
  now: number;
  blockFor: (tableId: string) => BoardDropBlock | null | undefined;
  onOpenTable: (tableId: string) => void;
  onBarTap: (b: C.TableBoardBooking) => void;
  /** กรองแล้วไม่เหลืออะไร → ปุ่มกลับไป "ทั้งหมด" */
  onResetFilter: () => void;
}) {
  const range = useMemo(
    () =>
      timelineRange({
        night: board.night,
        nightStart: board.night_start,
        nightEnd: board.night_end,
        hours,
        periods: board.bookings,
        now: new Date(now),
      }),
    [board.night, board.night_start, board.night_end, board.bookings, hours, now],
  );
  const width = NAME_COL_PX + canvasWidth(range);
  const nowInside = now >= range.start && now <= range.end;
  const scroller = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  // ครั้งแรก: เลื่อนให้ "ตอนนี้" อยู่ราว 25% ของจอ
  useEffect(() => {
    const el = scroller.current;
    if (!el || scrolled.current || !nowInside) return;
    scrolled.current = true;
    el.scrollLeft = Math.max(0, xOf(now, range.start) - (el.clientWidth - NAME_COL_PX) * 0.25);
  }, [now, nowInside, range.start]);

  if (!hasVisibleRows(board, index, filter)) return <FilterEmpty onReset={onResetFilter} />;

  return (
    <div
      ref={scroller}
      className="merchant-solid overflow-x-auto overscroll-x-contain rounded-[14px] border border-border bg-card"
    >
      <div className="relative min-w-full" style={{ width }}>
        {/* หัวเวลา */}
        <div className="flex h-8 border-b border-border">
          <span className="merchant-solid sticky left-0 z-20 shrink-0 border-r border-border bg-card" style={{ width: NAME_COL_PX }} />
          <div className="relative flex-1">
            {hourTicks(range).map((t) => (
              <span
                key={t}
                className="absolute top-1.5 -translate-x-1/2 text-[11px] text-muted tabular-nums first:translate-x-0"
                style={{ left: xOf(t, range.start) }}
              >
                {hhmm(t)}
              </span>
            ))}
          </div>
        </div>

        {board.zones.map((zone) => {
          const tables = [...zone.tables].sort(byTableName).filter((t) => filter === 'ALL' || t.status === filter);
          const lane = index.unassigned.get(zone.id) ?? [];
          if (!tables.length && !lane.length) return null;
          return (
            <section key={zone.id} aria-label={`โซน ${zone.name}`}>
              <div className="flex h-7 items-center border-b border-border bg-surface/60">
                <b className="sticky left-0 px-2.5 text-xs font-semibold">{zone.name}</b>
              </div>
              {lane.length > 0 && (
                <LooseRow label="ยังไม่ระบุโต๊ะ" bookings={lane} range={range} now={now} onBarTap={onBarTap} />
              )}
              {tables.map((t) => {
                const block = blockFor(t.id);
                return (
                  <TableRow
                    key={t.id}
                    table={t}
                    zoneId={zone.id}
                    bookings={index.byTable.get(t.id) ?? []}
                    range={range}
                    now={now}
                    dropState={block === undefined ? undefined : block === null ? 'valid' : 'invalid'}
                    onOpen={() => onOpenTable(t.id)}
                    onBarTap={onBarTap}
                  />
                );
              })}
            </section>
          );
        })}

        {index.inactiveZone.length > 0 && (
          <section aria-label="โซนที่ปิดใช้แล้ว">
            <div className="flex h-7 items-center border-b border-border bg-surface/60">
              <b className="sticky left-0 px-2.5 text-xs font-semibold text-muted">โซนที่ปิดใช้แล้ว</b>
            </div>
            <LooseRow label="ลากไปโต๊ะว่าง" bookings={index.inactiveZone} range={range} now={now} onBarTap={onBarTap} />
          </section>
        )}

        {nowInside && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-gold"
            style={{ left: NAME_COL_PX + xOf(now, range.start) }}
          >
            <span className="absolute top-1 left-1 rounded bg-gold px-1 text-[10px] font-semibold text-on-gold">ตอนนี้</span>
          </div>
        )}
      </div>
    </div>
  );
}
