import { DndContext, DragOverlay } from '@dnd-kit/core';
import { ArrowsLeftRight, Rows, SquaresFour } from '@phosphor-icons/react';
import type * as C from '@nightout/contracts';
import { getAntdTheme } from '@nightout/ui';
import { App, Button, ConfigProvider, Empty, Grid, Result, Segmented, Skeleton } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMerchantBar } from '@/hooks/useMerchantBar';
import { useNow } from '@/hooks/useNow';
import { Chip } from '@/ui/components/merchantUi';
import { tableBoardKey, useTableBoard } from './api';
import { ChipFace } from './components/bookingChip';
import { FloorGrid, type StatusFilter } from './components/floorGrid';
import { FloorLegend } from './components/floorLegend';
import { FloorTimeline } from './components/floorTimeline';
import { TableDrawer } from './components/tableDrawer';
import { MoveConfirmModal } from './modal/moveConfirmModal';
import { OccupancyModal } from './modal/occupancyModal';
import { bookingWho, buildBoardIndex, hhmm, hhmmss, isHolding, nightLabel, nightWeekday } from './utils/board';
import { useBoardMove } from './utils/useBoardMove';
import './floor.css';

type View = 'grid' | 'timeline';
const VIEW_KEY = 'nightout-floor-view';

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'timeline' ? 'timeline' : 'grid';
  } catch {
    return 'grid';
  }
}
function saveView(v: View) {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    // เก็บไม่ได้ (โหมดส่วนตัว) — ใช้ค่าเริ่มต้นครั้งหน้า
  }
}

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'ทั้งหมด' },
  { key: 'FREE', label: 'ว่าง' },
  { key: 'RESERVED', label: 'จองแล้ว' },
  { key: 'IN_USE', label: 'กำลังใช้' },
];

/**
 * /merchant/floor — ผังโต๊ะของร้าน (ทีมร้านทุกบทบาท · บังคับ Dark เหมือนหน้าคืนนี้ · ไม่มียอดเงิน/เบอร์โทร)
 * สถานะโต๊ะคำนวณที่ DB (bar_table_board) · โพลทุก 10 วิ (หยุดระหว่างลาก/แท็บซ่อน) · ผังโต๊ะ ↔ ไทม์ไลน์
 * ย้ายโต๊ะ: ลากวาง หรือแตะ "ย้ายโต๊ะ" แล้วแตะโต๊ะปลายทาง → ยืนยัน · ปุ่มลัดในแผงโต๊ะ
 */
