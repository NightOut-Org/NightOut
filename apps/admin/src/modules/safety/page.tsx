import { PageContainer } from '@ant-design/pro-components';
import { ClipboardText } from '@phosphor-icons/react';
import type { Db } from '@nightout/types';
import { safetyVerifyLabel } from '@nightout/utils';
import { Button, Segmented, Select, Space, Table, Tabs, Tag, Tooltip } from 'antd';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { PAGE_SIZE } from '@/configs/constants';
import { useAdminAction } from '@/services/adminData';
import { LoadError } from '@/ui/components/LoadError';
import { SlipImage } from '@/ui/components/SlipImage';
import { StatusTag } from '@/ui/components/StatusTag';
import { date, dateTime } from '@/ui/utils/format';
import { BAR_STATUS } from '@/ui/utils/labels';
import { InspectDrawer } from './components/inspectDrawer';
import { InspectionHistory } from './components/inspectionHistory';
import { useSafetyBars, useSafetyQueue, verifySafetyAction } from './api';
import { SAFETY_CHECK_TAG, SAFETY_VERIFY_TAG } from './utils/labels';

type Stage = 'all' | 'pending' | 'evidence';

/**
 * /safety — ข้อที่ร้านแจ้งว่า "มี" แต่ทีมยังไม่ได้ลงพื้นที่ · ตรวจได้ 2 วิธี (แยกให้เห็นทุกที่):
 * "ยืนยันแล้ว" = ตรวจหลักฐานที่ร้านแนบ (ลูกค้าเห็น "ตรวจหลักฐานแล้ว") · ลงพื้นที่ตรวจ = checklist + รูป (ลูกค้าเห็น "ทีมงานลงพื้นที่ตรวจ")
 * URL: ?bar=<id> กรองร้าน · ?tab=history ประวัติ · ?inspect=<bar id> เปิด Drawer ลงพื้นที่ตรวจ
 */
