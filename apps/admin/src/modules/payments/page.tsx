import { PageContainer } from '@ant-design/pro-components';
import type { Db } from '@nightout/types';
import { paymentProviderLabel } from '@nightout/utils';
import { Alert, Space, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PAGE_SIZE } from '@/configs/constants';
import { useAdminAction } from '@/services/adminData';
import { LoadError } from '@/ui/components/LoadError';
import { StatusTag } from '@/ui/components/StatusTag';
import { baht, dateTime } from '@/ui/utils/format';
import { BOOKING_STATUS, PAYMENT_REFUND, PAYMENT_STATUS, SETTLEMENT } from '@/ui/utils/labels';
import { MarkRefundedButton } from './components/markRefundedButton';
import { PaymentEvents } from './components/paymentEvents';
import { markPaymentRefundedAction, usePaymentConfig, usePaymentIntents, useUnmatchedPayments } from './api';

type Row = Db.AdminPaymentIntent;
type TabKey = 'refund' | 'all' | 'paid' | 'pending' | 'closed' | 'unmatched';

/** วันที่ตามเวลาไทย (YYYY-MM-DD) ไว้เทียบ "วันนี้" */
const bangkokDay = (d: Date | string) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

/**
 * /payments — การชำระ Table Fee ผ่านผู้ให้บริการ (payment intents)
 * ชำระสำเร็จ → deposits VERIFIED/HELD + การจอง CONFIRMED อัตโนมัติ (เงินต่อจากนั้นดูที่ /deposits)
 * เงินเข้าแต่ผูกกับการจองไม่ได้ (การจองหมดเวลา/ยกเลิก/ยอดไม่ตรง) → "ต้องคืนเงิน": คืนที่ระบบผู้ให้บริการเองแล้วบันทึกที่นี่
 * แสดงยอดรายรายการเท่านั้น ไม่มียอดรวมเป็นเงิน (REQUIREMENTS ข้อ 2: Admin ดูการเงินไม่ได้)
 */
