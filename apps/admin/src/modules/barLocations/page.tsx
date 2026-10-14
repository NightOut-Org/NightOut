import { PageContainer } from '@ant-design/pro-components';
import type { Db } from '@nightout/types';
import { distanceMeters } from '@nightout/utils';
import { Button, Input, Segmented, Table, Tag } from 'antd';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PAGE_SIZE } from '@/configs/constants';
import { LoadError } from '@/ui/components/LoadError';
import { StatusTag } from '@/ui/components/StatusTag';
import { date, dateTime } from '@/ui/utils/format';
import { BAR_STATUS } from '@/ui/utils/labels';
import {
  FAR_MOVE_METERS,
  LOCATION_REQUEST_STATUS,
  LOCATION_SOURCE,
  movedText,
  pinOf,
  realPinOf,
  transitText,
} from '@/ui/utils/location';
import { EditDrawer } from './components/editDrawer';
import { HistoryDrawer } from './components/historyDrawer';
import { ReviewDrawer, type PendingBarLocation } from './components/reviewDrawer';
import { useBarLocations, useLocationHistory } from './api';

type Tab = 'pending' | 'all' | 'history';
const TABS: readonly Tab[] = ['pending', 'all', 'history'];
type DrawerKind = 'review' | 'edit';
type PinState = 'unpinned' | 'unreviewed' | 'reviewed' | 'pending';

const hasPending = (b: Db.AdminBarLocation): b is PendingBarLocation => !!b.pending_request;

/**
 * /bar-locations — ตรวจตำแหน่งร้าน (หมุด · ที่อยู่ · ที่จอดรถ · รถไฟฟ้า)
 * แท็บ (?tab=): รอตรวจ (ค่าเริ่มต้น) · ร้านทั้งหมด (แก้หมุดแทนร้าน) · ประวัติ
 * ?bar=<id> เปิดร้านนั้นเลย (ลิงก์จากแจ้งเตือน / หน้า /bars) — มีคำขอรอตรวจ = Drawer ตรวจ · ไม่มี = Drawer แก้แทนร้าน
 * mount เฉพาะ Drawer ที่เปิด (ตรวจ/แก้ใช้ useUnsavedGuard → useBlocker ได้ทีละตัว) · หน้านี้เองไม่ใช้ useUnsavedGuard
 */
