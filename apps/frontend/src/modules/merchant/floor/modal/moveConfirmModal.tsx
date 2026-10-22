import { Clock, Ticket, User } from '@phosphor-icons/react';
import type * as C from '@nightout/contracts';
import { Alert, App, Input, Modal, Typography } from 'antd';
import { useState } from 'react';
import { moveBooking } from '../api';
import { bookingWho, hhmm, type BoardTableRef } from '../utils/board';
import { InfoButton } from '@/ui/components/infoButton';
import { MetaList } from '@/ui/components/metaList';

/**
 * ยืนยันย้ายโต๊ะจากผัง (ลากวาง / แตะเพื่อย้าย) — เวลาเดิม เปลี่ยนแค่โต๊ะ · DB ตรวจซ้ำ (TABLE_TAKEN / ZONE_FULL)
 * ลูกค้าได้แจ้งเตือนว่าย้ายไปโต๊ะไหน
 */
export function MoveConfirmModal({
  booking,
  target,
  onClose,
  onDone,
}: {
  booking: C.TableBoardBooking | null;
  target: BoardTableRef | null;
  onClose: () => void;
  /** หลังย้ายสำเร็จหรือล้มเหลว — โหลดผังใหม่ */
  onDone: () => void;
}) {
  const { message } = App.useApp();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const open = !!booking && !!target;

  const close = () => {
    setReason('');
    onClose();
  };

  const submit = async () => {
    if (!booking || !target) return;
    setSaving(true);
    try {
      const r = await moveBooking(booking.id, target.zone.id, target.table.id, reason);
      message.success(`ย้ายไป ${r.zone_name}${r.table_name ? ` โต๊ะ ${r.table_name}` : ''} แล้ว — แจ้งลูกค้าให้แล้ว`);
      close();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
      onDone();
    }
  };

  return (
    <Modal
      open={open}
      rootClassName="dark"
      title="ย้ายโต๊ะ"
      okText="ย้ายโต๊ะ"
      cancelText="ยกเลิก"
      onOk={() => void submit()}
      onCancel={close}
      confirmLoading={saving}
      mask={{ closable: !saving }}
      destroyOnHidden
    >
      {booking && target && (
        <div className="space-y-4">
          <Typography.Text type="secondary" className="block text-sm">
            <MetaList
              items={[
                { icon: <User weight="fill" />, label: 'ลูกค้า', value: bookingWho(booking), strong: true },
                { icon: <Clock weight="fill" />, label: 'ช่วงเวลา', value: `${hhmm(booking.reserved_from)}–${hhmm(booking.reserved_until)}` },
                { icon: <Ticket weight="fill" />, label: 'รหัสจอง', value: booking.code },
              ]}
            />
          </Typography.Text>
          <p className="m-0 text-[15px]">
            จาก {booking.zone_name} {booking.table_name ? `โต๊ะ ${booking.table_name}` : 'ยังไม่ระบุโต๊ะ'}
            <span className="mx-1.5 text-gold" aria-label="ไปที่">
              →
            </span>
            <b>
              {target.zone.name} โต๊ะ {target.table.name}
            </b>
          </p>
          {target.table.seats < booking.pax && (
            <Alert
              type="warning"
              showIcon
              title={`โต๊ะนี้ ${target.table.seats} ที่นั่ง น้อยกว่าจำนวนคน (${booking.pax})`}
            />
          )}
          {target.zone.id !== booking.zone_id && (
            <div>
              <InfoButton label="ย้ายข้ามโซน">ระบบตรวจที่ว่างในโซนปลายทางให้</InfoButton>
            </div>
          )}
          <div>
            <label htmlFor="floor-move-reason" className="mb-1.5 block text-sm font-medium">
              เหตุผล (ไม่บังคับ)
            </label>
            <Input
              id="floor-move-reason"
              placeholder="เช่น ลูกค้ามาเพิ่ม หรือแอร์โต๊ะเดิมเสีย"
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="!text-base"
            />
          </div>
          <p className="m-0 text-xs text-muted">ลูกค้าจะได้รับแจ้งเตือนว่าย้ายไปโต๊ะไหน</p>
        </div>
      )}
    </Modal>
  );
}
