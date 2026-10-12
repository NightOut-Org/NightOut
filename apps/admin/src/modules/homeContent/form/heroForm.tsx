import { ArrowCounterClockwise, Camera } from '@phosphor-icons/react';
import { App, Button, Card, Form, Input, Typography, Upload } from 'antd';
import { webSrc } from '@/ui/utils/image';
import { checkImage, IMAGE_ACCEPT } from '../utils/media';

/** ภาพตั้งต้นของ Hero (ไฟล์ใน public/ ของเว็บลูกค้า) — ใช้เมื่อ hero_image_url = null */
const DEFAULT_HERO = '/images/home/hero-night-1280.jpg';

/**
 * Hero ของหน้าแรก — ช่องกรอกในฟอร์มของหน้า (useHomePageDraft) · บันทึกด้วยปุ่มบันทึกของหน้า
 * ภาพที่เลือกพรีวิวจากเครื่อง อัปโหลดตอนกดบันทึก
 */
export function HeroForm({
  loading,
  preview,
  onPickImage,
}: {
  loading: boolean;
  /** พรีวิวภาพใหม่ที่ยังไม่อัปโหลด */
  preview: string | undefined;
  /** File = ภาพใหม่ · null = ใช้ภาพตั้งต้น */
  onPickImage: (file: File | null) => void;
}) {
  const { message } = App.useApp();
  const form = Form.useFormInstance();
  const image = Form.useWatch('hero_image_url', form) as string | null | undefined;
  const lead = Form.useWatch('hero_title_lead', form);
  const highlight = Form.useWatch('hero_title_highlight', form);
  const tail = Form.useWatch('hero_title_tail', form);
  const shown = preview ?? (image ? webSrc(image) : webSrc(DEFAULT_HERO));

  return (
    <Card title="Hero" loading={loading}>
      <Form.Item name="hero_image_url" hidden>
        <Input />
      </Form.Item>

      {/* ตัวอย่างคร่าว ๆ ของ Hero บนเว็บ */}
      <div
        className="relative mb-4 flex aspect-[16/6] items-center justify-center overflow-hidden rounded-lg bg-[#07070d] bg-cover bg-center px-4 text-center"
        style={{ backgroundImage: `url("${shown}")` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <p className="relative flex items-end gap-2 font-bold leading-none text-white">
          <span className="text-lg">{lead}</span>
          <span className="text-5xl text-[#e8b64c]">{highlight}</span>
          {tail && <span className="text-lg">{tail}</span>}
        </p>
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Upload
          accept={IMAGE_ACCEPT}
          showUploadList={false}
          beforeUpload={(f) => {
            const err = checkImage(f);
            if (err) void message.error(err);
            else onPickImage(f);
            return Upload.LIST_IGNORE;
          }}
        >
          <Button icon={<Camera size={16} />}>เปลี่ยนภาพพื้น</Button>
        </Upload>
        {(image || preview) && (
          <Button icon={<ArrowCounterClockwise size={16} />} onClick={() => onPickImage(null)}>
            ใช้ภาพตั้งต้น
          </Button>
        )}
        <Typography.Text type="secondary" className="text-xs">
          ภาพแนวนอน 16:9 โทนมืด · ระบบย่อเป็น 2560px ให้เอง (อัปโหลดตอนกดบันทึก) · ภาพตั้งต้นมีดาว/ไฟตึกระยิบ ภาพที่อัปโหลดจะเป็นภาพนิ่ง
        </Typography.Text>
      </div>

      <div className="grid gap-x-4 sm:grid-cols-3">
        <Form.Item name="hero_title_lead" label="คำหน้า" rules={[{ required: true, whitespace: true, message: 'กรอกคำหน้า' }]}>
          <Input maxLength={20} placeholder="คืนนี้ไป" />
        </Form.Item>
        <Form.Item
          name="hero_title_highlight"
          label="คำกลาง (ตัวใหญ่สีทอง)"
          rules={[{ required: true, whitespace: true, message: 'กรอกคำกลาง' }]}
        >
          <Input maxLength={20} placeholder="ร้านไหน" />
        </Form.Item>
        <Form.Item name="hero_title_tail" label="คำท้าย">
          <Input maxLength={20} placeholder="ดี (เว้นว่างได้)" />
        </Form.Item>
      </div>
      <Form.Item name="hero_subtitle" label="คำโปรยใต้หัวข้อ">
        <Input.TextArea rows={2} maxLength={160} showCount />
      </Form.Item>
      <Form.Item
        name="hero_search_placeholder"
        label="ข้อความในช่องค้นหา"
        className="!mb-0"
        rules={[{ required: true, whitespace: true, message: 'กรอกข้อความในช่องค้นหา' }]}
      >
        <Input maxLength={60} />
      </Form.Item>
    </Card>
  );
}
