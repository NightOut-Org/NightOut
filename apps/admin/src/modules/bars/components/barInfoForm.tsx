import { Images, Plus, Trash } from '@phosphor-icons/react';
import type { Db } from '@nightout/types';
import {
  Button,
  Form,
  Input,
  Select,
  Switch,
  Tag,
  TimePicker,
  Typography,
  type FormInstance,
} from 'antd';
import { useLayoutEffect } from 'react';
import { Link } from 'react-router';
import { DAYS, type InfoForm } from '../utils/useBarDetailsDraft';

const LINK_TYPES: { value: Db.BarLinkItem['type']; label: string; placeholder: string }[] = [
  { value: 'INSTAGRAM', label: 'Instagram', placeholder: 'https://instagram.com/…' },
  { value: 'TIKTOK', label: 'TikTok', placeholder: 'https://tiktok.com/@…' },
  { value: 'FACEBOOK', label: 'Facebook', placeholder: 'https://facebook.com/…' },
  { value: 'LINE_OA', label: 'LINE OA', placeholder: 'https://lin.ee/…' },
  { value: 'WEBSITE', label: 'เว็บไซต์', placeholder: 'https://…' },
  { value: 'REVIEW_CLIP', label: 'คลิปรีวิว', placeholder: 'https://youtube.com/…' },
];
const LINKS_MAX = 10;

/**
 * ฟอร์ม "ข้อมูลร้าน" ใน Drawer แก้ข้อมูลร้าน — ชื่อ คำอธิบาย เบอร์ สไตล์ เวลาเปิด-ปิด ลิงก์โซเชียล
 * ที่อยู่/หมุดดูอย่างเดียว (แก้ผ่านขั้นตอนตรวจตำแหน่งร้าน) · ย่าน DB หาเองจากหมุด (แก้ไม่ได้) · รูปจัดการที่ /bar-media
 * สไตล์ที่ถูกซ่อนแต่ร้านเลือกไว้ แสดงเป็นป้ายปิดใช้งาน และไม่ถูกส่ง (DB เก็บลิงก์เดิมไว้)
 */
