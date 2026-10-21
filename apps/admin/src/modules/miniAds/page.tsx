import { PageContainer } from '@ant-design/pro-components';
import { ArrowSquareOut, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { MINI_AD_PLACEMENT_LABELS } from '@nightout/contracts';
import type { Db } from '@nightout/types';
import { miniAdCtr, miniAdState, type MiniAdState } from '@nightout/utils';
import { Alert, Button, Popconfirm, Segmented, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useAdminAction } from '@/services/adminData';
import { LoadError } from '@/ui/components/LoadError';
import { StatusTag } from '@/ui/components/StatusTag';
import { webSrc } from '@/ui/utils/image';
import { MiniAdDrawer } from './form/miniAdDrawer';
import { periodLabel } from './utils/dates';
import { MINI_AD_STATE_TAG } from './utils/labels';
import { deleteMiniAdAction, useMiniAds } from './api';
import { RuleList } from '@/ui/components/RuleList';

type Row = Db.AdminMiniAd & { state: MiniAdState };
type Filter = 'ALL' | MiniAdState;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'ทั้งหมด' },
  { value: 'LIVE', label: MINI_AD_STATE_TAG.LIVE.text },
  { value: 'SCHEDULED', label: MINI_AD_STATE_TAG.SCHEDULED.text },
  { value: 'OFF', label: MINI_AD_STATE_TAG.OFF.text },
  { value: 'ENDED', label: MINI_AD_STATE_TAG.ENDED.text },
];

/** ลิงก์ในเว็บ (/…) เปิดบนเว็บลูกค้า (deploy: โดเมนเดียวกัน · dev: คนละ port) */
const linkHref = (url: string) =>
  url.startsWith('/') && import.meta.env.DEV ? `http://localhost:5173${url}` : url;

/**
 * โฆษณาแบนเนอร์เล็ก (Native Mini-Ads) — ทีม NightOut ลงให้ผู้ลงโฆษณาที่ไม่ใช่ร้านในระบบ
 * แสดงบนเว็บ 1 ชิ้นต่อหน้า: หน้าแรก (ใต้ร้านยอดนิยม) · หน้าค้นหา (หลังร้านลำดับที่ 6) ป้าย "โฆษณา" เสมอ · ไม่มีผลต่ออันดับ/ผลค้นหา
 * แอดมินทุกคน (MFA) เพิ่ม/แก้/ลบได้ · ทุกการเปลี่ยนแปลงลง Audit Log
 * สร้าง/แก้เนื้อหาต้องติ๊กยืนยันว่าไม่ใช่แบรนด์/สินค้าเครื่องดื่มแอลกอฮอล์ (ม.32) · เปิด/ปิด วันที่ ตำแหน่ง บันทึกภายใน แก้ได้โดยไม่ต้องยืนยันใหม่
 */
