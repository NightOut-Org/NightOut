import { PageContainer } from '@ant-design/pro-components';
import { Warning } from '@phosphor-icons/react';
import type { Db } from '@nightout/types';
import { Alert, Button, Input, Segmented, Space, Table, Tag, Tooltip } from 'antd';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { PAGE_SIZE } from '@/configs/constants';
import { LoadError } from '@/ui/components/LoadError';
import { StatusTag } from '@/ui/components/StatusTag';
import { date, dateTime } from '@/ui/utils/format';
import { BAR_STATUS } from '@/ui/utils/labels';
import { StrikeDrawer } from './components/strikeDrawer';
import { BlacklistModal, type BlacklistMode, type BlacklistTarget } from './modal/blacklistModal';
import { ReportNoTableModal } from './modal/reportNoTableModal';
import { useBarBlacklist } from './api';
import { RuleList } from '@/ui/components/RuleList';

type Filter = 'strikes' | 'blacklisted' | 'all';

/** ร้านไม่มีโต๊ะซ้ำ ≥ ค่านี้ใน 90 วัน → ป้ายแดงให้แอดมินเห็น (แสดงอย่างเดียว ไม่ Blacklist อัตโนมัติ) */
const STRIKE_WARN_90D = 2;

const EMPTY_TEXT: Record<Filter, string> = {
  strikes: 'ยังไม่มีร้านที่ถูกบันทึกว่าไม่มีโต๊ะให้ลูกค้า',
  blacklisted: 'ไม่มีร้านที่ติด Blacklist',
  all: 'ไม่พบร้าน',
};

/** Blacklist ได้เฉพาะร้านที่เคยเปิดแสดงแล้ว (BAR_NOT_BLACKLISTABLE) */
const isBlacklistable = (b: Db.AdminBarBlacklist) =>
  b.status === 'APPROVED' || b.status === 'SUSPENDED';

/**
 * /bar-blacklist — ร้านไม่มีโต๊ะให้ลูกค้า (ทีมร้านเลือกเหตุนี้ = บันทึกอัตโนมัติ · ลูกค้าร้องเรียน = แอดมินบันทึกแทน + คืน Table Fee)
 * แอดมินตัดสินใจ Blacklist (ซ่อนร้าน + ปิดรับจองใหม่) / ปลด · ?bar=<id> เปิดประวัติร้านนั้นเลย (ลิงก์จากแจ้งเตือน / หน้า /bars)
 */
