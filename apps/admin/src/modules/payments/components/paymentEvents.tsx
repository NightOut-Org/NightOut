import type { Db } from '@nightout/types';
import { paymentProviderLabel } from '@nightout/utils';
import { Descriptions, Table, Typography } from 'antd';
import { baht, dateTime } from '@/ui/utils/format';

/** รายละเอียดของรายการชำระ 1 รายการ (แถวที่กางออก): เลขอ้างอิง/เวลา + webhook ที่ได้รับ (view ส่งมาใหม่สุดก่อน สูงสุด 20) */
export function PaymentEvents({ row }: { row: Db.AdminPaymentIntent }) {
  return (
    <div className="space-y-4 py-2">
      <Descriptions
        size="small"
        column={{ xs: 1, md: 2, xl: 3 }}
        items={[
          {
            key: 'ref',
            label: `เลขอ้างอิง ${paymentProviderLabel(row.provider)}`,
            children: row.provider_ref ? <Typography.Text copyable>{row.provider_ref}</Typography.Text> : '-',
          },
          { key: 'created', label: 'เปิดรายการ', children: dateTime(row.created_at) },
          { key: 'expires', label: 'หมดเวลาชำระ', children: dateTime(row.expires_at) },
          { key: 'booking', label: 'เวลาจอง', children: `${dateTime(row.booking.booking_datetime)} · ${row.booking.pax} คน` },
          ...(row.refund_ref
            ? [
                {
                  key: 'refund_ref',
                  label: 'เลขอ้างอิงการคืนเงิน',
                  children: <Typography.Text copyable>{row.refund_ref}</Typography.Text>,
                },
              ]
            : []),
        ]}
      />
      <div>
        <Typography.Text type="secondary" className="mb-2 block text-xs">
          Webhook ที่ได้รับ{row.events.length >= 20 ? ' (20 รายการล่าสุด)' : ''}
        </Typography.Text>
        <Table<Db.PaymentEventRow>
          rowKey="id"
          size="small"
          pagination={false}
          dataSource={row.events}
          locale={{ emptyText: 'ยังไม่ได้รับ webhook' }}
          columns={[
            { title: 'เวลา', key: 'at', width: 180, render: (_, e) => dateTime(e.received_at) },
            { title: 'ชนิด', key: 'type', render: (_, e) => e.raw_type ?? e.event_type },
            { title: 'ผล', dataIndex: 'result' },
            {
              title: 'ยอด',
              key: 'amount',
              align: 'right',
              render: (_, e) => (e.amount == null ? '-' : baht(Number(e.amount))),
            },
          ]}
        />
      </div>
    </div>
  );
}