export function BarLocationsPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [historyRow, setHistoryRow] = useState<Db.AdminBarLocationRequest | null>(null);
  const locations = useBarLocations();
  const history = useLocationHistory();

  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'pending';

  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };
  const select = (id: string | null) => setParam({ bar: id });

  const all = useMemo(() => locations.data ?? [], [locations.data]);
  const pending = useMemo(
    () =>
      all
        .filter(hasPending)
        .sort((a, b) => (a.pending_since ?? '').localeCompare(b.pending_since ?? '')),
    [all],
  );

  const k = q.trim().toLowerCase();
  const matches = (b: { name: string; slug: string }) => !k || b.name.toLowerCase().includes(k) || b.slug.includes(k);

  // ชนิด Drawer ตัดสินตอนเปิด แล้วคงไว้ — ร้านส่งคำขอใหม่ระหว่างแอดมินแก้อยู่ จะไม่สลับ Drawer ใต้มือ (Drawer แก้แสดงคำเตือนแทน)
  const barId = params.get('bar');
  const row = barId ? (all.find((b) => b.id === barId) ?? null) : null;
  const [opened, setOpened] = useState<{ id: string; kind: DrawerKind } | null>(null);
  if (row && opened?.id !== row.id) setOpened({ id: row.id, kind: hasPending(row) ? 'review' : 'edit' });
  if (!row && opened) setOpened(null);
  const kind = row && opened?.id === row.id ? opened.kind : null;

  const loadError = tab === 'history' ? history.error : locations.error;
  const retry = () => void (tab === 'history' ? history.refetch() : locations.refetch());

  return (
    <PageContainer
      title="ตรวจตำแหน่งร้าน"
      content={
        <>
          หมุดใหม่/ที่ร้านแก้ต้องผ่านการตรวจก่อนแสดงบนแผนที่ (ระหว่างรอ ลูกค้าเห็นหมุดเดิม) · ร้านใหม่ตรวจหมุดพร้อมการอนุมัติที่หน้า{' '}
          <Link to="/merchants">ร้านรออนุมัติ</Link>
        </>
      }
      extra={<Input.Search placeholder="ค้นหาชื่อร้าน…" allowClear onSearch={setQ} className="w-64" />}
    >
      <LoadError error={loadError} onRetry={retry} />
      <Segmented<Tab>
        className="!mb-4"
        value={tab}
        onChange={(t) => setParam({ tab: t === 'pending' ? null : t })}
        options={[
          { label: `รอตรวจ (${pending.length})`, value: 'pending' },
          { label: 'ร้านทั้งหมด', value: 'all' },
          { label: 'ประวัติ', value: 'history' },
        ]}
      />

      {tab === 'pending' && (
        <Table<PendingBarLocation>
          rowKey="id"
          loading={locations.isLoading}
          dataSource={pending.filter(matches)}
          pagination={{ pageSize: PAGE_SIZE }}
          scroll={{ x: 960 }}
          locale={{ emptyText: 'ไม่มีคำขอรอตรวจ' }}
          onRow={(b) => ({ onClick: () => select(b.id), className: 'cursor-pointer' })}
          columns={[
            { title: 'ร้าน', key: 'bar', width: 220, render: (_, b) => <BarCell bar={b} /> },
            { title: 'ที่อยู่ใหม่', key: 'address', ellipsis: true, render: (_, b) => b.pending_request.address },
            { title: 'ย้ายหมุด', key: 'moved', width: 170, render: (_, b) => <MovedCell bar={b} /> },
            {
              title: 'ส่งโดย',
              key: 'by',
              width: 160,
              ellipsis: true,
              render: (_, b) => b.pending_request.requested_by?.display_name ?? '-',
            },
            {
              title: 'ส่งเมื่อ',
              key: 'since',
              width: 170,
              render: (_, b) => dateTime(b.pending_since ?? b.pending_request.created_at),
            },
            {
              title: '',
              key: 'action',
              width: 96,
              render: (_, b) => (
                <Button
                  type="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    select(b.id);
                  }}
                >
                  ตรวจ
                </Button>
              ),
            },
          ]}
        />
      )}

      {tab === 'all' && (
        <Table<Db.AdminBarLocation>
          rowKey="id"
          loading={locations.isLoading}
          dataSource={all.filter(matches)}
          pagination={{ pageSize: PAGE_SIZE }}
          scroll={{ x: 1080 }}
          locale={{ emptyText: 'ไม่พบร้าน' }}
          onRow={(b) => ({ onClick: () => select(b.id), className: 'cursor-pointer' })}
          columns={[
            { title: 'ร้าน', key: 'bar', width: 220, render: (_, b) => <BarCell bar={b} /> },
            { title: 'ที่อยู่', dataIndex: 'address', ellipsis: true },
            {
              title: 'รถไฟฟ้า',
              key: 'transit',
              width: 180,
              ellipsis: true,
              render: (_, b) => transitText(b) ?? <span className="text-muted">-</span>,
            },
            {
              title: 'ที่จอดรถ',
              dataIndex: 'parking_note',
              width: 180,
              ellipsis: true,
              render: (v: string | null) => v ?? <span className="text-muted">-</span>,
            },
            {
              title: 'ตรวจหมุดล่าสุด',
              key: 'reviewed',
              width: 190,
              filters: [
                { text: 'ยังไม่ปักหมุด', value: 'unpinned' },
                { text: 'ยังไม่เคยตรวจ', value: 'unreviewed' },
                { text: 'ตรวจแล้ว', value: 'reviewed' },
                { text: 'รอตรวจ', value: 'pending' },
              ],
              onFilter: (v, b) => pinStates(b).includes(v as PinState),
              render: (_, b) => <ReviewedCell bar={b} />,
            },
            {
              title: '',
              key: 'action',
              width: 110,
              render: (_, b) => (
                <Button
                  type={b.location_pending ? 'primary' : 'default'}
                  onClick={(e) => {
                    e.stopPropagation();
                    select(b.id);
                  }}
                >
                  {b.location_pending ? 'ตรวจ' : 'แก้หมุด'}
                </Button>
              ),
            },
          ]}
        />
      )}

      {tab === 'history' && (
        <Table<Db.AdminBarLocationRequest>
          rowKey="id"
          loading={history.isLoading}
          dataSource={(history.data ?? []).filter((r) => matches(r.bar))}
          pagination={{ pageSize: PAGE_SIZE }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: 'ยังไม่มีประวัติ' }}
          onRow={(r) => ({ onClick: () => setHistoryRow(r), className: 'cursor-pointer' })}
          columns={[
            {
              title: 'เวลา',
              key: 'at',
              width: 170,
              render: (_, r) => dateTime(r.reviewed_at ?? r.created_at),
            },
            { title: 'ร้าน', key: 'bar', width: 200, ellipsis: true, render: (_, r) => r.bar.name },
            {
              title: 'ที่มา',
              dataIndex: 'source',
              width: 160,
              filters: Object.entries(LOCATION_SOURCE).map(([value, text]) => ({ text, value })),
              onFilter: (v, r) => r.source === v,
              render: (s: Db.AdminBarLocationRequest['source']) => LOCATION_SOURCE[s],
            },
            {
              title: 'สถานะ',
              dataIndex: 'status',
              width: 170,
              filters: (['APPROVED', 'REJECTED', 'CANCELLED'] as const).map((value) => ({
                text: LOCATION_REQUEST_STATUS[value].text,
                value,
              })),
              onFilter: (v, r) => r.status === v,
              render: (_, r) => (
                <span className="inline-flex flex-wrap gap-1">
                  <StatusTag map={LOCATION_REQUEST_STATUS} value={r.status} />
                  {r.admin_edited && (
                    <Tag color="gold" className="!m-0">
                      แอดมินปรับ
                    </Tag>
                  )}
                </span>
              ),
            },
            {
              title: 'เหตุผล/หมายเหตุ',
              dataIndex: 'reason',
              ellipsis: true,
              render: (v: string | null) => v ?? <span className="text-muted">-</span>,
            },
            {
              title: 'โดย',
              key: 'who',
              width: 160,
              ellipsis: true,
              render: (_, r) =>
                r.reviewed_by?.display_name ??
                (r.status === 'CANCELLED' && r.requested_by ? `${r.requested_by.display_name} (ร้าน)` : '-'),
            },
            {
              title: '',
              key: 'action',
              width: 80,
              render: (_, r) => (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setHistoryRow(r);
                  }}
                >
                  ดู
                </Button>
              ),
            },
          ]}
        />
      )}

      {kind === 'review' && row && hasPending(row) && (
        <ReviewDrawer
          key={row.pending_request.id}
          bar={row}
          onClose={() => select(null)}
          onDone={() => select(null)}
        />
      )}
      {row && (kind === 'edit' || (kind === 'review' && !hasPending(row))) && (
        <EditDrawer key={row.id} bar={row} onClose={() => select(null)} onDone={() => select(null)} />
      )}
      {historyRow && <HistoryDrawer request={historyRow} onClose={() => setHistoryRow(null)} />}
    </PageContainer>
  );
}