export function BarBlacklistPage() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('strikes');
  const [reporting, setReporting] = useState(false);
  const [target, setTarget] = useState<BlacklistTarget | null>(null);
  const [params, setParams] = useSearchParams();
  const { data, isLoading, error, refetch } = useBarBlacklist();

  const all = useMemo(() => data ?? [], [data]);
  const openId = params.get('bar');
  const open = all.find((b) => b.id === openId) ?? null;
  const strikeCount = all.filter((b) => b.strike_count > 0).length;
  const blacklistedCount = all.filter((b) => b.is_blacklisted).length;

  const rows = useMemo(() => {
    const k = q.trim().toLowerCase();
    return all.filter(
      (b) =>
        (!k || b.name.toLowerCase().includes(k) || b.slug.includes(k)) &&
        (filter === 'all' || (filter === 'strikes' ? b.strike_count > 0 : b.is_blacklisted)),
    );
  }, [all, q, filter]);

  const select = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('bar', id);
    else next.delete('bar');
    setParams(next, { replace: true });
  };
  const decide = (bar: Db.AdminBarBlacklist, mode: BlacklistMode) => setTarget({ bar, mode });

  return (
    <PageContainer
      title="Blacklist ร้าน"
      extra={
        <Space wrap>
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { label: `มีประวัติไม่มีโต๊ะ (${strikeCount})`, value: 'strikes' },
              { label: `ติด Blacklist (${blacklistedCount})`, value: 'blacklisted' },
              { label: 'ทั้งหมด', value: 'all' },
            ]}
          />
          <Input.Search
            placeholder="ค้นหาชื่อร้าน / slug…"
            allowClear
            onSearch={setQ}
            className="w-64"
          />
          <Button icon={<Warning size={16} />} onClick={() => setReporting(true)}>
            บันทึกข้อร้องเรียน: ร้านไม่มีโต๊ะ
          </Button>
        </Space>
      }
    >
      <LoadError error={error} onRetry={() => void refetch()} />
      <Alert
        className="!mb-4"
        type="info"
        showIcon
        title="ประวัติร้านที่ไม่มีโต๊ะให้ลูกค้า"
        description={
          <RuleList
            rules={[
              'ระบบบันทึกให้อัตโนมัติเมื่อทีมร้านเลือกเหตุ "ไม่มีโต๊ะให้ลูกค้า" ตอนยกเลิก/คืน Table Fee',
              'ลูกค้าร้องเรียนมาเอง บันทึกที่ปุ่ม "บันทึกข้อร้องเรียน" (คืน Table Fee ให้ลูกค้าแทนร้าน)',
              'NightOut ปรับเงินร้านไม่ได้ จึงใช้ Blacklist ซ่อนร้านและปิดรับจองใหม่จนกว่าจะปลด',
            ]}
          />
        }
      />
      <Table<Db.AdminBarBlacklist>
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={{ pageSize: PAGE_SIZE }}
        scroll={{ x: 1040 }}
        locale={{ emptyText: EMPTY_TEXT[filter] }}
        columns={[
          {
            title: 'ร้าน',
            dataIndex: 'name',
            render: (name: string, b) => (
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate font-medium">{name}</span>
                {b.is_blacklisted && (
                  <Tag color="red" className="!m-0">
                    Blacklist
                  </Tag>
                )}
              </span>
            ),
          },
          {
            title: 'สถานะ',
            dataIndex: 'status',
            width: 110,
            render: (s: string) => <StatusTag map={BAR_STATUS} value={s} />,
          },
          {
            title: 'ไม่มีโต๊ะ (90 วัน)',
            dataIndex: 'strike_count_90d',
            width: 140,
            sorter: (a, b) => a.strike_count_90d - b.strike_count_90d,
            render: (n: number) =>
              n >= STRIKE_WARN_90D ? (
                <Tag color="red" className="!m-0 tabular-nums">
                  {n} ครั้ง
                </Tag>
              ) : (
                <span className="tabular-nums">{n}</span>
              ),
          },
          {
            title: 'ทั้งหมด',
            dataIndex: 'strike_count',
            width: 96,
            sorter: (a, b) => a.strike_count - b.strike_count,
            render: (n: number) => <span className="tabular-nums">{n}</span>,
          },
          {
            title: 'ครั้งล่าสุด',
            dataIndex: 'last_strike_at',
            width: 170,
            render: (v: string | null) => (v ? dateTime(v) : '-'),
          },
          {
            title: 'Blacklist',
            key: 'blacklist',
            width: 200,
            render: (_, b) =>
              b.blacklisted_at ? (
                <Tooltip title={b.blacklist_reason ? `เหตุผล: ${b.blacklist_reason}` : undefined}>
                  <span className="cursor-help">
                    {date(b.blacklisted_at)}
                    {b.blacklisted_by ? ` โดย ${b.blacklisted_by.display_name}` : ''}
                  </span>
                </Tooltip>
              ) : (
                '-'
              ),
          },
          {
            title: '',
            key: 'action',
            width: 200,
            render: (_, b) => (
              <Space size="small">
                <Button disabled={b.strike_count === 0} onClick={() => select(b.id)}>
                  ประวัติ
                </Button>
                {b.is_blacklisted ? (
                  <Button onClick={() => decide(b, 'lift')}>ปลด Blacklist</Button>
                ) : (
                  <Tooltip
                    title={
                      isBlacklistable(b) ? undefined : 'Blacklist ได้เฉพาะร้านที่เคยเปิดแสดงแล้ว'
                    }
                  >
                    <Button
                      danger
                      disabled={!isBlacklistable(b)}
                      onClick={() => decide(b, 'blacklist')}
                    >
                      Blacklist
                    </Button>
                  </Tooltip>
                )}
              </Space>
            ),
          },
        ]}
      />
      <StrikeDrawer bar={open} onClose={() => select(null)} onAction={decide} />
      <BlacklistModal target={target} onClose={() => setTarget(null)} />
      <ReportNoTableModal open={reporting} onClose={() => setReporting(false)} />
    </PageContainer>
  );
}
