import type * as C from '@nightout/contracts';
import { packLanes, timelineRange } from '@nightout/utils';
import { Empty } from 'antd';
import { useEffect, useMemo, useRef } from 'react';
import { BOOKING_STATUS } from '@/ui/utils/labels';
import { STATUS_META, UNPAID_STATUSES, hhmm, type BoardGroups } from '../utils/board';

const HOUR_MS = 3_600_000;
const PX_PER_HOUR = 72;
const ROW_H = 44;
const LEFT_W = 120;

interface Bar {
  start: number;
  end: number;
  booking?: C.TableBoardBooking;
  /** แถบ "กำลังใช้ (ไม่มีการจอง)" */
  manual?: C.TableBoardOccupancy;
}

function barStyle(bar: Bar): React.CSSProperties {
  if (bar.manual)
    return {
      background: `repeating-linear-gradient(45deg, color-mix(in srgb, var(--crowd-full) 35%, transparent) 0 6px, color-mix(in srgb, var(--crowd-full) 15%, transparent) 6px 12px)`,
      border: '1px solid var(--crowd-full)',
    };
  const s = bar.booking!.status;
  if (s === 'CHECKED_IN')
    return {
      background: `color-mix(in srgb, ${STATUS_META.IN_USE.color} 30%, transparent)`,
      border: `1px solid ${STATUS_META.IN_USE.color}`,
    };
  if (s === 'COMPLETED')
    return {
      background: 'color-mix(in srgb, var(--muted) 20%, transparent)',
      border: '1px solid var(--muted)',
      opacity: 0.75,
    };
  if (s === 'NO_SHOW')
    return {
      background: 'color-mix(in srgb, var(--crowd-full) 12%, transparent)',
      border: '1px solid color-mix(in srgb, var(--crowd-full) 50%, transparent)',
      opacity: 0.75,
    };
  return {
    background: `color-mix(in srgb, var(--gold) 25%, transparent)`,
    border: `1px ${UNPAID_STATUSES.has(s) ? 'dashed' : 'solid'} var(--gold)`,
  };
}

function barLabel(bar: Bar) {
  if (bar.manual) return `กำลังใช้ (ไม่มีการจอง)${bar.manual.pax ? ` · ${bar.manual.pax} คน` : ''}`;
  const b = bar.booking!;
  const forfeited = b.status === 'NO_SHOW' ? ` · ${BOOKING_STATUS.NO_SHOW.text}` : '';
  return `${hhmm(b.booking_datetime)} ${b.customer_name ?? 'ลูกค้า'}·${b.pax}${forfeited}`;
}

