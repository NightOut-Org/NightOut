import { PageContainer } from '@ant-design/pro-components';
import type { Db } from '@nightout/types';
import { paymentProviderLabel } from '@nightout/utils';
import { Alert, Badge, Card, Grid, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { type ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PAGE_SIZE } from '@/configs/constants';
import { useAdminAction } from '@/services/adminData';
import { LoadError } from '@/ui/components/LoadError';
import { StatusTag } from '@/ui/components/StatusTag';
import { baht, dateTime } from '@/ui/utils/format';
import { BOOKING_STATUS, PAYMENT_REFUND, PAYMENT_STATUS, SETTLEMENT } from '@/ui/utils/labels';
import { MarkRefundedButton } from './components/markRefundedButton';
import { PaymentEvents } from './components/paymentEvents';
import { SUMMARY_ICONS, SummaryCards, type SummaryItem } from './components/summaryCards';
import { markPaymentRefundedAction, usePaymentConfig, usePaymentIntents, useUnmatchedPayments } from './api';

type Row = Db.AdminPaymentIntent;
type TabKey = 'refund' | 'all' | 'paid' | 'pending' | 'closed' | 'unmatched';

/** วันที่ตามเวลาไทย (YYYY-MM-DD) ไว้เทียบ "วันนี้" */
const bangkokDay = (d: Date | string) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

/** ข้อความรองใต้ค่าหลักในเซลล์ */
const Sub = ({ children }: { children: ReactNode }) => (
  <Typography.Text type="secondary" className="block text-xs">
    {children}
  </Typography.Text>
);

/** ป้ายแท็บ + จำนวน — แท็บที่เป็นงานค้าง (ต้องคืนเงิน/จับคู่ไม่ได้) ใช้ Badge แดง */
const tabLabel = (text: string, count: number, urgent = false) => (
  <span className="inline-flex items-center gap-2">
    {text}
    {urgent ? (
      <Badge count={count} showZero={false} />
    ) : (
      <Typography.Text type="secondary">{count}</Typography.Text>
    )}
  </span>
);

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
  // จอแคบไม่ตรึงคอลัมน์ — คอลัมน์ที่ตรึงจะกินทั้งจอ
  const wide = Grid.useBreakpoint().md ?? true;
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
    {
      title: 'การจอง',
      key: 'booking',
      fixed: wide ? 'left' : undefined,
      width: 200,
      render: (_, r) => (
        <div>
          <div className="flex flex-wrap items-center gap-1">
            <Typography.Text strong>{r.booking.code}</Typography.Text>
            <StatusTag map={BOOKING_STATUS} value={r.booking.status} />
          </div>
          <Sub>{r.bar.name}</Sub>
        </div>
      ),
    },
    {
      title: 'ลูกค้า',
      key: 'customer',
      width: 160,
      render: (_, r) => r.customer?.display_name ?? <Typography.Text type="secondary">บัญชีถูกลบ</Typography.Text>,
    },
    {
      title: 'ยอด',
      key: 'amount',
      align: 'right',
      width: 120,
      render: (_, r) => {
        const paid = r.paid_amount == null ? null : Number(r.paid_amount);
        const mismatch = paid != null && paid !== Number(r.amount);
        return (
          <div>
            <Typography.Text strong className="tabular-nums">
              {baht(Number(r.amount))}
            </Typography.Text>
            {mismatch && (
              <Typography.Text type="danger" className="block text-xs">
                ได้รับจริง {baht(paid)}
              </Typography.Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'สถานะชำระ',
      key: 'status',
      width: 190,
      render: (_, r) => (
        <div>
          <StatusTag map={PAYMENT_STATUS} value={r.status} />
          {r.status === 'FAILED' && r.failure_message ? (
            <Sub>{r.failure_message}</Sub>
          ) : (
            <Sub>{r.paid_at ? `ชำระ ${dateTime(r.paid_at)}` : `เปิด ${dateTime(r.created_at)}`}</Sub>
          )}
        </div>
      ),
    },
    {
      title: 'เงินหลังชำระ',
      key: 'after',
      render: (_, r) => {
        if (r.refund_status !== 'NONE')
          return (
            <div>
              <StatusTag map={PAYMENT_REFUND} value={r.refund_status} />
              {r.refund_status === 'REQUIRED' && r.refund_reason && <Sub>{r.refund_reason}</Sub>}
              {r.refund_status === 'REFUNDED' && (
                <Sub>
                  {[r.refund_note, r.refunded_by_name, r.refunded_at ? dateTime(r.refunded_at) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Sub>
              )}
            </div>
          );
        if (!r.deposit_settlement) return <Typography.Text type="secondary">-</Typography.Text>;
        return (
          <div>
            <StatusTag map={SETTLEMENT} value={r.deposit_settlement} />
            {r.deposit_settlement === 'REFUND_PENDING' && (
              <Link to="/deposits" className="block text-xs">
                คืนที่หน้าเงินมัดจำ
              </Link>
            )}
          </div>
        );
      },
    },
    {
      title: '',
      key: 'a',
      fixed: wide ? 'right' : undefined,
      width: 130,
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
      pagination={{ pageSize: PAGE_SIZE, hideOnSinglePage: true }}
      scroll={{ x: 960 }}
      locale={{ emptyText: empty }}
      columns={columns}
      expandable={{ expandedRowRender: (r) => <PaymentEvents row={r} /> }}
    />
  );

  const unmatchedColumns: ColumnsType<Db.AdminPaymentUnmatched> = [
    { title: 'ได้รับเมื่อ', key: 'at', width: 180, render: (_, e) => dateTime(e.received_at) },
    { title: 'ช่องทาง', key: 'provider', render: (_, e) => paymentProviderLabel(e.provider) },
    {
      title: 'เลขอ้างอิง',
      key: 'ref',
      render: (_, e) => <Typography.Text copyable>{e.provider_ref ?? e.event_id}</Typography.Text>,
    },
    { title: 'ชนิด', key: 'type', render: (_, e) => e.raw_type ?? '-' },
    {
      title: 'ยอด',
      key: 'amount',
      align: 'right',
      render: (_, e) => (e.amount == null ? '-' : <Typography.Text strong>{baht(Number(e.amount))}</Typography.Text>),
    },
  ];

  const summary: SummaryItem<TabKey>[] = [
    { key: 'refund', title: 'ต้องคืนเงิน', value: g.refund.length, icon: SUMMARY_ICONS.refund, urgent: g.refund.length > 0 },
    { key: 'pending', title: 'รอชำระ', value: g.pending.length, icon: SUMMARY_ICONS.pending },
    { key: 'paid', title: 'ชำระแล้ววันนี้', value: g.paidToday, icon: SUMMARY_ICONS.paid },
    {
      key: 'unmatched',
      title: 'จับคู่ไม่ได้',
      value: unmatchedRows.length,
      icon: SUMMARY_ICONS.unmatched,
      urgent: unmatchedRows.length > 0,
    },
  ];

  const cfg = config.data;

  return (
    <PageContainer
      title="การชำระเงิน"
      subTitle="Table Fee ที่ลูกค้าชำระออนไลน์ · คืนเงินที่ระบบผู้ให้บริการแล้วกดบันทึกที่นี่"
      tags={
        cfg &&
        (cfg.mode === 'PROVIDER' ? (
          <Tag color="green">ชำระออนไลน์ · {cfg.provider_label ?? cfg.provider}</Tag>
        ) : (
          <Tag>ยังใช้โอน + แนบสลิป</Tag>
        ))
      }
    >
      <LoadError error={error} onRetry={() => void refetch()} />
      <LoadError error={unmatched.error} onRetry={() => void unmatched.refetch()} />

      <SummaryCards
        items={summary}
        active={activeTab}
        loading={isLoading}
        // จับคู่ไม่ได้ = 0 → ไม่มีแท็บให้ไป
        onSelect={(k) => {
          if (k !== 'unmatched' || unmatchedRows.length > 0) setTab(k);
        }}
      />

      <Card styles={{ body: { paddingTop: 4 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setTab(k as TabKey)}
          items={[
            {
              key: 'refund',
              label: tabLabel('ต้องคืนเงิน', g.refund.length, true),
              children: (
                <>
                  {g.refund.length > 0 && (
                    <Alert
                      className="!mb-4"
                      type="warning"
                      showIcon
                      title="ลูกค้าจ่ายแล้วแต่ระบบยืนยันโต๊ะไม่ได้ — คืนเงินที่หน้าระบบผู้ให้บริการก่อน แล้วกด “คืนเงินแล้ว” ในแถวนั้น"
                    />
                  )}
                  {table(g.refund, 'ไม่มีรายการที่ต้องคืนเงิน')}
                </>
              ),
            },
            { key: 'all', label: tabLabel('ทั้งหมด', g.all.length), children: table(g.all, 'ยังไม่มีรายการชำระเงิน') },
            { key: 'paid', label: tabLabel('ชำระแล้ว', g.paid.length), children: table(g.paid, 'ยังไม่มีรายการที่ชำระแล้ว') },
            { key: 'pending', label: tabLabel('รอชำระ', g.pending.length), children: table(g.pending, 'ไม่มีรายการรอชำระ') },
            {
              key: 'closed',
              label: tabLabel('ไม่สำเร็จ / หมดเวลา', g.closed.length),
              children: table(g.closed, 'ไม่มีรายการที่ไม่สำเร็จ'),
            },
            ...(unmatchedRows.length > 0
              ? [
                  {
                    key: 'unmatched',
                    label: tabLabel('จับคู่ไม่ได้', unmatchedRows.length, true),
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
                          loading={unmatched.isLoading}
                          dataSource={unmatchedRows}
                          pagination={{ pageSize: PAGE_SIZE, hideOnSinglePage: true }}
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
      </Card>
    </PageContainer>
  );
}