export function PaymentsPage() {
  const { data, isLoading, error, refetch } = usePaymentIntents();
  const unmatched = useUnmatchedPayments();
  const config = usePaymentConfig();
  const act = useAdminAction();
  const [tab, setTab] = useState<TabKey>();
  // แถวที่กำลังบันทึกคืนเงิน — หมุนเฉพาะปุ่มของแถวนั้น
  const [savingId, setSavingId] = useState<string>();

  const g = useMemo(() => {
    const all = data ?? [];
    const today = bangkokDay(new Date());
    return {
      all,
      refund: all.filter((r) => r.refund_status === 'REQUIRED'),
      paid: all.filter((r) => r.status === 'PAID'),
      pending: all.filter((r) => r.status === 'PENDING'),
      closed: all.filter((r) => r.status === 'FAILED' || r.status === 'EXPIRED' || r.status === 'CANCELLED'),
      paidToday: all.filter((r) => r.status === 'PAID' && r.paid_at && bangkokDay(r.paid_at) === today).length,
    };
  }, [data]);
  const unmatchedRows = unmatched.data ?? [];

  const fallbackTab: TabKey = g.refund.length > 0 ? 'refund' : 'all';
  const activeTab = !tab || (tab === 'unmatched' && unmatchedRows.length === 0) ? fallbackTab : tab;

  const columns: ColumnsType<Row> = [
    { title: 'เปิดเมื่อ', key: 'created', width: 150, render: (_, r) => dateTime(r.created_at) },
    {
      title: 'รหัสจอง',
      key: 'code',
      width: 150,
      render: (_, r) => (
        <Space size={4} wrap>
          <span>{r.booking.code}</span>
          <StatusTag map={BOOKING_STATUS} value={r.booking.status} />
        </Space>
      ),
    },
    { title: 'ร้าน', key: 'bar', render: (_, r) => r.bar.name },
    { title: 'ลูกค้า', key: 'customer', render: (_, r) => r.customer?.display_name ?? 'บัญชีถูกลบ' },
    { title: 'ยอด', key: 'amount', align: 'right', render: (_, r) => baht(Number(r.amount)) },
    { title: 'ช่องทาง', key: 'provider', render: (_, r) => paymentProviderLabel(r.provider) },
    {
      title: 'สถานะ',
      key: 'status',
      render: (_, r) => (
        <span>
          <StatusTag map={PAYMENT_STATUS} value={r.status} />
          {r.status === 'FAILED' && r.failure_message && (
            <Typography.Text type="secondary" className="block text-xs">
              {r.failure_message}
            </Typography.Text>
          )}
        </span>
      ),
    },
    { title: 'ชำระเมื่อ', key: 'paid', render: (_, r) => (r.paid_at ? dateTime(r.paid_at) : '-') },
    {
      title: 'เงิน',
      key: 'settlement',
      render: (_, r) =>
        r.deposit_settlement ? (
          <span>
            <StatusTag map={SETTLEMENT} value={r.deposit_settlement} />
            {r.deposit_settlement === 'REFUND_PENDING' && (
              <Link to="/deposits" className="block text-xs">
                คืนที่หน้าเงินมัดจำ
              </Link>
            )}
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: 'คืนเงิน',
      key: 'refund',
      render: (_, r) => (
        <span>
          <StatusTag map={PAYMENT_REFUND} value={r.refund_status} />
          {r.refund_status === 'REQUIRED' && r.refund_reason && (
            <Typography.Text type="secondary" className="block text-xs">
              {r.refund_reason}
            </Typography.Text>
          )}
          {r.refund_status === 'REFUNDED' && (
            <Typography.Text type="secondary" className="block text-xs">
              {[r.refund_note, r.refunded_by_name, r.refunded_at ? dateTime(r.refunded_at) : null]
                .filter(Boolean)
                .join(' · ')}
            </Typography.Text>
          )}
        </span>
      ),
    },
    {
      title: '',
      key: 'a',
      render: (_, r) =>
        r.refund_status === 'REQUIRED' ? (
          <MarkRefundedButton
            amount={Number(r.paid_amount ?? r.amount)}
            loading={act.isPending && savingId === r.id}
            onConfirm={(note, ref) => {
              setSavingId(r.id);
              act.mutate(
                {
                  ...markPaymentRefundedAction(r.id, { note, refund_ref: ref || undefined }),
                  success: 'บันทึกว่าคืนเงินแล้ว · แจ้งลูกค้าแล้ว',
                },
                { onSettled: () => setSavingId(undefined) },
              );
            }}
          />
        ) : null,
    },
  ];

  const table = (rows: Row[], empty: string) => (
    <Table<Row>
      rowKey="id"
      loading={isLoading}
      dataSource={rows}
      pagination={{ pageSize: PAGE_SIZE }}
      scroll={{ x: 1100 }}
      locale={{ emptyText: empty }}
      columns={columns}
      expandable={{
        expandedRowRender: (r) => <PaymentEvents events={r.events} />,
        rowExpandable: (r) => r.events.length > 0,
      }}
    />
  );

  const unmatchedColumns: ColumnsType<Db.AdminPaymentUnmatched> = [
    { title: 'เวลา', key: 'at', render: (_, e) => dateTime(e.received_at) },
    { title: 'ช่องทาง', key: 'provider', render: (_, e) => paymentProviderLabel(e.provider) },
    {
      title: 'เลขอ้างอิง',
      key: 'ref',
      render: (_, e) => <Typography.Text copyable>{e.provider_ref ?? e.event_id}</Typography.Text>,
    },
    { title: 'ชนิด', key: 'type', render: (_, e) => e.raw_type ?? '-' },
    { title: 'ยอด', key: 'amount', align: 'right', render: (_, e) => (e.amount == null ? '-' : baht(Number(e.amount))) },
  ];

  const cfg = config.data;

  return (
    <PageContainer
      title="การชำระเงิน"
      subTitle="ชำระ Table Fee ผ่านผู้ให้บริการ (payment intents) · คืนเงินทำที่ระบบผู้ให้บริการแล้วบันทึกที่นี่"
      extra={
        <Space size="large" wrap>
          {cfg &&
            (cfg.mode === 'PROVIDER' ? (
              <Tag color="green">เปิดชำระออนไลน์ · {cfg.provider_label ?? cfg.provider}</Tag>
            ) : (
              <Tag>ยังใช้โอน + แนบสลิป (ยังไม่ตั้ง PAYMENT_PROVIDER)</Tag>
            ))}
          <Statistic title="ชำระแล้ววันนี้" value={g.paidToday} suffix="รายการ" />
          <Statistic title="รอชำระ" value={g.pending.length} suffix="รายการ" />
          <Statistic title="ต้องคืนเงิน" value={g.refund.length} suffix="รายการ" />
          {unmatchedRows.length > 0 && (
            <Statistic title="จับคู่ไม่ได้" value={unmatchedRows.length} suffix="รายการ" />
          )}
        </Space>
      }
    >
      <LoadError error={error} onRetry={() => void refetch()} />
      <LoadError error={unmatched.error} onRetry={() => void unmatched.refetch()} />
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setTab(k as TabKey)}
        items={[
          { key: 'refund', label: `ต้องคืนเงิน (${g.refund.length})`, children: table(g.refund, 'ไม่มีรายการที่ต้องคืนเงิน') },
          { key: 'all', label: `ทั้งหมด (${g.all.length})`, children: table(g.all, 'ยังไม่มีรายการชำระเงิน') },
          { key: 'paid', label: `ชำระแล้ว (${g.paid.length})`, children: table(g.paid, 'ยังไม่มีรายการชำระเงิน') },
          { key: 'pending', label: `รอชำระ (${g.pending.length})`, children: table(g.pending, 'ยังไม่มีรายการชำระเงิน') },
          {
            key: 'closed',
            label: `ไม่สำเร็จ / หมดเวลา (${g.closed.length})`,
            children: table(g.closed, 'ยังไม่มีรายการชำระเงิน'),
          },
          ...(unmatchedRows.length > 0
            ? [
                {
                  key: 'unmatched',
                  label: `จับคู่ไม่ได้ (${unmatchedRows.length})`,
                  children: (
                    <>
                      <Alert
                        className="!mb-4"
                        type="warning"
                        showIcon
                        title="ได้รับเงินแต่หารายการชำระไม่เจอ — ตรวจที่ระบบผู้ให้บริการด้วยเลขอ้างอิง แล้วคืนเงินที่นั่น"
                      />
                      <Table<Db.AdminPaymentUnmatched>
                        rowKey="id"
                        size="small"
                        loading={unmatched.isLoading}
                        dataSource={unmatchedRows}
                        pagination={{ pageSize: PAGE_SIZE }}
                        scroll={{ x: 700 }}
                        columns={unmatchedColumns}
                      />
                    </>
                  ),
                },
              ]
            : []),
        ]}
      />
    </PageContainer>
  );
}