export function SafetyPage() {
  const [params, setParams] = useSearchParams();
  const bar = params.get('bar');
  const tab = params.get('tab') === 'history' ? 'history' : 'queue';
  const inspect = params.get('inspect');
  const [stage, setStage] = useState<Stage>('all');

  const bars = useSafetyBars();
  const queue = useSafetyQueue(bar);
  const act = useAdminAction();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  // server กรองแล้ว (awaiting_visit): ร้านแจ้ง "มี" ที่ยังไม่มีผลลงพื้นที่ = รอตรวจ + ตรวจหลักฐานแล้ว
  const waiting = useMemo(() => queue.data ?? [], [queue.data]);
  const rows = waiting.filter(
    (r) => stage === 'all' || (stage === 'pending') === (r.source === 'SELF_DECLARED'),
  );
  const nameOf = (id: string | null) =>
    id
      ? ((bars.data ?? []).find((b) => b.id === id)?.name ??
        (queue.data ?? []).find((r) => r.bar_id === id)?.bar.name)
      : undefined;

  return (
    <PageContainer
      title="ยืนยัน Safety"
      content="รายการที่ร้านแจ้งว่า “มี” แต่ทีมยังไม่ได้ลงพื้นที่ตรวจ · “ยืนยันแล้ว” = ตรวจจากหลักฐานที่ร้านแนบ (ลูกค้าเห็น “ตรวจหลักฐานแล้ว”) · แอดมินทุกคนลงพื้นที่ตรวจได้ ระบบบันทึกชื่อผู้ตรวจและวันที่ (ลูกค้าเห็น “ทีมงานลงพื้นที่ตรวจ”)"
    >
      <LoadError error={queue.error ?? bars.error} onRetry={() => {
          void queue.refetch();
          void bars.refetch();
        }} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          className="w-full sm:w-72"
          value={bar ?? undefined}
          onChange={(v?: string) => setParam('bar', v ?? null)}
          allowClear
          showSearch={{ optionFilterProp: 'label' }}
          placeholder="ทุกร้าน"
          loading={bars.isLoading}
          options={(bars.data ?? []).map((b) => ({ value: b.id, label: b.name, status: b.status }))}
          optionRender={(o) => (
            <span className="flex items-center justify-between gap-2">
              <span className="truncate">{o.label}</span>
              <StatusTag map={BAR_STATUS} value={o.data.status} />
            </span>
          )}
        />
        <Button
          type="primary"
          icon={<ClipboardText size={16} />}
          disabled={!bar}
          onClick={() => setParam('inspect', bar)}
          className="w-full sm:w-auto"
        >
          ลงพื้นที่ตรวจร้านนี้
        </Button>
      </div>
      <Tabs
        activeKey={tab}
        onChange={(k) => setParam('tab', k === 'history' ? 'history' : null)}
        items={[
          {
            key: 'queue',
            label: `รอลงพื้นที่ (${waiting.length})`,
            children: (
              <>
                <Segmented<Stage>
                  className="!mb-4"
                  value={stage}
                  onChange={setStage}
                  options={[
                    { label: 'ทั้งหมด', value: 'all' },
                    { label: 'รอตรวจ', value: 'pending' },
                    { label: 'ตรวจหลักฐานแล้ว', value: 'evidence' },
                  ]}
                />
                <Table<Db.AdminSafetyItem>
                  rowKey="id"
                  loading={queue.isLoading}
                  dataSource={rows}
                  pagination={{ pageSize: PAGE_SIZE }}
                  scroll={{ x: 1100 }}
                  locale={{ emptyText: 'ไม่มีรายการรอลงพื้นที่' }}
                  columns={[
                    {
                      title: 'ร้าน',
                      key: 'bar',
                      width: 170,
                      render: (_, r) => (
                        <Button type="link" className="!h-auto !p-0 text-left" onClick={() => setParam('bar', r.bar_id)}>
                          {r.bar.name}
                        </Button>
                      ),
                    },
                    { title: 'มาตรการ', dataIndex: 'name_th', width: 150 },
                    {
                      title: 'สถานะ',
                      key: 'stage',
                      width: 190,
                      render: (_, r) =>
                        r.source === 'SELF_DECLARED' ? (
                          <Tag color="gold">รอตรวจ</Tag>
                        ) : (
                          <span className="flex flex-col items-start gap-0.5">
                            <Tag color={SAFETY_VERIFY_TAG.EVIDENCE.color}>{safetyVerifyLabel(r.verify_method)}</Tag>
                            <span className="text-xs opacity-70">
                              {r.verified_at ? date(r.verified_at) : '-'}
                              {r.verified_by_name ? ` · ${r.verified_by_name}` : ''}
                            </span>
                          </span>
                        ),
                    },
                    {
                      title: 'หลักฐานจากร้าน',
                      dataIndex: 'evidence_path',
                      width: 110,
                      render: (p: string | null) =>
                        p ? <SlipImage bucket="bar-verifications" path={p} /> : <span className="text-xs text-muted">ยังไม่แนบ</span>,
                    },
                    { title: 'หมายเหตุจากร้าน', dataIndex: 'note', width: 160, render: (v: string | null) => v ?? '-' },
                    {
                      title: 'ลูกค้าแจ้งว่าไม่จริง',
                      dataIndex: 'open_inaccurate_reports',
                      width: 120,
                      render: (n: number) => (n > 0 ? <Tag color="red">{n} ครั้ง</Tag> : '-'),
                    },
                    {
                      title: 'ตรวจล่าสุด',
                      key: 'last',
                      width: 140,
                      render: (_, r) =>
                        r.last_result ? (
                          <span className="flex flex-col items-start gap-0.5">
                            <StatusTag map={SAFETY_CHECK_TAG} value={r.last_result} />
                            {r.last_inspected_at && <span className="text-xs opacity-70">{date(r.last_inspected_at)}</span>}
                          </span>
                        ) : (
                          '-'
                        ),
                    },
                    { title: 'แจ้งเมื่อ', dataIndex: 'updated_at', width: 150, render: (v: string) => dateTime(v) },
                    {
                      title: '',
                      key: 'a',
                      width: 220,
                      fixed: 'right',
                      render: (_, r) => (
                        <Space wrap size={6}>
                          {r.source === 'SELF_DECLARED' && (
                            <Tooltip
                              title={
                                r.evidence_path
                                  ? 'ตรวจจากหลักฐานที่ร้านแนบ — ไม่ได้ลงพื้นที่ · ลูกค้าเห็น “ตรวจหลักฐานแล้ว”'
                                  : 'ร้านยังไม่แนบหลักฐาน — ลงพื้นที่ตรวจแทน'
                              }
                            >
                              <Button
                                disabled={!r.evidence_path}
                                loading={act.isPending && act.variables?.path === verifySafetyAction(r.id).path}
                                onClick={() =>
                                  act.mutate(
                                    {
                                      ...verifySafetyAction(r.id),
                                      success: `ยืนยัน ${r.name_th} ของ ${r.bar.name} จากหลักฐานแล้ว`,
                                    },
                                    // คิวค้าง (แอดมินอีกคนเพิ่งตรวจ / ร้านเปลี่ยนค่า) → โหลดคิวใหม่
                                    { onError: () => void queue.refetch() },
                                  )
                                }
                              >
                                ยืนยันแล้ว
                              </Button>
                            </Tooltip>
                          )}
                          <Button type="primary" onClick={() => setParam('inspect', r.bar_id)}>
                            ลงพื้นที่ตรวจ
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          { key: 'history', label: 'ประวัติการตรวจ', children: <InspectionHistory barId={bar} /> },
        ]}
      />
      <InspectDrawer barId={inspect} barName={nameOf(inspect)} onClose={() => setParam('inspect', null)} />
    </PageContainer>
  );
}