export function MiniAdsPage() {
  const { data, isLoading, error, refetch } = useMiniAds();
  const act = useAdminAction();
  const [now] = useState(() => new Date());
  const [filter, setFilter] = useState<Filter>('ALL');
  const [editing, setEditing] = useState<Db.AdminMiniAd | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const rows = useMemo<Row[]>(
    () => (data ?? []).map((r) => ({ ...r, state: miniAdState(r, now) })),
    [data, now],
  );
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { ALL: rows.length, LIVE: 0, SCHEDULED: 0, OFF: 0, ENDED: 0 };
    for (const r of rows) c[r.state] += 1;
    return c;
  }, [rows]);
  const shown = filter === 'ALL' ? rows : rows.filter((r) => r.state === filter);

  const openDrawer = (ad: Db.AdminMiniAd | null) => {
    setEditing(ad);
    setDrawerOpen(true);
  };

  return (
    <PageContainer
      title="โฆษณา (Mini-Ads)"
      subTitle={data ? `กำลังแสดง ${counts.LIVE} จากทั้งหมด ${rows.length}` : undefined}
      extra={
        <Button
          type="primary"
          icon={<Plus size={16} weight="bold" />}
          onClick={() => openDrawer(null)}
        >
          เพิ่มโฆษณา
        </Button>
      }
    >
      <LoadError error={error} onRetry={() => void refetch()} />
      <Alert
        className="!mb-4"
        type="info"
        showIcon
        title="แบนเนอร์เล็กในหน้าแรกและหน้าค้นหา"
        description={
          <RuleList
            rules={[
              'หน้าแรกอยู่ใต้ "ร้านยอดนิยม" และหน้าค้นหาอยู่หลังร้านลำดับที่ 6',
              'แสดง 1 ชิ้นต่อหน้า สุ่มเมื่อมีหลายชิ้น และติดป้าย "โฆษณา" เสมอ',
              { tone: 'check', text: 'ไม่มีผลต่ออันดับหรือผลค้นหา' },
              {
                tone: 'warn',
                text: 'ห้ามแบรนด์/สินค้าเครื่องดื่มแอลกอฮอล์ รวมถึงสินค้าที่ใช้แบรนด์ร่วม (ม.32)',
              },
            ]}
          />
        }
      />
      <div className="mb-4 overflow-x-auto">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={FILTERS.map((f) => ({
            value: f.value,
            label: `${f.label} (${counts[f.value]})`,
          }))}
        />
      </div>
      <Table<Row>
        rowKey="id"
        loading={isLoading}
        dataSource={shown}
        scroll={{ x: 960 }}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        rowClassName={(r) => (r.state === 'OFF' || r.state === 'ENDED' ? 'opacity-60' : '')}
        locale={{ emptyText: 'ยังไม่มีโฆษณา — กด "เพิ่มโฆษณา" เพื่อเริ่ม' }}
        columns={[
          {
            title: 'โฆษณา',
            key: 'ad',
            render: (_, r) => (
              <div className="flex items-center gap-3">
                <img
                  src={webSrc(r.image_url)}
                  alt=""
                  width={96}
                  height={54}
                  loading="lazy"
                  className="h-[54px] w-24 shrink-0 rounded-md bg-black/10 object-cover"
                />
                <div className="min-w-0">
                  <div className="font-semibold">{r.title}</div>
                  <Typography.Text type="secondary" className="text-xs">
                    {r.advertiser_name}
                  </Typography.Text>
                </div>
              </div>
            ),
          },
          {
            title: 'ตำแหน่ง',
            dataIndex: 'placements',
            width: 170,
            render: (placements: Row['placements']) => (
              <Space size={[4, 4]} wrap>
                {placements.map((p) => (
                  <Tag key={p} className="!m-0">
                    {MINI_AD_PLACEMENT_LABELS[p]}
                  </Tag>
                ))}
              </Space>
            ),
          },
          {
            title: 'ช่วงเวลา',
            key: 'period',
            width: 220,
            render: (_, r) => periodLabel(r.starts_at, r.ends_at),
          },
          {
            title: 'สถานะ',
            dataIndex: 'state',
            width: 110,
            render: (state: MiniAdState) => <StatusTag map={MINI_AD_STATE_TAG} value={state} />,
          },
          {
            title: 'ผลลัพธ์',
            key: 'stats',
            width: 160,
            render: (_, r) => {
              const ctr = miniAdCtr(r.impressions, r.clicks);
              return (
                <Typography.Text type="secondary" className="text-xs">
                  เห็น {r.impressions.toLocaleString('th-TH')} คลิก{' '}
                  {r.clicks.toLocaleString('th-TH')}
                  <br />
                  {ctr === null ? '—' : `CTR ${ctr}%`}
                </Typography.Text>
              );
            },
          },
          {
            title: '',
            key: 'actions',
            width: 140,
            align: 'right',
            render: (_, r) => (
              <Space size={4}>
                <Tooltip title="แก้ไข">
                  <Button
                    icon={<PencilSimple size={16} />}
                    aria-label={`แก้ไข ${r.title}`}
                    onClick={() => openDrawer(r)}
                  />
                </Tooltip>
                <Tooltip title="เปิดลิงก์">
                  <Button
                    icon={<ArrowSquareOut size={16} />}
                    aria-label={`เปิดลิงก์ของ ${r.title}`}
                    href={linkHref(r.link_url)}
                    target="_blank"
                    rel="noreferrer"
                  />
                </Tooltip>
                <Popconfirm
                  title={`ลบโฆษณา "${r.title}"?`}
                  description='ลบถาวรพร้อมยอดเห็น/คลิก ถ้าแค่ไม่อยากให้แสดง ให้ปิด "เปิดใช้งาน" แทน'
                  okText="ลบ"
                  okButtonProps={{ danger: true }}
                  cancelText="ยกเลิก"
                  onConfirm={() =>
                    act.mutateAsync({ ...deleteMiniAdAction(r.id), success: 'ลบโฆษณาแล้ว' })
                  }
                >
                  <Tooltip title="ลบ">
                    <Button
                      danger
                      icon={<Trash size={16} />}
                      aria-label={`ลบ ${r.title}`}
                      disabled={act.isPending}
                    />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <MiniAdDrawer open={drawerOpen} ad={editing} onClose={() => setDrawerOpen(false)} />
    </PageContainer>
  );
}
