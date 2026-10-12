import { Camera } from '@phosphor-icons/react';
import type { Db } from '@nightout/types';
import { App, Button, Drawer, Form, Input, Typography, Upload } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { webSrc } from '@/ui/utils/image';
import { SLOT_LABELS } from '../utils/slots';
import { checkImage, IMAGE_ACCEPT } from '../utils/media';
import type { CategoryValues } from '../utils/useHomePageDraft';

interface Current {
  values: CategoryValues;
  /** ภาพที่แสดงอยู่ (blob: = ภาพใหม่ที่ยังไม่อัปโหลด) */
  image: string;
}

/**
 * แก้การ์ดหมวด 1 ช่อง — ตำแหน่งบนกริดตายตัว แก้ได้เฉพาะเนื้อหา
 * กด "ตกลง" = เข้า draft ของหน้า (บันทึกจริงด้วยปุ่มบันทึกของหน้า) · ภาพใหม่อัปโหลดตอนบันทึก
 */
export function CategoryDrawer({
  category,
  current,
  onApply,
  onClose,
}: {
  category: Db.AdminHomeCategory | null;
  /** ค่าที่แสดงอยู่ (draft ก่อน) */
  current: Current | null;
  onApply: (values: CategoryValues, file?: File) => void;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={!!category}
      onClose={onClose}
      size={480}
      destroyOnHidden
      title={category ? `แก้การ์ด · ${SLOT_LABELS[category.slot] ?? category.slot}` : ''}
    >
      {/* key = ช่อง → เปิดการ์ดใหม่ ฟอร์ม/ภาพที่เลือกเริ่มจากค่าปัจจุบันของการ์ดนั้นเสมอ */}
      {category && current && (
        <CategoryEditor key={category.slot} current={current} onApply={onApply} onClose={onClose} />
      )}
    </Drawer>
  );
}

function CategoryEditor({
  current,
  onApply,
  onClose,
}: {
  current: Current;
  onApply: (values: CategoryValues, file?: File) => void;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<CategoryValues>();
  const [file, setFile] = useState<File | null>(null);
  const filePreview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (filePreview && URL.revokeObjectURL(filePreview)), [filePreview]);
  const image =
    filePreview ?? (current.image.startsWith('blob:') ? current.image : webSrc(current.image));

  const apply = async () => {
    let v: CategoryValues;
    try {
      v = await form.validateFields();
    } catch {
      return;
    }
    onApply(v, file ?? undefined);
    onClose();
  };

  return (
    <>
      <Form<CategoryValues> form={form} layout="vertical" initialValues={current.values}>
        <Form.Item name="image_url" hidden rules={[{ required: true, message: 'ต้องมีภาพ' }]}>
          <Input />
        </Form.Item>
        <div className="mb-6">
          <div
            className="mb-2 aspect-[16/10] w-full rounded-lg bg-[#14121c] bg-cover bg-center"
            style={{ backgroundImage: `url("${image}")` }}
            role="img"
            aria-label="ภาพพื้นการ์ด"
          />
          <Upload
            accept={IMAGE_ACCEPT}
            showUploadList={false}
            beforeUpload={(f) => {
              const err = checkImage(f);
              if (err) void message.error(err);
              else setFile(f);
              return Upload.LIST_IGNORE;
            }}
          >
            <Button icon={<Camera size={16} />}>เปลี่ยนภาพ</Button>
          </Upload>
          <Typography.Text type="secondary" className="mt-1 block text-xs">
            ภาพคน/บรรยากาศร้าน โทนมืด ตัวหนังสือสีขาวอยู่มุมล่างซ้าย · ระบบย่อเป็น 1280px ให้เอง
            (อัปโหลดตอนกดบันทึก)
          </Typography.Text>
        </div>

        <Form.Item
          name="title"
          label="ชื่อหมวด"
          rules={[{ required: true, whitespace: true, message: 'กรอกชื่อหมวด' }]}
        >
          <Input maxLength={30} />
        </Form.Item>
        <Form.Item name="hint" label="คำอธิบายสั้น">
          <Input maxLength={60} />
        </Form.Item>
        <Form.Item
          name="link_to"
          label="ลิงก์เมื่อกดการ์ด"
          extra="ลิงก์ในเว็บ เช่น /ranking, /search?category=PUB_BAR, /search?style=Rooftop"
          rules={[
            { required: true, message: 'กรอกลิงก์' },
            { pattern: /^\/(?!\/)\S*$/, message: 'ต้องขึ้นต้นด้วย / และไม่มีช่องว่าง' },
          ]}
        >
          <Input maxLength={300} />
        </Form.Item>
        <Form.Item name="badge" label="ป้ายเหนือชื่อ" extra="เว้นว่าง = ไม่มีป้าย">
          <Input maxLength={30} placeholder="เช่น อันดับประจำสัปดาห์" allowClear />
        </Form.Item>
      </Form>
      <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 border-t border-black/5 bg-(--ant-color-bg-elevated) px-6 py-3 dark:border-white/10">
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button type="primary" onClick={() => void apply()}>
          ตกลง
        </Button>
      </div>
    </>
  );
}