export function BarInfoForm({
  form,
  bar,
  initialValues,
  styles,
  disabled,
  onChange,
}: {
  form: FormInstance<InfoForm>;
  bar: Db.AdminBarDetails;
  initialValues: InfoForm;
  styles: Db.AdminStyle[];
  disabled: boolean;
  onChange: (values: InfoForm) => void;
}) {
  const hiddenLinked = styles.filter((s) => !s.active && bar.style_keys.includes(s.key));

  // `form` เป็นของ Drawer (อยู่ตลอดหน้า /bars) — store เดิมชนะ initialValues ตอน Form mount ใหม่
  // ล้างเป็นค่าของร้านนี้ทุกครั้งที่ mount (เปิดร้านอื่น / เปิดซ้ำหลังทิ้งการแก้ไข) ก่อนวาดจอ
  // ไม่ใช้ clearOnDestroy: ถ้าสลับร้านใน render เดียว (key เปลี่ยน) cleanup ของ Form เก่าจะล้าง store หลังร้านใหม่ mount
  useLayoutEffect(() => {
    form.resetFields();
  }, [form]);

  return (
    <Form<InfoForm>
      form={form}
      layout="vertical"
      disabled={disabled}
      initialValues={initialValues}
      onValuesChange={(_, all) => onChange(all)}
      requiredMark={false}
    >
      <Form.Item
        name="name"
        label="ชื่อร้าน"
        rules={[{ required: true, whitespace: true, message: 'กรอกชื่อร้าน' }]}
      >
        <Input maxLength={80} showCount />
      </Form.Item>
      <Form.Item name="description" label="คำอธิบายร้าน">
        <Input.TextArea rows={3} maxLength={400} showCount />
      </Form.Item>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Form.Item name="phone" label="เบอร์โทรร้าน">
          <Input maxLength={30} inputMode="tel" placeholder="เช่น 02 123 4567" />
        </Form.Item>
        <div className="mb-6 flex min-w-0 flex-col gap-1">
          <span className="text-sm">ย่าน</span>
          <Typography.Text className="break-words">
            {bar.district?.name_th ? `ย่าน${bar.district.name_th}` : 'ไม่อยู่ในย่านไหน'}
          </Typography.Text>
          <Typography.Text type="secondary" className="text-xs">
            ระบบเลือกจากหมุดร้าน เปลี่ยนหมุดแล้วย่านเปลี่ยนตาม
          </Typography.Text>
        </div>
      </div>

      <div className="mb-6 flex min-w-0 flex-col gap-1">
        <span className="text-sm">ที่อยู่</span>
        <Typography.Text className="break-words">{bar.address || '-'}</Typography.Text>
        <Typography.Text type="secondary" className="text-xs">
          ที่อยู่และหมุดแผนที่แก้ผ่านขั้นตอนตรวจตำแหน่งร้าน (ไม่แก้ที่นี่)
        </Typography.Text>
      </div>

      <Form.Item
        name="style_keys"
        label="สไตล์ร้าน"
        extra={
          hiddenLinked.length > 0 && (
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              <span>ร้านเลือกไว้แต่ถูกซ่อนอยู่ (ไม่แสดงบนเว็บ แต่บันทึกแล้วยังอยู่):</span>
              {hiddenLinked.map((s) => (
                <Tag key={s.key} disabled className="!m-0">
                  {s.name_th} (ซ่อนอยู่)
                </Tag>
              ))}
            </span>
          )
        }
      >
        <Tag.CheckableTagGroup
          multiple
          options={styles.filter((s) => s.active).map((s) => ({ value: s.key, label: s.name_th }))}
        />
      </Form.Item>

      <Form.Item label="เวลาเปิด-ปิด" extra="รองรับปิดข้ามเที่ยงคืน เช่น 18:00–02:00" required>
        <Form.List name="hours">
          {(fields) => (
            <div className="flex flex-col gap-1.5">
              {fields.map((f, i) => (
                <div
                  key={f.key}
                  className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-black/10 px-3 py-1 dark:border-white/10"
                >
                  <span className="w-20 shrink-0 text-sm">{DAYS[i]}</span>
                  <Form.Item noStyle shouldUpdate>
                    {() =>
                      form.getFieldValue(['hours', f.name, 'closed']) ? (
                        <Typography.Text type="secondary" className="flex-1 text-sm">
                          ปิดทั้งวัน
                        </Typography.Text>
                      ) : (
                        <Form.Item
                          name={[f.name, 'range']}
                          className="!mb-0 min-w-0 flex-1"
                          rules={[{ required: true, message: 'เลือกเวลาเปิด-ปิด' }]}
                        >
                          <TimePicker.RangePicker
                            format="HH:mm"
                            minuteStep={15}
                            order={false}
                            needConfirm={false}
                            className="w-full"
                            aria-label={`เวลาเปิด-ปิด วัน${DAYS[i]}`}
                          />
                        </Form.Item>
                      )
                    }
                  </Form.Item>
                  {/* สวิตช์ = "เปิดร้าน" — ค่าในฟอร์มเป็น closed จึงกลับค่าเข้า/ออก */}
                  <Form.Item
                    name={[f.name, 'closed']}
                    noStyle
                    getValueProps={(closed: boolean) => ({ checked: !closed })}
                    normalize={(open: boolean) => !open}
                  >
                    <Switch size="small" aria-label={`เปิดร้านวัน${DAYS[i]}`} />
                  </Form.Item>
                </div>
              ))}
            </div>
          )}
        </Form.List>
      </Form.Item>

      <Form.Item label="ลิงก์โซเชียล" className="!mb-2">
        <Form.List name="links">
          {(fields, { add, remove }) => (
            <div className="flex flex-col gap-2">
              {fields.map((f) => (
                <div key={f.key} className="flex items-start gap-2">
                  <Form.Item name={[f.name, 'type']} className="!mb-0 w-32 shrink-0">
                    <Select options={LINK_TYPES} aria-label="ประเภทลิงก์" />
                  </Form.Item>
                  <Form.Item
                    name={[f.name, 'url']}
                    className="!mb-0 min-w-0 flex-1"
                    rules={[
                      { required: true, whitespace: true, message: 'ใส่ลิงก์' },
                      { type: 'url', message: 'ลิงก์ไม่ถูกต้อง' },
                      { pattern: /^https:\/\//, message: 'ลิงก์ต้องขึ้นต้นด้วย https://' },
                    ]}
                  >
                    <Input
                      placeholder={
                        LINK_TYPES.find(
                          (t) => t.value === form.getFieldValue(['links', f.name, 'type']),
                        )?.placeholder ?? 'https://…'
                      }
                      aria-label="ลิงก์"
                    />
                  </Form.Item>
                  <Button
                    icon={<Trash size={16} />}
                    aria-label="ลบลิงก์"
                    onClick={() => remove(f.name)}
                  />
                </div>
              ))}
              {fields.length < LINKS_MAX && (
                <Button
                  type="dashed"
                  icon={<Plus size={14} />}
                  className="self-start"
                  onClick={() => add({ type: 'INSTAGRAM', url: '' })}
                >
                  เพิ่มลิงก์
                </Button>
              )}
            </div>
          )}
        </Form.List>
      </Form.Item>

      <Link to={`/bar-media?bar=${bar.id}`} className="inline-flex items-center gap-1.5 text-sm">
        <Images size={16} aria-hidden /> จัดการรูปร้าน / รูปเมนูที่หน้ารูปร้าน
      </Link>
    </Form>
  );
}
