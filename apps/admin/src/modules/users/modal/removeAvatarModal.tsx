import type { Db } from '@nightout/types';
import { Form, Input, Modal, Typography } from 'antd';
import { useState } from 'react';
import { useAdminAction } from '@/services/adminData';
import { removeUserAvatarAction } from '../api';

/** ความยาวเหตุผล (ตรงกับ RemoveUserAvatarBody และ DB admin_remove_user_avatar) */
const REASON_RULES = [
  { required: true, whitespace: true, message: 'ใส่เหตุผล 3–300 ตัวอักษร' },
  { min: 3, max: 300, message: 'ใส่เหตุผล 3–300 ตัวอักษร' },
];

/**
 * ลบรูปโปรไฟล์ไม่เหมาะสม — ต้องมีเหตุผล (เจ้าของบัญชีเห็นในแจ้งเตือน + บันทึกใน Audit Log)
 * ไฟล์ถูกลบจาก Storage · เจ้าของอัปโหลดรูปใหม่ได้
 */
export function RemoveAvatarModal({ user: target, onClose }: { user: Db.AdminUser | null; onClose: () => void }) {
  // จำบัญชีล่าสุดไว้ — ระหว่าง modal ค่อย ๆ ปิด รูป/หัวข้อไม่หายวูบ
  const [user, setUser] = useState(target);
  if (target && target !== user) setUser(target);
  const [form] = Form.useForm<{ reason: string }>();
  const act = useAdminAction();
  const saving = act.isPending;
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
        ...removeUserAvatarAction(user.id, { reason }),
        success: `ลบรูปโปรไฟล์ของ ${user.display_name} แล้ว`,
      });
      close();
    } catch {
      // useAdminAction แจ้งเหตุผลแล้ว
    }
  };

  return (
    <Modal
      open={!!target}
      title={`ลบรูปโปรไฟล์ของ ${user?.display_name ?? ''}?`}
      okText="ลบรูป"
      okButtonProps={{ danger: true }}
      cancelText="ยกเลิก"
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={() => !saving && close()}
      keyboard={!saving}
      mask={{ closable: !saving }}
      destroyOnHidden
    >
      {user?.avatar_url && (
        <img src={user.avatar_url} alt={`รูปโปรไฟล์ของ ${user.display_name}`} className="mx-auto mt-2 mb-3 size-32 rounded-full object-cover" />
      )}
      <Typography.Paragraph type="secondary" className="!mb-4">
        เจ้าของบัญชีได้รับแจ้งเตือนพร้อมเหตุผล และอัปโหลดรูปใหม่ได้ (บันทึกใน Audit Log)
      </Typography.Paragraph>
      <Form form={form} layout="vertical" disabled={saving} initialValues={{ reason: '' }} clearOnDestroy>
        <Form.Item name="reason" label="เหตุผลที่ลบรูป" rules={REASON_RULES} className="!mb-0">
          <Input.TextArea rows={3} maxLength={300} showCount placeholder="เช่น รูปมีเนื้อหาไม่เหมาะสม" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
