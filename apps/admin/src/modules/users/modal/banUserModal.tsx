import type { Db } from '@nightout/types';
import { Alert, Checkbox, Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { useAdminAction } from '@/services/adminData';
import { banUserAction } from '../api';
import { RuleList } from '@/ui/components/RuleList';

interface Values {
  reason: string;
  ban_phones: boolean;
}

/** ความยาวเหตุผล (ตรงกับ BanUserBody และ DB admin_ban_user) */
const REASON_RULES = [
  { required: true, whitespace: true, message: 'ใส่เหตุผล 3–300 ตัวอักษร' },
  { min: 3, max: 300, message: 'ใส่เหตุผล 3–300 ตัวอักษร' },
];

/**
 * แบนบัญชีเอง (ลูกค้า / ทีมร้าน) — ต้องมีเหตุผล (เจ้าของบัญชีเห็นในแจ้งเตือน) · เลือกแบนทุกเบอร์ที่เคยใช้ได้
 * ถูกแบน = จองโต๊ะไม่ได้ + ชุมชนอ่านได้อย่างเดียว · ไม่แตะการจองเดิม / ร้าน / ทีมร้าน
 * บันทึกไม่สำเร็จ = useAdminAction แจ้งเหตุผลแล้ว · modal ยังเปิดอยู่ให้แก้แล้วลองใหม่
 */
export function BanUserModal({
  user: target,
  onClose,
}: {
  user: Db.AdminUser | null;
  onClose: () => void;
}) {
  // จำบัญชีล่าสุดไว้ — ระหว่าง modal ค่อย ๆ ปิด หัวข้อ/ข้อความไม่หายวูบ
  const [user, setUser] = useState(target);
  if (target && target !== user) setUser(target);
  const [form] = Form.useForm<Values>();
  const act = useAdminAction();
  const saving = act.isPending;
  // ล้างฟอร์มทุกครั้งที่ปิด — instance อยู่ตลอดหน้า /users (เหตุผล/ติ๊กแบนเบอร์ของบัญชีก่อนห้ามติดไปบัญชีถัดไป)
  const close = () => {
    form.resetFields();
    onClose();
  };

  const submit = async () => {
    if (!user) return;
    let v: Values;
    try {
      v = await form.validateFields();
    } catch {
      return; // ฟอร์มแสดงช่องที่ผิดให้แล้ว
    }
    try {
      await act.mutateAsync({
        ...banUserAction(user.id, { reason: v.reason.trim(), ban_phones: !!v.ban_phones }),
        success: `แบน ${user.display_name} แล้ว`,
      });
      close();
    } catch {
      // useAdminAction แจ้งเหตุผลแล้ว
    }
  };

  return (
    <Modal
      open={!!target}
      title={`แบน ${user?.display_name ?? ''}?`}
      okText="แบนบัญชี"
      okButtonProps={{ danger: true }}
      cancelText="ยกเลิก"
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={() => !saving && close()}
      keyboard={!saving}
      mask={{ closable: !saving }}
      destroyOnHidden
    >
      <div className="flex flex-col gap-3 pt-1">
        <Alert
          type="info"
          showIcon
          title="ผลของการแบน"
          description={
            <RuleList
              rules={[
                { tone: 'warn', text: 'จองโต๊ะไม่ได้ และชุมชนอ่านได้อย่างเดียว' },
                'การจองเดิมยังอยู่',
                'เจ้าของบัญชีได้รับแจ้งเตือนพร้อมเหตุผล',
                'บันทึกใน Audit Log',
              ]}
            />
          }
        />
        {!!user?.bars.length && (
          <Alert
            type="warning"
            showIcon
            title={`บัญชีนี้อยู่ในทีมร้าน ${user.bars.map((b) => b.name).join(', ')} — การแบนไม่ระงับร้านและไม่นำออกจากทีม (ระงับร้านที่หน้าจัดการร้าน)`}
          />
        )}
        <Form
          form={form}
          layout="vertical"
          disabled={saving}
          initialValues={{ reason: '', ban_phones: false }}
          clearOnDestroy
        >
          <Form.Item name="reason" label="เหตุผล (เจ้าของบัญชีเห็นข้อความนี้)" rules={REASON_RULES}>
            <Input.TextArea
              rows={3}
              maxLength={300}
              showCount
              placeholder="เช่น โพสต์ข้อความหลอกลวงในชุมชนซ้ำหลายครั้ง"
            />
          </Form.Item>
          <Form.Item name="ban_phones" valuePropName="checked" className="!mb-0">
            <Checkbox>
              แบนทุกเบอร์ที่บัญชีนี้เคยใช้ด้วย (สมัครบัญชีใหม่ด้วยเบอร์เดิมก็จองไม่ได้)
            </Checkbox>
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
}
