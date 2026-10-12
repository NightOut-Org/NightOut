import { Input, Popconfirm, Switch } from 'antd';
import { useState } from 'react';

/**
 * สวิตช์ "แสดง" ของร้าน — เปิด = APPROVED (ขึ้นเว็บ) · ปิด = SUSPENDED (ซ่อน)
 * แก้ใน draft ของหน้าเท่านั้น (บันทึกด้วยปุ่มบันทึกของหน้า) · ปิดต้องใส่เหตุผลก่อน (ร้านเห็นข้อความนี้ และลง audit log)
 */
export function ShowSwitch({
  name,
  shown,
  disabled,
  askReason,
  onChange,
}: {
  name: string;
  /** ค่าที่แสดงอยู่ (draft ถ้ามี ไม่งั้นค่าจาก server) */
  shown: boolean;
  disabled: boolean;
  /** ปิดแล้วต้องถามเหตุผลไหม (false = ปิดกลับเป็นค่าเดิมที่ระงับอยู่แล้ว) */
  askReason: boolean;
  onChange: (shown: boolean, reason?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const hide = () => {
    onChange(false, reason.trim());
    setOpen(false);
    setReason('');
  };

  return (
    <Popconfirm
      open={open}
      onOpenChange={(v) => !v && setOpen(false)}
      title={`ซ่อน ${name}? (มีผลเมื่อกดบันทึก)`}
      description={
        <Input.TextArea
          className="!mt-2 !w-64"
          rows={2}
          maxLength={500}
          placeholder="เหตุผล (ร้านจะเห็นข้อความนี้)…"
          aria-label="เหตุผลที่ซ่อนร้าน"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      }
      okText="ซ่อนร้าน"
      cancelText="ยกเลิก"
      okButtonProps={{ danger: true, disabled: !reason.trim() }}
      onConfirm={hide}
    >
      <Switch
        checked={shown}
        disabled={disabled}
        aria-label={`แสดง ${name} บนเว็บ`}
        onChange={(next) => (next || !askReason ? onChange(next) : setOpen(true))}
      />
    </Popconfirm>
  );
}
