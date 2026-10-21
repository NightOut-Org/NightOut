import { Ticket, User, UsersThree } from '@phosphor-icons/react';
import { App, Alert, Modal, Typography } from 'antd';
import { useState } from 'react';
import { type Booking } from '@/services/data';
import { refundDeposit, reportNoTable } from '../api';
import { ReasonPicker } from '../components/reasonPicker';
import { isReasonValid, noTableDoneText, reasonText, type MerchantCancelReason } from '../utils/cancelReasons';
import { baht } from '@/ui/utils/format';
import { MetaList } from '@/ui/components/metaList';

/** มัดจำที่ร้านอนุมัติคืนได้: ตรวจสลิปแล้ว และยังไม่โอนให้ร้าน */
export const canRefund = (b: Booking) =>
  b.deposit?.status === 'VERIFIED' && (b.deposit.settlement === 'HELD' || b.deposit.settlement === 'PAYOUT_PENDING');

/**
 * ยืนยันการคืนเงินมัดจำ — ร้านอนุมัติ → NightOut โอนคืนลูกค้า (เงินอยู่ที่ NightOut ร้านไม่ต้องโอนเอง)
 * การจองที่ยังไม่เช็กอินจะถูกยกเลิกฝั่งร้านและปล่อยโต๊ะ · ทีมร้านทุกบทบาทใช้ได้
 * เหตุ "ร้านไม่มีโต๊ะให้ลูกค้า" (ยืนยันแล้ว / เช็กอินแล้ว) → reportNoTable: คืนเต็ม + บันทึกประวัติร้าน + แจ้งทีม NightOut
 */
export function RefundModal({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const { message } = App.useApp();
  const [reason, setReason] = useState<MerchantCancelReason>();
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);
  const cancels = booking?.status === 'CONFIRMED' || booking?.status === 'PENDING';
  const allowNoTable = booking?.status === 'CONFIRMED' || booking?.status === 'CHECKED_IN';
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
        const r = await refundDeposit(booking.id, reasonText(reason, detail));
        message.success(`ยืนยันคืน Table Fee ${baht(r.amount)} แล้ว — NightOut จะโอนคืนลูกค้า`);
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
      title="ยืนยันการคืน Table Fee"
      okText={booking?.deposit ? `ยืนยันคืน ${baht(booking.deposit.amount)}` : 'ยืนยันคืนเงิน'}
      cancelText="ยกเลิก"
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
            <MetaList
              items={[
                { icon: <User weight="fill" />, label: 'ลูกค้า', value: booking.userName, strong: true },
                { icon: <UsersThree weight="fill" />, label: 'จำนวนคน', value: `${booking.pax} คน` },
                { icon: <Ticket weight="fill" />, label: 'รหัสจอง', value: booking.code },
              ]}
            />
          </Typography.Text>
          <Alert
            type="warning"
            showIcon
            title={cancels ? 'การจองนี้จะถูกยกเลิกและปล่อยโต๊ะ' : 'สถานะการจองคงเดิม'}
            description={`Table Fee ${baht(booking.deposit?.amount ?? 0)} จะไม่ถูกโอนให้ร้าน NightOut จะโอนคืนลูกค้าโดยตรง และแจ้งลูกค้าให้ทันที และทำแล้วย้อนกลับไม่ได้`}
          />
          <ReasonPicker
            value={reason}
            detail={detail}
            onChange={setReason}
            onDetail={setDetail}
            allowNoTable={allowNoTable}
          />
        </div>
      )}
    </Modal>
  );
}
