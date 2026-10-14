import type { Db } from '@nightout/types';
import { Table, Typography } from 'antd';
import { baht, dateTime } from '@/ui/utils/format';

/** webhook ที่ได้รับของรายการชำระ 1 รายการ (แถวที่กางออก · view ส่งมาใหม่สุดก่อนสูงสุด 20) */
export function PaymentEvents({ events }: { events: Db.PaymentEventRow[] }) {
  return (
    <div className="py-1">
      <Typography.Text strong className="mb-2 block">
        Webhook ที่ได้รับ (ล่าสุด 20 รายการ)
      </Typography.Text>
      <Table<Db.PaymentEventRow>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={events}
        columns={[
          { title: 'เวลา', key: 'at', render: (_, e) => dateTime(e.received_at) },
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
  );
}
