import type * as C from '@nightout/contracts';
import { Empty, Tag } from 'antd';
import { StatusTag } from '@/ui/components/StatusTag';
import { BOOKING_STATUS } from '@/ui/utils/labels';
import { STATUS_META, UNPAID_STATUSES, hhmm, type BoardGroups } from '../utils/board';

const MIN = 60_000;

/** ข้อความในการ์ดโต๊ะตามสถานะ (ไม่มียอดเงิน/เบอร์โทร) */
function tableBody(t: C.TableBoardTable, current: C.TableBoardBooking | undefined, now: number) {
  if (t.status === 'IN_USE' && t.status_source === 'MANUAL' && t.occupancy) {
    const pax = t.occupancy.pax ? ` · ${t.occupancy.pax} คน` : '';
    return { text: `ไม่มีการจอง${pax} · ตั้งแต่ ${hhmm(t.occupancy.started_at)}`, late: false };
  }
  if (!current) return { text: 'ว่าง', late: false };
  const who = `${current.customer_name ?? 'ลูกค้า'} · ${current.pax} คน`;
  if (t.status === 'IN_USE') {
    return {
      text: `${who}${current.checked_in_at ? ` · เช็กอิน ${hhmm(current.checked_in_at)}` : ''}`,
      late: false,
    };
  }
  const diff = Math.round((Date.parse(current.booking_datetime) - now) / MIN);
  const extended = current.extended_at ? ' · ต่อเวลาแล้ว' : '';
  if (diff >= 0)
    return {
      text: `${hhmm(current.booking_datetime)} · ${who} · อีก ${diff} นาที${extended}`,
      late: false,
    };
  return {
    text: `${hhmm(current.booking_datetime)} · ${who} · สาย ${-diff} นาที · ปลดโต๊ะ ${hhmm(current.auto_cancel_at)}${extended}`,
    late: true,
  };
}

function TableCard({
  table,
  current,
  now,
  onOpen,
}: {
  table: C.TableBoardTable;
  current: C.TableBoardBooking | undefined;
  now: number;
  onOpen: () => void;
}) {
  const meta = STATUS_META[table.status];
  const Icon = meta.icon;
  const body = tableBody(table, current, now);
  const nextSoon =
    table.status === 'IN_USE' &&
    table.status_source === 'MANUAL' &&
    table.next_booking_at != null &&
    Date.parse(table.next_booking_at) - now <= 60 * MIN;
  const dashed = current && UNPAID_STATUSES.has(current.status);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`โต๊ะ ${table.name} · ${meta.label} · ${table.seats} ที่นั่ง`}
      className="flex min-h-[104px] cursor-pointer flex-col gap-1.5 rounded-[14px] border border-black/10 p-3 text-left transition-colors hover:border-(--gold) focus-visible:outline-2 focus-visible:outline-(--gold) dark:border-white/10"
      style={{
        background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
        borderLeft: `2px ${dashed ? 'dashed' : 'solid'} ${meta.color}`,
      }}
    >
      <span className="flex items-center gap-2">
        <span className="text-[17px] font-semibold">{table.name}</span>
        <span className="text-xs opacity-70">{table.seats} ที่</span>
        <span
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            color: meta.color,
            background: `color-mix(in srgb, ${meta.color} 18%, transparent)`,
          }}
        >
          <Icon size={13} weight="bold" aria-hidden />
          {meta.label}
        </span>
      </span>
      <span className={`text-sm leading-snug ${body.late ? 'text-(--crowd-full)' : 'opacity-85'}`}>
        {body.text}
      </span>
      {current && UNPAID_STATUSES.has(current.status) && (
        <span>
          <StatusTag map={BOOKING_STATUS} value={current.status} />
        </span>
      )}
      {table.next_booking_at && (
        <span
          className={`mt-auto text-xs ${nextSoon ? 'font-medium text-(--crowd-full)' : 'opacity-65'}`}
        >
          {nextSoon ? 'มีจอง' : 'จองถัดไป'} {hhmm(table.next_booking_at)}
        </span>
      )}
    </button>
  );
}

/** แถวการจองแบบย่อ (ยังไม่ระบุโต๊ะ / โซนที่ปิดใช้) */
export function BookingRow({ b }: { b: C.TableBoardBooking }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10">
      <span className="font-mono text-xs opacity-70">{b.code}</span>
      <span className="tabular-nums">{hhmm(b.booking_datetime)}</span>
      <span>
        {b.customer_name ?? 'ลูกค้า'} · {b.pax} คน
      </span>
      <StatusTag map={BOOKING_STATUS} value={b.status} />
    </li>
  );
}

/** มุมมองผังโต๊ะ: การ์ดโต๊ะแยกตามโซน (ดูอย่างเดียว — แตะการ์ดเพื่อดูการจองของโต๊ะ) */
export function BoardGrid({
  groups,
  bookings,
  now,
  onOpenTable,
}: {
  groups: BoardGroups;
  bookings: C.TableBoardBooking[];
  /** เวลา server ตอนคำนวณ (server_now) — ใช้นับ "อีก/สาย n นาที" */
  now: number;
  onOpenTable: (t: C.TableBoardTable) => void;
}) {
  const byId = new Map(bookings.map((b) => [b.id, b]));
  if (groups.zones.length === 0 && groups.inactive.length === 0)
    return <Empty description="ร้านยังไม่ได้ตั้งโซน / โต๊ะ" />;

  return (
    <div className="flex flex-col gap-6">
      {groups.zones.map(({ zone, tables, unassigned }) => {
        const c = { FREE: 0, RESERVED: 0, IN_USE: 0 };
        for (const t of tables) c[t.status] += 1;
        return (
          <section key={zone.id} aria-labelledby={`zone-${zone.id}`}>
            <header className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 id={`zone-${zone.id}`} className="m-0 text-base font-semibold">
                {zone.name} · {tables.length} โต๊ะ
              </h3>
              <span className="text-xs opacity-70">
                ว่าง {c.FREE} · จองแล้ว {c.RESERVED} · กำลังใช้ {c.IN_USE}
              </span>
              {zone.allow_zone_only_booking && <Tag>จองแบบโซนได้</Tag>}
            </header>
            {unassigned.length > 0 && (
              <div className="mb-2.5">
                <p className="mb-1.5 text-xs opacity-70">ยังไม่ระบุโต๊ะ ({unassigned.length})</p>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {unassigned.map((b) => (
                    <BookingRow key={b.id} b={b} />
                  ))}
                </ul>
              </div>
            )}
            {tables.length === 0 ? (
              <p className="text-sm opacity-60">โซนนี้ยังไม่มีโต๊ะ</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {tables.map((t) => (
                  <TableCard
                    key={t.id}
                    table={t}
                    current={t.current_booking_id ? byId.get(t.current_booking_id) : undefined}
                    now={now}
                    onOpen={() => onOpenTable(t)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
      {groups.inactive.length > 0 && (
        <section aria-labelledby="zone-inactive">
          <h3 id="zone-inactive" className="mb-2.5 text-base font-semibold">
            โซนที่ปิดใช้แล้ว
          </h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {groups.inactive.map((b) => (
              <BookingRow key={b.id} b={b} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
