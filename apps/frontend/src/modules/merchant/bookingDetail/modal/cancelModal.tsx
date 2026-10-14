import { App, Alert, Modal, Typography } from 'antd';
import { useState } from 'react';
import { type Booking } from '@/services/data';
import { reportNoTable, setBookingStatus } from '../api';
import { ReasonPicker } from '../components/reasonPicker';
import {
  isReasonValid,
  noTableDoneText,
  reasonText,
  type MerchantCancelReason,
} from '../utils/cancelReasons';

/** เหตุผลยกเลิก (TeamBookingStatusBody.reason) ยาวได้ 200 ตัวอักษร */
const CANCEL_REASON_MAX = 200;

/**
 * ยกเลิกการจองฝั่งร้าน (ยืนยันแล้ว → ร้านยกเลิก · เจ้าของ/ผู้จัดการ) — ต้องเลือกเหตุผล
 * เหตุ "ร้านไม่มีโต๊ะให้ลูกค้า" → reportNoTable: คืน Table Fee เต็ม + บันทึกประวัติร้าน + แจ้งทีม NightOut
 */
export function CancelModal({
  booking,
  onClose,
}: {
  booking: Booking | null;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const [reason, setReason] = useState<MerchantCancelReason>();
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);
  const valid = isReasonValid(reason, detail);

  const close = () => {
    setReason(undefined);
    setDetail('');
    onClose();
  };

  const submit = async () => {
    if (!booking || !isReasonValid(reason, detail)) return;
    setSaving(true);
    try {
      if (reason === 'NO_TABLE') {
        message.success(noTableDoneText(await reportNoTable(booking.id, detail)));
      } else {
        await setBookingStatus(booking.id, 'CANCELLED_BY_MERCHANT', reasonText(reason, detail));
        message.success('ยกเลิกการจองแล้ว — แจ้งลูกค้าแล้ว');
      }
      close();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!booking}
      title="ยกเลิกการจองฝั่งร้าน"
      okText="ยกเลิกการจอง"
      cancelText="ไม่ยกเลิก"
      onOk={() => void submit()}
      onCancel={close}
      confirmLoading={saving}
      okButtonProps={{ danger: true, disabled: !valid }}
      mask={{ closable: !saving }}
      destroyOnHidden
    >
      {booking && (
        <div className="space-y-4">
          <Typography.Text type="secondary" className="block text-sm">
            {booking.code} · {booking.userName} · {booking.pax} คน
          </Typography.Text>
          <Alert
            type="warning"
            showIcon
            title="ลูกค้าจะได้รับแจ้งทันที · Table Fee ที่จ่ายแล้วเข้าคิวคืนลูกค้าเต็มจำนวน (NightOut โอนคืน) · ทำแล้วย้อนกลับไม่ได้"
          />
          <ReasonPicker
            value={reason}
            detail={detail}
            onChange={setReason}
            onDetail={setDetail}
            allowNoTable={booking.status === 'CONFIRMED'}
            limit={CANCEL_REASON_MAX}
          />
        </div>
      )}
    </Modal>
  );
}