function Row({
  label,
  sub,
  dot,
  bars,
  range,
}: {
  label: string;
  sub?: string;
  dot?: string;
  bars: Bar[];
  range: { start: number; end: number };
}) {
  const lanes = packLanes(bars);
  const height = Math.max(1, lanes.length) * ROW_H;
  const x = (t: number) => ((t - range.start) / HOUR_MS) * PX_PER_HOUR;
  return (
    <div className="flex border-b border-black/5 dark:border-white/5" style={{ height }}>
      <div
        className="sticky left-0 z-10 flex shrink-0 flex-col justify-center gap-0.5 border-r border-black/10 bg-(--surface) px-2 dark:border-white/10"
        style={{ width: LEFT_W }}
      >
        <span className="flex items-center gap-1.5 truncate text-sm font-medium">
          {dot && (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: dot }}
              aria-hidden
            />
          )}
          {label}
        </span>
        {sub && <span className="text-xs opacity-60">{sub}</span>}
      </div>
      <div className="relative grow">
        {lanes.map((lane, i) =>
          lane.map((bar) => {
            const left = Math.max(0, x(bar.start));
            const width = Math.max(18, x(Math.min(bar.end, range.end)) - left);
            const text = barLabel(bar);
            return (
              <div
                key={bar.booking?.id ?? bar.manual?.id}
                title={
                  bar.booking
                    ? `${bar.booking.code} · ${text} · ${BOOKING_STATUS[bar.booking.status].text}`
                    : text
                }
                className="absolute flex items-center overflow-hidden rounded-md px-1.5 text-xs whitespace-nowrap"
                style={{ left, width, top: i * ROW_H + 6, height: ROW_H - 12, ...barStyle(bar) }}
              >
                {text}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

const spanOf = (b: C.TableBoardBooking): Bar => ({
  start: Date.parse(b.reserved_from),
  end: Date.parse(b.completed_at ?? b.reserved_until),
  booking: b,
});

/** มุมมองไทม์ไลน์คืนนี้: 1 แถวต่อโต๊ะ + แถว "ยังไม่ระบุโต๊ะ" ต่อโซน · เส้น "ตอนนี้" สีทอง · เลื่อนแนวนอนบนมือถือ */
export function BoardTimeline({ board, groups }: { board: C.TableBoard; groups: BoardGroups }) {
  const scroller = useRef<HTMLDivElement>(null);
  const now = Date.parse(board.server_now);
  const range = useMemo(
    () =>
      timelineRange({
        night: board.night,
        nightStart: board.night_start,
        nightEnd: board.night_end,
        hours: null, // Backoffice ไม่มีเวลาเปิด-ปิดของร้านในข้อมูลนี้ — ใช้ช่วงของการจอง (ไม่มี = 18:00–02:00)
        periods: board.bookings,
        now: new Date(now),
      }),
    [board, now],
  );
  const width = ((range.end - range.start) / HOUR_MS) * PX_PER_HOUR;
  const hours = Array.from(
    { length: Math.round((range.end - range.start) / HOUR_MS) + 1 },
    (_, i) => range.start + i * HOUR_MS,
  );
  const nowX =
    now >= range.start && now <= range.end ? ((now - range.start) / HOUR_MS) * PX_PER_HOUR : null;

  // โหลดครั้งแรก/เปลี่ยนร้าน: เลื่อนให้ "ตอนนี้" อยู่ราว 25% ของจอ
  useEffect(() => {
    const el = scroller.current;
    if (el && nowX != null) el.scrollLeft = Math.max(0, LEFT_W + nowX - el.clientWidth * 0.25);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.bar_id]);

  if (groups.zones.length === 0 && groups.inactive.length === 0)
    return <Empty description="ร้านยังไม่ได้ตั้งโซน / โต๊ะ" />;

  return (
    <div
      ref={scroller}
      className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10"
    >
      <div className="relative" style={{ width: LEFT_W + width, minWidth: '100%' }}>
        <div className="sticky top-0 z-20 flex h-8 border-b border-black/10 bg-(--surface) dark:border-white/10">
          <div className="sticky left-0 z-10 shrink-0 bg-(--surface)" style={{ width: LEFT_W }} />
          <div className="relative grow">
            {hours.map((h) => (
              <span
                key={h}
                className="absolute top-1.5 -translate-x-1/2 text-xs tabular-nums opacity-60 first:translate-x-0"
                style={{ left: ((h - range.start) / HOUR_MS) * PX_PER_HOUR }}
              >
                {hhmm(h)}
              </span>
            ))}
          </div>
        </div>
        {groups.zones.map(({ zone, tables, unassigned }) => (
          <div key={zone.id}>
            <div
              className="sticky left-0 border-b border-black/10 px-2 py-1 text-xs font-semibold dark:border-white/10"
              style={{ width: 'fit-content' }}
            >
              {zone.name}
            </div>
            {unassigned.length > 0 && (
              <Row label="ยังไม่ระบุโต๊ะ" bars={unassigned.map(spanOf)} range={range} />
            )}
            {tables.map((t) => {
              const bars = (groups.byTable.get(t.id) ?? []).map(spanOf);
              if (t.occupancy)
                bars.push({
                  start: Date.parse(t.occupancy.started_at),
                  end: Math.max(now, Date.parse(t.occupancy.started_at) + 15 * 60_000),
                  manual: t.occupancy,
                });
              return (
                <Row
                  key={t.id}
                  label={t.name}
                  sub={`${t.seats} ที่ · ${STATUS_META[t.status].label}`}
                  dot={STATUS_META[t.status].color}
                  bars={bars}
                  range={range}
                />
              );
            })}
          </div>
        ))}
        {groups.inactive.length > 0 && (
          <Row label="โซนที่ปิดใช้แล้ว" bars={groups.inactive.map(spanOf)} range={range} />
        )}
        {nowX != null && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-(--gold)"
            style={{ left: LEFT_W + nowX }}
            aria-hidden
          >
            <span className="absolute top-9 left-1 rounded bg-(--gold) px-1 text-[10px] font-semibold text-(--on-gold)">
              ตอนนี้
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
