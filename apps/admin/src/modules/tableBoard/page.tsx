import { PageContainer } from '@ant-design/pro-components';
import { Alert, Empty, Segmented, Select } from 'antd';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type * as C from '@nightout/contracts';
import { LoadError } from '@/ui/components/LoadError';
import { BoardGrid } from './components/boardGrid';
import { BoardTimeline } from './components/boardTimeline';
import { TableDrawer } from './components/tableDrawer';
import { useBars, useTableBoard } from './api';
import { STATUS_META, groupBoard, hhmmss, nightLabel } from './utils/board';

type View = 'grid' | 'timeline';
const VIEW_KEY = 'nightout-admin-table-board-view';

const readView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'timeline' ? 'timeline' : 'grid';
  } catch {
    return 'grid';
  }
};

/** /table-board — ผังโต๊ะคืนนี้ของร้านที่เลือก (ดูอย่างเดียว · ข้อมูลชุดเดียวกับ /merchant/floor · โพลทุก 10 วิ) · ?bar=<id> */
export function TableBoardPage() {
  const [params, setParams] = useSearchParams();
  const barId = params.get('bar');
  const [view, setView] = useState<View>(readView);
  const [openTableId, setOpenTableId] = useState<string | null>(null);
  const bars = useBars();
  const board = useTableBoard(barId);
  const groups = useMemo(() => (board.data ? groupBoard(board.data) : null), [board.data]);
  const openTable = useMemo(
    () => board.data?.zones.flatMap((z) => z.tables).find((t) => t.id === openTableId) ?? null,
    [board.data, openTableId],
  );

  const selectBar = (id: string | undefined) => {
    const next = new URLSearchParams(params);
    if (id) next.set('bar', id);
    else next.delete('bar');
    setParams(next, { replace: true });
    setOpenTableId(null);
  };
  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ไม่มี storage ก็ใช้ค่าในหน้าไป */
    }
  };

  const live = board.isError && board.data ? 'error' : 'ok';
  const data: C.TableBoard | undefined = board.data;

  return (
    <PageContainer
      title="ผังโต๊ะร้าน"
      extra={
        <Select
          className="w-72 max-w-full"
          placeholder="เลือกร้าน…"
          allowClear
          showSearch={{ optionFilterProp: 'label' }}
          loading={bars.isLoading}
          value={barId ?? undefined}
          onChange={selectBar}
          options={(bars.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
        />
      }
    >
      <LoadError error={bars.error} onRetry={() => void bars.refetch()} />
      <Alert
        className="!mb-4"
        type="info"
        showIcon
        title="ดูอย่างเดียว — ทีมร้านเป็นคนย้ายโต๊ะ / ตั้งสถานะเองที่หน้า ผังโต๊ะ ของร้าน (ไม่มียอดเงินและเบอร์โทรในหน้านี้)"
      />
      {!barId ? (
        <Empty description="เลือกร้านเพื่อดูผังโต๊ะคืนนี้" />
      ) : (
        <>
          {!data && <LoadError error={board.error} onRetry={() => void board.refetch()} />}
          {board.isLoading && <p className="opacity-70">กำลังโหลดผังโต๊ะ…</p>}
          {data && groups && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex flex-col">
                  <span className="text-base font-semibold">{nightLabel(data.night)}</span>
                  <span className="flex items-center gap-1.5 text-xs opacity-75">
                    <span
                      className={`size-2 rounded-full ${live === 'ok' ? 'bg-(--crowd-available) motion-safe:animate-pulse' : 'bg-(--crowd-full)'}`}
                      aria-hidden
                    />
                    {live === 'ok' ? 'อัปเดตทุก 10 วินาที' : 'เชื่อมต่อไม่ได้ — กำลังลองใหม่'} ·
                    อัปเดต {hhmmss(board.dataUpdatedAt)}
                  </span>
                </div>
                <span className="flex flex-wrap gap-3 text-sm">
                  {(['FREE', 'RESERVED', 'IN_USE'] as const).map((s) => {
                    const Icon = STATUS_META[s].icon;
                    return (
                      <span key={s} className="inline-flex items-center gap-1">
                        <Icon
                          size={15}
                          weight="bold"
                          style={{ color: STATUS_META[s].color }}
                          aria-hidden
                        />
                        {STATUS_META[s].label} {groups.counts[s]}
                      </span>
                    );
                  })}
                  <span className="opacity-70">ทั้งหมด {groups.counts.ALL} โต๊ะ</span>
                </span>
                <Segmented<View>
                  className="ml-auto"
                  value={view}
                  onChange={changeView}
                  options={[
                    { label: 'ผังโต๊ะ', value: 'grid' },
                    { label: 'ไทม์ไลน์', value: 'timeline' },
                  ]}
                />
              </div>
              {view === 'grid' ? (
                <BoardGrid
                  groups={groups}
                  bookings={data.bookings}
                  now={Date.parse(data.server_now)}
                  onOpenTable={(t) => setOpenTableId(t.id)}
                />
              ) : (
                <BoardTimeline board={data} groups={groups} />
              )}
            </div>
          )}
        </>
      )}
      <TableDrawer
        table={openTable}
        bookings={openTable ? (groups?.byTable.get(openTable.id) ?? []) : []}
        onClose={() => setOpenTableId(null)}
      />
    </PageContainer>
  );
}