export function MerchantFloorPage() {
  const bar = useMerchantBar();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const now = useNow(30_000);
  const [paused, setPaused] = useState(false);
  const board = useTableBoard(bar.id, paused);
  const data = board.data;
  const index = useMemo(() => (data ? buildBoardIndex(data) : null), [data]);
  const move = useBoardMove(index, setPaused);
  const [view, setView] = useState<View>(readView);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  // มือถือ: Segmented ขนาดใหญ่ (เป้าแตะ ≥ 40px)
  const screens = Grid.useBreakpoint();
  const [openTableId, setOpenTableId] = useState<string | null>(null);
  const [occupyTableId, setOccupyTableId] = useState<string | null>(null);
  const { moving, cancelTapMove } = move;

  const refresh = () => void qc.invalidateQueries({ queryKey: tableBoardKey(bar.id) });

  // Escape = ยกเลิกโหมดแตะเพื่อย้าย
  useEffect(() => {
    if (!moving) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancelTapMove();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moving, cancelTapMove]);

  /** แตะโต๊ะ: โหมดแตะเพื่อย้าย → เลือกเป็นปลายทาง · ปกติ → เปิดแผงโต๊ะ */
  const tapTable = (tableId: string) => {
    if (move.justDragged()) return;
    const ref = index?.tables.get(tableId);
    if (move.moving && ref) move.tryMove(move.moving.id, { tableId, zoneId: ref.zone.id });
    else setOpenTableId(tableId);
  };
  /** แตะการจองที่ยังไม่มีโต๊ะ: ยังไม่จบ → เริ่มแตะเพื่อย้าย · จบแล้ว → ดูรายละเอียด */
  const tapLooseBooking = (b: C.TableBoardBooking) => {
    if (move.justDragged() || move.moving) return;
    if (isHolding(b.status)) move.startTapMove(b.id);
    else navigate(`/merchant/bookings/${b.id}`);
  };
  /** แตะแถบในไทม์ไลน์ */
  const tapBar = (b: C.TableBoardBooking) => {
    if (b.table_id && index?.byTable.get(b.table_id)?.some((x) => x.id === b.id)) tapTable(b.table_id);
    else tapLooseBooking(b);
  };

  const opened = openTableId ? (index?.tables.get(openTableId) ?? null) : null;
  const openedCurrent =
    opened?.table.current_booking_id ? (index?.bookings.get(opened.table.current_booking_id) ?? null) : null;
  const occupyTable = occupyTableId ? (index?.tables.get(occupyTableId)?.table ?? null) : null;
  const pendingBooking = move.pending ? (index?.bookings.get(move.pending.bookingId) ?? null) : null;
  const pendingTarget = move.pending ? (index?.tables.get(move.pending.tableId) ?? null) : null;
  const hours = data ? (bar.hours.find((h) => h.day === nightWeekday(data.night)) ?? null) : null;
  const canSetup = bar.staffRole !== 'STAFF';

  const header = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-2xl font-bold">ผังโต๊ะ</h1>
          {data && (
            <p className="m-0 text-[13px] text-muted">
              {nightLabel(data.night)} อัปเดตล่าสุด {hhmmss(board.dataUpdatedAt)}
            </p>
          )}
        </div>
        <Segmented<View>
          size="middle"
          value={view}
          onChange={(v) => {
            setView(v);
            saveView(v);
          }}
          options={[
            { value: 'grid', label: 'ผังโต๊ะ', icon: <SquaresFour size={16} /> },
            { value: 'timeline', label: 'ไทม์ไลน์', icon: <Rows size={16} /> },
          ]}
        />
      </div>
      {data && (
        <p role="status" className="m-0 inline-flex items-center gap-2 text-xs text-muted">
          <span
            aria-hidden
            className={`size-2 rounded-full ${board.isError ? '' : 'motion-safe:animate-pulse'}`}
            style={{ background: board.isError ? 'var(--crowd-full)' : 'var(--crowd-available)' }}
          />
          {board.isError ? 'เชื่อมต่อไม่ได้ — กำลังลองใหม่' : 'อัปเดตทุก 10 วินาที'}
        </p>
      )}
    </div>
  );

  let body;
  if (board.isPending) body = <Skeleton active paragraph={{ rows: 6 }} />;
  else if (!data || !index)
    body = (
      <Result
        status="error"
        title="โหลดผังโต๊ะไม่สำเร็จ"
        subTitle={(board.error as Error | null)?.message}
        extra={
          <Button type="primary" onClick={() => void board.refetch()}>
            ลองใหม่
          </Button>
        }
      />
    );
  else if (index.counts.ALL === 0 && data.bookings.length === 0)
    body = (
      <Empty description="ร้านยังไม่ได้ตั้งโซน / โต๊ะ">
        {canSetup ? (
          <Link to="/merchant/tables">
            <Button type="primary">
              ตั้งค่าโซน / โต๊ะ
            </Button>
          </Link>
        ) : (
          <p className="m-0 text-sm text-muted">ให้เจ้าของหรือผู้จัดการร้านตั้งค่าโซน / โต๊ะก่อน</p>
        )}
      </Empty>
    );
  else
    body = (
      <DndContext {...move.dndProps}>
        <div className="flex flex-col gap-3">
          <FloorLegend />
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label} {index.counts[f.key]}
              </Chip>
            ))}
          </div>
        </div>

        {move.moving && (
          <div
            role="status"
            className="merchant-solid sticky top-[calc(56px+env(safe-area-inset-top))] z-30 flex items-center gap-2 rounded-[14px] border border-gold bg-card px-3 py-2 shadow-glow lg:top-4"
          >
            <ArrowsLeftRight size={20} className="shrink-0 text-gold" aria-hidden />
            <span className="min-w-0 flex-1 text-[13px]">
              แตะโต๊ะปลายทางสำหรับ <b>{move.moving.code}</b> ({bookingWho(move.moving)})
            </span>
            <Button onClick={move.cancelTapMove} className="!h-11 shrink-0">
              ยกเลิก
            </Button>
          </div>
        )}

        {view === 'grid' ? (
          <FloorGrid
            board={data}
            index={index}
            filter={filter}
            now={now}
            blockFor={move.blockFor}
            onOpenTable={tapTable}
            onLaneTap={tapLooseBooking}
            onResetFilter={() => setFilter('ALL')}
          />
        ) : (
          <FloorTimeline
            board={data}
            index={index}
            filter={filter}
            hours={hours}
            now={now}
            blockFor={move.blockFor}
            onOpenTable={tapTable}
            onBarTap={tapBar}
            onResetFilter={() => setFilter('ALL')}
          />
        )}

        <DragOverlay dropAnimation={null}>
          {move.dragging && (
            <div className="floor-overlay w-56">
              <ChipFace booking={move.dragging}>
                <span className="truncate font-medium">
                  <span className="mr-2 tabular-nums">{hhmm(move.dragging.booking_datetime)}</span>
                  {bookingWho(move.dragging)}
                </span>
                <span className="truncate text-xs text-muted">{move.dragging.code}</span>
              </ChipFace>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    );

  return (
    <ConfigProvider theme={getAntdTheme('dark')}>
      <div className="dark flex flex-col gap-4 text-text">
        {header}
        {body}

        <TableDrawer
          target={opened}
          bookings={opened ? (index?.byTable.get(opened.table.id) ?? []) : []}
          current={openedCurrent}
          now={now}
          onClose={() => setOpenTableId(null)}
          onDone={refresh}
          onMove={(b) => {
            setOpenTableId(null);
            move.startTapMove(b.id);
            void message.info('แตะโต๊ะปลายทาง');
          }}
          onOccupy={(t) => setOccupyTableId(t.id)}
        />
        <OccupancyModal table={occupyTable} onClose={() => setOccupyTableId(null)} onDone={refresh} />
        <MoveConfirmModal
          booking={pendingBooking}
          target={pendingTarget}
          onClose={move.clearPending}
          onDone={refresh}
        />
      </div>
    </ConfigProvider>
  );
}
