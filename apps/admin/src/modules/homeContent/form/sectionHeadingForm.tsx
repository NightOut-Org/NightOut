import { Form, Input } from 'antd';

/** คู่คอลัมน์หัวข้อ section ใน home_content (บรรทัดเล็ก + ชื่อ) */
export type SectionHeadingFields =
  | { eyebrow: 'categories_eyebrow'; title: 'categories_title' }
  | { eyebrow: 'popular_eyebrow'; title: 'popular_title' };

/**
 * หัวข้อของ section บนหน้าแรก (บรรทัดเล็กเหนือชื่อ + ชื่อ section) — ช่องกรอกในฟอร์มของหน้า วางไว้ใน Card ของ section นั้น
 * บันทึกด้วยปุ่มบันทึกของหน้า
 */
export function SectionHeadingForm({
  fields,
  placeholders,
}: {
  fields: SectionHeadingFields;
  placeholders: { eyebrow: string; title: string };
}) {
  return (
    <div className="mb-5 grid items-end gap-x-4 sm:grid-cols-2">
      <Form.Item name={fields.eyebrow} label="บรรทัดเล็กเหนือชื่อ" className="!mb-3 sm:!mb-0">
        <Input maxLength={40} placeholder={`${placeholders.eyebrow} (เว้นว่างได้)`} />
      </Form.Item>
      <Form.Item
        name={fields.title}
        label="ชื่อ section"
        className="!mb-3 sm:!mb-0"
        rules={[{ required: true, whitespace: true, message: 'กรอกชื่อ section' }]}
      >
        <Input maxLength={60} placeholder={placeholders.title} />
      </Form.Item>
    </div>
  );
}