function BarCell({ bar }: { bar: Db.AdminBarLocation }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="truncate font-medium">{bar.name}</span>
      <StatusTag map={BAR_STATUS} value={bar.status} />
    </span>
  );
}

/** หมุดย้ายไกลแค่ไหนจากที่ลูกค้าเห็นตอนนี้ */
function MovedCell({ bar }: { bar: PendingBarLocation }) {
  const current = realPinOf(bar);
  if (!current) return <Tag color="blue">ปักครั้งแรก</Tag>;
  const next = pinOf(bar.pending_request);
  const meters = distanceMeters(current, next);
  if (meters < 2) return <span className="text-muted">ที่เดิม (แก้ข้อมูล)</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="tabular-nums">{movedText(current, next)}</span>
      {meters > FAR_MOVE_METERS && (
        <Tag color="warning" className="!m-0">
          ย้ายไกล
        </Tag>
      )}
    </span>
  );
}

const pinStates = (b: Db.AdminBarLocation): PinState[] => [
  b.is_default_pin ? 'unpinned' : b.location_reviewed_at ? 'reviewed' : 'unreviewed',
  ...(b.location_pending ? (['pending'] as const) : []),
];

function ReviewedCell({ bar }: { bar: Db.AdminBarLocation }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {bar.is_default_pin ? (
        <Tag color="red" className="!m-0">
          ยังไม่ปักหมุด
        </Tag>
      ) : bar.location_reviewed_at ? (
        <span className="tabular-nums" title={bar.location_reviewed_by?.display_name}>
          {date(bar.location_reviewed_at)}
        </span>
      ) : (
        <Tag className="!m-0">ยังไม่เคยตรวจ</Tag>
      )}
      {bar.location_pending && (
        <Tag color="gold" className="!m-0">
          รอตรวจ
        </Tag>
      )}
    </span>
  );
}
