import type * as C from '@nightout/contracts';
import { Descriptions, Drawer, Empty } from 'antd';
import { StatusTag } from '@/ui/components/StatusTag';
import { BOOKING_STATUS } from '@/ui/utils/labels';
import { PR_LABEL, STATUS_META, hhmm } from '../utils/board';

/** รายละเอียดโต๊ะ + การจองคืนนี้ของโต๊ะ (ดูอย่างเดียว · ไม่มียอดเงิน/เบอร์โทร) */
export function TableDrawer({
  table,
  bookings,
  onClose,
}: {
  table: C.TableBoardTable | null;
  bookings: C.TableBoardBooking[];
  onClose: () => void;
}) {
  const meta = table ? STATUS_META[table.status] : null;
  return (
    <Drawer
      open={!!table}
      onClose={onClose}
      size={440}
      destroyOnHidden
      title={table ? `โต๊ะ ${table.name} (${table.seats} ที่นั่ง)` : ''}
    >
      {table && meta && (
        <div className="flex flex-col gap-4">
          <p className="m-0 flex items-center gap-2 text-sm">
            <span
              className="size-2.5 rounded-full"
              style={{ background: meta.color }}
              aria-hidden
            />
            <span className="font-medium">{meta.label}</span>
            {table.status_source === 'MANUAL' && (
              <span className="opacity-70">(ทีมร้านตั้งเอง — ไม่มีการจอง)</span>
            )}
          </p>
          {table.occupancy && (
            <Descriptions
              size="small"
              column={1}
              bordered
              items={[
                {
                  key: 'start',
                  label: 'ตั้งกำลังใช้เมื่อ',
                  children: hhmm(table.occupancy.started_at),
                },
                { key: 'by', label: 'โดย', children: table.occupancy.started_by_name ?? '-' },
                { key: 'pax', label: 'จำนวนคน', children: table.occupancy.pax ?? '-' },
                { key: 'note', label: 'หมายเหตุ', children: table.occupancy.note ?? '-' },
              ]}
            />
          )}
          <h4 className="m-0 text-sm font-semibold">การจองคืนนี้ ({bookings.length})</h4>
          {bookings.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีการจองที่โต๊ะนี้คืนนี้" />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {bookings.map((b) => (
                <li
                  key={b.id}
                  className={`flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm ${
                    b.id === table.current_booking_id
                      ? 'border-(--gold)'
                      : 'border-black/10 dark:border-white/10'
                  }`}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs opacity-70">{b.code}</span>
                    <span className="tabular-nums">
                      {hhmm(b.reserved_from)}–{hhmm(b.completed_at ?? b.reserved_until)}
                    </span>
                    <StatusTag map={BOOKING_STATUS} value={b.status} />
                  </span>
                  <span>
                    {b.customer_name ?? 'ลูกค้า'} ({b.pax} คน)
                    {b.request_pr && ` ขอ ${PR_LABEL[b.request_pr]}`}
                  </span>
                  {b.checked_in_at && (
                    <span className="text-xs opacity-70">เช็กอิน {hhmm(b.checked_in_at)}</span>
                  )}
                  {b.extended_at && (
                    <span className="text-xs opacity-70">
                      ต่อเวลาแล้ว ปลดโต๊ะ {hhmm(b.auto_cancel_at)}
                    </span>
                  )}
                  {b.promotion_title && (
                    <span className="text-xs opacity-70">โปร: {b.promotion_title}</span>
                  )}
                  {b.customer_note && (
                    <span className="text-xs opacity-70">โน้ต: {b.customer_note}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Drawer>
  );
}
