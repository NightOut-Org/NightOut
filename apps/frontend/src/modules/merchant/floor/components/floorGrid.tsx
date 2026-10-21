import { Chair, Ticket } from '@phosphor-icons/react';
import type * as C from '@nightout/contracts';
import type { BoardDropBlock, TableBoardStatus } from '@nightout/utils';
import { Button, Empty } from 'antd';
import { BOOKING_STATUS } from '@/ui/utils/format';
import { bookingWho, byTableName, hhmm, type BoardIndex } from '../utils/board';
import { BookingChip } from './bookingChip';
import { TableCard, type DropState } from './tableCard';
import { MetaList } from '@/ui/components/metaList';
import { StatusChip } from '@/ui/components/statusChip';

export type StatusFilter = TableBoardStatus | 'ALL';

/** หลังกรองสถานะแล้วยังมีอะไรให้แสดงไหม (โต๊ะที่ตรง / การจองยังไม่ระบุโต๊ะ / โซนที่ปิดใช้) */
export function hasVisibleRows(board: C.TableBoard, index: BoardIndex, filter: StatusFilter): boolean {
  if (index.inactiveZone.length > 0) return true;
  return board.zones.some(
    (z) =>
      (index.unassigned.get(z.id)?.length ?? 0) > 0 ||
      z.tables.some((t) => filter === 'ALL' || t.status === filter),
  );
}

/** กรองแล้วไม่เหลือโต๊ะ — บอกให้ชัดว่าไม่ใช่โหลดไม่ขึ้น */
export function FilterEmpty({ onReset }: { onReset: () => void }) {
  return (
    <Empty description="ไม่มีโต๊ะสถานะนี้">
      <Button size="large" onClick={onReset}>
        ดูทั้งหมด
      </Button>
    </Empty>
  );
}

const toDropState = (block: BoardDropBlock | null | undefined): DropState =>
  block === undefined ? undefined : block === null ? 'valid' : 'invalid';

/** ชิปการจองที่ยังไม่ระบุโต๊ะ / อยู่โซนที่ปิดใช้ */
function LaneChips({
  bookings,
  onTap,
}: {
  bookings: C.TableBoardBooking[];
  onTap: (b: C.TableBoardBooking) => void;
}) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 lg:grid-cols-4">
      {bookings.map((b) => (
        <li key={b.id}>
          <BookingChip booking={b} label={`${b.code} ${bookingWho(b)}`} onTap={() => onTap(b)}>
            <span className="truncate font-medium">
              <span className="mr-2 tabular-nums">{hhmm(b.booking_datetime)}</span>
              {bookingWho(b)}
            </span>
            <span className="truncate text-xs text-muted">
              <MetaList
                items={[
                  { icon: <Ticket weight="fill" />, label: 'รหัสจอง', value: b.code },
                  BOOKING_STATUS[b.status].label,
                  b.table_name && { icon: <Chair weight="fill" />, label: 'โต๊ะเดิม', value: `เดิม ${b.table_name}` },
                ]}
              />
            </span>
          </BookingChip>
        </li>
      ))}
    </ul>
  );
}

/** มุมมองผังโต๊ะ: การ์ดโต๊ะแยกตามโซน + แถว "ยังไม่ระบุโต๊ะ" + "โซนที่ปิดใช้แล้ว" */
export function FloorGrid({
  board,
  index,
  filter,
  now,
  blockFor,
  onOpenTable,
  onLaneTap,
  onResetFilter,
}: {
  board: C.TableBoard;
  index: BoardIndex;
  filter: StatusFilter;
  now: number;
  blockFor: (tableId: string) => BoardDropBlock | null | undefined;
  onOpenTable: (tableId: string) => void;
  onLaneTap: (b: C.TableBoardBooking) => void;
  /** กรองแล้วไม่เหลืออะไร → ปุ่มกลับไป "ทั้งหมด" */
  onResetFilter: () => void;
}) {
  if (!hasVisibleRows(board, index, filter)) return <FilterEmpty onReset={onResetFilter} />;
  return (
    <div className="flex flex-col gap-6">
      {board.zones.map((zone) => {
        const tables = [...zone.tables].sort(byTableName);
        const shown = filter === 'ALL' ? tables : tables.filter((t) => t.status === filter);
        const count = (s: TableBoardStatus) => tables.filter((t) => t.status === s).length;
        const lane = index.unassigned.get(zone.id) ?? [];
        if (!shown.length && !lane.length) return null;
        return (
          <section key={zone.id} aria-labelledby={`zone-${zone.id}`} className="flex flex-col gap-2.5">
            <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <h2 id={`zone-${zone.id}`} className="m-0 text-base font-semibold">
                {zone.name} ({tables.length} โต๊ะ)
              </h2>
              <span className="text-xs text-muted">
                <span className="flex flex-wrap gap-1.5">
                  <StatusChip tone="success" value={count('FREE')}>ว่าง</StatusChip>
                  <StatusChip tone="gold" value={count('RESERVED')}>จองแล้ว</StatusChip>
                  <StatusChip tone="purple" value={count('IN_USE')}>กำลังใช้</StatusChip>
                </span>
              </span>
            </header>
            {lane.length > 0 && (
              <div className="rounded-[14px] border border-dashed border-border p-2.5">
                <p className="mb-2 text-xs text-muted">
                  ยังไม่ระบุโต๊ะ ({lane.length}) — ลากไปวางที่โต๊ะว่างเพื่อจัดโต๊ะ
                </p>
                <LaneChips bookings={lane} onTap={onLaneTap} />
              </div>
            )}
            {shown.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {shown.map((t) => (
                  <TableCard
                    key={t.id}
                    table={t}
                    zoneId={zone.id}
                    current={t.current_booking_id ? (index.bookings.get(t.current_booking_id) ?? null) : null}
                    now={now}
                    dropState={toDropState(blockFor(t.id))}
                    onOpen={() => onOpenTable(t.id)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {index.inactiveZone.length > 0 && (
        <section aria-labelledby="zone-inactive" className="flex flex-col gap-2.5">
          <h2 id="zone-inactive" className="m-0 text-base font-semibold text-muted">
            โซนที่ปิดใช้แล้ว ({index.inactiveZone.length})
          </h2>
          <p className="m-0 text-xs text-muted">การจองคืนนี้ที่อยู่ในโซนที่ปิดใช้ — ลากไปวางที่โต๊ะว่างเพื่อย้าย</p>
          <LaneChips bookings={index.inactiveZone} onTap={onLaneTap} />
        </section>
      )}
    </div>
  );
}
