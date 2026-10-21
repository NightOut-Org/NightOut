import { PageContainer } from '@ant-design/pro-components';
import { MapPin } from '@phosphor-icons/react';
import type { Db } from '@nightout/types';
import { Button, Space, Table, Tag, Tooltip } from 'antd';
import { useMemo, useState } from 'react';
import { PAGE_SIZE } from '@/configs/constants';
import { useAdminAction } from '@/services/adminData';
import { LoadError } from '@/ui/components/LoadError';
import { RejectButton } from '@/ui/components/RejectButton';
import { StatusTag } from '@/ui/components/StatusTag';
import { dateTime } from '@/ui/utils/format';
import { BAR_STATUS, CATEGORY } from '@/ui/utils/labels';
import { PinDrawer } from './components/pinDrawer';
import { usePendingBars, barStatusAction, usePendingBarLocations } from './api';
import { RuleList } from '@/ui/components/RuleList';

/**
 * ร้านที่ส่งข้อมูลมาให้ตรวจ — อนุมัติแล้วร้านจะแสดงบนเว็บทันที
 * คอลัมน์หมุด (admin_bar_locations จับคู่ด้วย id): ดู/แก้/ปักหมุดแทนร้าน · ยังเป็นหมุดค่าเริ่มต้นของระบบเดิม = อนุมัติไม่ได้ (BAR_LOCATION_NOT_SET)
 */
export function MerchantsPage() {
  const { data, isLoading, error, refetch } = usePendingBars();
  const locations = usePendingBarLocations();
  const locById = useMemo(
    () => new Map((locations.data ?? []).map((l) => [l.id, l])),
    [locations.data],
  );
  const [pinFor, setPinFor] = useState<string | null>(null);
  const pinBar = pinFor ? locById.get(pinFor) : undefined;
  const act = useAdminAction();
  const setStatus = (b: Db.AdminBar, status: 'APPROVED' | 'REJECTED', reason?: string) =>
    act.mutate({
      ...barStatusAction(b.id, { status, reason }),
      success: status === 'APPROVED' ? `อนุมัติ ${b.name} แล้ว` : `ไม่อนุมัติ ${b.name}`,
    });

  return (
    <PageContainer
      title="ร้านรออนุมัติ"
      content={
        <RuleList
          rules={[
            'การอนุมัติร้านคือการตรวจหมุดไปพร้อมกัน',
            'ร้านสถานะร่างยังกรอกข้อมูลไม่ครบ',
            { tone: 'check', text: 'อนุมัติแล้วร้านแสดงบนเว็บทันที' },
          ]}
        />
      }
    >
      <LoadError
        error={error ?? locations.error}
        onRetry={() => {
          void refetch();
          void locations.refetch();
        }}
      />
      <Table<Db.AdminBar>
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        pagination={{ pageSize: PAGE_SIZE }}
        scroll={{ x: 1200 }}
        locale={{ emptyText: 'ไม่มีร้านรอตรวจ' }}
        columns={[
          { title: 'ร้าน', dataIndex: 'name' },
          {
            title: 'ประเภท',
            dataIndex: 'category',
            render: (c: Db.AdminBar['category']) => CATEGORY[c],
          },
          { title: 'ย่าน', key: 'district', render: (_, b) => b.district?.name_th ?? '-' },
          { title: 'เจ้าของ', key: 'owner', render: (_, b) => b.owner?.email ?? '-' },
          { title: 'ส่งเมื่อ', dataIndex: 'created_at', render: (v: string) => dateTime(v) },
          {
            title: 'สถานะ',
            dataIndex: 'status',
            render: (s: string) => <StatusTag map={BAR_STATUS} value={s} />,
          },
          {
            title: 'หมุด',
            key: 'pin',
            width: 320,
            render: (_, b) => {
              const loc = locById.get(b.id);
              if (!loc)
                return (
                  <span className="text-muted">{locations.isLoading ? 'กำลังโหลด…' : '-'}</span>
                );
              return loc.is_default_pin ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <Tag color="red" className="!m-0">
                    ยังไม่ปักหมุด
                  </Tag>
                  <Button
                    size="small"
                    icon={<MapPin size={14} aria-hidden />}
                    onClick={() => setPinFor(b.id)}
                  >
                    ปักหมุด
                  </Button>
                </span>
              ) : (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="max-w-[220px] truncate" title={loc.address}>
                    {loc.address}
                  </span>
                  <Button size="small" className="shrink-0" onClick={() => setPinFor(b.id)}>
                    ดูหมุด
                  </Button>
                </span>
              );
            },
          },
          {
            title: '',
            key: 'a',
            render: (_, b) => {
              const unpinned = !!locById.get(b.id)?.is_default_pin;
              return (
                <Space>
                  <Tooltip title={unpinned ? 'ปักหมุดก่อนอนุมัติ' : undefined}>
                    <span className="inline-block">
                      <Button
                        type="primary"
                        loading={act.isPending}
                        disabled={unpinned}
                        onClick={() => setStatus(b, 'APPROVED')}
                      >
                        อนุมัติ
                      </Button>
                    </span>
                  </Tooltip>
                  <RejectButton
                    label="ไม่อนุมัติ"
                    title={`ไม่อนุมัติ ${b.name}?`}
                    loading={act.isPending}
                    onReject={(reason) => setStatus(b, 'REJECTED', reason)}
                  />
                </Space>
              );
            },
          },
        ]}
      />
      {pinBar && <PinDrawer key={pinBar.id} bar={pinBar} onClose={() => setPinFor(null)} />}
    </PageContainer>
  );
}
