import { Alert, Button, Input, Popconfirm } from 'antd';
import { useState } from 'react';
import { baht } from '@/ui/utils/format';

/**
 * บันทึกว่าคืนเงินแล้ว — เงินที่ชำระผ่านผู้ให้บริการแต่ผูกกับการจองไม่ได้ (refund_status = REQUIRED)
 * ระบบยังไม่คืนเงินอัตโนมัติ: แอดมินคืนที่หน้าระบบผู้ให้บริการก่อน แล้วค่อยบันทึกที่นี่ (ลูกค้าได้รับแจ้งเตือน)
 */
export function MarkRefundedButton({
  amount,
  loading,
  onConfirm,
}: {
  amount: number;
  loading?: boolean;
  onConfirm: (note: string, ref: string) => void;
}) {
  const [note, setNote] = useState('');
  const [ref, setRef] = useState('');
  const valid = note.trim().length >= 3;

  const reset = () => {
    setNote('');
    setRef('');
  };

  return (
    <Popconfirm
      title={`คืน ${baht(amount)} ให้ลูกค้าแล้ว?`}
      icon={null}
      description={
        <div className="mt-2 w-72 space-y-2">
          <Alert
            type="info"
            showIcon
            title="ระบบยังไม่คืนเงินอัตโนมัติ — ทำรายการคืนที่หน้าระบบผู้ให้บริการก่อน แล้วค่อยบันทึก"
          />
          <Input.TextArea
            rows={2}
            maxLength={300}
            aria-label="หมายเหตุการคืนเงิน"
            placeholder="คืนอย่างไร เช่น คืนผ่าน Dashboard ของผู้ให้บริการ"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Input
            maxLength={120}
            aria-label="เลขอ้างอิงการคืนเงิน"
            placeholder="เลขอ้างอิงการคืนเงิน (ถ้ามี)"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
          />
        </div>
      }
      okText="บันทึกว่าคืนแล้ว"
      cancelText="ยกเลิก"
      okButtonProps={{ disabled: !valid }}
      onCancel={reset}
      onConfirm={() => {
        if (!valid) return;
        onConfirm(note.trim(), ref.trim());
        reset();
      }}
    >
      <Button type="primary" loading={loading}>
        คืนเงินแล้ว
      </Button>
    </Popconfirm>
  );
}
