import type { Db } from '@nightout/types';
import { formatThaiPhone } from '@nightout/utils';
import { Form, Input, Modal, Typography } from 'antd';
import { useState } from 'react';
import { useAdminAction } from '@/services/adminData';
import { unbanUserAction } from '../api';

/** ความยาวเหตุผล (ตรงกับ UnbanUserBody และ DB admin_unban_user) */
const REASON_RULES = [
  { required: true, whitespace: true, message: 'ใส่เหตุผล 3–300 ตัวอักษร' },
  { min: 3, max: 300, message: 'ใส่เหตุผล 3–300 ตัวอักษร' },
];

/**
 * ปลดแบน (ทั้งที่แบนเองและแบนอัตโนมัติจากสลิปปลอม) — ต้องมีเหตุผล (บันทึกใน Audit Log)
 * ปลดบัญชี + ทุกเบอร์ที่ถูกแบนเพราะบัญชีนี้ + ล้างธงสลิปปลอม · เจ้าของบัญชีได้รับแจ้งเตือน
 */
export function UnbanUserModal({ user: target, onClose }: { user: Db.AdminUser | null; onClose: () => void }) {
  // จำบัญชีล่าสุดไว้ — ระหว่าง modal ค่อย ๆ ปิด หัวข้อ/ข้อความไม่หายวูบ
  const [user, setUser] = useState(target);
  if (target && target !== user) setUser(target);
  const [form] = Form.useForm<{ reason: string }>();
  const act = useAdminAction();
  const saving = act.isPending;
  // ล้างฟอร์มทุกครั้งที่ปิด — instance อยู่ตลอดหน้า /users (เหตุผลของบัญชีก่อนห้ามติดไปบัญชีถัดไป)
  const close = () => {
    form.resetFields();
    onClose();
  };

  const submit = async () => {
    if (!user) return;
    let reason: string;
    try {
      reason = (await form.validateFields()).reason.trim();
    } catch {
      return; // ฟอร์มแสดงช่องที่ผิดให้แล้ว
    }
    try {
      await act.mutateAsync({
        ...unbanUserAction(user.id, { reason }),
        success: `${user.display_name} ใช้งานได้ตามปกติแล้ว`,
      });
      close();
    } catch {
      // useAdminAction แจ้งเหตุผลแล้ว
    }
  };

  return (
    <Modal
      open={!!target}
      title={`ปลดแบน ${user?.display_name ?? ''}?`}
      okText="ปลดแบน"
      cancelText="ยกเลิก"
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={() => !saving && close()}
      keyboard={!saving}
      mask={{ closable: !saving }}
      destroyOnHidden
    >
      {user && (
        <Typography.Paragraph type="secondary" className="!mb-4 !mt-1">
          จองโต๊ะได้อีกครั้ง · ปลดเบอร์ {user.banned_phones.map(formatThaiPhone).join(', ') || '-'} · ล้างธงสลิปปลอม{' '}
          {user.fake_slip_count} ครั้ง (บันทึกใน Audit Log)
        </Typography.Paragraph>
      )}
      <Form form={form} layout="vertical" disabled={saving} initialValues={{ reason: '' }} clearOnDestroy>
        <Form.Item name="reason" label="เหตุผลที่ปลดแบน" rules={REASON_RULES} className="!mb-0">
          <Input.TextArea rows={3} maxLength={300} showCount placeholder="เช่น ตรวจสอบแล้วสลิปถูกต้อง" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
