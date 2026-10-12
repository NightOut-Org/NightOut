import { PageContainer } from '@ant-design/pro-components';
import { Images, Star } from '@phosphor-icons/react';
import type { Db } from '@nightout/types';
import { Button, Input, Space, Table, Tag, Tooltip } from 'antd';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PAGE_SIZE } from '@/configs/constants';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useAdminAction } from '@/services/adminData';
import { SaveBar } from '@/ui/components/SaveBar';
import { LoadError } from '@/ui/components/LoadError';
import { StatusTag } from '@/ui/components/StatusTag';
import { date } from '@/ui/utils/format';
import { BAR_STATUS } from '@/ui/utils/labels';
import { ShowSwitch } from './components/showSwitch';
import { isToggleable, useBarStatusDraft } from './utils/useBarStatusDraft';
import { barsStatusAction, useBars } from './api';

/**
 * ร้านทั้งหมด — เปิด/ปิดการแสดงบนเว็บ (สลับได้หลายร้าน แล้วกดบันทึกครั้งเดียว) · ป้าย "แนะนำ" (โฆษณา) ดูอย่างเดียว จัดการที่ /promotions
 * รูปร้านจัดการที่ /bar-media
 */
export function BarsPage() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useBars();
  const act = useAdminAction();
  const status = useBarStatusDraft(data ?? []);
  const saving = act.isPending;
  const { confirmDiscard } = useUnsavedGuard(status.changes.length > 0);

  const save = async () => {
    const n = status.changes.length;
    try {
      await act.mutateAsync({ ...barsStatusAction({ changes: status.changes }), success: `บันทึกการแสดงร้านแล้ว ${n} ร้าน` });
      await refetch();
      status.reset();
    } catch {
      // useAdminAction แจ้งเหตุผลแล้ว · draft ยังอยู่ กดบันทึกใหม่ได้
    }
  };
  const rows = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (data ?? []).filter((b) => !k || b.name.toLowerCase().includes(k) || b.slug.includes(k));
  }, [data, q]);

  return (
    <PageContainer
      title="จัดการร้าน"
      extra={
        <Space wrap>
          <Input.Search placeholder="ค้นหาชื่อร้าน…" allowClear onSearch={setQ} className="w-64" />
          <SaveBar
            count={status.changes.length}
            saving={saving}
            onSave={() => void save()}
            onReset={() => confirmDiscard(status.reset)}
          />
        </Space>
      }
    >
      <LoadError error={error} onRetry={() => void refetch()} />
      <Table<Db.AdminBar>
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={{ pageSize: PAGE_SIZE }}
        scroll={{ x: 1100 }}
        columns={[
          {
            title: 'ร้าน',
            dataIndex: 'name',
            render: (name: string, b) => (
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate">{name}</span>
                {b.is_promoted && (
                  <Link to="/promotions" title="ร้านซื้อแพ็กเกจโปรโมท — จัดการที่หน้าโปรโมท">
                    <Tag color="gold" className="!m-0">
                      แนะนำ{b.promoted_until ? ` ถึง ${date(b.promoted_until)}` : ''}
                    </Tag>
                  </Link>
                )}
              </span>
            ),
          },
          { title: 'ย่าน', key: 'district', render: (_, b) => b.district?.name_th ?? '-' },
          {
            title: 'ดาว',
            key: 'stars',
            width: 110,
            sorter: (a, b) => (a.current_stars ?? 0) - (b.current_stars ?? 0),
            // ตัวเลข + ดาวดวงเดียว — แคบและเทียบหลายแถวได้เร็วกว่าดาว 5 ดวง
            render: (_, b) =>
              b.is_new || !b.current_stars ? (
                <Tag>ร้านใหม่</Tag>
              ) : (
                <span className="inline-flex items-center gap-1 tabular-nums" aria-label={`${b.current_stars} ดาว`}>
                  {b.current_stars}
                  <Star size={14} weight="fill" className="text-(--gold-text)" aria-hidden />
                </span>
              ),
          },
          {
            title: 'คะแนน',
            dataIndex: 'score',
            sorter: (a, b) => (a.score ?? 0) - (b.score ?? 0),
            render: (v: number | null) => v ?? '-',
          },
          {
            title: 'สถานะ',
            dataIndex: 'status',
            filters: Object.entries(BAR_STATUS).map(([value, l]) => ({ text: l.text, value })),
            onFilter: (v, b) => b.status === v,
            render: (s: string) => <StatusTag map={BAR_STATUS} value={s} />,
          },
          {
            title: 'แสดง',
            key: 'show',
            width: 150,
            // ร่าง / รอตรวจ / ไม่อนุมัติ ยังไม่เคยขึ้นเว็บ — จัดการที่หน้า /merchants
            render: (_, b) =>
              isToggleable(b) ? (
                <span className="inline-flex items-center gap-2">
                  <ShowSwitch
                    name={b.name}
                    shown={status.shownOf(b)}
                    disabled={saving}
                    askReason={b.status === 'APPROVED'}
                    onChange={(shown, reason) => status.set(b, shown, reason)}
                  />
                  {status.changed(b) && (
                    <Tooltip title={status.reasonOf(b) ? `เหตุผล: ${status.reasonOf(b)}` : undefined}>
                      <Tag color="warning" className="!m-0">
                        ยังไม่บันทึก
                      </Tag>
                    </Tooltip>
                  )}
                </span>
              ) : (
                '-'
              ),
          },
          {
            title: '',
            key: 'media',
            width: 110,
            render: (_, b) => (
              <Button size="small" icon={<Images size={14} />} onClick={() => void navigate(`/bar-media?bar=${b.id}`)}>
                รูปร้าน
              </Button>
            ),
          },
        ]}
      />
    </PageContainer>
  );
}
